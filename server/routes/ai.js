/**
 * RenoAI - Routes IA
 * Services d'intelligence artificielle
 */

import { Router } from 'express';
import { body, param } from 'express-validator';
import * as aiController from '../controllers/aiController.js';
import { validate } from '../middleware/errorHandler.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// ============================================
// VALIDATIONS
// ============================================

const analyzePhotosValidation = [
    body('photos')
        .isArray({ min: 1, max: 10 })
        .withMessage('Entre 1 et 10 photos requises'),
    body('photos.*.url')
        .notEmpty()
        .withMessage('URL de photo requise'),
    body('photos.*.description')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('Description trop longue'),
    body('room_type')
        .optional()
        .isIn(['bathroom', 'kitchen', 'bedroom', 'living_room', 'office', 'garage', 'exterior', 'whole_house', 'other'])
        .withMessage('Type de pièce invalide'),
    body('work_types')
        .optional()
        .isArray()
        .withMessage('Types de travaux doit être un tableau')
];

const estimateValidation = [
    body('work_type')
        .isIn(['demolition', 'plumbing', 'electrical', 'tiling', 'painting', 'carpentry', 'insulation', 'masonry', 'roofing', 'flooring', 'general'])
        .withMessage('Type de travail invalide'),
    body('room_type')
        .isIn(['bathroom', 'kitchen', 'bedroom', 'living_room', 'office', 'garage', 'exterior', 'whole_house', 'other'])
        .withMessage('Type de pièce invalide'),
    body('surface_area')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Surface invalide'),
    body('quality_level')
        .optional()
        .isIn(['economy', 'standard', 'premium', 'luxury'])
        .withMessage('Niveau de qualité invalide'),
    body('details')
        .optional()
        .isObject()
        .withMessage('Détails doivent être un objet')
];

const generateDevisValidation = [
    body('analysis_id')
        .optional()
        .notEmpty()
        .withMessage('ID analyse invalide'),
    body('photos')
        .optional()
        .isArray({ min: 1 })
        .withMessage('Au moins une photo requise'),
    body('room_type')
        .isIn(['bathroom', 'kitchen', 'bedroom', 'living_room', 'office', 'garage', 'exterior', 'whole_house', 'other'])
        .withMessage('Type de pièce invalide'),
    body('work_types')
        .isArray({ min: 1 })
        .withMessage('Au moins un type de travail requis'),
    body('quality_level')
        .optional()
        .isIn(['economy', 'standard', 'premium', 'luxury'])
        .withMessage('Niveau de qualité invalide')
];

const chatValidation = [
    body('message')
        .trim()
        .isLength({ min: 1, max: 2000 })
        .withMessage('Message entre 1 et 2000 caractères'),
    body('context')
        .optional()
        .isObject()
        .withMessage('Contexte doit être un objet'),
    body('context.project_id')
        .optional()
        .isInt({ min: 1 })
        .withMessage('ID projet invalide'),
    body('context.devis_id')
        .optional()
        .isInt({ min: 1 })
        .withMessage('ID devis invalide')
];

// ============================================
// ROUTES IA
// ============================================

// Toutes les routes nécessitent une authentification
router.use(authenticateToken);

/**
 * @route   POST /api/ai/analyze-photos
 * @desc    Analyser des photos de rénovation
 * @access  Private
 */
router.post('/analyze-photos', validate(analyzePhotosValidation), aiController.analyzePhotos);

/**
 * @route   GET /api/ai/analysis/:analysisId
 * @desc    Obtenir les résultats d'une analyse
 * @access  Private
 */
router.get('/analysis/:analysisId', aiController.getAnalysisResults);

/**
 * @route   GET /api/ai/analysis/:analysisId/status
 * @desc    Obtenir le statut d'une analyse en cours
 * @access  Private
 */
router.get('/analysis/:analysisId/status', aiController.getAnalysisStatus);

/**
 * @route   POST /api/ai/estimate
 * @desc    Obtenir une estimation de coût
 * @access  Private
 */
router.post('/estimate', validate(estimateValidation), aiController.getEstimate);

/**
 * @route   POST /api/ai/generate-devis
 * @desc    Générer un devis complet avec IA
 * @access  Private
 */
router.post('/generate-devis', validate(generateDevisValidation), aiController.generateDevis);

/**
 * @route   POST /api/ai/suggest-materials
 * @desc    Suggérer des matériaux
 * @access  Private
 */
router.post('/suggest-materials', aiController.suggestMaterials);

/**
 * @route   POST /api/ai/optimize-devis
 * @desc    Optimiser un devis existant
 * @access  Private
 */
router.post('/optimize-devis', aiController.optimizeDevis);

/**
 * @route   POST /api/ai/chat
 * @desc    Chat avec l'assistant IA
 * @access  Private
 */
router.post('/chat', validate(chatValidation), aiController.chat);

/**
 * @route   GET /api/ai/chat/history
 * @desc    Obtenir l'historique de chat
 * @access  Private
 */
router.get('/chat/history', aiController.getChatHistory);

/**
 * @route   DELETE /api/ai/chat/history
 * @desc    Effacer l'historique de chat
 * @access  Private
 */
router.delete('/chat/history', aiController.clearChatHistory);

/**
 * @route   POST /api/ai/detect-work-types
 * @desc    Détecter les types de travaux depuis une description
 * @access  Private
 */
router.post('/detect-work-types', aiController.detectWorkTypes);

/**
 * @route   POST /api/ai/annotate-image
 * @desc    Annoter une image avec les zones de travaux
 * @access  Private
 */
router.post('/annotate-image', aiController.annotateImage);

/**
 * @route   GET /api/ai/pricing
 * @desc    Obtenir les tarifs de référence par type de travail
 * @access  Private
 */
router.get('/pricing', aiController.getPricingReference);

/**
 * @route   GET /api/ai/materials-catalog
 * @desc    Obtenir le catalogue de matériaux
 * @access  Private
 */
router.get('/materials-catalog', aiController.getMaterialsCatalog);

/**
 * @route   POST /api/ai/compare-quotes
 * @desc    Comparer plusieurs devis
 * @access  Private
 */
router.post('/compare-quotes', aiController.compareQuotes);

/**
 * @route   GET /api/ai/stats
 * @desc    Obtenir ses statistiques d'utilisation IA
 * @access  Private
 */
router.get('/stats', aiController.getAIUsageStats);

export default router;
