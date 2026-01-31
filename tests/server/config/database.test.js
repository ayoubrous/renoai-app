import { jest } from '@jest/globals';

// Mock sql.js
const mockStmt = {
  bind: jest.fn(),
  step: jest.fn(() => false),
  getAsObject: jest.fn(() => ({})),
  free: jest.fn(),
};

const mockSqlDb = {
  run: jest.fn(),
  prepare: jest.fn(() => mockStmt),
  exec: jest.fn(),
  getRowsModified: jest.fn(() => 1),
  export: jest.fn(() => new Uint8Array([1, 2, 3])),
  close: jest.fn(),
};

const MockDatabase = jest.fn(() => mockSqlDb);

jest.unstable_mockModule('sql.js', () => ({
  default: jest.fn(() => Promise.resolve({ Database: MockDatabase })),
}));

// Mock fs
const mockExistsSync = jest.fn(() => false);
const mockMkdirSync = jest.fn();
const mockWriteFileSync = jest.fn();
const mockReadFileSync = jest.fn(() => Buffer.from([1, 2, 3]));

jest.unstable_mockModule('fs', () => ({
  default: {
    existsSync: mockExistsSync,
    mkdirSync: mockMkdirSync,
    writeFileSync: mockWriteFileSync,
    readFileSync: mockReadFileSync,
  },
  existsSync: mockExistsSync,
  mkdirSync: mockMkdirSync,
  writeFileSync: mockWriteFileSync,
  readFileSync: mockReadFileSync,
}));

// Mock url
jest.unstable_mockModule('url', () => ({
  fileURLToPath: jest.fn(() => '/mock/server/config/database.js'),
}));

// We need to re-import for each test group since initializeDatabase sets module-level state
let dbModule;

beforeAll(async () => {
  dbModule = await import('../../../server/config/database.js');
});

beforeEach(() => {
  jest.clearAllMocks();
  mockSqlDb.run.mockReset();
  mockSqlDb.prepare.mockReset().mockReturnValue(mockStmt);
  mockSqlDb.exec.mockReset();
  mockSqlDb.getRowsModified.mockReset().mockReturnValue(1);
  mockSqlDb.export.mockReset().mockReturnValue(new Uint8Array([1, 2, 3]));
  mockSqlDb.close.mockReset();
  mockStmt.bind.mockReset();
  mockStmt.step.mockReset().mockReturnValue(false);
  mockStmt.getAsObject.mockReset().mockReturnValue({});
  mockStmt.free.mockReset();
  mockExistsSync.mockReset().mockReturnValue(false);
  mockMkdirSync.mockReset();
  mockWriteFileSync.mockReset();
});

