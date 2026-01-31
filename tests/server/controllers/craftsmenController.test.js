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
    CRAFTSMAN_NOT_FOUND: Object.assign(new Error('Craftsman not found'), { statusCode: 404, code: 'CRAFTSMAN_NOT_FOUND' }),
    USER_NOT_FOUND: Object.assign(new Error('User not found'), { statusCode: 404, code: 'USER_NOT_FOUND' }),
  },
}));

jest.unstable_mockModule('../../../server/middleware/logger.js', () => ({
  logger: {
    child: () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }),
  },
}));

const craftsmenController = await import('../../../server/controllers/craftsmenController.js');
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

// ===== searchCraftsmen =====
describe('searchCraftsmen', () => {
  test('returns paginated list of craftsmen', async () => {
    mockGet.mockReturnValueOnce({ total: 2 });
    mockAll.mockReturnValueOnce([
      { id: 1, company_name: 'A', specialties: '["plumbing"]' },
      { id: 2, company_name: 'B', specialties: '["electrical"]' },
    ]);
    const req = mockReq({ query: { page: '1', limit: '20' } });
    const res = mockRes();
    await craftsmenController.searchCraftsmen(req, res);
    expect(res._json.success).toBe(true);
    expect(res._json.data.craftsmen).toHaveLength(2);
    expect(res._json.data.pagination.total).toBe(2);
  });

  test('filters by specialty', async () => {
    mockGet.mockReturnValueOnce({ total: 1 });
    mockAll.mockReturnValueOnce([{ id: 1, specialties: '["plumbing"]' }]);
    const req = mockReq({ query: { specialty: 'plumbing' } });
    const res = mockRes();
    await craftsmenController.searchCraftsmen(req, res);
    const calls = mockPrepare.mock.calls.map(c => c[0]);
    expect(calls.some(q => q.includes('specialties LIKE'))).toBe(true);
  });

  test('filters by city', async () => {
    mockGet.mockReturnValueOnce({ total: 1 });
    mockAll.mockReturnValueOnce([{ id: 1, specialties: '[]' }]);
    const req = mockReq({ query: { city: 'Paris' } });
    const res = mockRes();
    await craftsmenController.searchCraftsmen(req, res);
    const calls = mockPrepare.mock.calls.map(c => c[0]);
    expect(calls.some(q => q.includes('city LIKE'))).toBe(true);
  });

  test('filters by min_rating', async () => {
    mockGet.mockReturnValueOnce({ total: 1 });
    mockAll.mockReturnValueOnce([{ id: 1, specialties: '[]' }]);
    const req = mockReq({ query: { min_rating: '4' } });
    const res = mockRes();
    await craftsmenController.searchCraftsmen(req, res);
    const calls = mockPrepare.mock.calls.map(c => c[0]);
    expect(calls.some(q => q.includes('rating >='))).toBe(true);
  });

  test('filters by max_rate', async () => {
    mockGet.mockReturnValueOnce({ total: 1 });
    mockAll.mockReturnValueOnce([{ id: 1, specialties: '[]' }]);
    const req = mockReq({ query: { max_rate: '60' } });
    const res = mockRes();
    await craftsmenController.searchCraftsmen(req, res);
    const calls = mockPrepare.mock.calls.map(c => c[0]);
    expect(calls.some(q => q.includes('hourly_rate <='))).toBe(true);
  });

  test('filters by available', async () => {
    mockGet.mockReturnValueOnce({ total: 1 });
    mockAll.mockReturnValueOnce([{ id: 1, specialties: '[]' }]);
    const req = mockReq({ query: { available: 'true' } });
    const res = mockRes();
    await craftsmenController.searchCraftsmen(req, res);
    const calls = mockPrepare.mock.calls.map(c => c[0]);
    expect(calls.some(q => q.includes('available = 1'))).toBe(true);
  });

  test('filters by verified', async () => {
    mockGet.mockReturnValueOnce({ total: 1 });
    mockAll.mockReturnValueOnce([{ id: 1, specialties: '[]' }]);
    const req = mockReq({ query: { verified: 'true' } });
    const res = mockRes();
    await craftsmenController.searchCraftsmen(req, res);
    const calls = mockPrepare.mock.calls.map(c => c[0]);
    expect(calls.some(q => q.includes('verified = 1'))).toBe(true);
  });

  test('filters by search term', async () => {
    mockGet.mockReturnValueOnce({ total: 1 });
    mockAll.mockReturnValueOnce([{ id: 1, specialties: '[]' }]);
    const req = mockReq({ query: { search: 'jean' } });
    const res = mockRes();
    await craftsmenController.searchCraftsmen(req, res);
    const calls = mockPrepare.mock.calls.map(c => c[0]);
    expect(calls.some(q => q.includes('company_name LIKE'))).toBe(true);
  });

  test('parses specialties JSON', async () => {
    mockGet.mockReturnValueOnce({ total: 1 });
    mockAll.mockReturnValueOnce([{ id: 1, specialties: '["plumbing","electrical"]' }]);
    const req = mockReq({ query: {} });
    const res = mockRes();
    await craftsmenController.searchCraftsmen(req, res);
    expect(res._json.data.craftsmen[0].specialties).toEqual(['plumbing', 'electrical']);
  });
});

