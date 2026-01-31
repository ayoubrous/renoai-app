import { jest } from '@jest/globals';

// Mock database
const mockRun = jest.fn(() => ({ changes: 1, lastInsertRowid: 'new-id-1' }));
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
    debug: jest.fn(),
    child: () => ({
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    }),
  },
}));

// Mock error handler
class MockAPIError extends Error {
  constructor(msg, status, code) {
    super(msg);
    this.statusCode = status;
    this.code = code;
  }
}

jest.unstable_mockModule('../../../server/middleware/errorHandler.js', () => ({
  asyncHandler: (fn) => fn,
  APIError: MockAPIError,
  errors: {
    PROJECT_NOT_FOUND: Object.assign(new Error('Projet non trouvé'), { statusCode: 404, code: 'PROJECT_NOT_FOUND' }),
    FORBIDDEN: Object.assign(new Error('Accès interdit'), { statusCode: 403, code: 'FORBIDDEN' }),
    CRAFTSMAN_NOT_FOUND: Object.assign(new Error('Artisan non trouvé'), { statusCode: 404, code: 'CRAFTSMAN_NOT_FOUND' }),
  },
}));

const controller = await import('../../../server/controllers/projectController.js');

// Helpers
function mockReq(overrides = {}) {
  return {
    body: {},
    params: {},
    query: {},
    user: { id: 'user-1', email: 'test@test.lu', role: 'user' },
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

// ============================================================
// TESTS
// ============================================================

describe('ProjectController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRun.mockReturnValue({ changes: 1, lastInsertRowid: 'new-id-1' });
    mockGet.mockReturnValue(null);
    mockAll.mockReturnValue([]);
  });

  // ----------------------------------------------------------
  // getProjects
  // ----------------------------------------------------------
  describe('getProjects', () => {
    test('returns paginated project list', async () => {
      mockGet.mockReturnValue({ total: 2 });
      mockAll.mockReturnValue([{ id: 'p1' }, { id: 'p2' }]);

      const req = mockReq({ query: { page: '1', limit: '20' } });
      const res = mockRes();

      await controller.getProjects(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            projects: expect.any(Array),
            pagination: expect.objectContaining({ page: 1, limit: 20 }),
          }),
        })
      );
    });

    test('applies status filter', async () => {
      mockGet.mockReturnValue({ total: 0 });
      mockAll.mockReturnValue([]);

      const req = mockReq({ query: { status: 'in_progress' } });
      const res = mockRes();

      await controller.getProjects(req, res);

      // Should have added status param
      const prepareArgs = mockPrepare.mock.calls;
      const hasStatusFilter = prepareArgs.some(
        (call) => typeof call[0] === 'string' && call[0].includes('status')
      );
      expect(hasStatusFilter).toBe(true);
    });

    test('applies type filter', async () => {
      mockGet.mockReturnValue({ total: 0 });
      mockAll.mockReturnValue([]);

      const req = mockReq({ query: { type: 'renovation' } });
      const res = mockRes();

      await controller.getProjects(req, res);

      const prepareArgs = mockPrepare.mock.calls;
      const hasTypeFilter = prepareArgs.some(
        (call) => typeof call[0] === 'string' && call[0].includes('type')
      );
      expect(hasTypeFilter).toBe(true);
    });

    test('applies search filter', async () => {
      mockGet.mockReturnValue({ total: 0 });
      mockAll.mockReturnValue([]);

      const req = mockReq({ query: { search: 'cuisine' } });
      const res = mockRes();

      await controller.getProjects(req, res);

      const prepareArgs = mockPrepare.mock.calls;
      const hasSearch = prepareArgs.some(
        (call) => typeof call[0] === 'string' && call[0].includes('LIKE')
      );
      expect(hasSearch).toBe(true);
    });
  });

  // ----------------------------------------------------------
  // createProject
  // ----------------------------------------------------------
  describe('createProject', () => {
    test('creates project and returns 201', async () => {
      const newProject = { id: 'new-id-1', name: 'Test Project', status: 'draft' };
      mockGet.mockReturnValue(newProject);

      const req = mockReq({
        body: { name: 'Test Project', type: 'renovation', description: 'Desc' },
      });
      const res = mockRes();

      await controller.createProject(req, res);

      expect(mockRun).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ project: newProject }),
        })
      );
    });
  });

  // ----------------------------------------------------------
  // getProjectStats
  // ----------------------------------------------------------
  describe('getProjectStats', () => {
    test('returns stats with counts', async () => {
      mockGet
        .mockReturnValueOnce({ count: 5 })   // total
        .mockReturnValueOnce({ sum: 50000 })  // total_budget
        .mockReturnValueOnce({ avg: 45 });    // average_progress
      mockAll
        .mockReturnValueOnce([{ status: 'draft', count: 3 }])  // by_status
        .mockReturnValueOnce([{ type: 'renovation', count: 2 }]); // by_type

      const req = mockReq();
      const res = mockRes();

      await controller.getProjectStats(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            stats: expect.any(Object),
          }),
        })
      );
    });
  });

  // ----------------------------------------------------------
  // getProjectById
  // ----------------------------------------------------------
  describe('getProjectById', () => {
    test('returns project with devis and craftsmen', async () => {
      const project = { id: 'p1', user_id: 'user-1', name: 'My Project' };
      mockGet.mockReturnValueOnce(project);
      mockAll
        .mockReturnValueOnce([{ id: 'd1', title: 'Devis 1' }])
        .mockReturnValueOnce([{ id: 'c1', company_name: 'Builder Co' }]);

      const req = mockReq({ params: { id: 'p1' } });
      const res = mockRes();

      await controller.getProjectById(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            project,
            devis: expect.any(Array),
            craftsmen: expect.any(Array),
          }),
        })
      );
    });

    test('throws 404 if project not found', async () => {
      mockGet.mockReturnValue(undefined);

      const req = mockReq({ params: { id: 'nonexistent' } });
      const res = mockRes();

      await expect(controller.getProjectById(req, res)).rejects.toHaveProperty('statusCode', 404);
    });

    test('throws 403 if not owner and not admin', async () => {
      const project = { id: 'p1', user_id: 'other-user', name: 'Not Mine' };
      mockGet
        .mockReturnValueOnce(project)    // project query
        .mockReturnValueOnce(undefined); // isAssigned check

      const req = mockReq({ params: { id: 'p1' } });
      const res = mockRes();

      await expect(controller.getProjectById(req, res)).rejects.toHaveProperty('statusCode', 403);
    });

    test('allows access for assigned craftsman', async () => {
      const project = { id: 'p1', user_id: 'other-user', name: 'Their Project' };
      mockGet
        .mockReturnValueOnce(project)   // project query
        .mockReturnValueOnce({ 1: 1 }); // isAssigned returns truthy
      mockAll
        .mockReturnValueOnce([])
        .mockReturnValueOnce([]);

      const req = mockReq({ params: { id: 'p1' } });
      const res = mockRes();

      await controller.getProjectById(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });
  });

  // ----------------------------------------------------------
  // updateProject
  // ----------------------------------------------------------
  describe('updateProject', () => {
    test('updates allowed fields and returns updated project', async () => {
      const project = { id: 'p1', user_id: 'user-1' };
      const updatedProject = { id: 'p1', user_id: 'user-1', name: 'Updated' };
      mockGet
        .mockReturnValueOnce(project)
        .mockReturnValueOnce(updatedProject);

      const req = mockReq({
        params: { id: 'p1' },
        body: { name: 'Updated' },
      });
      const res = mockRes();

      await controller.updateProject(req, res);

      expect(mockRun).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ project: updatedProject }),
        })
      );
    });

    test('throws 404 if project not found', async () => {
      mockGet.mockReturnValue(undefined);

      const req = mockReq({ params: { id: 'x' }, body: { name: 'X' } });
      const res = mockRes();

      await expect(controller.updateProject(req, res)).rejects.toHaveProperty('statusCode', 404);
    });

    test('throws 403 if not owner and not admin', async () => {
      mockGet.mockReturnValue({ id: 'p1', user_id: 'other-user' });

      const req = mockReq({ params: { id: 'p1' }, body: { name: 'X' } });
      const res = mockRes();

      await expect(controller.updateProject(req, res)).rejects.toHaveProperty('statusCode', 403);
    });

    test('throws 400 if no data to update', async () => {
      mockGet.mockReturnValue({ id: 'p1', user_id: 'user-1' });

      const req = mockReq({ params: { id: 'p1' }, body: {} });
      const res = mockRes();

      await expect(controller.updateProject(req, res)).rejects.toThrow();
    });
  });

  // ----------------------------------------------------------
  // deleteProject
  // ----------------------------------------------------------
  describe('deleteProject', () => {
    test('deletes project and associated data', async () => {
      mockGet.mockReturnValue({ id: 'p1', user_id: 'user-1' });

      const req = mockReq({ params: { id: 'p1' } });
      const res = mockRes();

      await controller.deleteProject(req, res);

      // Should delete craftsmen, photos, timeline, update devis, delete project
      expect(mockRun).toHaveBeenCalledTimes(5);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });

    test('throws 404 if project not found', async () => {
      mockGet.mockReturnValue(undefined);

      const req = mockReq({ params: { id: 'x' } });
      const res = mockRes();

      await expect(controller.deleteProject(req, res)).rejects.toHaveProperty('statusCode', 404);
    });

    test('throws 403 if not owner and not admin', async () => {
      mockGet.mockReturnValue({ id: 'p1', user_id: 'other-user' });

      const req = mockReq({ params: { id: 'p1' } });
      const res = mockRes();

      await expect(controller.deleteProject(req, res)).rejects.toHaveProperty('statusCode', 403);
    });
  });

  // ----------------------------------------------------------
  // duplicateProject
  // ----------------------------------------------------------
  describe('duplicateProject', () => {
    test('creates copy with "(copie)" suffix', async () => {
      const original = { id: 'p1', user_id: 'user-1', name: 'My Project', type: 'reno' };
      const duplicate = { id: 'new-id-1', name: 'My Project (copie)' };
      mockGet
        .mockReturnValueOnce(original)
        .mockReturnValueOnce(duplicate);

      const req = mockReq({ params: { id: 'p1' } });
      const res = mockRes();

      await controller.duplicateProject(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      // Verify the run call includes "(copie)" in the name
      expect(mockRun).toHaveBeenCalled();
      const runArgs = mockRun.mock.calls[0];
      expect(runArgs).toContain('My Project (copie)');
    });
  });

  // ----------------------------------------------------------
  // archiveProject
  // ----------------------------------------------------------
  describe('archiveProject', () => {
    test('updates project status to archived', async () => {
      mockGet.mockReturnValue({ id: 'p1', user_id: 'user-1' });

      const req = mockReq({ params: { id: 'p1' } });
      const res = mockRes();

      await controller.archiveProject(req, res);

      expect(mockRun).toHaveBeenCalled();
      const sql = mockPrepare.mock.calls.find(
        (c) => typeof c[0] === 'string' && c[0].includes('archived')
      );
      expect(sql).toBeDefined();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });
  });

  // ----------------------------------------------------------
  // restoreProject
  // ----------------------------------------------------------
  describe('restoreProject', () => {
    test('updates project status to draft', async () => {
      mockGet.mockReturnValue({ id: 'p1', user_id: 'user-1' });

      const req = mockReq({ params: { id: 'p1' } });
      const res = mockRes();

      await controller.restoreProject(req, res);

      expect(mockRun).toHaveBeenCalled();
      const sql = mockPrepare.mock.calls.find(
        (c) => typeof c[0] === 'string' && c[0].includes("status = 'draft'")
      );
      expect(sql).toBeDefined();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });
  });

  // ----------------------------------------------------------
  // getProjectCraftsmen
  // ----------------------------------------------------------
  describe('getProjectCraftsmen', () => {
    test('returns craftsmen for project', async () => {
      mockGet.mockReturnValue({ user_id: 'user-1' });
      mockAll.mockReturnValue([{ id: 'c1', company_name: 'Builder' }]);

      const req = mockReq({ params: { id: 'p1' } });
      const res = mockRes();

      await controller.getProjectCraftsmen(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            craftsmen: [{ id: 'c1', company_name: 'Builder' }],
          }),
        })
      );
    });
  });

  // ----------------------------------------------------------
  // addCraftsmanToProject
  // ----------------------------------------------------------
  describe('addCraftsmanToProject', () => {
    test('validates craftsman exists and adds to project', async () => {
      mockGet
        .mockReturnValueOnce({ id: 'p1', user_id: 'user-1' }) // project
        .mockReturnValueOnce({ id: 'craft-1' })                // craftsman exists
        .mockReturnValueOnce(undefined);                        // not already assigned

      const req = mockReq({
        params: { id: 'p1' },
        body: { craftsman_id: 'craft-1' },
      });
      const res = mockRes();

      await controller.addCraftsmanToProject(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
    });

    test('throws 404 if craftsman not found', async () => {
      mockGet
        .mockReturnValueOnce({ id: 'p1', user_id: 'user-1' }) // project
        .mockReturnValueOnce(undefined);                        // craftsman not found

      const req = mockReq({
        params: { id: 'p1' },
        body: { craftsman_id: 'nonexistent' },
      });
      const res = mockRes();

      await expect(controller.addCraftsmanToProject(req, res)).rejects.toHaveProperty('statusCode', 404);
    });

    test('throws 409 if craftsman already assigned', async () => {
      mockGet
        .mockReturnValueOnce({ id: 'p1', user_id: 'user-1' }) // project
        .mockReturnValueOnce({ id: 'craft-1' })                // craftsman exists
        .mockReturnValueOnce({ id: 'existing' });              // already assigned

      const req = mockReq({
        params: { id: 'p1' },
        body: { craftsman_id: 'craft-1' },
      });
      const res = mockRes();

      await expect(controller.addCraftsmanToProject(req, res)).rejects.toThrow(/déjà assigné/);
    });
  });

  // ----------------------------------------------------------
  // removeCraftsmanFromProject
  // ----------------------------------------------------------
  describe('removeCraftsmanFromProject', () => {
    test('removes craftsman assignment', async () => {
      mockGet.mockReturnValue({ id: 'p1', user_id: 'user-1' });

      const req = mockReq({ params: { id: 'p1', craftsmanId: 'craft-1' } });
      const res = mockRes();

      await controller.removeCraftsmanFromProject(req, res);

      expect(mockRun).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });
  });

  // ----------------------------------------------------------
  // getProjectDevis
  // ----------------------------------------------------------
  describe('getProjectDevis', () => {
    test('returns devis for project', async () => {
      mockAll.mockReturnValue([{ id: 'd1', title: 'Devis cuisine' }]);

      const req = mockReq({ params: { id: 'p1' } });
      const res = mockRes();

      await controller.getProjectDevis(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            devis: [{ id: 'd1', title: 'Devis cuisine' }],
          }),
        })
      );
    });
  });

  // ----------------------------------------------------------
  // getProjectTimeline
  // ----------------------------------------------------------
  describe('getProjectTimeline', () => {
    test('returns timeline events', async () => {
      mockAll.mockReturnValue([{ id: 'e1', title: 'Started' }]);

      const req = mockReq({ params: { id: 'p1' } });
      const res = mockRes();

      await controller.getProjectTimeline(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            events: [{ id: 'e1', title: 'Started' }],
          }),
        })
      );
    });
  });

  // ----------------------------------------------------------
  // addTimelineEvent
  // ----------------------------------------------------------
  describe('addTimelineEvent', () => {
    test('inserts timeline event and returns 201', async () => {
      const event = { id: 'new-id-1', title: 'Milestone', event_type: 'milestone' };
      mockGet.mockReturnValue(event);

      const req = mockReq({
        params: { id: 'p1' },
        body: { event_type: 'milestone', title: 'Milestone', description: 'Done' },
      });
      const res = mockRes();

      await controller.addTimelineEvent(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ event }),
        })
      );
    });
  });

  // ----------------------------------------------------------
  // getProjectPhotos
  // ----------------------------------------------------------
  describe('getProjectPhotos', () => {
    test('returns project photos', async () => {
      mockAll.mockReturnValue([{ id: 'ph1', url: '/photos/img.jpg' }]);

      const req = mockReq({ params: { id: 'p1' } });
      const res = mockRes();

      await controller.getProjectPhotos(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            photos: [{ id: 'ph1', url: '/photos/img.jpg' }],
          }),
        })
      );
    });
  });

  // ----------------------------------------------------------
  // addProjectPhotos
  // ----------------------------------------------------------
  describe('addProjectPhotos', () => {
    test('inserts photos and returns 201', async () => {
      const inserted = { id: 'new-id-1', url: '/photos/new.jpg' };
      mockGet.mockReturnValue(inserted);

      const req = mockReq({
        params: { id: 'p1' },
        body: { photos: [{ url: '/photos/new.jpg', description: 'Kitchen' }] },
      });
      const res = mockRes();

      await controller.addProjectPhotos(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(mockRun).toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------
  // deleteProjectPhoto
  // ----------------------------------------------------------
  describe('deleteProjectPhoto', () => {
    test('deletes photo by id and project id', async () => {
      const req = mockReq({ params: { id: 'p1', photoId: 'ph1' } });
      const res = mockRes();

      await controller.deleteProjectPhoto(req, res);

      expect(mockRun).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );
    });
  });

  // ----------------------------------------------------------
  // getAllProjectsAdmin
  // ----------------------------------------------------------
  describe('getAllProjectsAdmin', () => {
    test('returns all projects with user info', async () => {
      mockGet.mockReturnValue({ total: 1 });
      mockAll.mockReturnValue([
        { id: 'p1', name: 'Admin Project', email: 'user@test.lu', first_name: 'Jean' },
      ]);

      const req = mockReq({ query: { page: '1', limit: '20' } });
      const res = mockRes();

      await controller.getAllProjectsAdmin(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            projects: expect.arrayContaining([
              expect.objectContaining({ email: 'user@test.lu' }),
            ]),
            pagination: expect.any(Object),
          }),
        })
      );
    });
  });
});
