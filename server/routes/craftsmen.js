/**
 * RenoAI - Routes Artisans
 * Gestion du marketplace d'artisans
 */

import { Router } from 'express';
import { body, param, query } from 'express-validator';
import * as craftsmenController from '../controllers/craftsmenController.js';
import { validate } from '../middleware/errorHandler.js';
import { authenticateToken, optionalAuth, requireRole } from '../middleware/auth.js';

const router = Router();

// ============================================
// VALIDATIONS
// ============================================

const createCraftsmanProfileValidation = [
    body('company_name')
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Le nom de l\'entreprise doit contenir entre 2 et 100 caractères'),
    body('specialties')
        .isArray({ min: 1 })
        .withMessage('Au moins une spécialité requise'),
    body('specialties.*')
        .isIn(['demolition', 'plumbing', 'electrical', 'tiling', 'painting', 'carpentry', 'insulation', 'masonry', 'roofing', 'flooring', 'general'])
        .withMessage('Spécialité invalide'),
    body('description')
        .optional()
        .trim()
        .isLength({ max: 2000 })
        .withMessage('La description ne doit pas dépasser 2000 caractères'),
    body('hourly_rate')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Taux horaire invalide'),
    body('experience_years')
        .optional()
        .isInt({ min: 0, max: 50 })
        .withMessage('Années d\'expérience invalides'),
    body('service_area')
        .optional()
        .isArray()
        .withMessage('Zone de service doit être un tableau'),
    body('certifications')
        .optional()
        .isArray()
        .withMessage('Certifications doit être un tableau'),
    body('insurance_number')
        .optional()
        .trim()
        .isLength({ max: 50 })
        .withMessage('Numéro d\'assurance trop long'),
    body('vat_number')
        .optional()
        .trim()
        .matches(/^[A-Z]{2}[0-9A-Z]{8,12}$/i)
        .withMessage('Numéro de TVA invalide')
];

const updateCraftsmanProfileValidation = [
    body('company_name')
        .optional()
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Le nom de l\'entreprise doit contenir entre 2 et 100 caractères'),
    body('specialties')
        .optional()
        .isArray({ min: 1 })
        .withMessage('Au moins une spécialité requise'),
    body('available')
        .optional()
        .isBoolean()
        .withMessage('Disponibilité doit être un booléen'),
    body('hourly_rate')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Taux horaire invalide'),
    ...createCraftsmanProfileValidation.filter(v =>
        !['company_name', 'specialties', 'hourly_rate'].includes(v.builder?.fields?.[0])
    )
];

const reviewValidation = [
    body('rating')
        .isInt({ min: 1, max: 5 })
        .withMessage('Note entre 1 et 5 requise'),
    body('comment')
        .optional()
        .trim()
        .isLength({ max: 1000 })
        .withMessage('Le commentaire ne doit pas dépasser 1000 caractères'),
    body('project_id')
        .optional()
        .isInt({ min: 1 })
        .withMessage('ID projet invalide')
];

const craftsmanIdValidation = [
    param('id')
        .isInt({ min: 1 })
        .withMessage('ID artisan invalide')
];

const searchValidation = [
    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Numéro de page invalide'),
    query('limit')
        .optional()
        .isInt({ min: 1, max: 50 })
        .withMessage('Limite invalide (1-50)'),
    query('specialty')
        .optional()
        .isIn(['demolition', 'plumbing', 'electrical', 'tiling', 'painting', 'carpentry', 'insulation', 'masonry', 'roofing', 'flooring', 'general', 'all'])
        .withMessage('Spécialité invalide'),
    query('city')
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage('Ville invalide'),
    query('min_rating')
        .optional()
        .isFloat({ min: 0, max: 5 })
        .withMessage('Note minimale invalide'),
    query('max_rate')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Taux maximum invalide'),
    query('available')
        .optional()
        .isBoolean()
        .withMessage('Disponibilité invalide'),
    query('verified')
        .optional()
        .isBoolean()
        .withMessage('Vérification invalide'),
    query('sort')
        .optional()
        .isIn(['rating', 'review_count', 'hourly_rate', 'experience_years', 'created_at'])
        .withMessage('Champ de tri invalide'),
    query('order')
        .optional()
        .isIn(['asc', 'desc'])
        .withMessage('Ordre invalide')
];

// ============================================
// ROUTES PUBLIQUES (marketplace)
// ============================================

/**
 * @route   GET /api/craftsmen
 * @desc    Rechercher des artisans (marketplace)
 * @access  Public (optionalAuth)
 */
router.get('/', optionalAuth, validate(searchValidation), craftsmenController.searchCraftsmen);

/**
 * @route   GET /api/craftsmen/featured
 * @desc    Obtenir les artisans mis en avant
 * @access  Public
 */
router.get('/featured', craftsmenController.getFeaturedCraftsmen);

/**
 * @route   GET /api/craftsmen/specialties
 * @desc    Lister les spécialités disponibles
 * @access  Public
 */
router.get('/specialties', craftsmenController.getSpecialties);

/**
 * @route   GET /api/craftsmen/:id
 * @desc    Obtenir le profil public d'un artisan
 * @access  Public (optionalAuth)
 */
router.get('/:id', optionalAuth, validate(craftsmanIdValidation), craftsmenController.getCraftsmanById);

/**
 * @route   GET /api/craftsmen/:id/reviews
 * @desc    Obtenir les avis d'un artisan
 * @access  Public
 */
router.get('/:id/reviews', validate(craftsmanIdValidation), craftsmenController.getCraftsmanReviews);

