/**
 * RenoAI - Routes d'authentification
 * Inscription, connexion, tokens et gestion de session
 */

import { Router } from 'express';
import { body } from 'express-validator';
import * as authController from '../controllers/authController.js';
import { validate } from '../middleware/errorHandler.js';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';

const router = Router();

// ============================================
// VALIDATIONS
// ============================================

const registerValidation = [
    body('email')
        .isEmail()
        .withMessage('Email invalide')
        .normalizeEmail(),
    body('password')
        .isLength({ min: 8 })
        .withMessage('Le mot de passe doit contenir au moins 8 caractères')
        .matches(/\d/)
        .withMessage('Le mot de passe doit contenir au moins un chiffre')
        .matches(/[a-zA-Z]/)
        .withMessage('Le mot de passe doit contenir au moins une lettre'),
    body('first_name')
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('Le prénom doit contenir entre 2 et 50 caractères'),
    body('last_name')
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('Le nom doit contenir entre 2 et 50 caractères'),
    body('phone')
        .optional()
        .isMobilePhone('any')
        .withMessage('Numéro de téléphone invalide'),
    body('role')
        .optional()
        .isIn(['user', 'craftsman', 'admin'])
        .withMessage('Rôle invalide')
];

const loginValidation = [
    body('email')
        .isEmail()
        .withMessage('Email invalide')
        .normalizeEmail(),
    body('password')
        .notEmpty()
        .withMessage('Mot de passe requis')
];

const refreshValidation = [
    body('refreshToken')
        .notEmpty()
        .withMessage('Refresh token requis')
];

const forgotPasswordValidation = [
    body('email')
        .isEmail()
        .withMessage('Email invalide')
        .normalizeEmail()
];

const resetPasswordValidation = [
    body('token')
        .notEmpty()
        .withMessage('Token requis'),
    body('password')
        .isLength({ min: 8 })
        .withMessage('Le mot de passe doit contenir au moins 8 caractères')
        .matches(/\d/)
        .withMessage('Le mot de passe doit contenir au moins un chiffre')
];

const changePasswordValidation = [
    body('currentPassword')
        .notEmpty()
        .withMessage('Mot de passe actuel requis'),
    body('newPassword')
        .isLength({ min: 8 })
        .withMessage('Le nouveau mot de passe doit contenir au moins 8 caractères')
        .matches(/\d/)
        .withMessage('Le nouveau mot de passe doit contenir au moins un chiffre')
];

// ============================================
// ROUTES PUBLIQUES
// ============================================

/**
 * @route   POST /api/auth/register
 * @desc    Inscription d'un nouvel utilisateur
 * @access  Public
 */
router.post('/register', validate(registerValidation), authController.register);

/**
 * @route   POST /api/auth/login
 * @desc    Connexion utilisateur
 * @access  Public
 */
router.post('/login', validate(loginValidation), authController.login);

/**
 * @route   POST /api/auth/refresh
 * @desc    Rafraîchir le token d'accès
 * @access  Public
 */
router.post('/refresh', validate(refreshValidation), authController.refreshToken);

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Demande de réinitialisation de mot de passe
 * @access  Public
 */
router.post('/forgot-password', validate(forgotPasswordValidation), authController.forgotPassword);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Réinitialiser le mot de passe avec token
 * @access  Public
 */
router.post('/reset-password', validate(resetPasswordValidation), authController.resetPassword);

/**
 * @route   GET /api/auth/verify-email/:token
 * @desc    Vérifier l'email avec token
 * @access  Public
 */
router.get('/verify-email/:token', authController.verifyEmail);

// ============================================
// ROUTES PROTÉGÉES
// ============================================

/**
 * @route   POST /api/auth/logout
 * @desc    Déconnexion (invalider le refresh token)
 * @access  Private
 */
router.post('/logout', authenticateToken, authController.logout);

/**
 * @route   GET /api/auth/me
 * @desc    Obtenir le profil de l'utilisateur connecté
 * @access  Private
 */
router.get('/me', authenticateToken, authController.getMe);

/**
 * @route   POST /api/auth/change-password
 * @desc    Changer le mot de passe
 * @access  Private
 */
router.post('/change-password', authenticateToken, validate(changePasswordValidation), authController.changePassword);

/**
 * @route   POST /api/auth/resend-verification
 * @desc    Renvoyer l'email de vérification
 * @access  Private
 */
router.post('/resend-verification', authenticateToken, authController.resendVerification);

/**
 * @route   GET /api/auth/sessions
 * @desc    Obtenir la liste des sessions actives
 * @access  Private
 */
router.get('/sessions', authenticateToken, authController.getSessions);

/**
 * @route   DELETE /api/auth/sessions/:sessionId
 * @desc    Révoquer une session spécifique
 * @access  Private
 */
router.delete('/sessions/:sessionId', authenticateToken, authController.revokeSession);

/**
 * @route   DELETE /api/auth/sessions
 * @desc    Révoquer toutes les sessions sauf la courante
 * @access  Private
 */
router.delete('/sessions', authenticateToken, authController.revokeAllSessions);

export default router;
