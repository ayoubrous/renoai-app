/**
 * RenoAI - Contrôleur IA
 * Services d'intelligence artificielle pour l'analyse et la génération
 */

import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../config/database.js';
import { asyncHandler, APIError, errors } from '../middleware/errorHandler.js';
import { logger } from '../middleware/logger.js';
import * as aiService from '../services/aiService.js';

const aiLogger = logger.child('AI');

// Cache pour les analyses en cours
const analysisCache = new Map();

/**
 * Analyser des photos
 * POST /api/ai/analyze-photos
 */
export const analyzePhotos = asyncHandler(async (req, res) => {
    const { photos, room_type, work_types, description } = req.body;
    const db = getDatabase();

    const analysisId = uuidv4();

    // Stocker l'analyse en cours
    analysisCache.set(analysisId, {
        status: 'processing',
        progress: 0,
        startedAt: new Date().toISOString()
    });

    // Enregistrer en base
    db.prepare(`
        INSERT INTO ai_analyses (id, user_id, type, input_data, status)
        VALUES (?, ?, 'photos', ?, 'processing')
    `).run(analysisId, req.user.id, JSON.stringify({ photos, room_type, work_types, description }));

    // Lancer l'analyse de façon asynchrone
    processPhotoAnalysis(analysisId, photos, { room_type, work_types, description }, req.user.id)
        .catch(error => {
            aiLogger.error('Erreur analyse photos', { analysisId, error: error.message });
        });

    aiLogger.info('Analyse lancée', { analysisId, photosCount: photos.length, userId: req.user.id });

    res.status(202).json({
        success: true,
        message: 'Analyse en cours',
        data: {
            analysis_id: analysisId,
            status: 'processing'
        }
    });
});

/**
 * Processus d'analyse des photos (asynchrone)
 */
