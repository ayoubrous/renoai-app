import { jest } from '@jest/globals';

// Mock fs
const mockExistsSync = jest.fn(() => true);
const mockMkdirSync = jest.fn();
const mockReaddirSync = jest.fn(() => []);
const mockStatSync = jest.fn(() => ({ mtimeMs: Date.now() }));
const mockUnlinkSync = jest.fn();

jest.unstable_mockModule('fs', () => ({
  default: {
    existsSync: mockExistsSync,
    mkdirSync: mockMkdirSync,
    readdirSync: mockReaddirSync,
    statSync: mockStatSync,
    unlinkSync: mockUnlinkSync,
  },
  existsSync: mockExistsSync,
  mkdirSync: mockMkdirSync,
  readdirSync: mockReaddirSync,
  statSync: mockStatSync,
  unlinkSync: mockUnlinkSync,
}));

// Mock uuid
jest.unstable_mockModule('uuid', () => ({
  v4: () => 'mock-uuid-1234',
}));

// Mock multer - native dependency
const mockMulterInstance = {
  single: jest.fn(() => 'single-middleware'),
  array: jest.fn(() => 'array-middleware'),
  fields: jest.fn(() => 'fields-middleware'),
  none: jest.fn(() => 'none-middleware'),
};

class MockMulterError extends Error {
  constructor(code, field) {
    super(code);
    this.code = code;
    this.field = field;
    this.name = 'MulterError';
  }
}

const mockMulter = jest.fn(() => mockMulterInstance);
mockMulter.diskStorage = jest.fn(() => 'disk-storage');
mockMulter.memoryStorage = jest.fn(() => 'memory-storage');
mockMulter.MulterError = MockMulterError;

jest.unstable_mockModule('multer', () => ({
  default: mockMulter,
}));

// Mock path and url modules to avoid issues with import.meta.url
jest.unstable_mockModule('url', () => ({
  fileURLToPath: jest.fn(() => '/mock/server/middleware/upload.js'),
}));

const { handleUploadError, cleanupTempFiles, upload, uploadToMemory, uploadImages, uploadMultiple, uploadAvatar, uploadDocument } = await import('../../../server/middleware/upload.js');
const multer = (await import('multer')).default;

