import { jest } from '@jest/globals';
import { mockReq, mockRes, createMockDb } from '../helpers/testUtils.js';

const mockDb = createMockDb();

jest.unstable_mockModule('../../../server/config/database.js', () => ({
  getDatabase: jest.fn(() => mockDb)
}));
jest.unstable_mockModule('../../../server/middleware/errorHandler.js', () => ({
  asyncHandler: jest.fn((fn) => fn),
  APIError: class APIError extends Error {
    constructor(m, s, c) { super(m); this.statusCode = s; this.code = c; }
  },
  errors: {
    DEVIS_NOT_FOUND: Object.assign(new Error('Not found'), { statusCode: 404 }),
    FORBIDDEN: Object.assign(new Error('Forbidden'), { statusCode: 403 })
  }
}));
jest.unstable_mockModule('../../../server/middleware/logger.js', () => ({
  logger: {
    child: () => ({
      info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn()
    })
  }
}));

const mockWriteFileSync = jest.fn();
const mockCopyFileSync = jest.fn();
const mockUnlinkSync = jest.fn();
const mockExistsSync = jest.fn(() => true);
const mockMkdirSync = jest.fn();
const mockRenameSync = jest.fn();
const mockStatSync = jest.fn(() => ({ size: 1024 }));

jest.unstable_mockModule('fs', () => ({
  default: {
    existsSync: mockExistsSync,
    mkdirSync: mockMkdirSync,
    writeFileSync: mockWriteFileSync,
    copyFileSync: mockCopyFileSync,
    unlinkSync: mockUnlinkSync,
    renameSync: mockRenameSync,
    statSync: mockStatSync
  },
  existsSync: mockExistsSync,
  mkdirSync: mockMkdirSync,
  writeFileSync: mockWriteFileSync,
  copyFileSync: mockCopyFileSync,
  unlinkSync: mockUnlinkSync,
  renameSync: mockRenameSync,
  statSync: mockStatSync
}));

jest.unstable_mockModule('uuid', () => ({
  v4: jest.fn(() => 'test-uuid')
}));

const {
  uploadSingle, uploadMultiple, uploadPhotos, uploadAvatar,
  uploadDocument, getFileInfo, downloadFile, deleteFile,
  getUserFiles, getStorageUsage, processImage, batchDelete
} = await import('../../../server/controllers/uploadController.js');

