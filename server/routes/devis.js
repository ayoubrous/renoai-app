/**
 * RenoAI - Routes Devis
 * Gestion complète des devis et sous-devis
 */

import { Router } from 'express';
import { body, param, query } from 'express-validator';
import * as devisController from '../controllers/devisController.js';
import { validate } from '../middleware/errorHandler.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = Router();

// ============================================
// VALIDATIONS
// ============================================

const createDevisValidation = [
    body('title')
        .trim()
        .isLength({ min: 3, max: 200 })
        .withMessage('Le titre doit contenir entre 3 et 200 caractères'),
    body('project_id')
        .optional()
        .isInt({ min: 1 })
        .withMessage('ID projet invalide'),
    body('description')
        .optional()
        .trim()
        .isLength({ max: 2000 })
        .withMessage('La description ne doit pas dépasser 2000 caractères'),
    body('room_type')
        .optional()
        .isIn(['bathroom', 'kitchen', 'bedroom', 'living_room', 'office', 'garage', 'exterior', 'whole_house', 'other'])
        .withMessage('Type de pièce invalide'),
    body('surface_area')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Surface invalide'),
    body('urgency')
        .optional()
        .isIn(['low', 'normal', 'high', 'urgent'])
        .withMessage('Urgence invalide')
];

const updateDevisValidation = [
    body('title')
        .optional()
        .trim()
        .isLength({ min: 3, max: 200 })
        .withMessage('Le titre doit contenir entre 3 et 200 caractères'),
    body('status')
        .optional()
        .isIn(['draft', 'analyzing', 'pending', 'approved', 'rejected', 'expired'])
        .withMessage('Statut invalide'),
    body('total_amount')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Montant total invalide'),
    body('valid_until')
        .optional()
        .isISO8601()
        .withMessage('Date de validité invalide')
];

const createSubDevisValidation = [
    body('work_type')
        .isIn(['demolition', 'plumbing', 'electrical', 'tiling', 'painting', 'carpentry', 'insulation', 'masonry', 'roofing', 'flooring', 'other'])
        .withMessage('Type de travail invalide'),
    body('title')
        .trim()
        .isLength({ min: 3, max: 200 })
        .withMessage('Le titre doit contenir entre 3 et 200 caractères'),
    body('description')
        .optional()
        .trim()
        .isLength({ max: 1000 })
        .withMessage('La description ne doit pas dépasser 1000 caractères'),
    body('materials_cost')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Coût matériaux invalide'),
    body('labor_hours')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Heures de travail invalides'),
    body('labor_rate')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Taux horaire invalide'),
    body('priority')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Priorité invalide')
];

const addMaterialValidation = [
    body('name')
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Le nom doit contenir entre 2 et 100 caractères'),
    body('quantity')
        .isFloat({ min: 0 })
        .withMessage('Quantité invalide'),
    body('unit')
        .isIn(['piece', 'meter', 'sqm', 'liter', 'kg', 'box', 'roll', 'bag'])
        .withMessage('Unité invalide'),
    body('unit_price')
        .isFloat({ min: 0 })
        .withMessage('Prix unitaire invalide'),
    body('brand')
        .optional()
        .trim()
        .isLength({ max: 50 })
        .withMessage('Marque trop longue'),
    body('reference')
        .optional()
        .trim()
        .isLength({ max: 50 })
        .withMessage('Référence trop longue')
];

const devisIdValidation = [
    param('id')
        .isInt({ min: 1 })
        .withMessage('ID devis invalide')
];

const subDevisIdValidation = [
    param('subId')
        .isInt({ min: 1 })
        .withMessage('ID sous-devis invalide')
];

const paginationValidation = [
    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Numéro de page invalide'),
    query('limit')
        .optional()
        .isInt({ min: 1, max: 50 })
        .withMessage('Limite invalide (1-50)'),
    query('status')
        .optional()
        .isIn(['draft', 'analyzing', 'pending', 'approved', 'rejected', 'expired', 'all'])
        .withMessage('Statut invalide'),
    query('sort')
        .optional()
        .isIn(['created_at', 'updated_at', 'title', 'total_amount', 'status'])
        .withMessage('Champ de tri invalide'),
    query('order')
        .optional()
        .isIn(['asc', 'desc'])
        .withMessage('Ordre invalide')
];

// ============================================
// ROUTES DEVIS
// ============================================

// Toutes les routes nécessitent une authentification
router.use(authenticateToken);

/**
 * @route   GET /api/devis
 * @desc    Lister ses devis avec filtres et pagination
 * @access  Private
 */
router.get('/', validate(paginationValidation), devisController.getDevis);

/**
 * @route   POST /api/devis
 * @desc    Créer un nouveau devis
 * @access  Private
 */
router.post('/', validate(createDevisValidation), devisController.createDevis);

/**
 * @route   GET /api/devis/stats
 * @desc    Obtenir les statistiques de ses devis
 * @access  Private
 */
router.get('/stats', devisController.getDevisStats);

/**
 * @route   GET /api/devis/:id
 * @desc    Obtenir les détails d'un devis
 * @access  Private
 */
router.get('/:id', validate(devisIdValidation), devisController.getDevisById);

/**
 * @route   PUT /api/devis/:id
 * @desc    Mettre à jour un devis
 * @access  Private
 */
router.put('/:id', validate([...devisIdValidation, ...updateDevisValidation]), devisController.updateDevis);

/**
 * @route   DELETE /api/devis/:id
 * @desc    Supprimer un devis
 * @access  Private
 */
router.delete('/:id', validate(devisIdValidation), devisController.deleteDevis);

/**
 * @route   POST /api/devis/:id/duplicate
 * @desc    Dupliquer un devis
 * @access  Private
 */