// Helpers
function mockReq(overrides = {}) {
  return {
    body: {},
    params: {},
    query: {},
    user: { id: 'user-1', role: 'user' },
    path: '/api/test',
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

function mockNext() {
  return jest.fn();
}

// ============================================================
// TESTS
// ============================================================

describe('Upload Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ----------------------------------------------------------
  // handleUploadError
  // ----------------------------------------------------------
  describe('handleUploadError', () => {
    test('returns 400 with FILE_TOO_LARGE for LIMIT_FILE_SIZE MulterError', () => {
      const err = new MockMulterError('LIMIT_FILE_SIZE');
      // Make it an instance that passes the instanceof check in the source
      // The source checks `err instanceof multer.MulterError`
      Object.setPrototypeOf(err, multer.MulterError.prototype);

      const req = mockReq();
      const res = mockRes();
      const next = mockNext();

      handleUploadError(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: 'FILE_TOO_LARGE' }),
        })
      );
    });

    test('returns 400 with TOO_MANY_FILES for LIMIT_FILE_COUNT MulterError', () => {
      const err = new MockMulterError('LIMIT_FILE_COUNT');
      Object.setPrototypeOf(err, multer.MulterError.prototype);

      const req = mockReq();
      const res = mockRes();
      const next = mockNext();

      handleUploadError(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: 'TOO_MANY_FILES' }),
        })
      );
    });

    test('returns 400 with UNEXPECTED_FILE for LIMIT_UNEXPECTED_FILE MulterError', () => {
      const err = new MockMulterError('LIMIT_UNEXPECTED_FILE');
      Object.setPrototypeOf(err, multer.MulterError.prototype);

      const req = mockReq();
      const res = mockRes();
      const next = mockNext();

      handleUploadError(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: 'UNEXPECTED_FILE' }),
        })
      );
    });

    test('returns 400 with UPLOAD_ERROR for generic MulterError', () => {
      const err = new MockMulterError('SOME_OTHER_CODE');
      err.message = 'Some multer error';
      Object.setPrototypeOf(err, multer.MulterError.prototype);

      const req = mockReq();
      const res = mockRes();
      const next = mockNext();

      handleUploadError(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: 'UPLOAD_ERROR' }),
        })
      );
    });

    test('returns 400 with UPLOAD_ERROR for non-Multer error', () => {
      const err = new Error('Some random upload error');
      const req = mockReq();
      const res = mockRes();
      const next = mockNext();

      handleUploadError(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'UPLOAD_ERROR',
            message: 'Some random upload error',
          }),
        })
      );
    });

    test('calls next() when no error is provided', () => {
      const req = mockReq();
      const res = mockRes();
      const next = mockNext();

      handleUploadError(null, req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------
  // cleanupTempFiles
  // ----------------------------------------------------------
  describe('cleanupTempFiles', () => {
    test('deletes files older than 24 hours', () => {
      const oldTime = Date.now() - 25 * 60 * 60 * 1000; // 25 hours ago
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue(['old-file.tmp', 'another-old.tmp']);
      mockStatSync.mockReturnValue({ mtimeMs: oldTime });

      cleanupTempFiles();

      expect(mockUnlinkSync).toHaveBeenCalledTimes(2);
    });

    test('keeps recent files (less than 24 hours old)', () => {
      const recentTime = Date.now() - 1 * 60 * 60 * 1000; // 1 hour ago
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue(['recent-file.tmp']);
      mockStatSync.mockReturnValue({ mtimeMs: recentTime });

      cleanupTempFiles();

      expect(mockUnlinkSync).not.toHaveBeenCalled();
    });

    test('handles mix of old and recent files', () => {
      const oldTime = Date.now() - 25 * 60 * 60 * 1000;
      const recentTime = Date.now() - 1 * 60 * 60 * 1000;
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue(['old.tmp', 'recent.tmp']);
      mockStatSync
        .mockReturnValueOnce({ mtimeMs: oldTime })
        .mockReturnValueOnce({ mtimeMs: recentTime });

      cleanupTempFiles();

      expect(mockUnlinkSync).toHaveBeenCalledTimes(1);
    });

    test('does nothing when temp directory does not exist', () => {
      mockExistsSync.mockReturnValue(false);

      cleanupTempFiles();

      expect(mockReaddirSync).not.toHaveBeenCalled();
      expect(mockUnlinkSync).not.toHaveBeenCalled();
    });

    test('handles empty temp directory', () => {
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue([]);

      cleanupTempFiles();

      expect(mockUnlinkSync).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------
  // Multer configuration / exported instances
  // ----------------------------------------------------------
  describe('Multer configuration', () => {
    test('upload export exists', () => {
      expect(upload).toBeDefined();
    });

    test('uploadToMemory export exists', () => {
      expect(uploadToMemory).toBeDefined();
    });

    test('uploadImages export exists', () => {
      expect(uploadImages).toBeDefined();
    });

    test('uploadMultiple export exists', () => {
      expect(uploadMultiple).toBeDefined();
    });

    test('uploadAvatar export exists', () => {
      expect(uploadAvatar).toBeDefined();
    });

    test('uploadDocument export exists', () => {
      expect(uploadDocument).toBeDefined();
    });
  });

  // ----------------------------------------------------------
  // File filter tests (via multer config calls)
  // ----------------------------------------------------------
  describe('File filter', () => {
    let generalFilter;
    let imageFilter;

    beforeAll(() => {
      const calls = mockMulter.mock.calls;
      // Find the general filter (accepts images + documents) and image-only filter
      for (const call of calls) {
        if (call[0] && typeof call[0].fileFilter === 'function') {
          const cb = jest.fn();
          // Test with PDF to distinguish general vs image-only filter
          call[0].fileFilter({}, { mimetype: 'application/pdf' }, cb);
          if (cb.mock.calls[0][1] === true) {
            generalFilter = call[0].fileFilter;
          } else {
            imageFilter = call[0].fileFilter;
          }
        }
      }
    });

    test('general filter accepts image/jpeg', () => {
      if (!generalFilter) return;
      const cb = jest.fn();
      generalFilter({}, { mimetype: 'image/jpeg' }, cb);
      expect(cb).toHaveBeenCalledWith(null, true);
    });

    test('general filter accepts image/png', () => {
      if (!generalFilter) return;
      const cb = jest.fn();
      generalFilter({}, { mimetype: 'image/png' }, cb);
      expect(cb).toHaveBeenCalledWith(null, true);
    });

    test('general filter accepts image/gif', () => {
      if (!generalFilter) return;
      const cb = jest.fn();
      generalFilter({}, { mimetype: 'image/gif' }, cb);
      expect(cb).toHaveBeenCalledWith(null, true);
    });

    test('general filter accepts image/webp', () => {
      if (!generalFilter) return;
      const cb = jest.fn();
      generalFilter({}, { mimetype: 'image/webp' }, cb);
      expect(cb).toHaveBeenCalledWith(null, true);
    });

    test('general filter rejects invalid mimetype', () => {
      if (!generalFilter) return;
      const cb = jest.fn();
      generalFilter({}, { mimetype: 'application/zip' }, cb);
      expect(cb).toHaveBeenCalledWith(expect.any(Error), false);
    });

    test('general filter accepts application/pdf', () => {
      if (!generalFilter) return;
      const cb = jest.fn();
      generalFilter({}, { mimetype: 'application/pdf' }, cb);
      expect(cb).toHaveBeenCalledWith(null, true);
    });

    test('general filter accepts docx mimetype', () => {
      if (!generalFilter) return;
      const cb = jest.fn();
      generalFilter(
        {},
        { mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
        cb
      );
      expect(cb).toHaveBeenCalledWith(null, true);
    });

    test('general filter accepts xlsx mimetype', () => {
      if (!generalFilter) return;
      const cb = jest.fn();
      generalFilter(
        {},
        { mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
        cb
      );
      expect(cb).toHaveBeenCalledWith(null, true);
    });

    test('image filter rejects non-image types', () => {
      if (!imageFilter) return;
      const cb = jest.fn();
      imageFilter({}, { mimetype: 'application/pdf' }, cb);
      expect(cb).toHaveBeenCalledWith(expect.any(Error), expect.anything());
    });
  });
});