// ===== getFeaturedCraftsmen =====
describe('getFeaturedCraftsmen', () => {
  test('returns featured verified craftsmen', async () => {
    mockAll.mockReturnValueOnce([
      { id: 1, featured: 1, verified: 1, specialties: '["plumbing"]' },
    ]);
    const req = mockReq();
    const res = mockRes();
    await craftsmenController.getFeaturedCraftsmen(req, res);
    expect(res._json.success).toBe(true);
    expect(res._json.data.craftsmen).toHaveLength(1);
    expect(res._json.data.craftsmen[0].specialties).toEqual(['plumbing']);
  });
});

// ===== getSpecialties =====
describe('getSpecialties', () => {
  test('returns static specialties list', async () => {
    const req = mockReq();
    const res = mockRes();
    await craftsmenController.getSpecialties(req, res);
    expect(res._json.success).toBe(true);
    expect(res._json.data.specialties.length).toBeGreaterThan(0);
    expect(res._json.data.specialties[0]).toHaveProperty('id');
    expect(res._json.data.specialties[0]).toHaveProperty('name');
  });
});

// ===== getCraftsmanById =====
describe('getCraftsmanById', () => {
  test('returns craftsman with stats and reviews', async () => {
    const craftsman = {
      id: 1, specialties: '["plumbing"]', service_area: '["Paris"]',
      certifications: '["RGE"]', company_name: 'Test Co',
    };
    mockGet
      .mockReturnValueOnce(craftsman) // craftsman
      .mockReturnValueOnce({ count: 5 }) // total_reviews
      .mockReturnValueOnce({ count: 3 }); // projects_completed
    mockAll.mockReturnValueOnce([{ id: 1, rating: 5 }]); // recent_reviews
    const req = mockReq({ params: { id: '1' } });
    const res = mockRes();
    await craftsmenController.getCraftsmanById(req, res);
    expect(res._json.success).toBe(true);
    expect(res._json.data.craftsman.specialties).toEqual(['plumbing']);
    expect(res._json.data.stats.total_reviews).toBe(5);
  });

  test('throws 404 if not found', async () => {
    mockGet.mockReturnValueOnce(null);
    const req = mockReq({ params: { id: '999' } });
    const res = mockRes();
    await expect(craftsmenController.getCraftsmanById(req, res)).rejects.toHaveProperty('statusCode', 404);
  });

  test('handles invalid JSON in specialties gracefully', async () => {
    const craftsman = { id: 1, specialties: 'invalid', service_area: null, certifications: null };
    mockGet
      .mockReturnValueOnce(craftsman)
      .mockReturnValueOnce({ count: 0 })
      .mockReturnValueOnce({ count: 0 });
    mockAll.mockReturnValueOnce([]);
    const req = mockReq({ params: { id: '1' } });
    const res = mockRes();
    await craftsmenController.getCraftsmanById(req, res);
    expect(res._json.data.craftsman.specialties).toEqual([]);
  });
});

