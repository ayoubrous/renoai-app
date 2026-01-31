import { jest } from '@jest/globals';

// Mock the logger before importing the module under test
jest.unstable_mockModule('../../../server/middleware/logger.js', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    child: () => ({
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn()
    })
  },
}));

// Import after mocking
const { logger } = await import('../../../server/middleware/logger.js');
const {
  APIError,
  errors,
  createError,
  notFoundHandler,
  errorHandler,
  asyncHandler
} = await import('../../../server/middleware/errorHandler.js');

// Import test utilities
const { mockReq, mockRes, mockNext } = await import('../helpers/testUtils.js');

describe('APIError', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should create APIError with all properties', () => {
    const error = new APIError('Test error', 400, 'TEST_ERROR', { field: 'email' });

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(APIError);
    expect(error.message).toBe('Test error');
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('TEST_ERROR');
    expect(error.details).toEqual({ field: 'email' });
    expect(error.isOperational).toBe(true);
  });

  test('should use default values when not provided', () => {
    const error = new APIError('Test error');

    expect(error.statusCode).toBe(500);
    expect(error.code).toBe('INTERNAL_ERROR');
    expect(error.details).toBe(null);
    expect(error.isOperational).toBe(true);
  });

  test('should have stack trace', () => {
    const error = new APIError('Test error', 400, 'TEST_ERROR');

    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('Test error');
  });

  test('should capture stack trace at constructor', () => {
    const error = new APIError('Test error');
    const stackLines = error.stack.split('\n');

    expect(stackLines[0]).toContain('Error: Test error');
    expect(error.stack).not.toContain('APIError.constructor');
  });
});

describe('Predefined errors', () => {
  test('should have UNAUTHORIZED error', () => {
    expect(errors.UNAUTHORIZED).toBeInstanceOf(APIError);
    expect(errors.UNAUTHORIZED.statusCode).toBe(401);
    expect(errors.UNAUTHORIZED.code).toBe('UNAUTHORIZED');
  });

  test('should have INVALID_CREDENTIALS error', () => {
    expect(errors.INVALID_CREDENTIALS).toBeInstanceOf(APIError);
    expect(errors.INVALID_CREDENTIALS.statusCode).toBe(401);
    expect(errors.INVALID_CREDENTIALS.code).toBe('INVALID_CREDENTIALS');
  });

  test('should have NOT_FOUND error', () => {
    expect(errors.NOT_FOUND).toBeInstanceOf(APIError);
    expect(errors.NOT_FOUND.statusCode).toBe(404);
    expect(errors.NOT_FOUND.code).toBe('NOT_FOUND');
  });

  test('should have VALIDATION_ERROR error', () => {
    expect(errors.VALIDATION_ERROR).toBeInstanceOf(APIError);
    expect(errors.VALIDATION_ERROR.statusCode).toBe(400);
    expect(errors.VALIDATION_ERROR.code).toBe('VALIDATION_ERROR');
  });

  test('should have EMAIL_EXISTS error', () => {
    expect(errors.EMAIL_EXISTS).toBeInstanceOf(APIError);
    expect(errors.EMAIL_EXISTS.statusCode).toBe(409);
    expect(errors.EMAIL_EXISTS.code).toBe('EMAIL_EXISTS');
  });
});

describe('createError', () => {
  test('should create custom error with all parameters', () => {
    const error = createError('Custom error', 418, 'CUSTOM_CODE', { foo: 'bar' });

    expect(error).toBeInstanceOf(APIError);
    expect(error.message).toBe('Custom error');
    expect(error.statusCode).toBe(418);
    expect(error.code).toBe('CUSTOM_CODE');
    expect(error.details).toEqual({ foo: 'bar' });
  });

  test('should create error without details', () => {
    const error = createError('Custom error', 400, 'BAD_REQUEST');

    expect(error.details).toBe(null);
  });
});

