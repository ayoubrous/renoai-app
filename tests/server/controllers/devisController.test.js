import { jest } from '@jest/globals';

// --- Mock setup ---
const mockRun = jest.fn(() => ({ changes: 1, lastInsertRowid: 10 }));
const mockGet = jest.fn(() => null);
const mockAll = jest.fn(() => []);
const mockPrepare = jest.fn(() => ({ run: mockRun, get: mockGet, all: mockAll }));
const mockDb = { prepare: mockPrepare };

jest.unstable_mockModule('../../../server/config/database.js', () => ({
  getDatabase: jest.fn(() => mockDb),
}));

jest.unstable_mockModule('../../../server/middleware/errorHandler.js', () => ({
  asyncHandler: jest.fn((fn) => fn),
  APIError: class APIError extends Error {
    constructor(m, s, c) { super(m); this.statusCode = s; this.code = c; }
  },
  errors: {
    DEVIS_NOT_FOUND: Object.assign(new Error('Not found'), { statusCode: 404, code: 'DEVIS_NOT_FOUND' }),
    FORBIDDEN: Object.assign(new Error('Forbidden'), { statusCode: 403, code: 'FORBIDDEN' }),
    PROJECT_NOT_FOUND: Object.assign(new Error('Project not found'), { statusCode: 404, code: 'PROJECT_NOT_FOUND' }),
  },
}));

jest.unstable_mockModule('../../../server/middleware/logger.js', () => ({
  logger: {
    child: () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }),
  },
}));

jest.unstable_mockModule('../../../server/services/aiService.js', () => ({
  analyzePhotos: jest.fn(),
  generateSubDevisFromAnalysis: jest.fn(),
}));

const devisController = await import('../../../server/controllers/devisController.js');
const { APIError } = await import('../../../server/middleware/errorHandler.js');

// --- Helpers ---
function mockReq(overrides = {}) {
  return { user: { id: 1, role: 'user' }, params: {}, query: {}, body: {}, ...overrides };
}

function mockRes() {
  const res = { statusCode: 200, _json: null, status(c) { res.statusCode = c; return res; }, json(d) { res._json = d; return res; } };
  return res;
}

// --- Tests ---
beforeEach(() => {
  jest.clearAllMocks();
  mockGet.mockReturnValue(null);
  mockAll.mockReturnValue([]);
  mockRun.mockReturnValue({ changes: 1, lastInsertRowid: 10 });
});

// ===== getDevis =====
describe('getDevis', () => {
  test('returns paginated devis list', async () => {
    mockGet.mockReturnValueOnce({ total: 2 });
    mockAll.mockReturnValueOnce([{ id: 1, title: 'D1' }, { id: 2, title: 'D2' }]);
    const req = mockReq({ query: { page: '1', limit: '20' } });
    const res = mockRes();
    await devisController.getDevis(req, res);
    expect(res._json.success).toBe(true);
    expect(res._json.data.devis).toHaveLength(2);
    expect(res._json.data.pagination.total).toBe(2);
  });

  test('filters by status', async () => {
    mockGet.mockReturnValueOnce({ total: 1 });
    mockAll.mockReturnValueOnce([{ id: 1, status: 'draft' }]);
    const req = mockReq({ query: { status: 'draft' } });
    const res = mockRes();
    await devisController.getDevis(req, res);
    expect(res._json.success).toBe(true);
    const callArgs = mockPrepare.mock.calls.map(c => c[0]);
    expect(callArgs.some(q => q.includes('d.status = ?'))).toBe(true);
  });

  test('filters by project_id', async () => {
    mockGet.mockReturnValueOnce({ total: 1 });
    mockAll.mockReturnValueOnce([{ id: 1 }]);
    const req = mockReq({ query: { project_id: '5' } });
    const res = mockRes();
    await devisController.getDevis(req, res);
    expect(res._json.success).toBe(true);
    const callArgs = mockPrepare.mock.calls.map(c => c[0]);
    expect(callArgs.some(q => q.includes('d.project_id = ?'))).toBe(true);
  });
});