// ===== getCraftsmanReviews =====
describe('getCraftsmanReviews', () => {
  test('returns paginated reviews with rating distribution', async () => {
    mockGet.mockReturnValueOnce({ count: 10 });
    mockAll
      .mockReturnValueOnce([{ id: 1, rating: 5, comment: 'Great' }]) // reviews
      .mockReturnValueOnce([{ rating: 5, count: 7 }, { rating: 4, count: 3 }]); // distribution
    const req = mockReq({ params: { id: '1' }, query: { page: '1', limit: '10' } });
    const res = mockRes();
    await craftsmenController.getCraftsmanReviews(req, res);
    expect(res._json.success).toBe(true);
    expect(res._json.data.reviews).toHaveLength(1);
    expect(res._json.data.rating_distribution).toHaveLength(2);
    expect(res._json.data.pagination.total).toBe(10);
  });
});

// ===== addReview =====
describe('addReview', () => {
  test('creates a review for a craftsman', async () => {
    mockGet
      .mockReturnValueOnce({ id: 1 }) // craftsman exists
      .mockReturnValueOnce(null) // no existing review
      .mockReturnValueOnce({ avg: 4.5, count: 11 }) // avg rating
      .mockReturnValueOnce({ id: 10, rating: 5, comment: 'Great' }); // created review
    const req = mockReq({ params: { id: '1' }, body: { rating: 5, comment: 'Great' } });
    const res = mockRes();
    await craftsmenController.addReview(req, res);
    expect(res.statusCode).toBe(201);
    expect(res._json.success).toBe(true);
    expect(res._json.data.review.rating).toBe(5);
  });

  test('throws 404 if craftsman not found', async () => {
    mockGet.mockReturnValueOnce(null);
    const req = mockReq({ params: { id: '999' }, body: { rating: 5 } });
    const res = mockRes();
    await expect(craftsmenController.addReview(req, res)).rejects.toHaveProperty('statusCode', 404);
  });

  test('throws 409 if review already exists', async () => {
    mockGet
      .mockReturnValueOnce({ id: 1 }) // craftsman exists
      .mockReturnValueOnce({ id: 5 }); // existing review
    const req = mockReq({ params: { id: '1' }, body: { rating: 5 } });
    const res = mockRes();
    await expect(craftsmenController.addReview(req, res)).rejects.toHaveProperty('statusCode', 409);
  });
});

// ===== getCraftsmanPortfolio =====
describe('getCraftsmanPortfolio', () => {
  test('returns portfolio items', async () => {
    mockAll.mockReturnValueOnce([{ id: 1, url: 'img.jpg', title: 'Kitchen' }]);
    const req = mockReq({ params: { id: '1' } });
    const res = mockRes();
    await craftsmenController.getCraftsmanPortfolio(req, res);
    expect(res._json.success).toBe(true);
    expect(res._json.data.portfolio).toHaveLength(1);
  });
});

// ===== addPortfolioPhotos =====
describe('addPortfolioPhotos', () => {
  test('adds photos to portfolio', async () => {
    mockGet
      .mockReturnValueOnce({ id: 1 }) // craftsman profile
      .mockReturnValueOnce({ id: 10, url: 'img.jpg' }); // inserted photo
    const req = mockReq({ body: { photos: [{ url: 'img.jpg', title: 'Kitchen' }] } });
    const res = mockRes();
    await craftsmenController.addPortfolioPhotos(req, res);
    expect(res.statusCode).toBe(201);
    expect(res._json.data.photos).toHaveLength(1);
  });

  test('throws 404 if no craftsman profile', async () => {
    mockGet.mockReturnValueOnce(null);
    const req = mockReq({ body: { photos: [{ url: 'img.jpg' }] } });
    const res = mockRes();
    await expect(craftsmenController.addPortfolioPhotos(req, res)).rejects.toHaveProperty('statusCode', 404);
  });
});
