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

jest.unstable_mockModule('uuid', () => ({
  v4: jest.fn(() => 'test-uuid')
}));

const mockAiService = {
  analyzePhoto: jest.fn(() => ({ detected: true })),
  consolidateAnalyses: jest.fn(() => ({ work_types: ['plumbing'], total_estimate: 5000 })),
  generateRecommendations: jest.fn(() => []),
  calculateEstimate: jest.fn(() => ({ total: 5000, breakdown: [] })),
  generateFullDevis: jest.fn(() => ({ title: 'Generated Devis', items: [] })),
  suggestMaterials: jest.fn(() => [{ name: 'Material A', price: 20 }]),
  optimizeDevis: jest.fn(() => ({ suggestions: [] })),
  generateChatResponse: jest.fn(() => ({ message: 'AI response', suggestions: [] })),
  detectWorkTypes: jest.fn(() => ['plumbing', 'painting']),
  annotateImage: jest.fn(() => ({ annotated_url: 'url' })),
  getPricingReference: jest.fn(() => ({ prices: [] })),
  getMaterialsCatalog: jest.fn(() => ({ items: [] })),
  compareDevis: jest.fn(() => ({ comparison: {} }))
};

jest.unstable_mockModule('../../../server/services/aiService.js', () => mockAiService);

const {
  analyzePhotos, getAnalysisResults, getAnalysisStatus, getEstimate,
  generateDevis, suggestMaterials, optimizeDevis, chat,
  getChatHistory, clearChatHistory, detectWorkTypes, getAIUsageStats
} = await import('../../../server/controllers/aiController.js');

