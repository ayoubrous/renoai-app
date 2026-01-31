import { jest } from '@jest/globals';

// Mock bcryptjs
const mockGenSalt = jest.fn(() => 'salt');
const mockHash = jest.fn(() => 'hashed_password');
const mockCompare = jest.fn(() => true);
jest.unstable_mockModule('bcryptjs', () => ({
  default: { genSalt: mockGenSalt, hash: mockHash, compare: mockCompare },
}));

// Mock crypto
jest.unstable_mockModule('crypto', () => ({
  default: {
    randomBytes: () => ({ toString: () => 'mock-token-hex' }),
    randomUUID: () => 'mock-uuid-1234',
  },
  randomBytes: () => ({ toString: () => 'mock-token-hex' }),
  randomUUID: () => 'mock-uuid-1234',
}));

// Mock database
const mockRun = jest.fn(() => ({ changes: 1, lastInsertRowid: 1 }));
const mockGet = jest.fn(() => null);
const mockAll = jest.fn(() => []);
const mockPrepare = jest.fn(() => ({ run: mockRun, get: mockGet, all: mockAll }));

jest.unstable_mockModule('../../../server/config/database.js', () => ({
  getDatabase: () => ({ prepare: mockPrepare }),
}));

// Mock logger
jest.unstable_mockModule('../../../server/middleware/logger.js', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    child: () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn() }),
  },
}));

// Mock auth middleware
const mockGenerateTokens = jest.fn(() => ({ accessToken: 'mock-access', refreshToken: 'mock-refresh' }));
jest.unstable_mockModule('../../../server/middleware/auth.js', () => ({
  generateTokens: mockGenerateTokens,
}));

// Mock error handler
jest.unstable_mockModule('../../../server/middleware/errorHandler.js', () => ({
  asyncHandler: (fn) => fn,
  APIError: class APIError extends Error {
    constructor(msg, status, code) {
      super(msg);
      this.statusCode = status;
      this.code = code;
    }
  },
  errors: {
    USER_NOT_FOUND: Object.assign(new Error('User not found'), { statusCode: 404, code: 'USER_NOT_FOUND' }),
    NOT_FOUND: Object.assign(new Error('Not found'), { statusCode: 404, code: 'NOT_FOUND' }),
  },
}));

const authController = await import('../../../server/controllers/authController.js');
const { APIError } = await import('../../../server/middleware/errorHandler.js');

// Helper functions
function mockReq(overrides = {}) {
  return {
    body: {},
    params: {},
    query: {},
    user: { id: 1, email: 'test@test.lu', role: 'user' },
    ip: '127.0.0.1',
    method: 'GET',
    originalUrl: '/api/test',
    path: '/api/test',
    get: jest.fn((h) => ({ 'User-Agent': 'TestAgent' }[h])),
    ...overrides,
  };
}

function mockRes() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res;
}

