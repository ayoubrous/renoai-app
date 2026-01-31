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
    USER_NOT_FOUND: Object.assign(new Error('User not found'), { statusCode: 404, code: 'USER_NOT_FOUND' }),
  },
}));

jest.unstable_mockModule('../../../server/middleware/logger.js', () => ({
  logger: {
    child: () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }),
  },
}));

const messageController = await import('../../../server/controllers/messageController.js');
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

// ===== getConversations =====
describe('getConversations', () => {
  test('returns paginated conversations', async () => {
    mockGet.mockReturnValueOnce({ total: 2 });
    mockAll.mockReturnValueOnce([
      { id: 1, user1_id: 1, user2_id: 2, last_message: 'Hi' },
      { id: 2, user1_id: 1, user2_id: 3, last_message: 'Hello' },
    ]);
    const req = mockReq({ query: { page: '1', limit: '20' } });
    const res = mockRes();
    await messageController.getConversations(req, res);
    expect(res._json.success).toBe(true);
    expect(res._json.data.conversations).toHaveLength(2);
    expect(res._json.data.pagination.total).toBe(2);
  });

  test('filters archived conversations', async () => {
    mockGet.mockReturnValueOnce({ total: 1 });
    mockAll.mockReturnValueOnce([{ id: 1 }]);
    const req = mockReq({ query: { archived: 'true' } });
    const res = mockRes();
    await messageController.getConversations(req, res);
    const calls = mockPrepare.mock.calls.map(c => c[0]);
    expect(calls.some(q => q.includes('archived_by LIKE'))).toBe(true);
  });

  test('excludes archived by default', async () => {
    mockGet.mockReturnValueOnce({ total: 1 });
    mockAll.mockReturnValueOnce([{ id: 1 }]);
    const req = mockReq({ query: {} });
    const res = mockRes();
    await messageController.getConversations(req, res);
    const calls = mockPrepare.mock.calls.map(c => c[0]);
    expect(calls.some(q => q.includes('archived_by NOT LIKE') || q.includes('archived_by IS NULL'))).toBe(true);
  });
});

// ===== getConversation =====
describe('getConversation', () => {
  test('returns conversation with messages', async () => {
    const conversation = { id: 1, user1_id: 1, user2_id: 2, project_name: null };
    mockGet.mockReturnValueOnce(conversation);
    mockAll.mockReturnValueOnce([
      { id: 1, content: 'Hello', sender_id: 1 },
      { id: 2, content: 'Hi', sender_id: 2 },
    ]);
    const req = mockReq({ params: { conversationId: '1' }, query: {} });
    const res = mockRes();
    await messageController.getConversation(req, res);
    expect(res._json.success).toBe(true);
    expect(res._json.data.conversation).toEqual(conversation);
    expect(res._json.data.messages).toHaveLength(2);
  });

  test('throws 404 if conversation not found', async () => {
    mockGet.mockReturnValueOnce(null);
    const req = mockReq({ params: { conversationId: '999' }, query: {} });
    const res = mockRes();
    await expect(messageController.getConversation(req, res)).rejects.toHaveProperty('statusCode', 404);
  });

  test('marks messages as read upon retrieval', async () => {
    mockGet.mockReturnValueOnce({ id: 1, user1_id: 1, user2_id: 2 });
    mockAll.mockReturnValueOnce([]);
    const req = mockReq({ params: { conversationId: '1' }, query: {} });
    const res = mockRes();
    await messageController.getConversation(req, res);
    // The last run call should be the UPDATE messages SET read_at
    const updateCalls = mockPrepare.mock.calls.filter(c => c[0].includes('UPDATE messages'));
    expect(updateCalls.length).toBeGreaterThan(0);
  });
});

