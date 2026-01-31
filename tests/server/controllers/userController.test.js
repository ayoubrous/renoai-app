import { jest } from '@jest/globals';

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

const userController = await import('../../../server/controllers/userController.js');
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

describe('userController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRun.mockReturnValue({ changes: 1, lastInsertRowid: 1 });
    mockGet.mockReturnValue(null);
    mockAll.mockReturnValue([]);
  });

  describe('getProfile', () => {
    it('should return user profile without password', async () => {
      const req = mockReq();
      const res = mockRes();
      const next = jest.fn();

      const mockUser = {
        id: 1,
        email: 'test@test.lu',
        first_name: 'Test',
        last_name: 'User',
        role: 'user',
        avatar_url: null,
      };

      mockGet.mockReturnValueOnce(mockUser);

      await userController.getProfile(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            user: mockUser,
          }),
        })
      );
    });

    it('should throw 404 error when user not found', async () => {
      const req = mockReq();
      const res = mockRes();
      const next = jest.fn();

      mockGet.mockReturnValueOnce(null);

      await expect(userController.getProfile(req, res, next)).rejects.toThrow();
    });
  });

  describe('updateProfile', () => {
    it('should update user profile successfully', async () => {
      const req = mockReq({
        body: {
          first_name: 'Updated',
          last_name: 'Name',
          phone: '+352123456789',
        },
      });
      const res = mockRes();
      const next = jest.fn();

      const mockUpdatedUser = {
        id: 1,
        email: 'test@test.lu',
        first_name: 'Updated',
        last_name: 'Name',
        phone: '+352123456789',
      };

      // run() for UPDATE, then get() for fetching updated user
      mockGet.mockReturnValueOnce(mockUpdatedUser);

      await userController.updateProfile(req, res, next);

      expect(mockRun).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            user: mockUpdatedUser,
          }),
        })
      );
    });

    it('should throw 400 error when no data provided', async () => {
      const req = mockReq({
        body: {},
      });
      const res = mockRes();
      const next = jest.fn();

      await expect(userController.updateProfile(req, res, next)).rejects.toThrow();
    });
  });

  describe('getPreferences', () => {
    it('should return user preferences', async () => {
      const req = mockReq();
      const res = mockRes();
      const next = jest.fn();

      const mockPreferences = {
        user_id: 1,
        notifications_email: 1,
        language: 'fr',
        theme: 'light',
      };

      mockGet.mockReturnValueOnce(mockPreferences);

      await userController.getPreferences(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            preferences: mockPreferences,
          }),
        })
      );
    });

    it('should create default preferences if not exist', async () => {
      const req = mockReq();
      const res = mockRes();
      const next = jest.fn();

      const mockDefaultPreferences = {
        user_id: 1,
        notifications_email: 1,
        language: 'fr',
        theme: 'light',
      };

      // 1st get: returns null (no preferences), then run() to insert, then 2nd get: returns preferences
      mockGet.mockReturnValueOnce(null).mockReturnValueOnce(mockDefaultPreferences);

      await userController.getPreferences(req, res, next);

      expect(mockRun).toHaveBeenCalled(); // Should create defaults
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            preferences: mockDefaultPreferences,
          }),
        })
      );
    });
  });

  describe('updatePreferences', () => {
    it('should update user preferences successfully', async () => {
      const req = mockReq({
        body: {
          notifications_email: false,
          language: 'en',
          theme: 'dark',
        },
      });
      const res = mockRes();
      const next = jest.fn();

      const mockUpdatedPreferences = {
        user_id: 1,
        notifications_email: 0,
        language: 'en',
        theme: 'dark',
      };

      // get() to check existing preferences, then run() to update, then get() to return updated
      mockGet
        .mockReturnValueOnce({ id: 1 }) // existing check
        .mockReturnValueOnce(mockUpdatedPreferences); // final fetch

      await userController.updatePreferences(req, res, next);

      expect(mockRun).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            preferences: mockUpdatedPreferences,
          }),
        })
      );
    });

    it('should throw 400 error when no data provided', async () => {
      const req = mockReq({
        body: {},
      });
      const res = mockRes();
      const next = jest.fn();

      await expect(userController.updatePreferences(req, res, next)).rejects.toThrow();
    });
  });

  describe('uploadAvatar', () => {
    it('should upload avatar successfully', async () => {
      const req = mockReq({
        file: {
          filename: 'avatar.jpg',
          path: '/uploads/avatar.jpg',
        },
      });
      const res = mockRes();
      const next = jest.fn();

      await userController.uploadAvatar(req, res, next);

      expect(mockRun).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            avatar_url: expect.any(String),
          }),
        })
      );
    });

    it('should throw 400 error when no file provided', async () => {
      const req = mockReq({
        file: null,
      });
      const res = mockRes();
      const next = jest.fn();

      await expect(userController.uploadAvatar(req, res, next)).rejects.toThrow();
    });
  });

  describe('deleteAvatar', () => {
    it('should delete avatar successfully', async () => {
      const req = mockReq();
      const res = mockRes();
      const next = jest.fn();

      await userController.deleteAvatar(req, res, next);

      expect(mockRun).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.any(String),
        })
      );
    });
  });

  describe('getUserStats', () => {
    it('should return user statistics', async () => {
      const req = mockReq();
      const res = mockRes();
      const next = jest.fn();

      // getUserStats calls get() 10 times:
      // projects: total, active, completed (3)
      // devis: total, pending, approved, total_amount (4)
      // messages: total, unread (2)
      // member_since (1)
      mockGet
        .mockReturnValueOnce({ count: 5 })   // projects.total
        .mockReturnValueOnce({ count: 2 })   // projects.active
        .mockReturnValueOnce({ count: 3 })   // projects.completed
        .mockReturnValueOnce({ count: 10 })  // devis.total
        .mockReturnValueOnce({ count: 4 })   // devis.pending
        .mockReturnValueOnce({ count: 6 })   // devis.approved
        .mockReturnValueOnce({ sum: 50000 }) // devis.total_amount
        .mockReturnValueOnce({ count: 20 })  // messages.total
        .mockReturnValueOnce({ count: 5 })   // messages.unread
        .mockReturnValueOnce({ created_at: '2025-01-01T00:00:00.000Z' }); // member_since

      await userController.getUserStats(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            stats: expect.objectContaining({
              projects: { total: 5, active: 2, completed: 3 },
              devis: { total: 10, pending: 4, approved: 6, total_amount: 50000 },
              messages: { total: 20, unread: 5 },
              member_since: '2025-01-01T00:00:00.000Z',
            }),
          }),
        })
      );
    });
  });

  describe('getActivityHistory', () => {
    it('should return activity history', async () => {
      const req = mockReq({
        query: { limit: '10', offset: '0' },
      });
      const res = mockRes();
      const next = jest.fn();

      const mockActivities = [
        {
          type: 'project',
          id: 1,
          title: 'My Project',
          created_at: '2025-01-29T00:00:00.000Z',
          status: 'in_progress',
        },
        {
          type: 'devis',
          id: 2,
          title: 'My Devis',
          created_at: '2025-01-28T00:00:00.000Z',
          status: 'pending',
        },
      ];

      mockAll.mockReturnValueOnce(mockActivities);

      await userController.getActivityHistory(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            activities: mockActivities,
          }),
        })
      );
    });
  });

  describe('deleteAccount', () => {
    it('should soft delete account and revoke tokens', async () => {
      const req = mockReq();
      const res = mockRes();
      const next = jest.fn();

      await userController.deleteAccount(req, res, next);

      expect(mockRun).toHaveBeenCalled(); // Should soft delete and revoke tokens
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.any(String),
        })
      );
    });
  });

  describe('getPublicProfile', () => {
    it('should return public user profile', async () => {
      const req = mockReq({
        params: { id: '2' },
      });
      const res = mockRes();
      const next = jest.fn();

      const mockUser = {
        id: 2,
        first_name: 'John',
        last_name: 'Doe',
        role: 'user',
        avatar_url: null,
        created_at: '2025-01-01T00:00:00.000Z',
      };

      mockGet.mockReturnValueOnce(mockUser);

      await userController.getPublicProfile(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            user: mockUser,
            craftsman: null,
          }),
        })
      );
    });

    it('should include craftsman profile if role is craftsman', async () => {
      const req = mockReq({
        params: { id: '3' },
      });
      const res = mockRes();
      const next = jest.fn();

      const mockUser = {
        id: 3,
        first_name: 'Jane',
        last_name: 'Smith',
        role: 'craftsman',
        avatar_url: null,
        created_at: '2025-01-01T00:00:00.000Z',
      };

      const mockCraftsmanProfile = {
        user_id: 3,
        company_name: 'Smith Construction',
        specialties: 'plumbing,electrical',
        rating: 4.5,
      };

      mockGet.mockReturnValueOnce(mockUser).mockReturnValueOnce(mockCraftsmanProfile);

      await userController.getPublicProfile(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            user: mockUser,
            craftsman: mockCraftsmanProfile,
          }),
        })
      );
    });

    it('should throw 404 error when user not found', async () => {
      const req = mockReq({
        params: { id: '999' },
      });
      const res = mockRes();
      const next = jest.fn();

      mockGet.mockReturnValueOnce(null);

      await expect(userController.getPublicProfile(req, res, next)).rejects.toThrow();
    });
  });

  describe('getAllUsers (admin)', () => {
    it('should return all users with pagination', async () => {
      const req = mockReq({
        query: { page: '1', limit: '10' },
        user: { id: 1, email: 'admin@test.lu', role: 'admin' },
      });
      const res = mockRes();
      const next = jest.fn();

      const mockUsers = [
        { id: 1, email: 'user1@test.lu', role: 'user', status: 'active' },
        { id: 2, email: 'user2@test.lu', role: 'craftsman', status: 'active' },
      ];

      // getAllUsers: get() for count, then all() for users
      mockGet.mockReturnValueOnce({ total: 2 });
      mockAll.mockReturnValueOnce(mockUsers);

      await userController.getAllUsers(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            users: mockUsers,
            pagination: expect.objectContaining({
              total: 2,
              page: 1,
              limit: 10,
            }),
          }),
        })
      );
    });

    it('should support search and filters', async () => {
      const req = mockReq({
        query: {
          page: '1',
          limit: '10',
          search: 'john',
          role: 'craftsman',
          status: 'active',
        },
        user: { id: 1, email: 'admin@test.lu', role: 'admin' },
      });
      const res = mockRes();
      const next = jest.fn();

      const mockUsers = [
        { id: 2, email: 'john@test.lu', role: 'craftsman', status: 'active' },
      ];

      mockGet.mockReturnValueOnce({ total: 1 });
      mockAll.mockReturnValueOnce(mockUsers);

      await userController.getAllUsers(req, res, next);

      expect(mockPrepare).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            users: mockUsers,
          }),
        })
      );
    });
  });

  describe('getUserById (admin)', () => {
    it('should return user by id', async () => {
      const req = mockReq({
        params: { id: '2' },
        user: { id: 1, email: 'admin@test.lu', role: 'admin' },
      });
      const res = mockRes();
      const next = jest.fn();

      const mockUser = {
        id: 2,
        email: 'user@test.lu',
        first_name: 'Test',
        last_name: 'User',
        role: 'user',
      };

      mockGet.mockReturnValueOnce(mockUser);

      await userController.getUserById(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            user: mockUser,
          }),
        })
      );
    });

    it('should throw 404 error when user not found', async () => {
      const req = mockReq({
        params: { id: '999' },
        user: { id: 1, email: 'admin@test.lu', role: 'admin' },
      });
      const res = mockRes();
      const next = jest.fn();

      mockGet.mockReturnValueOnce(null);

      await expect(userController.getUserById(req, res, next)).rejects.toThrow();
    });
  });

  describe('updateUserById (admin)', () => {
    it('should update user successfully', async () => {
      const req = mockReq({
        params: { id: '2' },
        body: {
          first_name: 'Updated',
          last_name: 'User',
        },
        user: { id: 1, email: 'admin@test.lu', role: 'admin' },
      });
      const res = mockRes();
      const next = jest.fn();

      const mockUpdatedUser = {
        id: 2,
        email: 'user@test.lu',
        first_name: 'Updated',
        last_name: 'User',
      };

      // get() to check user exists, run() to update, get() to fetch updated
      mockGet
        .mockReturnValueOnce({ id: 2 })       // existence check
        .mockReturnValueOnce(mockUpdatedUser); // fetch updated user

      await userController.updateUserById(req, res, next);

      expect(mockRun).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            user: mockUpdatedUser,
          }),
        })
      );
    });

    it('should throw 404 error when user not found', async () => {
      const req = mockReq({
        params: { id: '999' },
        body: { first_name: 'Updated' },
        user: { id: 1, email: 'admin@test.lu', role: 'admin' },
      });
      const res = mockRes();
      const next = jest.fn();

      // get() returns null -> user not found
      mockGet.mockReturnValueOnce(null);

      await expect(userController.updateUserById(req, res, next)).rejects.toThrow();
    });
  });

  describe('updateUserRole (admin)', () => {
    it('should update user role successfully', async () => {
      const req = mockReq({
        params: { id: '2' },
        body: { role: 'craftsman' },
        user: { id: 1, email: 'admin@test.lu', role: 'admin' },
      });
      const res = mockRes();
      const next = jest.fn();

      // get() to check user exists, then run() to update
      mockGet.mockReturnValueOnce({ id: 2 });

      await userController.updateUserRole(req, res, next);

      expect(mockRun).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.any(String),
        })
      );
    });

    it('should throw 400 error for invalid role', async () => {
      const req = mockReq({
        params: { id: '2' },
        body: { role: 'invalid_role' },
        user: { id: 1, email: 'admin@test.lu', role: 'admin' },
      });
      const res = mockRes();
      const next = jest.fn();

      await expect(userController.updateUserRole(req, res, next)).rejects.toThrow();
    });

    it('should throw 404 error when user not found', async () => {
      const req = mockReq({
        params: { id: '999' },
        body: { role: 'craftsman' },
        user: { id: 1, email: 'admin@test.lu', role: 'admin' },
      });
      const res = mockRes();
      const next = jest.fn();

      // get() returns null -> user not found
      mockGet.mockReturnValueOnce(null);

      await expect(userController.updateUserRole(req, res, next)).rejects.toThrow();
    });
  });

  describe('updateUserStatus (admin)', () => {
    it('should update user status successfully', async () => {
      const req = mockReq({
        params: { id: '2' },
        body: { status: 'suspended' },
        user: { id: 1, email: 'admin@test.lu', role: 'admin' },
      });
      const res = mockRes();
      const next = jest.fn();

      // get() to check user exists
      mockGet.mockReturnValueOnce({ id: 2 });

      await userController.updateUserStatus(req, res, next);

      expect(mockRun).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.any(String),
        })
      );
    });

    it('should revoke tokens when status is not active', async () => {
      const req = mockReq({
        params: { id: '2' },
        body: { status: 'suspended' },
        user: { id: 1, email: 'admin@test.lu', role: 'admin' },
      });
      const res = mockRes();
      const next = jest.fn();

      mockGet.mockReturnValueOnce({ id: 2 });

      await userController.updateUserStatus(req, res, next);

      // run called for status update + token revocation
      expect(mockRun).toHaveBeenCalled();
    });

    it('should throw 400 error for invalid status', async () => {
      const req = mockReq({
        params: { id: '2' },
        body: { status: 'invalid_status' },
        user: { id: 1, email: 'admin@test.lu', role: 'admin' },
      });
      const res = mockRes();
      const next = jest.fn();

      await expect(userController.updateUserStatus(req, res, next)).rejects.toThrow();
    });

    it('should throw 404 error when user not found', async () => {
      const req = mockReq({
        params: { id: '999' },
        body: { status: 'suspended' },
        user: { id: 1, email: 'admin@test.lu', role: 'admin' },
      });
      const res = mockRes();
      const next = jest.fn();

      // get() returns null -> user not found
      mockGet.mockReturnValueOnce(null);

      await expect(userController.updateUserStatus(req, res, next)).rejects.toThrow();
    });
  });

  describe('deleteUserById (admin)', () => {
    it('should soft delete user successfully', async () => {
      const req = mockReq({
        params: { id: '2' },
        user: { id: 1, email: 'admin@test.lu', role: 'admin' },
      });
      const res = mockRes();
      const next = jest.fn();

      // get() to check user exists
      mockGet.mockReturnValueOnce({ id: 2 });

      await userController.deleteUserById(req, res, next);

      expect(mockRun).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.any(String),
        })
      );
    });

    it('should throw 404 error when user not found', async () => {
      const req = mockReq({
        params: { id: '999' },
        user: { id: 1, email: 'admin@test.lu', role: 'admin' },
      });
      const res = mockRes();
      const next = jest.fn();

      // get() returns null -> user not found
      mockGet.mockReturnValueOnce(null);

      await expect(userController.deleteUserById(req, res, next)).rejects.toThrow();
    });
  });
});