describe('aiController', () => {
  let req, res;

  beforeEach(() => {
    req = mockReq();
    res = mockRes();
    jest.clearAllMocks();
    mockDb._mockRun.mockReturnValue({ changes: 1, lastInsertRowid: 1 });
    mockDb._mockGet.mockReturnValue(null);
    mockDb._mockAll.mockReturnValue([]);
  });

  // ---- analyzePhotos ----
  describe('analyzePhotos', () => {
    it('should return 202 with analysis_id', async () => {
      req.body = { photos: ['photo1.jpg'], room_type: 'bathroom', work_types: ['plumbing'] };
      await analyzePhotos(req, res);
      expect(res.status).toHaveBeenCalledWith(202);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({ analysis_id: 'test-uuid', status: 'processing' })
      }));
    });

    it('should insert into ai_analyses', async () => {
      req.body = { photos: ['photo1.jpg'], room_type: 'kitchen', work_types: [] };
      await analyzePhotos(req, res);
      expect(mockDb.prepare).toHaveBeenCalled();
      expect(mockDb._mockRun).toHaveBeenCalled();
    });
  });

  // ---- getAnalysisResults ----
  describe('getAnalysisResults', () => {
    it('should return analysis with parsed output_data', async () => {
      mockDb._mockGet.mockReturnValueOnce({
        id: 'a1', status: 'completed',
        output_data: JSON.stringify({ work_types: ['painting'] }),
        created_at: '2025-01-01', completed_at: '2025-01-01'
      });
      req.params = { analysisId: 'a1' };
      await getAnalysisResults(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({ status: 'completed', results: { work_types: ['painting'] } })
      }));
    });

    it('should throw 404 if not found', async () => {
      mockDb._mockGet.mockReturnValueOnce(null);
      req.params = { analysisId: 'missing' };
      await expect(getAnalysisResults(req, res)).rejects.toThrow('non trouvée');
    });
  });

  // ---- getAnalysisStatus ----
  describe('getAnalysisStatus', () => {
    it('should fall back to DB and return status', async () => {
      mockDb._mockGet.mockReturnValueOnce({ status: 'completed' });
      req.params = { analysisId: 'a-db' };
      await getAnalysisStatus(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({ status: 'completed' })
      }));
    });

    it('should throw 404 if not found', async () => {
      mockDb._mockGet.mockReturnValueOnce(null);
      req.params = { analysisId: 'missing' };
      await expect(getAnalysisStatus(req, res)).rejects.toThrow('non trouvée');
    });
  });

  // ---- getEstimate ----
  describe('getEstimate', () => {
    it('should call aiService.calculateEstimate and return estimate', async () => {
      req.body = { work_type: 'plumbing', room_type: 'bathroom', surface_area: 20 };
      await getEstimate(req, res);
      expect(mockAiService.calculateEstimate).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({ estimate: expect.any(Object) })
      }));
    });
  });

  // ---- generateDevis ----
  describe('generateDevis', () => {
    it('should generate devis without analysis_id', async () => {
      req.body = { room_type: 'kitchen', work_types: ['painting'], quality_level: 'standard' };
      await generateDevis(req, res);
      expect(mockAiService.generateFullDevis).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should generate devis with analysis_id', async () => {
      mockDb._mockGet.mockReturnValueOnce({ output_data: JSON.stringify({ data: true }) });
      req.body = { analysis_id: 'a1', room_type: 'bathroom', work_types: ['plumbing'] };
      await generateDevis(req, res);
      expect(mockAiService.generateFullDevis).toHaveBeenCalledWith(
        expect.objectContaining({ analysis: { data: true } })
      );
    });
  });

  // ---- suggestMaterials ----
  describe('suggestMaterials', () => {
    it('should return material suggestions', async () => {
      req.body = { work_type: 'flooring', room_type: 'living', quality_level: 'premium' };
      await suggestMaterials(req, res);
      expect(mockAiService.suggestMaterials).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ materials: expect.any(Array) })
      }));
    });
  });

  // ---- optimizeDevis ----
  describe('optimizeDevis', () => {
    it('should throw DEVIS_NOT_FOUND if not found', async () => {
      mockDb._mockGet.mockReturnValueOnce(null);
      req.body = { devis_id: 'missing', optimization_goal: 'cost' };
      await expect(optimizeDevis(req, res)).rejects.toThrow();
    });

    it('should return optimizations', async () => {
      mockDb._mockGet.mockReturnValueOnce({ id: 'd1', user_id: 1 });
      mockDb._mockAll.mockReturnValueOnce([{ id: 's1', devis_id: 'd1' }]);
      mockDb._mockAll.mockReturnValueOnce([]);
      req.body = { devis_id: 'd1', optimization_goal: 'cost' };
      await optimizeDevis(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  // ---- chat ----
  describe('chat', () => {
    it('should save messages to history and return response', async () => {
      mockDb._mockAll.mockReturnValueOnce([]);
      req.body = { message: 'Hello AI', context: {} };
      await chat(req, res);
      expect(mockAiService.generateChatResponse).toHaveBeenCalledWith('Hello AI', expect.any(Object));
      // Two inserts: user message + assistant message
      expect(mockDb._mockRun).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ message: 'AI response' })
      }));
    });
  });

  // ---- getChatHistory ----
  describe('getChatHistory', () => {
    it('should return history in chronological order', async () => {
      const history = [
        { id: 1, role: 'user', content: 'Hi', created_at: '2025-01-01' },
        { id: 2, role: 'assistant', content: 'Hello', created_at: '2025-01-01' }
      ];
      mockDb._mockAll.mockReturnValueOnce(history);
      req.query = { limit: '50' };
      await getChatHistory(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        data: { history }
      }));
    });
  });

  // ---- clearChatHistory ----
  describe('clearChatHistory', () => {
    it('should delete all history for user', async () => {
      await clearChatHistory(req, res);
      expect(mockDb.prepare).toHaveBeenCalled();
      expect(mockDb._mockRun).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  // ---- detectWorkTypes ----
  describe('detectWorkTypes', () => {
    it('should return detected work types', async () => {
      req.body = { description: 'Fix bathroom plumbing' };
      await detectWorkTypes(req, res);
      expect(mockAiService.detectWorkTypes).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ work_types: expect.any(Array) })
      }));
    });
  });

  // ---- getAIUsageStats ----
  describe('getAIUsageStats', () => {
    it('should return stats counts', async () => {
      mockDb._mockGet
        .mockReturnValueOnce({ count: 10 })
        .mockReturnValueOnce({ count: 8 })
        .mockReturnValueOnce({ count: 25 })
        .mockReturnValueOnce({ count: 3 });
      await getAIUsageStats(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: {
          stats: {
            total_analyses: 10,
            completed_analyses: 8,
            chat_messages: 25,
            this_month_analyses: 3
          }
        }
      }));
    });
  });
});