describe('authController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRun.mockReturnValue({ changes: 1, lastInsertRowid: 1 });
    mockGet.mockReturnValue(null);
    mockAll.mockReturnValue([]);
    mockCompare.mockReturnValue(true);
    mockGenerateTokens.mockReturnValue({ accessToken: 'mock-access', refreshToken: 'mock-refresh' });
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const req = mockReq({
        body: {
          email: 'newuser@test.lu',
          password: 'Password123!',
          first_name: 'John',
          last_name: 'Doe',
          role: 'user',
        },
      });
      const res = mockRes();
      const next = jest.fn();

      // 1st get: check existing user -> null
      mockGet.mockReturnValueOnce(null);
      // 1st run: INSERT user -> lastInsertRowid: 5
      mockRun.mockReturnValueOnce({ lastInsertRowid: 5 });

      await authController.register(req, res, next);

      expect(mockGenSalt).toHaveBeenCalledWith(12);
      expect(mockHash).toHaveBeenCalledWith('Password123!', 'salt');
      expect(mockGenerateTokens).toHaveBeenCalledWith({ userId: 'mock-uuid-1234', email: 'newuser@test.lu', role: 'user' });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.any(String),
          data: expect.objectContaining({
            user: expect.objectContaining({ id: 'mock-uuid-1234', email: 'newuser@test.lu' }),
            tokens: { accessToken: 'mock-access', refreshToken: 'mock-refresh' },
          }),
        })
      );
    });

    it('should throw 409 error when email already exists', async () => {
      const req = mockReq({
        body: {
          email: 'existing@test.lu',
          password: 'Password123!',
          first_name: 'John',
          last_name: 'Doe',
        },
      });
      const res = mockRes();
      const next = jest.fn();

      // Mock user exists
      mockGet.mockReturnValueOnce({ id: 1, email: 'existing@test.lu' });

      await expect(authController.register(req, res, next)).rejects.toThrow();
    });
  });

  describe('login', () => {
    it('should login user successfully', async () => {
      const req = mockReq({
        body: { email: 'user@test.lu', password: 'Password123!' },
      });
      const res = mockRes();
      const next = jest.fn();

      const mockUser = {
        id: 1,
        email: 'user@test.lu',
        password: 'hashed_password',
        first_name: 'Test',
        last_name: 'User',
        role: 'user',
        status: 'active',
        avatar_url: null,
        email_verified: 1,
      };

      mockGet.mockReturnValueOnce(mockUser);
      mockCompare.mockReturnValueOnce(true);

      await authController.login(req, res, next);

      expect(mockCompare).toHaveBeenCalledWith('Password123!', 'hashed_password');
      expect(mockGenerateTokens).toHaveBeenCalledWith({ userId: 1, email: 'user@test.lu', role: 'user' });
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            tokens: { accessToken: 'mock-access', refreshToken: 'mock-refresh' },
          }),
        })
      );
    });

    it('should throw 401 error when user not found', async () => {
      const req = mockReq({
        body: { email: 'notfound@test.lu', password: 'Password123!' },
      });
      const res = mockRes();
      const next = jest.fn();

      mockGet.mockReturnValueOnce(null);

      await expect(authController.login(req, res, next)).rejects.toThrow();
    });

    it('should throw 401 error when password is wrong', async () => {
      const req = mockReq({
        body: { email: 'user@test.lu', password: 'WrongPassword!' },
      });
      const res = mockRes();
      const next = jest.fn();

      const mockUser = {
        id: 1,
        email: 'user@test.lu',
        password: 'hashed_password',
        role: 'user',
        status: 'active',
      };

      mockGet.mockReturnValueOnce(mockUser);
      mockCompare.mockReturnValueOnce(false);

      await expect(authController.login(req, res, next)).rejects.toThrow();
      expect(mockRun).toHaveBeenCalled(); // Should increment failed attempts
    });

    it('should throw 403 error when account is suspended', async () => {
      const req = mockReq({
        body: { email: 'user@test.lu', password: 'Password123!' },
      });
      const res = mockRes();
      const next = jest.fn();

      const mockUser = {
        id: 1,
        email: 'user@test.lu',
        password: 'hashed_password',
        role: 'user',
        status: 'suspended',
      };

      mockGet.mockReturnValueOnce(mockUser);

      await expect(authController.login(req, res, next)).rejects.toThrow();
    });

    it('should throw 404 error when account is deleted', async () => {
      const req = mockReq({
        body: { email: 'user@test.lu', password: 'Password123!' },
      });
      const res = mockRes();
      const next = jest.fn();

      const mockUser = {
        id: 1,
        email: 'user@test.lu',
        password: 'hashed_password',
        role: 'user',
        status: 'deleted',
      };

      mockGet.mockReturnValueOnce(mockUser);

      await expect(authController.login(req, res, next)).rejects.toThrow();
    });

    it('should reset failed attempts on successful login', async () => {
      const req = mockReq({
        body: { email: 'user@test.lu', password: 'Password123!' },
      });
      const res = mockRes();
      const next = jest.fn();

      const mockUser = {
        id: 1,
        email: 'user@test.lu',
        password: 'hashed_password',
        first_name: 'Test',
        last_name: 'User',
        role: 'user',
        status: 'active',
        avatar_url: null,
        email_verified: 0,
        failed_login_attempts: 3,
      };

      mockGet.mockReturnValueOnce(mockUser);
      mockCompare.mockReturnValueOnce(true);

      await authController.login(req, res, next);

      expect(mockRun).toHaveBeenCalled(); // Should reset failed attempts
    });
  });

  describe('refreshToken', () => {
    it('should refresh token successfully', async () => {
      const req = mockReq({
        body: { refreshToken: 'valid-refresh-token' },
      });
      const res = mockRes();
      const next = jest.fn();

      // The controller does a single JOIN query returning token + user fields
      const mockStoredToken = {
        id: 1,
        user_id: 1,
        token: 'valid-refresh-token',
        expires_at: new Date(Date.now() + 86400000).toISOString(),
        revoked: 0,
        email: 'user@test.lu',
        role: 'user',
        status: 'active',
      };

      mockGet.mockReturnValueOnce(mockStoredToken);

      await authController.refreshToken(req, res, next);

      expect(mockGenerateTokens).toHaveBeenCalledWith({ userId: 1, email: 'user@test.lu', role: 'user' });
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            tokens: { accessToken: 'mock-access', refreshToken: 'mock-refresh' },
          }),
        })
      );
    });

    it('should throw 401 error when token not found', async () => {
      const req = mockReq({
        body: { refreshToken: 'invalid-token' },
      });
      const res = mockRes();
      const next = jest.fn();

      mockGet.mockReturnValueOnce(null);

      await expect(authController.refreshToken(req, res, next)).rejects.toThrow();
    });

    it('should throw 401 error when token is expired', async () => {
      const req = mockReq({
        body: { refreshToken: 'expired-token' },
      });
      const res = mockRes();
      const next = jest.fn();

      const mockStoredToken = {
        id: 1,
        user_id: 1,
        token: 'expired-token',
        expires_at: new Date(Date.now() - 86400000).toISOString(),
        revoked: 0,
        email: 'user@test.lu',
        role: 'user',
        status: 'active',
      };

      mockGet.mockReturnValueOnce(mockStoredToken);

      await expect(authController.refreshToken(req, res, next)).rejects.toThrow();
    });

    it('should throw 403 error when account is inactive', async () => {
      const req = mockReq({
        body: { refreshToken: 'valid-refresh-token' },
      });
      const res = mockRes();
      const next = jest.fn();

      const mockStoredToken = {
        id: 1,
        user_id: 1,
        token: 'valid-refresh-token',
        expires_at: new Date(Date.now() + 86400000).toISOString(),
        revoked: 0,
        email: 'user@test.lu',
        role: 'user',
        status: 'suspended',
      };

      mockGet.mockReturnValueOnce(mockStoredToken);

      await expect(authController.refreshToken(req, res, next)).rejects.toThrow();
    });
  });

  describe('logout', () => {
    it('should logout successfully with token', async () => {
      const req = mockReq({
        body: { refreshToken: 'valid-token' },
      });
      const res = mockRes();
      const next = jest.fn();

      await authController.logout(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.any(String),
        })
      );
    });

    it('should logout successfully without token', async () => {
      const req = mockReq({
        body: {},
      });
      const res = mockRes();
      const next = jest.fn();

      await authController.logout(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        })
      );
    });
  });

  describe('getMe', () => {
    it('should return current user with preferences and stats', async () => {
      const req = mockReq();
      const res = mockRes();
      const next = jest.fn();

      const mockUser = {
        id: 1,
        email: 'test@test.lu',
        first_name: 'Test',
        last_name: 'User',
        role: 'user',
      };

      const mockPreferences = {
        user_id: 1,
        notifications_enabled: 1,
        language: 'fr',
        theme: 'light',
      };

      // getMe does: get(user), get(preferences), get(projects_count), get(devis_count), get(unread_messages)
      mockGet
        .mockReturnValueOnce(mockUser)
        .mockReturnValueOnce(mockPreferences)
        .mockReturnValueOnce({ count: 5 })
        .mockReturnValueOnce({ count: 10 })
        .mockReturnValueOnce({ count: 20 });

      await authController.getMe(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            user: mockUser,
            preferences: mockPreferences,
            stats: { projects_count: 5, devis_count: 10, unread_messages: 20 },
          }),
        })
      );
    });

    it('should throw 404 error when user not found', async () => {
      const req = mockReq();
      const res = mockRes();
      const next = jest.fn();

      mockGet.mockReturnValueOnce(null);

      await expect(authController.getMe(req, res, next)).rejects.toThrow();
    });
  });

  describe('forgotPassword', () => {
    it('should generate reset token for existing user', async () => {
      const req = mockReq({
        body: { email: 'user@test.lu' },
      });
      const res = mockRes();
      const next = jest.fn();

      const mockUser = {
        id: 1,
        email: 'user@test.lu',
        first_name: 'Test',
      };

      mockGet.mockReturnValueOnce(mockUser);

      await authController.forgotPassword(req, res, next);

      expect(mockRun).toHaveBeenCalled(); // Should insert reset token
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.any(String),
        })
      );
    });

    it('should return success even for non-existing user', async () => {
      const req = mockReq({
        body: { email: 'notfound@test.lu' },
      });
      const res = mockRes();
      const next = jest.fn();

      mockGet.mockReturnValueOnce(null);

      await authController.forgotPassword(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        })
      );
    });
  });

  describe('resetPassword', () => {
    it('should reset password successfully', async () => {
      const req = mockReq({
        body: {
          token: 'valid-reset-token',
          password: 'NewPassword123!',
        },
      });
      const res = mockRes();
      const next = jest.fn();

      // Controller looks up user by password_reset_token
      const mockUser = {
        id: 1,
        email: 'user@test.lu',
      };

      mockGet.mockReturnValueOnce(mockUser);

      await authController.resetPassword(req, res, next);

      expect(mockGenSalt).toHaveBeenCalledWith(12);
      expect(mockHash).toHaveBeenCalledWith('NewPassword123!', 'salt');
      expect(mockRun).toHaveBeenCalled(); // Should update password
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.any(String),
        })
      );
    });

    it('should throw 400 error for invalid token', async () => {
      const req = mockReq({
        body: {
          token: 'invalid-token',
          password: 'NewPassword123!',
        },
      });
      const res = mockRes();
      const next = jest.fn();

      mockGet.mockReturnValueOnce(null);

      await expect(authController.resetPassword(req, res, next)).rejects.toThrow();
    });

    it('should throw 400 error for expired token', async () => {
      const req = mockReq({
        body: {
          token: 'expired-token',
          password: 'NewPassword123!',
        },
      });
      const res = mockRes();
      const next = jest.fn();

      // The expiry check is done in SQL (password_reset_expires > datetime('now')),
      // so if the DB returns null, the token is invalid/expired
      mockGet.mockReturnValueOnce(null);

      await expect(authController.resetPassword(req, res, next)).rejects.toThrow();
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      const req = mockReq({
        body: {
          currentPassword: 'OldPassword123!',
          newPassword: 'NewPassword123!',
        },
      });
      const res = mockRes();
      const next = jest.fn();

      const mockUser = {
        password: 'old_hashed_password',
      };

      mockGet.mockReturnValueOnce(mockUser);
      mockCompare.mockReturnValueOnce(true);

      await authController.changePassword(req, res, next);

      expect(mockCompare).toHaveBeenCalledWith('OldPassword123!', 'old_hashed_password');
      expect(mockGenSalt).toHaveBeenCalledWith(12);
      expect(mockHash).toHaveBeenCalledWith('NewPassword123!', 'salt');
      expect(mockRun).toHaveBeenCalled(); // Should update password
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.any(String),
        })
      );
    });

    it('should throw 401 error for wrong current password', async () => {
      const req = mockReq({
        body: {
          currentPassword: 'WrongPassword!',
          newPassword: 'NewPassword123!',
        },
      });
      const res = mockRes();
      const next = jest.fn();

      const mockUser = {
        password: 'old_hashed_password',
      };

      mockGet.mockReturnValueOnce(mockUser);
      mockCompare.mockReturnValueOnce(false);

      await expect(authController.changePassword(req, res, next)).rejects.toThrow();
    });
  });

  describe('verifyEmail', () => {
    it('should verify email successfully', async () => {
      const req = mockReq({
        params: { token: 'valid-verify-token' },
      });
      const res = mockRes();
      const next = jest.fn();

      // Controller looks up user by email_verification_token
      const mockUser = {
        id: 1,
      };

      mockGet.mockReturnValueOnce(mockUser);

      await authController.verifyEmail(req, res, next);

      expect(mockRun).toHaveBeenCalled(); // Should mark email as verified
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.any(String),
        })
      );
    });

    it('should throw 400 error for invalid token', async () => {
      const req = mockReq({
        params: { token: 'invalid-token' },
      });
      const res = mockRes();
      const next = jest.fn();

      mockGet.mockReturnValueOnce(null);

      await expect(authController.verifyEmail(req, res, next)).rejects.toThrow();
    });
  });

  describe('getSessions', () => {
    it('should return active sessions', async () => {
      const req = mockReq();
      const res = mockRes();
      const next = jest.fn();

      const mockSessions = [
        {
          id: 1,
          user_agent: 'Chrome on Windows',
          ip_address: '127.0.0.1',
          created_at: '2025-01-29T00:00:00.000Z',
          expires_at: '2025-02-05T00:00:00.000Z',
        },
        {
          id: 2,
          user_agent: 'Safari on Mac',
          ip_address: '192.168.1.1',
          created_at: '2025-01-28T00:00:00.000Z',
          expires_at: '2025-02-04T00:00:00.000Z',
        },
      ];

      mockAll.mockReturnValueOnce(mockSessions);

      await authController.getSessions(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            sessions: mockSessions,
          }),
        })
      );
    });
  });

  describe('revokeSession', () => {
    it('should revoke session successfully', async () => {
      const req = mockReq({
        params: { sessionId: '1' },
      });
      const res = mockRes();
      const next = jest.fn();

      mockRun.mockReturnValueOnce({ changes: 1 });

      await authController.revokeSession(req, res, next);

      expect(mockRun).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.any(String),
        })
      );
    });

    it('should throw 404 error when session not found', async () => {
      const req = mockReq({
        params: { sessionId: '999' },
      });
      const res = mockRes();
      const next = jest.fn();

      mockRun.mockReturnValueOnce({ changes: 0 });

      await expect(authController.revokeSession(req, res, next)).rejects.toThrow();
    });
  });

  describe('revokeAllSessions', () => {
    it('should revoke all sessions successfully', async () => {
      const req = mockReq();
      const res = mockRes();
      const next = jest.fn();

      mockRun.mockReturnValueOnce({ changes: 5 });

      await authController.revokeAllSessions(req, res, next);

      expect(mockRun).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.any(String),
        })
      );
    });
  });
});