describe('uploadController', () => {
  let req, res;

  beforeEach(() => {
    req = mockReq();
    res = mockRes();
    res.download = jest.fn();
    jest.clearAllMocks();
    mockExistsSync.mockReturnValue(true);
    mockDb._mockRun.mockReturnValue({ changes: 1, lastInsertRowid: 1 });
  });

  // ---- uploadSingle ----
  describe('uploadSingle', () => {
    it('should throw 400 if no req.file', async () => {
      req.file = undefined;
      await expect(uploadSingle(req, res)).rejects.toThrow('Aucun fichier');
    });

    it('should process and return 201', async () => {
      req.file = { originalname: 'test.pdf', mimetype: 'application/pdf', size: 1024, buffer: Buffer.from('data') };
      await uploadSingle(req, res);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  // ---- uploadMultiple ----
  describe('uploadMultiple', () => {
    it('should throw 400 if no req.files', async () => {
      req.files = undefined;
      await expect(uploadMultiple(req, res)).rejects.toThrow('Aucun fichier');
    });

    it('should process multiple files', async () => {
      req.files = [
        { originalname: 'a.pdf', mimetype: 'application/pdf', size: 512, buffer: Buffer.from('a') },
        { originalname: 'b.pdf', mimetype: 'application/pdf', size: 256, buffer: Buffer.from('b') }
      ];
      await uploadMultiple(req, res);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalled();
    });
  });

  // ---- uploadPhotos ----
  describe('uploadPhotos', () => {
    it('should skip non-image files', async () => {
      req.files = [
        { originalname: 'pic.jpg', mimetype: 'image/jpeg', size: 1024, buffer: Buffer.from('img') },
        { originalname: 'doc.pdf', mimetype: 'application/pdf', size: 512, buffer: Buffer.from('doc') }
      ];
      await uploadPhotos(req, res);
      expect(res.status).toHaveBeenCalledWith(201);
      const call = res.json.mock.calls[0][0];
      expect(call.data.photos).toHaveLength(1);
    });

    it('should return 201 with photos', async () => {
      req.files = [
        { originalname: 'pic.png', mimetype: 'image/png', size: 2048, buffer: Buffer.from('img') }
      ];
      await uploadPhotos(req, res);
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  // ---- uploadAvatar ----
  describe('uploadAvatar', () => {
    it('should throw 400 if no file', async () => {
      req.file = undefined;
      await expect(uploadAvatar(req, res)).rejects.toThrow('Aucune image');
    });

    it('should throw 400 if not image', async () => {
      req.file = { originalname: 'doc.pdf', mimetype: 'application/pdf', size: 512 };
      await expect(uploadAvatar(req, res)).rejects.toThrow('image');
    });

    it('should write buffer to disk and update user in DB', async () => {
      req.file = { buffer: Buffer.from('test'), mimetype: 'image/png', originalname: 'avatar.png' };
      await uploadAvatar(req, res);
      expect(mockWriteFileSync).toHaveBeenCalled();
      expect(mockDb.prepare).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({ avatar_url: expect.any(String) })
      }));
    });
  });

  // ---- uploadDocument ----
  describe('uploadDocument', () => {
    it('should throw 415 for invalid types', async () => {
      req.file = { originalname: 'script.js', mimetype: 'text/javascript', size: 100 };
      await expect(uploadDocument(req, res)).rejects.toThrow('non autorisé');
    });

    it('should process valid document', async () => {
      req.file = { originalname: 'doc.pdf', mimetype: 'application/pdf', size: 1024, buffer: Buffer.from('pdf') };
      await uploadDocument(req, res);
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  // ---- getFileInfo ----
  describe('getFileInfo', () => {
    it('should return file info', async () => {
      const file = { id: 'f1', original_name: 'test.pdf', user_id: 1 };
      mockDb._mockGet.mockReturnValueOnce(file);
      req.params = { fileId: 'f1' };
      await getFileInfo(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: { file }
      }));
    });

    it('should throw 404 if not found', async () => {
      mockDb._mockGet.mockReturnValueOnce(null);
      req.params = { fileId: 'missing' };
      await expect(getFileInfo(req, res)).rejects.toThrow('non trouvé');
    });
  });

  // ---- downloadFile ----
  describe('downloadFile', () => {
    it('should call res.download', async () => {
      const file = { id: 'f1', path: 'docs/test.pdf', original_name: 'test.pdf', user_id: 1 };
      mockDb._mockGet.mockReturnValueOnce(file);
      mockExistsSync.mockReturnValue(true);
      req.params = { fileId: 'f1' };
      await downloadFile(req, res);
      expect(res.download).toHaveBeenCalled();
    });

    it('should throw 404 if not found in DB', async () => {
      mockDb._mockGet.mockReturnValueOnce(null);
      req.params = { fileId: 'missing' };
      await expect(downloadFile(req, res)).rejects.toThrow('non trouvé');
    });

    it('should throw 404 if file missing on disk', async () => {
      const file = { id: 'f1', path: 'docs/test.pdf', original_name: 'test.pdf', user_id: 1 };
      mockDb._mockGet.mockReturnValueOnce(file);
      mockExistsSync.mockReturnValue(false);
      req.params = { fileId: 'f1' };
      await expect(downloadFile(req, res)).rejects.toThrow();
    });
  });

  // ---- deleteFile ----
  describe('deleteFile', () => {
    it('should delete file and thumbnail from disk and DB', async () => {
      const file = { id: 'f1', path: 'docs/test.pdf', thumbnail_path: 'photos/thumbnails/thumb.jpg', user_id: 1 };
      mockDb._mockGet.mockReturnValueOnce(file);
      mockExistsSync.mockReturnValue(true);
      req.params = { fileId: 'f1' };
      await deleteFile(req, res);
      expect(mockUnlinkSync).toHaveBeenCalledTimes(2);
      expect(mockDb.prepare).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should throw 404 if file not found', async () => {
      mockDb._mockGet.mockReturnValueOnce(null);
      req.params = { fileId: 'missing' };
      await expect(deleteFile(req, res)).rejects.toThrow('non trouvé');
    });
  });

  // ---- getUserFiles ----
  describe('getUserFiles', () => {
    it('should return paginated files', async () => {
      mockDb._mockAll.mockReturnValueOnce([{ id: 'f1' }]);
      mockDb._mockGet.mockReturnValueOnce({ count: 1 });
      req.query = { page: '1', limit: '10' };
      await getUserFiles(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          files: expect.any(Array),
          pagination: expect.any(Object)
        })
      }));
    });

    it('should filter by type when provided', async () => {
      mockDb._mockAll.mockReturnValueOnce([]);
      mockDb._mockGet.mockReturnValueOnce({ count: 0 });
      req.query = { type: 'photos', page: '1', limit: '10' };
      await getUserFiles(req, res);
      expect(mockDb.prepare).toHaveBeenCalled();
    });
  });

  // ---- getStorageUsage ----
  describe('getStorageUsage', () => {
    it('should return usage stats with by_type breakdown', async () => {
      mockDb._mockGet.mockReturnValueOnce({ total_bytes: 5000, total_files: 3 });
      mockDb._mockAll.mockReturnValueOnce([
        { type: 'photos', bytes: 3000, count: 2 },
        { type: 'documents', bytes: 2000, count: 1 }
      ]);
      await getStorageUsage(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          used_bytes: 5000,
          total_files: 3,
          by_type: expect.any(Array)
        })
      }));
    });
  });

  // ---- processImage ----
  describe('processImage', () => {
    it('should return message about sharp not available', async () => {
      const file = { id: 'f1', mimetype: 'image/png', user_id: 1 };
      mockDb._mockGet.mockReturnValueOnce(file);
      req.body = { file_id: 'f1' };
      await processImage(req, res);
      const response = res.json.mock.calls[0][0];
      expect(response.message).toMatch(/sharp/i);
    });
  });

  // ---- batchDelete ----
  describe('batchDelete', () => {
    it('should throw 400 if no file_ids', async () => {
      req.body = {};
      await expect(batchDelete(req, res)).rejects.toThrow('requis');
    });

    it('should delete multiple files', async () => {
      mockDb._mockGet.mockReturnValueOnce({ id: 'f1', path: 'docs/a.pdf', user_id: 1 });
      mockDb._mockGet.mockReturnValueOnce({ id: 'f2', path: 'docs/b.pdf', user_id: 1 });
      req.body = { file_ids: ['f1', 'f2'] };
      await batchDelete(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });
});
