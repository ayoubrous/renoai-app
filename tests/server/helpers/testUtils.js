import { jest } from '@jest/globals';

// Mock request helper
export function mockReq(overrides = {}) {
  return {
    body: {},
    params: {},
    query: {},
    user: { id: 1, email: 'test@test.com', role: 'user' },
    ip: '127.0.0.1',
    method: 'GET',
    originalUrl: '/api/test',
    path: '/api/test',
    get: jest.fn((header) => {
      const headers = { 'User-Agent': 'TestAgent', 'Content-Type': 'application/json', ...overrides.headers };
      return headers[header];
    }),
    ...overrides,
  };
}

export function mockRes() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    statusCode: 200,
  };
  return res;
}

export function mockNext() {
  return jest.fn();
}

// DB mock helpers
export function createMockDb() {
  const mockRun = jest.fn(() => ({ changes: 1, lastInsertRowid: 1 }));
  const mockGet = jest.fn(() => null);
  const mockAll = jest.fn(() => []);
  const mockPrepare = jest.fn(() => ({ run: mockRun, get: mockGet, all: mockAll }));
  return { prepare: mockPrepare, _mockRun: mockRun, _mockGet: mockGet, _mockAll: mockAll, _mockPrepare: mockPrepare };
}

// Test data factories
export function createTestUser(overrides = {}) {
  return {
    id: 1, email: 'thomas@test.lu', password: '$2a$12$hashedpassword', first_name: 'Thomas', last_name: 'Muller',
    role: 'user', status: 'active', email_verified: 1, avatar_url: null, phone: '+352123456',
    address: '1 rue Test', city: 'Luxembourg', postal_code: 'L-1234',
    created_at: '2025-01-01T00:00:00Z', last_login: '2025-01-15T00:00:00Z',
    failed_login_attempts: 0, ...overrides,
  };
}

export function createTestProject(overrides = {}) {
  return {
    id: 1, user_id: 1, name: 'Rénovation salle de bain', type: 'bathroom', description: 'Test project',
    status: 'draft', priority: 'medium', progress: 0, estimated_budget: 15000,
    address: '1 rue Test', city: 'Luxembourg', postal_code: 'L-1234',
    created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z', ...overrides,
  };
}

export function createTestDevis(overrides = {}) {
  return {
    id: 1, user_id: 1, project_id: 1, title: 'Devis salle de bain', status: 'draft',
    total_amount: 15000, subtotal: 12820.51, tax_rate: 17, tax_amount: 2179.49,
    created_at: '2025-01-01T00:00:00Z', ...overrides,
  };
}

export function createTestCraftsman(overrides = {}) {
  return {
    id: 1, user_id: 2, company_name: 'Plomberie Martin', specialties: '["plumbing"]',
    rating: 4.9, reviews_count: 127, experience_years: 15, hourly_rate: 55,
    verified: 1, available: 1, ...overrides,
  };
}