// ===== createConversation =====
describe('createConversation', () => {
  test('creates a new conversation', async () => {
    mockGet
      .mockReturnValueOnce({ id: 2 }) // target user exists
      .mockReturnValueOnce(null); // no existing conversation
    const req = mockReq({ body: { user_id: 2 } });
    const res = mockRes();
    await messageController.createConversation(req, res);
    expect(res.statusCode).toBe(201);
    expect(res._json.success).toBe(true);
    expect(res._json.data.conversation_id).toBeDefined();
  });

  test('returns existing conversation if already exists', async () => {
    mockGet
      .mockReturnValueOnce({ id: 2 }) // target user exists
      .mockReturnValueOnce({ id: 5 }); // existing conversation
    const req = mockReq({ body: { user_id: 2 } });
    const res = mockRes();
    await messageController.createConversation(req, res);
    expect(res._json.data.conversation_id).toBe(5);
    expect(res.statusCode).toBe(200);
  });

  test('adds initial_message when creating new conversation', async () => {
    mockGet
      .mockReturnValueOnce({ id: 2 }) // target user exists
      .mockReturnValueOnce(null); // no existing conversation
    const req = mockReq({ body: { user_id: 2, initial_message: 'Hello!' } });
    const res = mockRes();
    await messageController.createConversation(req, res);
    expect(res.statusCode).toBe(201);
    // Should have INSERT INTO messages call
    const insertMsgCalls = mockPrepare.mock.calls.filter(c => c[0].includes('INSERT INTO messages'));
    expect(insertMsgCalls.length).toBeGreaterThan(0);
  });

  test('adds initial_message to existing conversation', async () => {
    mockGet
      .mockReturnValueOnce({ id: 2 }) // target user exists
      .mockReturnValueOnce({ id: 5 }); // existing conversation
    const req = mockReq({ body: { user_id: 2, initial_message: 'Hello again!' } });
    const res = mockRes();
    await messageController.createConversation(req, res);
    const insertMsgCalls = mockPrepare.mock.calls.filter(c => c[0].includes('INSERT INTO messages'));
    expect(insertMsgCalls.length).toBeGreaterThan(0);
  });

  test('throws 400 if no user_id', async () => {
    const req = mockReq({ body: {} });
    const res = mockRes();
    await expect(messageController.createConversation(req, res)).rejects.toHaveProperty('statusCode', 400);
  });

  test('throws 404 if target user not found', async () => {
    mockGet.mockReturnValueOnce(null); // user not found
    const req = mockReq({ body: { user_id: 999 } });
    const res = mockRes();
    await expect(messageController.createConversation(req, res)).rejects.toHaveProperty('statusCode', 404);
  });
});

// ===== sendMessage =====
describe('sendMessage', () => {
  test('sends message and returns it', async () => {
    mockGet
      .mockReturnValueOnce({ id: 2 }) // receiver exists
      .mockReturnValueOnce({ id: 5 }) // existing conversation
      .mockReturnValueOnce({ id: 10, content: 'Hello', sender_id: 1, first_name: 'Test' }); // created message
    const req = mockReq({ body: { receiver_id: 2, content: 'Hello' } });
    const res = mockRes();
    await messageController.sendMessage(req, res);
    expect(res.statusCode).toBe(201);
    expect(res._json.success).toBe(true);
    expect(res._json.data.message.content).toBe('Hello');
    expect(res._json.data.conversation_id).toBe(5);
  });

  test('creates conversation if none exists', async () => {
    mockGet
      .mockReturnValueOnce({ id: 2 }) // receiver exists
      .mockReturnValueOnce(null) // no existing conversation
      .mockReturnValueOnce({ id: 10, content: 'Hello', sender_id: 1 }); // created message
    mockRun.mockReturnValueOnce({ changes: 1, lastInsertRowid: 20 }); // new conversation
    const req = mockReq({ body: { receiver_id: 2, content: 'Hello' } });
    const res = mockRes();
    await messageController.sendMessage(req, res);
    expect(res.statusCode).toBe(201);
  });

  test('throws 404 if receiver not found', async () => {
    mockGet.mockReturnValueOnce(null);
    const req = mockReq({ body: { receiver_id: 999, content: 'Hello' } });
    const res = mockRes();
    await expect(messageController.sendMessage(req, res)).rejects.toHaveProperty('statusCode', 404);
  });
});

// ===== markAsRead =====
describe('markAsRead', () => {
  test('marks a message as read', async () => {
    const req = mockReq({ params: { messageId: '1' } });
    const res = mockRes();
    await messageController.markAsRead(req, res);
    expect(res._json.success).toBe(true);
    expect(mockRun).toHaveBeenCalled();
  });
});

// ===== archiveConversation =====
describe('archiveConversation', () => {
  test('archives a conversation for the user', async () => {
    mockGet.mockReturnValueOnce({ archived_by: null });
    const req = mockReq({ params: { conversationId: '1' } });
    const res = mockRes();
    await messageController.archiveConversation(req, res);
    expect(res._json.success).toBe(true);
    expect(mockRun).toHaveBeenCalled();
  });

  test('throws 404 if conversation not found', async () => {
    mockGet.mockReturnValueOnce(null);
    const req = mockReq({ params: { conversationId: '999' } });
    const res = mockRes();
    await expect(messageController.archiveConversation(req, res)).rejects.toHaveProperty('statusCode', 404);
  });
});

// ===== getUnreadCount =====
describe('getUnreadCount', () => {
  test('returns unread message count', async () => {
    mockGet.mockReturnValueOnce({ count: 7 });
    const req = mockReq();
    const res = mockRes();
    await messageController.getUnreadCount(req, res);
    expect(res._json.success).toBe(true);
    expect(res._json.data.count).toBe(7);
  });

  test('returns zero when no unread messages', async () => {
    mockGet.mockReturnValueOnce({ count: 0 });
    const req = mockReq();
    const res = mockRes();
    await messageController.getUnreadCount(req, res);
    expect(res._json.data.count).toBe(0);
  });
});