router.post('/:id/duplicate', validate(devisIdValidation), devisController.duplicateDevis);

/**
 * @route   PUT /api/devis/:id/approve
 * @desc    Approuver un devis
 * @access  Private
 */
router.put('/:id/approve', validate(devisIdValidation), devisController.approveDevis);

/**
 * @route   PUT /api/devis/:id/reject
 * @desc    Rejeter un devis
 * @access  Private
 */
router.put('/:id/reject', validate(devisIdValidation), devisController.rejectDevis);

/**
 * @route   GET /api/devis/:id/pdf
 * @desc    Générer le PDF d'un devis
 * @access  Private
 */
router.get('/:id/pdf', validate(devisIdValidation), devisController.generateDevisPDF);

/**
 * @route   POST /api/devis/:id/send
 * @desc    Envoyer le devis par email
 * @access  Private
 */
router.post('/:id/send', validate(devisIdValidation), devisController.sendDevisByEmail);

// ============================================
// ROUTES PHOTOS DU DEVIS
// ============================================

/**
 * @route   GET /api/devis/:id/photos
 * @desc    Lister les photos d'un devis
 * @access  Private
 */
router.get('/:id/photos', validate(devisIdValidation), devisController.getDevisPhotos);

/**
 * @route   POST /api/devis/:id/photos
 * @desc    Ajouter des photos au devis
 * @access  Private
 */
router.post('/:id/photos', validate(devisIdValidation), devisController.addDevisPhotos);

/**
 * @route   DELETE /api/devis/:id/photos/:photoId
 * @desc    Supprimer une photo du devis
 * @access  Private
 */
router.delete('/:id/photos/:photoId', validate(devisIdValidation), devisController.deleteDevisPhoto);

// ============================================
// ROUTES SOUS-DEVIS
// ============================================

/**
 * @route   GET /api/devis/:id/sub-devis
 * @desc    Lister les sous-devis d'un devis
 * @access  Private
 */
router.get('/:id/sub-devis', validate(devisIdValidation), devisController.getSubDevis);

/**
 * @route   POST /api/devis/:id/sub-devis
 * @desc    Créer un nouveau sous-devis
 * @access  Private
 */
router.post('/:id/sub-devis', validate([...devisIdValidation, ...createSubDevisValidation]), devisController.createSubDevis);

/**
 * @route   GET /api/devis/:id/sub-devis/:subId
 * @desc    Obtenir les détails d'un sous-devis
 * @access  Private
 */
router.get('/:id/sub-devis/:subId', validate([...devisIdValidation, ...subDevisIdValidation]), devisController.getSubDevisById);

/**
 * @route   PUT /api/devis/:id/sub-devis/:subId
 * @desc    Mettre à jour un sous-devis
 * @access  Private
 */
router.put('/:id/sub-devis/:subId', validate([...devisIdValidation, ...subDevisIdValidation]), devisController.updateSubDevis);

/**
 * @route   DELETE /api/devis/:id/sub-devis/:subId
 * @desc    Supprimer un sous-devis
 * @access  Private
 */
router.delete('/:id/sub-devis/:subId', validate([...devisIdValidation, ...subDevisIdValidation]), devisController.deleteSubDevis);

/**
 * @route   PUT /api/devis/:id/sub-devis/reorder
 * @desc    Réordonner les sous-devis
 * @access  Private
 */
router.put('/:id/sub-devis/reorder', validate(devisIdValidation), devisController.reorderSubDevis);

// ============================================
// ROUTES MATÉRIAUX
// ============================================

/**
 * @route   GET /api/devis/:id/sub-devis/:subId/materials
 * @desc    Lister les matériaux d'un sous-devis
 * @access  Private
 */
router.get('/:id/sub-devis/:subId/materials', validate([...devisIdValidation, ...subDevisIdValidation]), devisController.getSubDevisMaterials);

/**
 * @route   POST /api/devis/:id/sub-devis/:subId/materials
 * @desc    Ajouter un matériau au sous-devis
 * @access  Private
 */
router.post('/:id/sub-devis/:subId/materials', validate([...devisIdValidation, ...subDevisIdValidation, ...addMaterialValidation]), devisController.addMaterial);

/**
 * @route   PUT /api/devis/:id/sub-devis/:subId/materials/:materialId
 * @desc    Mettre à jour un matériau
 * @access  Private
 */
router.put('/:id/sub-devis/:subId/materials/:materialId', validate([...devisIdValidation, ...subDevisIdValidation]), devisController.updateMaterial);

/**
 * @route   DELETE /api/devis/:id/sub-devis/:subId/materials/:materialId
 * @desc    Supprimer un matériau
 * @access  Private
 */
router.delete('/:id/sub-devis/:subId/materials/:materialId', validate([...devisIdValidation, ...subDevisIdValidation]), devisController.deleteMaterial);

// ============================================
// ROUTES ANALYSE IA
// ============================================

/**
 * @route   POST /api/devis/:id/analyze
 * @desc    Lancer l'analyse IA du devis
 * @access  Private
 */
router.post('/:id/analyze', validate(devisIdValidation), devisController.analyzeDevis);

/**
 * @route   GET /api/devis/:id/analysis
 * @desc    Obtenir les résultats de l'analyse IA
 * @access  Private
 */
router.get('/:id/analysis', validate(devisIdValidation), devisController.getDevisAnalysis);

/**
 * @route   POST /api/devis/:id/generate
 * @desc    Générer automatiquement les sous-devis depuis l'analyse
 * @access  Private
 */
router.post('/:id/generate', validate(devisIdValidation), devisController.generateFromAnalysis);

export default router;
