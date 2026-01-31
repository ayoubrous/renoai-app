/**
 * Tests — auth middleware
 * Comportement : authentification JWT, contrôle de rôle, ownership, rate limiting
 */

import { jest } from '@jest/globals';

// Mock jsonwebtoken
const mockVerify = jest.fn();
const mockSign = jest.fn();
const mockDecode = jest.fn();
jest.unstable_mockModule('jsonwebtoken', () => ({
  default: {
    verify: mockVerify,
    sign: mockSign,
    decode: mockDecode,
  },
}));

// Mock database
const mockGet = jest.fn();
const mockPrepare = jest.fn(() => ({ get: mockGet }));
jest.unstable_mockModule('../../../server/config/database.js', () => ({
  getDatabase: () => ({ prepare: mockPrepare }),
}));

// Set required env var before importing auth module
process.env.JWT_SECRET = 'test-secret-key-for-jest';

// Mock errorHandler (APIError n'est pas réellement utilisée dans ce middleware)
jest.unstable_mockModule('../../../server/middleware/errorHandler.js', () => ({
  APIError: class APIError extends Error {
    constructor(msg, status, code) {
      super(msg);
      this.statusCode = status;
      this.code = code;
    }
  },
}));

const {
  authenticateToken,
  optionalAuth,
  requireRole,
  generateTokens,
  verifyToken,
  decodeToken,
  requireOwnership,
  userRateLimit,
} = await import('../../../server/middleware/auth.js');

// Helpers
function mockReq(overrides = {}) {
  return {
    headers: {},
    params: {},
    user: null,
    path: '/test',
    get: jest.fn(() => 'test-agent'),
    ip: '127.0.0.1',
    ...overrides,
  };
}

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

const next = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
});

// ========================================
// authenticateToken
// ========================================

describe('authenticateToken', () => {
  test('injecte un utilisateur démo si aucun token en mode development', () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const req = mockReq();
    authenticateToken(req, mockRes(), next);

    expect(req.user.id).toBe('demo-user');
    expect(next).toHaveBeenCalled();
    process.env.NODE_ENV = origEnv;
  });

  test('retourne 401 si aucun token en mode production', () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const req = mockReq();
    const res = mockRes();
    authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
    process.env.NODE_ENV = origEnv;
  });

  test('authentifie un utilisateur avec un token valide', () => {
    mockVerify.mockReturnValue({ userId: '123' });
    mockGet.mockReturnValue({ id: '123', email: 'test@test.lu', role: 'user', status: 'active' });

    const req = mockReq({ headers: { authorization: 'Bearer valid-token' } });
    authenticateToken(req, mockRes(), next);

    expect(req.user.id).toBe('123');
    expect(next).toHaveBeenCalled();
  });

  test('retourne 401 si l\'utilisateur n\'existe pas en base', () => {
    mockVerify.mockReturnValue({ userId: 'unknown' });
    mockGet.mockReturnValue(undefined);

    const req = mockReq({ headers: { authorization: 'Bearer valid-token' } });
    const res = mockRes();
    authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    );
  });

  test('retourne 403 si le compte est suspendu', () => {
    mockVerify.mockReturnValue({ userId: '1' });
    mockGet.mockReturnValue({ id: '1', status: 'suspended' });

    const req = mockReq({ headers: { authorization: 'Bearer token' } });
    const res = mockRes();
    authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('retourne 401 pour un token expiré', () => {
    const expiredError = new Error('jwt expired');
    expiredError.name = 'TokenExpiredError';
    mockVerify.mockImplementation(() => { throw expiredError; });

    const req = mockReq({ headers: { authorization: 'Bearer expired' } });
    const res = mockRes();
    authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'TOKEN_EXPIRED' }),
      })
    );
  });

  test('retourne 401 pour un token invalide (JsonWebTokenError)', () => {
    const jwtError = new Error('invalid token');
    jwtError.name = 'JsonWebTokenError';
    mockVerify.mockImplementation(() => { throw jwtError; });

    const req = mockReq({ headers: { authorization: 'Bearer bad' } });
    const res = mockRes();
    authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'TOKEN_INVALID' }),
      })
    );
  });
});

// ========================================
// optionalAuth
// ========================================

describe('optionalAuth', () => {
  test('continue sans utilisateur si pas de token', () => {
    const req = mockReq();
    optionalAuth(req, mockRes(), next);
    expect(req.user).toBeNull();
    expect(next).toHaveBeenCalled();
  });

  test('enrichit la requête avec l\'utilisateur si token valide', () => {
    mockVerify.mockReturnValue({ userId: '42' });
    mockGet.mockReturnValue({ id: '42', email: 'a@b.lu', role: 'user', status: 'active' });

    const req = mockReq({ headers: { authorization: 'Bearer good' } });
    optionalAuth(req, mockRes(), next);

    expect(req.user.id).toBe('42');
    expect(next).toHaveBeenCalled();
  });

  test('ignore silencieusement un token invalide', () => {
    mockVerify.mockImplementation(() => { throw new Error('bad'); });

    const req = mockReq({ headers: { authorization: 'Bearer bad' } });
    optionalAuth(req, mockRes(), next);

    expect(req.user).toBeNull();
    expect(next).toHaveBeenCalled();
  });
});

