import { jest } from '@jest/globals';
import { createMockDb } from '../helpers/testUtils.js';

const mockDb = createMockDb();

jest.unstable_mockModule('../../../server/config/database.js', () => ({
  getDatabase: jest.fn(() => mockDb)
}));
jest.unstable_mockModule('../../../server/middleware/logger.js', () => ({
  logger: {
    child: () => ({
      info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn()
    })
  }
}));

const mockRegisterConnectedUser = jest.fn();
const mockUnregisterConnectedUser = jest.fn();
const mockGetUserSocketIds = jest.fn(() => []);
const mockIsUserConnected = jest.fn(() => false);
const mockRequireSocketAuth = jest.fn((socket, handler) => handler);

jest.unstable_mockModule('../../../server/middleware/socketAuth.js', () => ({
  registerConnectedUser: mockRegisterConnectedUser,
  unregisterConnectedUser: mockUnregisterConnectedUser,
  getUserSocketIds: mockGetUserSocketIds,
  isUserConnected: mockIsUserConnected,
  requireSocketAuth: mockRequireSocketAuth
}));

const { setupSocketHandlers, emitToUser, emitToProject, broadcast } = await import('../../../server/socket/handlers.js');

function createMockSocket() {
  const handlers = {};
  return {
    id: 'socket-1',
    user: { id: 'user-1', first_name: 'Test', last_name: 'User' },
    handshake: { address: '127.0.0.1' },
    join: jest.fn(),
    leave: jest.fn(),
    emit: jest.fn(),
    broadcast: { emit: jest.fn() },
    to: jest.fn(() => ({ emit: jest.fn() })),
    on: jest.fn((event, handler) => { handlers[event] = handler; }),
    _handlers: handlers
  };
}

function createMockIo() {
  let connectionHandler;
  const mockSocket = createMockSocket();
  return {
    on: jest.fn((event, handler) => {
      if (event === 'connection') {
        connectionHandler = handler;
        handler(mockSocket);
      }
    }),
    to: jest.fn(() => ({ emit: jest.fn() })),
    emit: jest.fn(),
    _connectionHandler: () => connectionHandler,
    _socket: mockSocket
  };
}