// ===== createDevis =====
describe('createDevis', () => {
  test('creates a draft devis', async () => {
    const createdDevis = { id: 10, title: 'New', status: 'draft', user_id: 1 };
    mockGet.mockReturnValueOnce(createdDevis); // SELECT after insert
    const req = mockReq({ body: { title: 'New' } });
    const res = mockRes();
    await devisController.createDevis(req, res);
    expect(res.statusCode).toBe(201);
    expect(res._json.success).toBe(true);
    expect(res._json.data.devis.title).toBe('New');
  });

  test('validates project ownership when project_id provided', async () => {
    mockGet.mockReturnValueOnce({ id: 5, user_id: 999 }); // project owned by other user
    const req = mockReq({ body: { title: 'New', project_id: 5 } });
    const res = mockRes();
    await expect(devisController.createDevis(req, res)).rejects.toHaveProperty('statusCode', 404);
  });

  test('allows valid project ownership', async () => {
    mockGet
      .mockReturnValueOnce({ id: 5, user_id: 1 }) // project owned by user
      .mockReturnValueOnce({ id: 10, title: 'New', user_id: 1, status: 'draft' }); // created devis
    const req = mockReq({ body: { title: 'New', project_id: 5 } });
    const res = mockRes();
    await devisController.createDevis(req, res);
    expect(res.statusCode).toBe(201);
  });
});

// ===== getDevisStats =====
describe('getDevisStats', () => {
  test('returns count and amount stats', async () => {
    mockGet
      .mockReturnValueOnce({ count: 5 })
      .mockReturnValueOnce({ sum: 10000 })
      .mockReturnValueOnce({ avg: 2000 })
      .mockReturnValueOnce({ count: 2 });
    mockAll.mockReturnValueOnce([{ status: 'draft', count: 3 }, { status: 'approved', count: 2 }]);
    const req = mockReq();
    const res = mockRes();
    await devisController.getDevisStats(req, res);
    expect(res._json.success).toBe(true);
    expect(res._json.data.stats.total).toBe(5);
  });
});

// ===== getDevisById =====
describe('getDevisById', () => {
  test('returns devis with sub_devis, materials and photos', async () => {
    const devis = { id: 1, user_id: 1, title: 'Test' };
    mockGet
      .mockReturnValueOnce(devis); // main devis
    mockAll
      .mockReturnValueOnce([{ id: 1, devis_id: 1 }]) // sub_devis
      .mockReturnValueOnce([{ id: 1, name: 'cement' }]) // materials for sub_devis
      .mockReturnValueOnce([]) // images for sub_devis
      .mockReturnValueOnce([{ id: 1, url: 'photo.jpg' }]); // photos
    const req = mockReq({ params: { id: '1' } });
    const res = mockRes();
    await devisController.getDevisById(req, res);
    expect(res._json.success).toBe(true);
    expect(res._json.data.devis).toEqual(devis);
    expect(res._json.data.sub_devis).toHaveLength(1);
    expect(res._json.data.photos).toHaveLength(1);
  });

  test('throws 404 if devis not found', async () => {
    mockGet.mockReturnValueOnce(null);
    const req = mockReq({ params: { id: '999' } });
    const res = mockRes();
    await expect(devisController.getDevisById(req, res)).rejects.toHaveProperty('statusCode', 404);
  });

  test('throws 403 if not owner and not admin', async () => {
    mockGet.mockReturnValueOnce({ id: 1, user_id: 999, title: 'Other' });
    const req = mockReq({ params: { id: '1' } });
    const res = mockRes();
    await expect(devisController.getDevisById(req, res)).rejects.toHaveProperty('statusCode', 403);
  });
});

// ===== updateDevis =====
describe('updateDevis', () => {
  test('updates allowed fields', async () => {
    mockGet
      .mockReturnValueOnce({ id: 1, user_id: 1 }) // existing
      .mockReturnValueOnce({ id: 1, user_id: 1, title: 'Updated' }); // after update
    const req = mockReq({ params: { id: '1' }, body: { title: 'Updated' } });
    const res = mockRes();
    await devisController.updateDevis(req, res);
    expect(res._json.success).toBe(true);
    expect(res._json.data.devis.title).toBe('Updated');
  });

  test('throws 404 if devis not found', async () => {
    mockGet.mockReturnValueOnce(null);
    const req = mockReq({ params: { id: '999' }, body: { title: 'X' } });
    const res = mockRes();
    await expect(devisController.updateDevis(req, res)).rejects.toHaveProperty('statusCode', 404);
  });

  test('throws 403 if not owner', async () => {
    mockGet.mockReturnValueOnce({ id: 1, user_id: 999 });
    const req = mockReq({ params: { id: '1' }, body: { title: 'X' } });
    const res = mockRes();
    await expect(devisController.updateDevis(req, res)).rejects.toHaveProperty('statusCode', 403);
  });

  test('throws 400 if no data to update', async () => {
    mockGet.mockReturnValueOnce({ id: 1, user_id: 1 });
    const req = mockReq({ params: { id: '1' }, body: {} });
    const res = mockRes();
    await expect(devisController.updateDevis(req, res)).rejects.toHaveProperty('statusCode', 400);
  });
});