// ========================================
// requireRole
// ========================================

describe('requireRole', () => {
  test('autorise un utilisateur avec le bon rôle', () => {
    const middleware = requireRole('admin');
    const req = mockReq({ user: { role: 'admin' } });
    middleware(req, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  test('refuse un utilisateur sans le bon rôle (403)', () => {
    const middleware = requireRole('admin');
    const req = mockReq({ user: { role: 'user' } });
    const res = mockRes();
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('retourne 401 si pas d\'utilisateur', () => {
    const middleware = requireRole('admin');
    const req = mockReq({ user: null });
    const res = mockRes();
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('accepte un tableau de rôles', () => {
    const middleware = requireRole(['admin', 'moderator']);
    const req = mockReq({ user: { role: 'moderator' } });
    middleware(req, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });
});

// ========================================
// generateTokens
// ========================================

describe('generateTokens', () => {
  test('génère un accessToken et un refreshToken', () => {
    mockSign.mockReturnValueOnce('access-123').mockReturnValueOnce('refresh-456');

    const result = generateTokens({ userId: '1', email: 'a@b.lu', role: 'user' });
    expect(result.accessToken).toBe('access-123');
    expect(result.refreshToken).toBe('refresh-456');
    expect(result).toHaveProperty('expiresIn');
    expect(mockSign).toHaveBeenCalledTimes(2);
  });
});

// ========================================
// verifyToken / decodeToken
// ========================================

describe('verifyToken', () => {
  test('retourne le payload décodé si le token est valide', () => {
    mockVerify.mockReturnValue({ userId: '1' });
    expect(verifyToken('good')).toEqual({ userId: '1' });
  });

  test('retourne null si le token est invalide', () => {
    mockVerify.mockImplementation(() => { throw new Error(); });
    expect(verifyToken('bad')).toBeNull();
  });
});

describe('decodeToken', () => {
  test('décode un token sans vérification', () => {
    mockDecode.mockReturnValue({ userId: '1' });
    expect(decodeToken('any')).toEqual({ userId: '1' });
  });
});

// ========================================
// requireOwnership
// ========================================

describe('requireOwnership', () => {
  test('autorise l\'admin sans vérifier la propriété', async () => {
    const middleware = requireOwnership('id', 'projects');
    const req = mockReq({ user: { id: '1', role: 'admin' }, params: { id: '99' } });
    await middleware(req, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  test('autorise le propriétaire de la ressource', async () => {
    mockGet.mockReturnValue({ user_id: '42' });
    const middleware = requireOwnership('id', 'projects');
    const req = mockReq({ user: { id: '42', role: 'user' }, params: { id: '1' } });
    await middleware(req, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });

  test('refuse 403 si l\'utilisateur n\'est pas propriétaire', async () => {
    mockGet.mockReturnValue({ user_id: '99' });
    const middleware = requireOwnership('id', 'projects');
    const req = mockReq({ user: { id: '42', role: 'user' }, params: { id: '1' } });
    const res = mockRes();
    await middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('retourne 404 si la ressource n\'existe pas', async () => {
    mockGet.mockReturnValue(undefined);
    const middleware = requireOwnership('id', 'projects');
    const req = mockReq({ user: { id: '42', role: 'user' }, params: { id: 'nonexistent' } });
    const res = mockRes();
    await middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('retourne 401 si pas d\'utilisateur', async () => {
    const middleware = requireOwnership('id', 'projects');
    const req = mockReq({ user: null, params: { id: '1' } });
    const res = mockRes();
    await middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

// ========================================
// userRateLimit
// ========================================

describe('userRateLimit', () => {
  test('laisse passer les requêtes sous la limite', () => {
    const middleware = userRateLimit(5, 60000);
    const req = mockReq({ user: { id: 'rate-test' }, path: '/rate-unique' });
    const res = mockRes();

    for (let i = 0; i < 5; i++) {
      next.mockClear();
      middleware(req, res, next);
      expect(next).toHaveBeenCalled();
    }
  });

  test('bloque après le maximum de requêtes (429)', () => {
    const middleware = userRateLimit(2, 60000);
    const req = mockReq({ user: { id: 'rate-block' }, path: '/rate-block-path' });
    const res = mockRes();

    middleware(req, res, next); // 1
    middleware(req, res, next); // 2
    next.mockClear();
    middleware(req, res, next); // 3 → bloqué
    expect(res.status).toHaveBeenCalledWith(429);
  });

  test('ne rate-limit pas si pas d\'utilisateur', () => {
    const middleware = userRateLimit(1, 60000);
    const req = mockReq({ user: null, path: '/anon' });
    middleware(req, mockRes(), next);
    expect(next).toHaveBeenCalled();
  });
});
