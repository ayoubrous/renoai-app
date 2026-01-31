/**
 * RenoAI - Routes Projets
 * Gestion complète des projets de rénovation
 */

import { Router } from 'express';
import { body, param, query } from 'express-validator';
import * as projectController from '../controllers/projectController.js';
import { validate } from '../middleware/errorHandler.js';
import { authenticateToken, optionalAuth, requireRole } from '../middleware/auth.js';

const router = Router();

// ============================================
// VALIDATIONS
// ============================================

const createProjectValidation = [
    body('name')
        .trim()
        .isLength({ min: 3, max: 100 })
        .withMessage('Le nom doit contenir entre 3 et 100 caractères'),
    body('type')
        .isIn(['renovation', 'construction', 'extension', 'amenagement', 'decoration', 'autre'])
        .withMessage('Type de projet invalide'),
    body('description')
        .optional()
        .trim()
        .isLength({ max: 2000 })
        .withMessage('La description ne doit pas dépasser 2000 caractères'),
    body('address')
        .optional()
        .trim()
        .isLength({ max: 255 })
        .withMessage('L\'adresse ne doit pas dépasser 255 caractères'),
    body('city')
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage('La ville ne doit pas dépasser 100 caractères'),
    body('postal_code')
        .optional()
        .trim()
        .matches(/^[A-Z0-9\s-]{3,10}$/i)
        .withMessage('Code postal invalide'),
    body('estimated_budget')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Budget estimé invalide'),
    body('target_start_date')
        .optional()
        .isISO8601()
        .withMessage('Date de début invalide'),
    body('target_end_date')
        .optional()
        .isISO8601()
        .withMessage('Date de fin invalide'),
    body('priority')
        .optional()
        .isIn(['low', 'medium', 'high', 'urgent'])
        .withMessage('Priorité invalide')
];

const updateProjectValidation = [
    body('name')
        .optional()
        .trim()
        .isLength({ min: 3, max: 100 })
        .withMessage('Le nom doit contenir entre 3 et 100 caractères'),
    body('status')
        .optional()
        .isIn(['draft', 'planning', 'in_progress', 'on_hold', 'completed', 'cancelled'])
        .withMessage('Statut invalide'),
    body('progress')
        .optional()
        .isInt({ min: 0, max: 100 })
        .withMessage('Progression invalide (0-100)'),
    ...createProjectValidation.filter(v => v.builder?.fields?.[0] !== 'name')
];

const projectIdValidation = [
    param('id')
        .isInt({ min: 1 })
        .withMessage('ID projet invalide')
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
        .isIn(['draft', 'planning', 'in_progress', 'on_hold', 'completed', 'cancelled', 'all'])
        .withMessage('Statut invalide'),
    query('type')
        .optional()
        .isIn(['renovation', 'construction', 'extension', 'amenagement', 'decoration', 'autre', 'all'])
        .withMessage('Type invalide'),
    query('sort')
        .optional()
        .isIn(['created_at', 'updated_at', 'name', 'status', 'progress', 'estimated_budget'])
        .withMessage('Champ de tri invalide'),
    query('order')
        .optional()
        .isIn(['asc', 'desc'])
        .withMessage('Ordre invalide')
];

const addCraftsmanValidation = [
    body('craftsman_id')
        .isInt({ min: 1 })
        .withMessage('ID artisan invalide'),
    body('role')
        .optional()
        .isIn(['main', 'secondary', 'consultant'])
        .withMessage('Rôle invalide')
];

// ============================================
// ROUTES PROJETS
// ============================================

// Toutes les routes nécessitent une authentification
router.use(authenticateToken);

/**
 * @route   GET /api/projects/admin/all
 * @desc    Lister tous les projets (admin)
 * @access  Admin
 */
router.get('/admin/all', requireRole(['admin']), projectController.getAllProjectsAdmin);

/**
 * @route   GET /api/projects
 * @desc    Lister ses projets avec filtres et pagination
 * @access  Private
 */
router.get('/', validate(paginationValidation), projectController.getProjects);

/**
 * @route   POST /api/projects
 * @desc    Créer un nouveau projet
 * @access  Private
 */
router.post('/', validate(createProjectValidation), projectController.createProject);