// ===== deleteDevis =====
describe('deleteDevis', () => {
  test('deletes devis and associated sub_devis', async () => {
    mockGet.mockReturnValueOnce({ id: 1, user_id: 1 });
    mockAll.mockReturnValueOnce([{ id: 10 }, { id: 11 }]); // sub_devis ids
    const req = mockReq({ params: { id: '1' } });
    const res = mockRes();
    await devisController.deleteDevis(req, res);
    expect(res._json.success).toBe(true);
    // Verify sub_devis materials/images deleted, then sub_devis, photos, devis
    expect(mockRun).toHaveBeenCalled();
  });

  test('throws 404 if devis not found', async () => {
    mockGet.mockReturnValueOnce(null);
    const req = mockReq({ params: { id: '999' } });
    const res = mockRes();
    await expect(devisController.deleteDevis(req, res)).rejects.toHaveProperty('statusCode', 404);
  });

  test('throws 403 if not owner', async () => {
    mockGet.mockReturnValueOnce({ id: 1, user_id: 999 });
    const req = mockReq({ params: { id: '1' } });
    const res = mockRes();
    await expect(devisController.deleteDevis(req, res)).rejects.toHaveProperty('statusCode', 403);
  });
});

// ===== duplicateDevis =====
describe('duplicateDevis', () => {
  test('creates a copy of the devis', async () => {
    const original = { id: 1, user_id: 1, title: 'Original', project_id: null, description: 'desc', room_type: 'kitchen', surface_area: 20, urgency: 'normal' };
    mockGet
      .mockReturnValueOnce(original) // find original
      .mockReturnValueOnce({ id: 10, title: 'Original (copie)', user_id: 1, status: 'draft' }); // new devis
    mockAll
      .mockReturnValueOnce([]) // sub_devis of original (empty)
    const req = mockReq({ params: { id: '1' } });
    const res = mockRes();
    await devisController.duplicateDevis(req, res);
    expect(res.statusCode).toBe(201);
    expect(res._json.data.devis.id).toBe(10);
  });

  test('throws 404 if original not found', async () => {
    mockGet.mockReturnValueOnce(null);
    const req = mockReq({ params: { id: '999' } });
    const res = mockRes();
    await expect(devisController.duplicateDevis(req, res)).rejects.toHaveProperty('statusCode', 404);
  });

  test('throws 403 if not owner', async () => {
    mockGet.mockReturnValueOnce({ id: 1, user_id: 999 });
    const req = mockReq({ params: { id: '1' } });
    const res = mockRes();
    await expect(devisController.duplicateDevis(req, res)).rejects.toHaveProperty('statusCode', 403);
  });
});

// ===== createSubDevis =====
describe('createSubDevis', () => {
  test('adds sub-devis to a devis', async () => {
    mockGet
      .mockReturnValueOnce({ max: 0 }) // max priority
      .mockReturnValueOnce({ materials_total: 0, labor_total: 0, total: 0 }) // updateDevisTotals totals
      .mockReturnValueOnce({ id: 10, devis_id: 1, title: 'Plumbing' }); // created sub_devis
    const req = mockReq({ params: { id: '1' }, body: { work_type: 'plumbing', title: 'Plumbing', labor_hours: 5, labor_rate: 50 } });
    const res = mockRes();
    await devisController.createSubDevis(req, res);
    expect(res.statusCode).toBe(201);
    expect(res._json.success).toBe(true);
  });
});

// ===== updateSubDevis =====
describe('updateSubDevis', () => {
  test('updates sub-devis fields', async () => {
    mockGet
      .mockReturnValueOnce({ id: 10, devis_id: 1, labor_hours: 5, labor_rate: 50, materials_cost: 100 }) // existing
      .mockReturnValueOnce({ materials_total: 100, labor_total: 250, total: 350 }) // updateDevisTotals
      .mockReturnValueOnce({ id: 10, title: 'Updated' }); // updated
    const req = mockReq({ params: { id: '1', subId: '10' }, body: { title: 'Updated' } });
    const res = mockRes();
    await devisController.updateSubDevis(req, res);
    expect(res._json.success).toBe(true);
  });

  test('throws 404 if sub-devis not found', async () => {
    mockGet.mockReturnValueOnce(null);
    const req = mockReq({ params: { id: '1', subId: '999' }, body: { title: 'X' } });
    const res = mockRes();
    await expect(devisController.updateSubDevis(req, res)).rejects.toHaveProperty('statusCode', 404);
  });
});