describe('socket handlers', () => {
  let io, socket;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb._mockRun.mockReturnValue({ changes: 1, lastInsertRowid: 1 });
    mockDb._mockGet.mockReturnValue(null);
    mockDb._mockAll.mockReturnValue([]);
    io = createMockIo();
    socket = io._socket;
  });

  // ---- setupSocketHandlers ----
  describe('setupSocketHandlers', () => {
    it('should register connection handler', () => {
      setupSocketHandlers(io);
      expect(io.on).toHaveBeenCalledWith('connection', expect.any(Function));
    });

    it('should register all event handlers on socket', () => {
      setupSocketHandlers(io);
      const registeredEvents = socket.on.mock.calls.map(c => c[0]);
      expect(registeredEvents).toContain('message:send');
      expect(registeredEvents).toContain('message:read');
      expect(registeredEvents).toContain('typing:start');
      expect(registeredEvents).toContain('typing:stop');
      expect(registeredEvents).toContain('project:join');
      expect(registeredEvents).toContain('project:leave');
      expect(registeredEvents).toContain('disconnect');
    });
  });

  // ---- connection ----
  describe('connection', () => {
    it('should register user and join user room', () => {
      setupSocketHandlers(io);
      expect(mockRegisterConnectedUser).toHaveBeenCalledWith('user-1', 'socket-1');
      expect(socket.join).toHaveBeenCalledWith('user:user-1');
    });

    it('should broadcast user:online', () => {
      setupSocketHandlers(io);
      expect(socket.broadcast.emit).toHaveBeenCalledWith('user:online', expect.objectContaining({
        userId: 'user-1'
      }));
    });
  });

  // ---- message:send ----
  describe('message:send', () => {
    it('should create conversation if needed, insert message, emit to receiver', async () => {
      setupSocketHandlers(io);
      const handler = socket._handlers['message:send'];

      mockDb._mockGet
        .mockReturnValueOnce(null) // no existing conversation
        .mockReturnValueOnce({ id: 1, sender_id: 'user-1', content: 'Hello' }); // message lookup

      mockGetUserSocketIds.mockReturnValue(['recv-socket']);

      await handler({ receiverId: 'user-2', content: 'Hello' });

      expect(mockDb._mockRun).toHaveBeenCalled();
      expect(socket.emit).toHaveBeenCalledWith('message:sent', expect.objectContaining({ success: true }));
    });
  });

  // ---- message:read ----
  describe('message:read', () => {
    it('should mark messages as read', async () => {
      setupSocketHandlers(io);
      const handler = socket._handlers['message:read'];
      await handler({ messageIds: ['m1', 'm2'] });
      expect(mockDb.prepare).toHaveBeenCalled();
      expect(socket.emit).toHaveBeenCalledWith('message:read:ack', { success: true });
    });
  });

  // ---- typing:start / typing:stop ----
  describe('typing:start', () => {
    it('should emit typing events to receiver', () => {
      setupSocketHandlers(io);
      const handler = socket._handlers['typing:start'];
      mockGetUserSocketIds.mockReturnValue(['recv-socket']);
      handler({ receiverId: 'user-2', conversationId: 'c1' });
      expect(mockGetUserSocketIds).toHaveBeenCalledWith('user-2');
    });
  });

  describe('typing:stop', () => {
    it('should emit typing stopped to receiver', () => {
      setupSocketHandlers(io);
      const handler = socket._handlers['typing:stop'];
      mockGetUserSocketIds.mockReturnValue(['recv-socket']);
      handler({ receiverId: 'user-2', conversationId: 'c1' });
      expect(mockGetUserSocketIds).toHaveBeenCalledWith('user-2');
    });
  });

  // ---- project:join / project:leave ----
  describe('project:join', () => {
    it('should join project room', () => {
      setupSocketHandlers(io);
      const handler = socket._handlers['project:join'];
      handler({ projectId: 'p1' });
      expect(socket.join).toHaveBeenCalledWith('project:p1');
    });
  });

  describe('project:leave', () => {
    it('should leave project room', () => {
      setupSocketHandlers(io);
      const handler = socket._handlers['project:leave'];
      handler({ projectId: 'p1' });
      expect(socket.leave).toHaveBeenCalledWith('project:p1');
    });
  });

  // ---- disconnect ----
  describe('disconnect', () => {
    it('should unregister user', () => {
      setupSocketHandlers(io);
      const handler = socket._handlers['disconnect'];
      handler('transport close');
      expect(mockUnregisterConnectedUser).toHaveBeenCalledWith('user-1', 'socket-1');
    });

    it('should broadcast user:offline if no other connections', () => {
      mockIsUserConnected.mockReturnValue(false);
      setupSocketHandlers(io);
      const handler = socket._handlers['disconnect'];
      handler('transport close');
      expect(socket.broadcast.emit).toHaveBeenCalledWith('user:offline', expect.objectContaining({
        userId: 'user-1'
      }));
    });
  });

  // ---- emitToUser ----
  describe('emitToUser', () => {
    it('should emit to user room', () => {
      const mockIo = { to: jest.fn(() => ({ emit: jest.fn() })) };
      emitToUser(mockIo, 'u1', 'notification', { data: true });
      expect(mockIo.to).toHaveBeenCalledWith('user:u1');
    });
  });

  // ---- emitToProject ----
  describe('emitToProject', () => {
    it('should emit to project room', () => {
      const mockIo = { to: jest.fn(() => ({ emit: jest.fn() })) };
      emitToProject(mockIo, 'p1', 'update', { data: true });
      expect(mockIo.to).toHaveBeenCalledWith('project:p1');
    });
  });

  // ---- broadcast ----
  describe('broadcast', () => {
    it('should emit to all', () => {
      const mockIo = { emit: jest.fn() };
      broadcast(mockIo, 'global:event', { data: true });
      expect(mockIo.emit).toHaveBeenCalledWith('global:event', { data: true });
    });
  });
});
