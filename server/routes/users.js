/**
 * RenoAI - Routes Utilisateurs
 * Gestion des profils et préférences utilisateurs
 */

import { Router } from 'express';
import { body, param, query } from 'express-validator';
import * as userController from '../controllers/userController.js';
import { validate } from '../middleware/errorHandler.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = Router();

// ============================================
// VALIDATIONS
// ============================================

const updateProfileValidation = [
    body('first_name')
        .optional()
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('Le prénom doit contenir entre 2 et 50 caractères'),
    body('last_name')
        .optional()
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('Le nom doit contenir entre 2 et 50 caractères'),
    body('phone')
        .optional()
        .isMobilePhone('any')
        .withMessage('Numéro de téléphone invalide'),
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
        .withMessage('Code postal invalide')
];

const updatePreferencesValidation = [
    body('notifications_email')
        .optional()
        .isBoolean()
        .withMessage('Valeur booléenne attendue'),
    body('notifications_push')
        .optional()
        .isBoolean()
        .withMessage('Valeur booléenne attendue'),
    body('notifications_sms')
        .optional()
        .isBoolean()
        .withMessage('Valeur booléenne attendue'),
    body('language')
        .optional()
        .isIn(['fr', 'en', 'de', 'lu'])
        .withMessage('Langue non supportée'),
    body('currency')
        .optional()
        .isIn(['EUR', 'USD', 'GBP'])
        .withMessage('Devise non supportée'),
    body('theme')
        .optional()
        .isIn(['light', 'dark', 'auto'])
        .withMessage('Thème invalide')
];

const userIdValidation = [
    param('id')
        .isInt({ min: 1 })
        .withMessage('ID utilisateur invalide')
];

const paginationValidation = [
    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Numéro de page invalide'),
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limite invalide (1-100)'),
    query('search')
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage('Recherche trop longue')
];

// ============================================
// ROUTES UTILISATEUR CONNECTÉ
// ============================================

// Toutes les routes nécessitent une authentification
router.use(authenticateToken);

/**
 * @route   GET /api/users/profile
 * @desc    Obtenir son propre profil complet
 * @access  Private
 */
router.get('/profile', userController.getProfile);

/**
 * @route   PUT /api/users/profile
 * @desc    Mettre à jour son profil
 * @access  Private
 */
router.put('/profile', validate(updateProfileValidation), userController.updateProfile);

/**
 * @route   GET /api/users/preferences
 * @desc    Obtenir ses préférences
 * @access  Private
 */
router.get('/preferences', userController.getPreferences);

/**
 * @route   PUT /api/users/preferences
 * @desc    Mettre à jour ses préférences
 * @access  Private
 */
router.put('/preferences', validate(updatePreferencesValidation), userController.updatePreferences);

/**
 * @route   POST /api/users/avatar
 * @desc    Uploader un avatar
 * @access  Private
 */
router.post('/avatar', userController.uploadAvatar);

/**
 * @route   DELETE /api/users/avatar
 * @desc    Supprimer son avatar
 * @access  Private
 */
router.delete('/avatar', userController.deleteAvatar);

/**
 * @route   GET /api/users/stats
 * @desc    Obtenir ses statistiques
 * @access  Private
 */
router.get('/stats', userController.getUserStats);

/**
 * @route   GET /api/users/activity
 * @desc    Obtenir son historique d'activité
 * @access  Private
 */
router.get('/activity', userController.getActivityHistory);

/**
 * @route   DELETE /api/users/account
 * @desc    Supprimer son compte
 * @access  Private
 */
router.delete('/account', userController.deleteAccount);

// ============================================
// ROUTES PUBLIQUES (profils visibles)
// ============================================

/**
 * @route   GET /api/users/:id/public
 * @desc    Obtenir le profil public d'un utilisateur
 * @access  Private (authentifié)
 */
router.get('/:id/public', validate(userIdValidation), userController.getPublicProfile);

// ============================================
// ROUTES ADMIN
// ============================================

/**
 * @route   GET /api/users
 * @desc    Lister tous les utilisateurs (admin)
 * @access  Admin
 */
router.get('/', requireRole(['admin']), validate(paginationValidation), userController.getAllUsers);

/**
 * @route   GET /api/users/:id
 * @desc    Obtenir un utilisateur par ID (admin)
 * @access  Admin
 */
router.get('/:id', requireRole(['admin']), validate(userIdValidation), userController.getUserById);

/**
 * @route   PUT /api/users/:id
 * @desc    Mettre à jour un utilisateur (admin)
 * @access  Admin
 */
router.put('/:id', requireRole(['admin']), validate([...userIdValidation, ...updateProfileValidation]), userController.updateUserById);

/**
 * @route   PUT /api/users/:id/role
 * @desc    Changer le rôle d'un utilisateur (admin)
 * @access  Admin
 */
router.put('/:id/role', requireRole(['admin']), validate(userIdValidation), userController.updateUserRole);

/**
 * @route   PUT /api/users/:id/status
 * @desc    Activer/désactiver un utilisateur (admin)
 * @access  Admin
 */
router.put('/:id/status', requireRole(['admin']), validate(userIdValidation), userController.updateUserStatus);

/**
 * @route   DELETE /api/users/:id
 * @desc    Supprimer un utilisateur (admin)
 * @access  Admin
 */
router.delete('/:id', requireRole(['admin']), validate(userIdValidation), userController.deleteUserById);

export default router;