// ===== deleteSubDevis =====
describe('deleteSubDevis', () => {
  test('deletes sub-devis and updates totals', async () => {
    mockGet.mockReturnValueOnce({ materials_total: 0, labor_total: 0, total: 0 }); // updateDevisTotals
    const req = mockReq({ params: { id: '1', subId: '10' } });
    const res = mockRes();
    await devisController.deleteSubDevis(req, res);
    expect(res._json.success).toBe(true);
    expect(mockRun).toHaveBeenCalled();
  });
});

// ===== addMaterial =====
describe('addMaterial', () => {
  test('adds material to sub-devis', async () => {
    mockGet
      .mockReturnValueOnce({ sum: 500 }) // total materials
      .mockReturnValueOnce({ id: 10, labor_cost: 250 }) // sub_devis for total calc
      .mockReturnValueOnce({ materials_total: 500, labor_total: 250, total: 750 }) // updateDevisTotals
      .mockReturnValueOnce({ id: 1, name: 'Cement', quantity: 10, unit_price: 5 }); // created material
    const req = mockReq({ params: { id: '1', subId: '10' }, body: { name: 'Cement', quantity: 10, unit: 'kg', unit_price: 5 } });
    const res = mockRes();
    await devisController.addMaterial(req, res);
    expect(res.statusCode).toBe(201);
    expect(res._json.success).toBe(true);
  });
});

// ===== updateMaterial =====
describe('updateMaterial', () => {
  test('updates material and recalculates totals', async () => {
    mockGet
      .mockReturnValueOnce({ id: 1, quantity: 10, unit_price: 5 }) // existing material
      .mockReturnValueOnce({ sum: 600 }) // total materials
      .mockReturnValueOnce({ id: 10, labor_cost: 250 }) // sub_devis
      .mockReturnValueOnce({ materials_total: 600, labor_total: 250, total: 850 }) // updateDevisTotals
      .mockReturnValueOnce({ id: 1, name: 'Cement', quantity: 12 }); // updated material
    const req = mockReq({ params: { id: '1', subId: '10', materialId: '1' }, body: { quantity: 12 } });
    const res = mockRes();
    await devisController.updateMaterial(req, res);
    expect(res._json.success).toBe(true);
  });

  test('throws 404 if material not found', async () => {
    mockGet.mockReturnValueOnce(null);
    const req = mockReq({ params: { id: '1', subId: '10', materialId: '999' }, body: { quantity: 1 } });
    const res = mockRes();
    await expect(devisController.updateMaterial(req, res)).rejects.toHaveProperty('statusCode', 404);
  });
});

// ===== deleteMaterial =====
describe('deleteMaterial', () => {
  test('deletes material and recalculates totals', async () => {
    mockGet
      .mockReturnValueOnce({ sum: 0 }) // total materials after delete
      .mockReturnValueOnce({ id: 10, labor_cost: 250 }) // sub_devis
      .mockReturnValueOnce({ materials_total: 0, labor_total: 250, total: 250 }); // updateDevisTotals
    const req = mockReq({ params: { id: '1', subId: '10', materialId: '1' } });
    const res = mockRes();
    await devisController.deleteMaterial(req, res);
    expect(res._json.success).toBe(true);
  });
});

// ===== addDevisPhotos =====
describe('addDevisPhotos', () => {
  test('adds photos to devis', async () => {
    mockGet
      .mockReturnValueOnce({ id: 1, url: 'photo1.jpg' })
      .mockReturnValueOnce({ id: 2, url: 'photo2.jpg' });
    const req = mockReq({
      params: { id: '1' },
      body: { photos: [{ url: 'photo1.jpg', description: 'A' }, { url: 'photo2.jpg' }] },
    });
    const res = mockRes();
    await devisController.addDevisPhotos(req, res);
    expect(res.statusCode).toBe(201);
    expect(res._json.data.photos).toHaveLength(2);
  });
});

// ===== generateDevisPDF =====
describe('generateDevisPDF', () => {
  test('returns PDF generation placeholder', async () => {
    const req = mockReq({ params: { id: '1' } });
    const res = mockRes();
    await devisController.generateDevisPDF(req, res);
    expect(res._json.success).toBe(true);
    expect(res._json.data.url).toContain('pdf');
  });
});

// ===== getSubDevis =====
describe('getSubDevis', () => {
  test('returns sub-devis list with materials', async () => {
    mockAll
      .mockReturnValueOnce([{ id: 1, devis_id: 1 }]) // sub_devis
      .mockReturnValueOnce([{ id: 1, name: 'cement' }]); // materials
    const req = mockReq({ params: { id: '1' } });
    const res = mockRes();
    await devisController.getSubDevis(req, res);
    expect(res._json.success).toBe(true);
    expect(res._json.data.sub_devis).toHaveLength(1);
    expect(res._json.data.sub_devis[0].materials).toHaveLength(1);
  });
});