/**
 * @route   GET /api/craftsmen/:id/portfolio
 * @desc    Obtenir le portfolio d'un artisan
 * @access  Public
 */
router.get('/:id/portfolio', validate(craftsmanIdValidation), craftsmenController.getCraftsmanPortfolio);

/**
 * @route   GET /api/craftsmen/:id/availability
 * @desc    Obtenir les disponibilités d'un artisan
 * @access  Public
 */
router.get('/:id/availability', validate(craftsmanIdValidation), craftsmenController.getCraftsmanAvailability);

// ============================================
// ROUTES PROTÉGÉES (utilisateurs connectés)
// ============================================

/**
 * @route   POST /api/craftsmen/:id/reviews
 * @desc    Ajouter un avis sur un artisan
 * @access  Private
 */
router.post('/:id/reviews', authenticateToken, validate([...craftsmanIdValidation, ...reviewValidation]), craftsmenController.addReview);

/**
 * @route   POST /api/craftsmen/:id/contact
 * @desc    Contacter un artisan
 * @access  Private
 */
router.post('/:id/contact', authenticateToken, validate(craftsmanIdValidation), craftsmenController.contactCraftsman);

/**
 * @route   POST /api/craftsmen/:id/favorite
 * @desc    Ajouter un artisan aux favoris
 * @access  Private
 */
router.post('/:id/favorite', authenticateToken, validate(craftsmanIdValidation), craftsmenController.addToFavorites);

/**
 * @route   DELETE /api/craftsmen/:id/favorite
 * @desc    Retirer un artisan des favoris
 * @access  Private
 */
router.delete('/:id/favorite', authenticateToken, validate(craftsmanIdValidation), craftsmenController.removeFromFavorites);

/**
 * @route   GET /api/craftsmen/user/favorites
 * @desc    Obtenir ses artisans favoris
 * @access  Private
 */
router.get('/user/favorites', authenticateToken, craftsmenController.getFavorites);

// ============================================
// ROUTES PROFIL ARTISAN (craftsman)
// ============================================

/**
 * @route   POST /api/craftsmen/profile
 * @desc    Créer son profil artisan
 * @access  Private
 */
router.post('/profile', authenticateToken, validate(createCraftsmanProfileValidation), craftsmenController.createCraftsmanProfile);

/**
 * @route   GET /api/craftsmen/profile/me
 * @desc    Obtenir son profil artisan
 * @access  Private (craftsman)
 */
router.get('/profile/me', authenticateToken, requireRole(['craftsman', 'admin']), craftsmenController.getMyCraftsmanProfile);

/**
 * @route   PUT /api/craftsmen/profile/me
 * @desc    Mettre à jour son profil artisan
 * @access  Private (craftsman)
 */
router.put('/profile/me', authenticateToken, requireRole(['craftsman', 'admin']), validate(updateCraftsmanProfileValidation), craftsmenController.updateMyCraftsmanProfile);

/**
 * @route   POST /api/craftsmen/profile/portfolio
 * @desc    Ajouter des photos au portfolio
 * @access  Private (craftsman)
 */
router.post('/profile/portfolio', authenticateToken, requireRole(['craftsman', 'admin']), craftsmenController.addPortfolioPhotos);

/**
 * @route   DELETE /api/craftsmen/profile/portfolio/:photoId
 * @desc    Supprimer une photo du portfolio
 * @access  Private (craftsman)
 */
router.delete('/profile/portfolio/:photoId', authenticateToken, requireRole(['craftsman', 'admin']), craftsmenController.deletePortfolioPhoto);

/**
 * @route   PUT /api/craftsmen/profile/availability
 * @desc    Mettre à jour ses disponibilités
 * @access  Private (craftsman)
 */
router.put('/profile/availability', authenticateToken, requireRole(['craftsman', 'admin']), craftsmenController.updateAvailability);

/**
 * @route   GET /api/craftsmen/profile/stats
 * @desc    Obtenir ses statistiques artisan
 * @access  Private (craftsman)
 */
router.get('/profile/stats', authenticateToken, requireRole(['craftsman', 'admin']), craftsmenController.getCraftsmanStats);

/**
 * @route   GET /api/craftsmen/profile/requests
 * @desc    Obtenir ses demandes de projet
 * @access  Private (craftsman)
 */
router.get('/profile/requests', authenticateToken, requireRole(['craftsman', 'admin']), craftsmenController.getProjectRequests);

/**
 * @route   PUT /api/craftsmen/profile/requests/:requestId
 * @desc    Répondre à une demande de projet
 * @access  Private (craftsman)
 */
router.put('/profile/requests/:requestId', authenticateToken, requireRole(['craftsman', 'admin']), craftsmenController.respondToRequest);

// ============================================
// ROUTES ADMIN
// ============================================

/**
 * @route   PUT /api/craftsmen/:id/verify
 * @desc    Vérifier un artisan (admin)
 * @access  Admin
 */
router.put('/:id/verify', authenticateToken, requireRole(['admin']), validate(craftsmanIdValidation), craftsmenController.verifyCraftsman);

/**
 * @route   PUT /api/craftsmen/:id/feature
 * @desc    Mettre en avant un artisan (admin)
 * @access  Admin
 */
router.put('/:id/feature', authenticateToken, requireRole(['admin']), validate(craftsmanIdValidation), craftsmenController.featureCraftsman);

/**
 * @route   DELETE /api/craftsmen/:id
 * @desc    Supprimer un profil artisan (admin)
 * @access  Admin
 */
router.delete('/:id', authenticateToken, requireRole(['admin']), validate(craftsmanIdValidation), craftsmenController.deleteCraftsmanProfile);

export default router;