async function processPhotoAnalysis(analysisId, photos, options, userId) {
    const db = getDatabase();

    try {
        // Mettre à jour la progression
        updateAnalysisProgress(analysisId, 10, 'Préparation des images...');

        // Analyser chaque photo
        const photoAnalyses = [];
        for (let i = 0; i < photos.length; i++) {
            updateAnalysisProgress(analysisId, 10 + (i / photos.length) * 50, `Analyse de l'image ${i + 1}/${photos.length}...`);

            const analysis = await aiService.analyzePhoto(photos[i], options);
            photoAnalyses.push(analysis);
        }

        updateAnalysisProgress(analysisId, 70, 'Consolidation des résultats...');

        // Consolider les résultats
        const consolidatedAnalysis = aiService.consolidateAnalyses(photoAnalyses, options);

        updateAnalysisProgress(analysisId, 90, 'Génération des recommandations...');

        // Générer les recommandations
        const recommendations = aiService.generateRecommendations(consolidatedAnalysis);

        const results = {
            photos: photoAnalyses,
            consolidated: consolidatedAnalysis,
            recommendations,
            detected_work_types: consolidatedAnalysis.work_types,
            estimated_total: consolidatedAnalysis.total_estimate
        };

        // Mettre à jour en base
        db.prepare(`
            UPDATE ai_analyses
            SET status = 'completed', output_data = ?, completed_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(JSON.stringify(results), analysisId);

        updateAnalysisProgress(analysisId, 100, 'Analyse terminée');
        analysisCache.get(analysisId).status = 'completed';
        analysisCache.get(analysisId).results = results;

        aiLogger.info('Analyse terminée', { analysisId });

    } catch (error) {
        db.prepare(`
            UPDATE ai_analyses
            SET status = 'failed', error = ?
            WHERE id = ?
        `).run(error.message, analysisId);

        analysisCache.get(analysisId).status = 'failed';
        analysisCache.get(analysisId).error = error.message;

        throw error;
    }
}

/**
 * Mettre à jour la progression d'une analyse
 */
function updateAnalysisProgress(analysisId, progress, message) {
    const analysis = analysisCache.get(analysisId);
    if (analysis) {
        analysis.progress = progress;
        analysis.message = message;
    }
}

/**
 * Obtenir les résultats d'une analyse
 * GET /api/ai/analysis/:analysisId
 */
export const getAnalysisResults = asyncHandler(async (req, res) => {
    const { analysisId } = req.params;
    const db = getDatabase();

    const analysis = db.prepare(`
        SELECT * FROM ai_analyses WHERE id = ? AND user_id = ?
    `).get(analysisId, req.user.id);

    if (!analysis) {
        throw new APIError('Analyse non trouvée', 404, 'ANALYSIS_NOT_FOUND');
    }

    let results = null;
    if (analysis.output_data) {
        try {
            results = JSON.parse(analysis.output_data);
        } catch {
            results = null;
        }
    }

    res.json({
        success: true,
        data: {
            id: analysis.id,
            status: analysis.status,
            results,
            error: analysis.error,
            created_at: analysis.created_at,
            completed_at: analysis.completed_at
        }
    });
});

/**
 * Obtenir le statut d'une analyse
 * GET /api/ai/analysis/:analysisId/status
 */
export const getAnalysisStatus = asyncHandler(async (req, res) => {
    const { analysisId } = req.params;

    // Vérifier le cache d'abord
    const cached = analysisCache.get(analysisId);
    if (cached) {
        return res.json({
            success: true,
            data: {
                status: cached.status,
                progress: cached.progress,
                message: cached.message
            }
        });
    }

    // Sinon vérifier en base
    const db = getDatabase();
    const analysis = db.prepare('SELECT status FROM ai_analyses WHERE id = ?').get(analysisId);

    if (!analysis) {
        throw new APIError('Analyse non trouvée', 404, 'ANALYSIS_NOT_FOUND');
    }

    res.json({
        success: true,
        data: {
            status: analysis.status,
            progress: analysis.status === 'completed' ? 100 : 0
        }
    });
});

/**
 * Obtenir une estimation de coût
 * POST /api/ai/estimate
 */
export const getEstimate = asyncHandler(async (req, res) => {
    const { work_type, room_type, surface_area, quality_level = 'standard', details } = req.body;

    const estimate = aiService.calculateEstimate({
        work_type,
        room_type,
        surface_area,
        quality_level,
        details
    });

    res.json({
        success: true,
        data: { estimate }
    });
});

/**
 * Générer un devis complet
 * POST /api/ai/generate-devis
 */
export const generateDevis = asyncHandler(async (req, res) => {
    const { analysis_id, photos, room_type, work_types, quality_level = 'standard', surface_area } = req.body;
    const db = getDatabase();

    let analysisData = null;

    // Si on a un ID d'analyse, récupérer les résultats
    if (analysis_id) {
        const analysis = db.prepare('SELECT output_data FROM ai_analyses WHERE id = ?').get(analysis_id);
        if (analysis?.output_data) {
            analysisData = JSON.parse(analysis.output_data);
        }
    }

    // Générer le devis
    const generatedDevis = await aiService.generateFullDevis({
        analysis: analysisData,
        photos,
        room_type,
        work_types,
        quality_level,
        surface_area
    });

    aiLogger.info('Devis généré', { userId: req.user.id, workTypes: work_types });

    res.json({
        success: true,
        data: { devis: generatedDevis }
    });
});

/**
 * Suggérer des matériaux
 * POST /api/ai/suggest-materials
 */
export const suggestMaterials = asyncHandler(async (req, res) => {
    const { work_type, room_type, quality_level = 'standard', surface_area, budget } = req.body;

    const suggestions = aiService.suggestMaterials({
        work_type,
        room_type,
        quality_level,
        surface_area,
        budget
    });

    res.json({
        success: true,
        data: { materials: suggestions }
    });
});

/**
 * Optimiser un devis existant
 * POST /api/ai/optimize-devis
 */
export const optimizeDevis = asyncHandler(async (req, res) => {
    const { devis_id, optimization_goal } = req.body;
    const db = getDatabase();

    const devis = db.prepare('SELECT * FROM devis WHERE id = ? AND user_id = ?').get(devis_id, req.user.id);
    if (!devis) {
        throw errors.DEVIS_NOT_FOUND;
    }

    const subDevis = db.prepare('SELECT * FROM sub_devis WHERE devis_id = ?').all(devis_id);
    for (const sd of subDevis) {
        sd.materials = db.prepare('SELECT * FROM sub_devis_materials WHERE sub_devis_id = ?').all(sd.id);
    }

    const optimizations = aiService.optimizeDevis({ devis, sub_devis: subDevis }, optimization_goal);

    res.json({
        success: true,
        data: { optimizations }
    });
});

/**
 * Chat avec l'assistant IA
 * POST /api/ai/chat
 */
export const chat = asyncHandler(async (req, res) => {
    const { message, context } = req.body;
    const db = getDatabase();

    // Récupérer l'historique de conversation
    const history = db.prepare(`
        SELECT role, content FROM ai_chat_history
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 10
    `).all(req.user.id).reverse();

    // Générer la réponse
    const response = await aiService.generateChatResponse(message, {
        history,
        context,
        userId: req.user.id
    });

    // Sauvegarder dans l'historique
    db.prepare(`
        INSERT INTO ai_chat_history (user_id, role, content, context)
        VALUES (?, 'user', ?, ?)
    `).run(req.user.id, message, JSON.stringify(context || {}));

    db.prepare(`
        INSERT INTO ai_chat_history (user_id, role, content)
        VALUES (?, 'assistant', ?)
    `).run(req.user.id, response.message);

    res.json({
        success: true,
        data: {
            message: response.message,
            suggestions: response.suggestions
        }
    });
});

/**
 * Obtenir l'historique de chat
 * GET /api/ai/chat/history
 */
export const getChatHistory = asyncHandler(async (req, res) => {
    const { limit = 50 } = req.query;
    const db = getDatabase();

    const history = db.prepare(`
        SELECT id, role, content, created_at FROM ai_chat_history
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT ?
    `).all(req.user.id, parseInt(limit)).reverse();

    res.json({
        success: true,
        data: { history }
    });
});

/**
 * Effacer l'historique de chat
 * DELETE /api/ai/chat/history
 */
export const clearChatHistory = asyncHandler(async (req, res) => {
    const db = getDatabase();

    db.prepare('DELETE FROM ai_chat_history WHERE user_id = ?').run(req.user.id);

    res.json({
        success: true,
        message: 'Historique effacé'
    });
});

/**
 * Détecter les types de travaux depuis une description
 * POST /api/ai/detect-work-types
 */
export const detectWorkTypes = asyncHandler(async (req, res) => {
    const { description, photos } = req.body;

    const detected = aiService.detectWorkTypes(description, photos);

    res.json({
        success: true,
        data: { work_types: detected }
    });
});

/**
 * Annoter une image
 * POST /api/ai/annotate-image
 */
export const annotateImage = asyncHandler(async (req, res) => {
    const { image_url, work_types, annotations } = req.body;

    const result = await aiService.annotateImage(image_url, {
        work_types,
        annotations
    });

    res.json({
        success: true,
        data: { annotated_image: result }
    });
});

/**
 * Obtenir les tarifs de référence
 * GET /api/ai/pricing
 */
export const getPricingReference = asyncHandler(async (req, res) => {
    const { work_type, room_type } = req.query;

    const pricing = aiService.getPricingReference(work_type, room_type);

    res.json({
        success: true,
        data: { pricing }
    });
});

/**
 * Obtenir le catalogue de matériaux
 * GET /api/ai/materials-catalog
 */
export const getMaterialsCatalog = asyncHandler(async (req, res) => {
    const { work_type, quality_level, search } = req.query;

    const catalog = aiService.getMaterialsCatalog({ work_type, quality_level, search });

    res.json({
        success: true,
        data: { catalog }
    });
});

/**
 * Comparer plusieurs devis
 * POST /api/ai/compare-quotes
 */
export const compareQuotes = asyncHandler(async (req, res) => {
    const { devis_ids } = req.body;
    const db = getDatabase();

    if (!devis_ids || devis_ids.length < 2) {
        throw new APIError('Au moins 2 devis requis pour la comparaison', 400, 'NOT_ENOUGH_DEVIS');
    }

    const devisList = [];
    for (const id of devis_ids) {
        const devis = db.prepare('SELECT * FROM devis WHERE id = ? AND user_id = ?').get(id, req.user.id);
        if (devis) {
            devis.sub_devis = db.prepare('SELECT * FROM sub_devis WHERE devis_id = ?').all(id);
            devisList.push(devis);
        }
    }

    const comparison = aiService.compareDevis(devisList);

    res.json({
        success: true,
        data: { comparison }
    });
});

/**
 * Obtenir les statistiques d'utilisation IA
 * GET /api/ai/stats
 */
export const getAIUsageStats = asyncHandler(async (req, res) => {
    const db = getDatabase();

    const stats = {
        total_analyses: db.prepare(`
            SELECT COUNT(*) as count FROM ai_analyses WHERE user_id = ?
        `).get(req.user.id).count,
        completed_analyses: db.prepare(`
            SELECT COUNT(*) as count FROM ai_analyses WHERE user_id = ? AND status = 'completed'
        `).get(req.user.id).count,
        chat_messages: db.prepare(`
            SELECT COUNT(*) as count FROM ai_chat_history WHERE user_id = ?
        `).get(req.user.id).count,
        this_month_analyses: db.prepare(`
            SELECT COUNT(*) as count FROM ai_analyses
            WHERE user_id = ? AND created_at >= date('now', 'start of month')
        `).get(req.user.id).count
    };

    res.json({
        success: true,
        data: { stats }
    });
});

export default {
    analyzePhotos,
    getAnalysisResults,
    getAnalysisStatus,
    getEstimate,
    generateDevis,
    suggestMaterials,
    optimizeDevis,
    chat,
    getChatHistory,
    clearChatHistory,
    detectWorkTypes,
    annotateImage,
    getPricingReference,
    getMaterialsCatalog,
    compareQuotes,
    getAIUsageStats
};