/**
 * @route   GET /api/projects/stats
 * @desc    Obtenir les statistiques de ses projets
 * @access  Private
 */
router.get('/stats', projectController.getProjectStats);

/**
 * @route   GET /api/projects/:id
 * @desc    Obtenir les détails d'un projet
 * @access  Private
 */
router.get('/:id', validate(projectIdValidation), projectController.getProjectById);

/**
 * @route   PUT /api/projects/:id
 * @desc    Mettre à jour un projet
 * @access  Private
 */
router.put('/:id', validate([...projectIdValidation, ...updateProjectValidation]), projectController.updateProject);

/**
 * @route   DELETE /api/projects/:id
 * @desc    Supprimer un projet
 * @access  Private
 */
router.delete('/:id', validate(projectIdValidation), projectController.deleteProject);

/**
 * @route   POST /api/projects/:id/duplicate
 * @desc    Dupliquer un projet
 * @access  Private
 */
router.post('/:id/duplicate', validate(projectIdValidation), projectController.duplicateProject);

/**
 * @route   PUT /api/projects/:id/archive
 * @desc    Archiver un projet
 * @access  Private
 */
router.put('/:id/archive', validate(projectIdValidation), projectController.archiveProject);

/**
 * @route   PUT /api/projects/:id/restore
 * @desc    Restaurer un projet archivé
 * @access  Private
 */
router.put('/:id/restore', validate(projectIdValidation), projectController.restoreProject);

// ============================================
// ROUTES ARTISANS DU PROJET
// ============================================

/**
 * @route   GET /api/projects/:id/craftsmen
 * @desc    Lister les artisans d'un projet
 * @access  Private
 */
router.get('/:id/craftsmen', validate(projectIdValidation), projectController.getProjectCraftsmen);

/**
 * @route   POST /api/projects/:id/craftsmen
 * @desc    Ajouter un artisan au projet
 * @access  Private
 */
router.post('/:id/craftsmen', validate([...projectIdValidation, ...addCraftsmanValidation]), projectController.addCraftsmanToProject);

/**
 * @route   DELETE /api/projects/:id/craftsmen/:craftsmanId
 * @desc    Retirer un artisan du projet
 * @access  Private
 */
router.delete('/:id/craftsmen/:craftsmanId', validate(projectIdValidation), projectController.removeCraftsmanFromProject);

/**
 * @route   PUT /api/projects/:id/craftsmen/:craftsmanId/status
 * @desc    Mettre à jour le statut d'un artisan sur le projet
 * @access  Private
 */
router.put('/:id/craftsmen/:craftsmanId/status', validate(projectIdValidation), projectController.updateCraftsmanStatus);

// ============================================
// ROUTES DEVIS DU PROJET
// ============================================

/**
 * @route   GET /api/projects/:id/devis
 * @desc    Lister les devis d'un projet
 * @access  Private
 */
router.get('/:id/devis', validate(projectIdValidation), projectController.getProjectDevis);

// ============================================
// ROUTES TIMELINE / HISTORIQUE
// ============================================

/**
 * @route   GET /api/projects/:id/timeline
 * @desc    Obtenir la timeline du projet
 * @access  Private
 */
router.get('/:id/timeline', validate(projectIdValidation), projectController.getProjectTimeline);

/**
 * @route   POST /api/projects/:id/timeline
 * @desc    Ajouter un événement à la timeline
 * @access  Private
 */
router.post('/:id/timeline', validate(projectIdValidation), projectController.addTimelineEvent);

// ============================================
// ROUTES PHOTOS DU PROJET
// ============================================

/**
 * @route   GET /api/projects/:id/photos
 * @desc    Lister les photos d'un projet
 * @access  Private
 */
router.get('/:id/photos', validate(projectIdValidation), projectController.getProjectPhotos);

/**
 * @route   POST /api/projects/:id/photos
 * @desc    Ajouter des photos au projet
 * @access  Private
 */
router.post('/:id/photos', validate(projectIdValidation), projectController.addProjectPhotos);

/**
 * @route   DELETE /api/projects/:id/photos/:photoId
 * @desc    Supprimer une photo du projet
 * @access  Private
 */
router.delete('/:id/photos/:photoId', validate(projectIdValidation), projectController.deleteProjectPhoto);

export default router;