describe('notFoundHandler', () => {
  test('should create 404 error with method and URL', () => {
    const req = mockReq({ method: 'GET', originalUrl: '/api/unknown' });
    const next = mockNext();

    notFoundHandler(req, null, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = next.mock.calls[0][0];
    expect(error).toBeInstanceOf(APIError);
    expect(error.message).toBe('Route non trouvée: GET /api/unknown');
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe('ROUTE_NOT_FOUND');
  });

  test('should handle POST request', () => {
    const req = mockReq({ method: 'POST', originalUrl: '/api/invalid/route' });
    const next = mockNext();

    notFoundHandler(req, null, next);

    const error = next.mock.calls[0][0];
    expect(error.message).toContain('POST');
    expect(error.message).toContain('/api/invalid/route');
  });
});

describe('errorHandler', () => {
  let originalEnv;

  beforeEach(() => {
    jest.clearAllMocks();
    originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  test('should handle default error with 500 status', () => {
    const req = mockReq({ method: 'GET', originalUrl: '/api/test' });
    const res = mockRes();
    const next = mockNext();
    const error = new Error('Something went wrong');

    errorHandler(error, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'INTERNAL_ERROR',
          message: 'Something went wrong',
          stack: expect.any(String)
        }),
        timestamp: expect.any(String),
        path: '/api/test'
      })
    );
    expect(logger.error).toHaveBeenCalledWith('Server Error', expect.any(Object));
  });

  test('should handle APIError correctly', () => {
    const req = mockReq({ method: 'POST', originalUrl: '/api/users' });
    const res = mockRes();
    const error = new APIError('User not found', 404, 'USER_NOT_FOUND', { userId: 123 });

    errorHandler(error, req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'USER_NOT_FOUND',
          message: 'User not found',
          details: { userId: 123 },
          stack: expect.any(String)
        })
      })
    );
    expect(logger.warn).toHaveBeenCalledWith('Client Error', expect.any(Object));
  });

  test('should handle express-validator errors', () => {
    const req = mockReq();
    const res = mockRes();
    const error = {
      array: jest.fn(() => [
        { field: 'email', msg: 'Invalid email', value: 'bad-email' },
        { field: 'password', msg: 'Too short', value: '123' }
      ])
    };

    errorHandler(error, req, res);

    expect(error.array).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'VALIDATION_ERROR',
          message: 'Erreur de validation',
          details: expect.arrayContaining([
            { field: 'email', msg: 'Invalid email', value: 'bad-email' },
            { field: 'password', msg: 'Too short', value: '123' }
          ])
        })
      })
    );
    // Logger is called before error reclassification, so initial statusCode (500) triggers logger.error
    expect(logger.error).toHaveBeenCalled();
  });

  test('should handle Multer LIMIT_FILE_SIZE error', () => {
    const req = mockReq();
    const res = mockRes();
    const error = { code: 'LIMIT_FILE_SIZE', message: 'File too large' };

    errorHandler(error, req, res);

    expect(res.status).toHaveBeenCalledWith(413);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'FILE_TOO_LARGE',
          message: 'Le fichier dépasse la taille maximale autorisée (10 MB)'
        })
      })
    );
  });

  test('should handle Multer LIMIT_UNEXPECTED_FILE error', () => {
    const req = mockReq();
    const res = mockRes();
    const error = { code: 'LIMIT_UNEXPECTED_FILE', message: 'Unexpected field' };

    errorHandler(error, req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'INVALID_FILE_FIELD',
          message: 'Champ de fichier inattendu'
        })
      })
    );
  });

  test('should handle JsonWebTokenError', () => {
    const req = mockReq();
    const res = mockRes();
    const error = { name: 'JsonWebTokenError', message: 'jwt malformed' };

    errorHandler(error, req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'TOKEN_INVALID',
          message: 'Token invalide'
        })
      })
    );
    // Logger is called before error reclassification, so initial statusCode (500) triggers logger.error
    expect(logger.error).toHaveBeenCalled();
  });

  test('should handle TokenExpiredError', () => {
    const req = mockReq();
    const res = mockRes();
    const error = { name: 'TokenExpiredError', message: 'jwt expired', expiredAt: new Date() };

    errorHandler(error, req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'TOKEN_EXPIRED',
          message: 'Token expiré'
        })
      })
    );
  });

  test('should handle SQLITE_CONSTRAINT error', () => {
    const req = mockReq();
    const res = mockRes();
    const error = { code: 'SQLITE_CONSTRAINT', message: 'FOREIGN KEY constraint failed' };

    errorHandler(error, req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'CONSTRAINT_VIOLATION',
          message: 'Violation de contrainte de base de données'
        })
      })
    );
  });

  test('should handle SQLITE_CONSTRAINT with UNIQUE violation', () => {
    const req = mockReq();
    const res = mockRes();
    const error = { code: 'SQLITE_CONSTRAINT', message: 'UNIQUE constraint failed: users.email' };

    errorHandler(error, req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'CONSTRAINT_VIOLATION',
          message: 'Cette valeur existe déjà'
        })
      })
    );
  });

  test('should mask error details in production for 500+ errors', () => {
    process.env.NODE_ENV = 'production';
    const req = mockReq();
    const res = mockRes();
    const error = new APIError('Database connection failed', 500, 'DATABASE_ERROR', { host: 'localhost' });

    errorHandler(error, req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'DATABASE_ERROR',
          message: 'Une erreur est survenue, veuillez réessayer plus tard'
        })
      })
    );
    const jsonCall = res.json.mock.calls[0][0];
    expect(jsonCall.error.details).toBeUndefined();
    expect(jsonCall.error.stack).toBeUndefined();
  });

  test('should not mask 400-level errors in production', () => {
    process.env.NODE_ENV = 'production';
    const req = mockReq();
    const res = mockRes();
    const error = new APIError('Invalid email', 400, 'VALIDATION_ERROR', { field: 'email' });

    errorHandler(error, req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          message: 'Invalid email',
          details: { field: 'email' }
        })
      })
    );
  });

  test('should include stack trace in development mode', () => {
    process.env.NODE_ENV = 'development';
    const req = mockReq();
    const res = mockRes();
    const error = new Error('Test error');

    errorHandler(error, req, res);

    const jsonCall = res.json.mock.calls[0][0];
    expect(jsonCall.error.stack).toBeDefined();
    expect(jsonCall.error.stack).toContain('Error: Test error');
  });

  test('should log errors with request context', () => {
    const req = mockReq({
      method: 'POST',
      originalUrl: '/api/test',
      user: { id: 42 },
      ip: '192.168.1.1'
    });
    const res = mockRes();
    const error = new APIError('Test error', 500);

    errorHandler(error, req, res);

    expect(logger.error).toHaveBeenCalledWith('Server Error', expect.objectContaining({
      timestamp: expect.any(String),
      method: 'POST',
      url: '/api/test',
      statusCode: 500,
      userId: 42,
      ip: '192.168.1.1',
      userAgent: 'TestAgent'
    }));
  });

  test('should handle missing user in request', () => {
    const req = mockReq({ user: undefined });
    const res = mockRes();
    const error = new Error('Test');

    errorHandler(error, req, res);

    expect(logger.error).toHaveBeenCalledWith('Server Error', expect.objectContaining({
      userId: undefined
    }));
  });
});