describe('Database Module', () => {
  // ----------------------------------------------------------
  // getDatabase
  // ----------------------------------------------------------
  describe('getDatabase', () => {
    test('throws when database is not initialized', () => {
      // Fresh import state - db is null initially, but beforeAll may have
      // triggered initialization in other tests. We test the error message pattern.
      // This test works best when run in isolation or first.
      // We'll verify the function exists and has the right behavior by
      // testing after closeDatabase.
      dbModule.closeDatabase();
      expect(() => dbModule.getDatabase()).toThrow(/non initialisée|not initialized/i);
    });
  });

  // ----------------------------------------------------------
  // initializeDatabase
  // ----------------------------------------------------------
  describe('initializeDatabase', () => {
    test('creates a new database when no file exists', async () => {
      mockExistsSync.mockReturnValue(false);
      const db = await dbModule.initializeDatabase();
      expect(db).toBeDefined();
      expect(MockDatabase).toHaveBeenCalled();
    });

    test('loads existing database from disk', async () => {
      mockExistsSync.mockReturnValue(true);
      const db = await dbModule.initializeDatabase();
      expect(db).toBeDefined();
      expect(mockReadFileSync).toHaveBeenCalled();
    });

    test('creates directory if it does not exist', async () => {
      mockExistsSync.mockReturnValue(false);
      await dbModule.initializeDatabase();
      expect(mockMkdirSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ recursive: true })
      );
    });

    test('creates tables via exec calls', async () => {
      mockExistsSync.mockReturnValue(false);
      await dbModule.initializeDatabase();
      // Should call exec many times for CREATE TABLE statements
      expect(mockSqlDb.exec.mock.calls.length).toBeGreaterThan(5);
    });

    test('creates indexes', async () => {
      mockExistsSync.mockReturnValue(false);
      await dbModule.initializeDatabase();
      const indexCalls = mockSqlDb.exec.mock.calls.filter(
        (call) => typeof call[0] === 'string' && call[0].includes('CREATE INDEX')
      );
      expect(indexCalls.length).toBeGreaterThan(0);
    });

    test('inserts demo user', async () => {
      mockExistsSync.mockReturnValue(false);
      await dbModule.initializeDatabase();
      const demoCalls = mockSqlDb.exec.mock.calls.filter(
        (call) => typeof call[0] === 'string' && call[0].includes('demo-user')
      );
      expect(demoCalls.length).toBeGreaterThan(0);
    });

    test('saves database after initialization', async () => {
      mockExistsSync.mockReturnValue(false);
      await dbModule.initializeDatabase();
      // saveDatabase is called via exec -> which calls saveDatabase internally
      expect(mockSqlDb.export).toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------
  // DatabaseWrapper.prepare().run()
  // ----------------------------------------------------------
  describe('DatabaseWrapper.prepare().run()', () => {
    beforeEach(async () => {
      mockExistsSync.mockReturnValue(false);
      await dbModule.initializeDatabase();
      jest.clearAllMocks();
      mockSqlDb.getRowsModified.mockReturnValue(1);
    });

    test('calls sqlDb.run with SQL and params', () => {
      const db = dbModule.getDatabase();
      db.prepare('INSERT INTO test VALUES (?)').run('value1');
      expect(mockSqlDb.run).toHaveBeenCalledWith('INSERT INTO test VALUES (?)', ['value1']);
    });

    test('returns object with changes property', () => {
      mockSqlDb.getRowsModified.mockReturnValue(3);
      const db = dbModule.getDatabase();
      const result = db.prepare('UPDATE test SET x = ?').run('val');
      expect(result).toEqual({ changes: 3 });
    });

    test('throws on SQL error', () => {
      mockSqlDb.run.mockImplementation(() => {
        throw new Error('SQL syntax error');
      });
      const db = dbModule.getDatabase();
      expect(() => db.prepare('BAD SQL').run()).toThrow('SQL syntax error');
    });
  });

  // ----------------------------------------------------------
  // DatabaseWrapper.prepare().get()
  // ----------------------------------------------------------
  describe('DatabaseWrapper.prepare().get()', () => {
    beforeEach(async () => {
      mockExistsSync.mockReturnValue(false);
      await dbModule.initializeDatabase();
      jest.clearAllMocks();
    });

    test('returns object when row found', () => {
      mockStmt.step.mockReturnValue(true);
      mockStmt.getAsObject.mockReturnValue({ id: 1, name: 'test' });

      const db = dbModule.getDatabase();
      const result = db.prepare('SELECT * FROM test WHERE id = ?').get(1);
      expect(result).toEqual({ id: 1, name: 'test' });
    });

    test('returns undefined when no row found', () => {
      mockStmt.step.mockReturnValue(false);

      const db = dbModule.getDatabase();
      const result = db.prepare('SELECT * FROM test WHERE id = ?').get(999);
      expect(result).toBeUndefined();
    });

    test('frees statement after use', () => {
      mockStmt.step.mockReturnValue(true);
      mockStmt.getAsObject.mockReturnValue({ id: 1 });

      const db = dbModule.getDatabase();
      db.prepare('SELECT * FROM test').get();
      expect(mockStmt.free).toHaveBeenCalled();
    });

    test('frees statement even when no row found', () => {
      mockStmt.step.mockReturnValue(false);

      const db = dbModule.getDatabase();
      db.prepare('SELECT * FROM test').get();
      expect(mockStmt.free).toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------
  // DatabaseWrapper.prepare().all()
  // ----------------------------------------------------------
  describe('DatabaseWrapper.prepare().all()', () => {
    beforeEach(async () => {
      mockExistsSync.mockReturnValue(false);
      await dbModule.initializeDatabase();
      jest.clearAllMocks();
    });

    test('returns array of objects', () => {
      mockStmt.step
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false);
      mockStmt.getAsObject
        .mockReturnValueOnce({ id: 1 })
        .mockReturnValueOnce({ id: 2 });

      const db = dbModule.getDatabase();
      const results = db.prepare('SELECT * FROM test').all();
      expect(results).toEqual([{ id: 1 }, { id: 2 }]);
    });

    test('returns empty array when no rows', () => {
      mockStmt.step.mockReturnValue(false);

      const db = dbModule.getDatabase();
      const results = db.prepare('SELECT * FROM test').all();
      expect(results).toEqual([]);
    });

    test('frees statement after iteration', () => {
      mockStmt.step.mockReturnValue(false);

      const db = dbModule.getDatabase();
      db.prepare('SELECT * FROM test').all();
      expect(mockStmt.free).toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------
  // DatabaseWrapper.exec()
  // ----------------------------------------------------------
  describe('DatabaseWrapper.exec()', () => {
    beforeEach(async () => {
      mockExistsSync.mockReturnValue(false);
      await dbModule.initializeDatabase();
      jest.clearAllMocks();
    });

    test('calls sqlDb.exec with SQL string', () => {
      const db = dbModule.getDatabase();
      db.exec('CREATE TABLE foo (id INT)');
      expect(mockSqlDb.exec).toHaveBeenCalledWith('CREATE TABLE foo (id INT)');
    });

    test('throws on exec error', () => {
      mockSqlDb.exec.mockImplementation(() => {
        throw new Error('exec failed');
      });
      const db = dbModule.getDatabase();
      expect(() => db.exec('BAD SQL')).toThrow('exec failed');
    });
  });

  // ----------------------------------------------------------
  // DatabaseWrapper.pragma()
  // ----------------------------------------------------------
  describe('DatabaseWrapper.pragma()', () => {
    beforeEach(async () => {
      mockExistsSync.mockReturnValue(false);
      await dbModule.initializeDatabase();
      jest.clearAllMocks();
    });

    test('executes PRAGMA statement', () => {
      const db = dbModule.getDatabase();
      db.pragma('journal_mode = WAL');
      expect(mockSqlDb.exec).toHaveBeenCalledWith('PRAGMA journal_mode = WAL');
    });

    test('handles pragma errors silently', () => {
      mockSqlDb.exec.mockImplementation(() => {
        throw new Error('pragma failed');
      });
      const db = dbModule.getDatabase();
      // Should not throw
      expect(() => db.pragma('bad_pragma')).not.toThrow();
    });
  });

  // ----------------------------------------------------------
  // DatabaseWrapper.close()
  // ----------------------------------------------------------
  describe('DatabaseWrapper.close()', () => {
    beforeEach(async () => {
      mockExistsSync.mockReturnValue(false);
      await dbModule.initializeDatabase();
      jest.clearAllMocks();
    });

    test('saves and closes the database', () => {
      const db = dbModule.getDatabase();
      db.close();
      expect(mockSqlDb.export).toHaveBeenCalled();
      expect(mockSqlDb.close).toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------
  // saveDatabase
  // ----------------------------------------------------------
  describe('saveDatabase', () => {
    beforeEach(async () => {
      mockExistsSync.mockReturnValue(false);
      await dbModule.initializeDatabase();
      jest.clearAllMocks();
      mockExistsSync.mockReturnValue(false);
    });

    test('creates directory if needed', () => {
      dbModule.saveDatabase();
      expect(mockMkdirSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ recursive: true })
      );
    });

    test('writes database buffer to disk', () => {
      dbModule.saveDatabase();
      expect(mockSqlDb.export).toHaveBeenCalled();
      expect(mockWriteFileSync).toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------
  // closeDatabase
  // ----------------------------------------------------------
  describe('closeDatabase', () => {
    test('saves, closes, and nullifies database', async () => {
      mockExistsSync.mockReturnValue(false);
      await dbModule.initializeDatabase();
      jest.clearAllMocks();

      dbModule.closeDatabase();

      expect(mockSqlDb.export).toHaveBeenCalled();
      expect(() => dbModule.getDatabase()).toThrow();
    });

    test('does nothing when database is already null', () => {
      // After closeDatabase, calling again should not throw
      dbModule.closeDatabase();
      expect(() => dbModule.closeDatabase()).not.toThrow();
    });
  });
});
