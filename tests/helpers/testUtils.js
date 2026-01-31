import { jest } from '@jest/globals';

export function mockReq(overrides = {}) {
  return {
    user: { id: 1, role: 'user', email: 'test@test.com' },
    params: {},
    query: {},
    body: {},
    ...overrides,
  };
}

export function mockRes() {
  const res = {
    statusCode: 200,
    _json: null,
    status(code) { res.statusCode = code; return res; },
    json(data) { res._json = data; return res; },
  };
  return res;
}

export function mockNext() {
  return jest.fn();
}

export function createMockDb() {
  const mockRun = jest.fn(() => ({ changes: 1, lastInsertRowid: 1 }));
  const mockGet = jest.fn(() => null);
  const mockAll = jest.fn(() => []);
  const mockPrepare = jest.fn(() => ({ run: mockRun, get: mockGet, all: mockAll }));
  return { prepare: mockPrepare, _run: mockRun, _get: mockGet, _all: mockAll };
}

export function createTestDevis(overrides = {}) {
  return {
    id: 1,
    user_id: 1,
    project_id: null,
    title: 'Test Devis',
    description: 'A test devis',
    room_type: 'kitchen',
    surface_area: 20,
    urgency: 'normal',
    status: 'draft',
    total_amount: 0,
    materials_total: 0,
    labor_total: 0,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

export function createTestCraftsman(overrides = {}) {
  return {
    id: 1,
    user_id: 2,
    company_name: 'Test Co',
    specialties: '["plumbing"]',
    description: 'A test craftsman',
    hourly_rate: 50,
    experience_years: 5,
    rating: 4.5,
    reviews_count: 10,
    verified: 1,
    featured: 0,
    available: 1,
    city: 'Paris',
    first_name: 'Jean',
    last_name: 'Dupont',
    avatar_url: null,
    email: 'jean@test.com',
    ...overrides,
  };
}