describe('asyncHandler', () => {
  test('should call async function and pass result', async () => {
    const req = mockReq();
    const res = mockRes();
    const next = mockNext();
    const asyncFn = jest.fn(async (req, res) => {
      res.json({ success: true });
    });

    const wrapped = asyncHandler(asyncFn);
    await wrapped(req, res, next);

    expect(asyncFn).toHaveBeenCalledWith(req, res, next);
    expect(next).not.toHaveBeenCalled();
  });

  test('should catch async errors and pass to next', async () => {
    const req = mockReq();
    const res = mockRes();
    const next = mockNext();
    const error = new Error('Async error');
    const asyncFn = jest.fn(async () => {
      throw error;
    });

    const wrapped = asyncHandler(asyncFn);
    await wrapped(req, res, next);

    expect(asyncFn).toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(error);
  });

  test('should handle rejected promises', async () => {
    const req = mockReq();
    const res = mockRes();
    const next = mockNext();
    const error = new APIError('Promise rejected', 400);
    const asyncFn = jest.fn(() => Promise.reject(error));

    const wrapped = asyncHandler(asyncFn);
    await wrapped(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });

  test('should handle synchronous errors in async function', async () => {
    const req = mockReq();
    const res = mockRes();
    const next = mockNext();
    const error = new Error('Sync error in async');
    // Use an async function that throws - Promise.resolve wraps the async result
    const asyncFn = jest.fn(async () => {
      throw error;
    });

    const wrapped = asyncHandler(asyncFn);
    await wrapped(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});
