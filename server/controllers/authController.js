/**
 * RenoAI - Contrôleur Authentification
 * Gestion complète de l'authentification utilisateur
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { getDatabase } from '../config/database.js';
import { asyncHandler, APIError, errors } from '../middleware/errorHandler.js';
import { logger } from '../middleware/logger.js';
import { generateTokens } from '../middleware/auth.js';

const authLogger = logger.child('Auth');

/**
 * Inscription d'un nouvel utilisateur
 * POST /api/auth/register
 */
export const register = asyncHandler(async (req, res) => {
    const { email, password, first_name, last_name, phone, address, role = 'user' } = req.body;

    const db = getDatabase();

    // Vérifier si l'email existe déjà
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingUser) {
        throw new APIError('Cet email est déjà utilisé', 409, 'EMAIL_EXISTS');
    }

    // Hasher le mot de passe
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Générer le token de vérification email
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    // Créer l'utilisateur
    const userId = crypto.randomUUID();
    db.prepare(`
        INSERT INTO users (id, email, password, first_name, last_name, phone, address, role,
                          email_verification_token, email_verification_expires)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(userId, email, hashedPassword, first_name, last_name, phone || null, address || null,
           role, verificationToken, verificationExpiry);

    // Créer les préférences par défaut
    db.prepare(`
        INSERT INTO user_preferences (id, user_id)
        VALUES (?, ?)
    `).run(crypto.randomUUID(), userId);

    // Générer les tokens
    const tokens = generateTokens({ userId, email, role });

    // Sauvegarder le refresh token
    db.prepare(`
        INSERT INTO refresh_tokens (id, user_id, token, expires_at, user_agent, ip_address)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(crypto.randomUUID(), userId, tokens.refreshToken,
           new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
           req.get('User-Agent'), req.ip);

    authLogger.info('Nouvel utilisateur inscrit', { userId, email });

    // TODO: Envoyer l'email de vérification

    res.status(201).json({
        success: true,
        message: 'Inscription réussie. Veuillez vérifier votre email.',
        data: {
            user: {
                id: userId,
                email,
                first_name,
                last_name,
                role
            },
            tokens
        }
    });
});

/**
 * Connexion utilisateur
 * POST /api/auth/login
 */
export const login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const db = getDatabase();

    // Récupérer l'utilisateur
    const user = db.prepare(`
        SELECT id, email, password, first_name, last_name, role,
               email_verified, status, avatar_url
        FROM users
        WHERE email = ?
    `).get(email);

    if (!user) {
        throw new APIError('Email ou mot de passe incorrect', 401, 'INVALID_CREDENTIALS');
    }

    // Vérifier le statut du compte
    if (user.status === 'suspended') {
        throw new APIError('Votre compte a été suspendu', 403, 'ACCOUNT_SUSPENDED');
    }

    if (user.status === 'deleted') {
        throw new APIError('Ce compte n\'existe plus', 404, 'ACCOUNT_DELETED');
    }

    // Vérifier le mot de passe
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
        // Incrémenter les tentatives échouées
        db.prepare(`
            UPDATE users
            SET failed_login_attempts = failed_login_attempts + 1,
                last_failed_login = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(user.id);

        throw new APIError('Email ou mot de passe incorrect', 401, 'INVALID_CREDENTIALS');
    }

    // Générer les tokens
    const tokens = generateTokens({ userId: user.id, email: user.email, role: user.role });

    // Réinitialiser les tentatives échouées et mettre à jour la dernière connexion
    db.prepare(`
        UPDATE users
        SET failed_login_attempts = 0,
            last_login = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(user.id);

    // Sauvegarder le refresh token
    db.prepare(`
        INSERT INTO refresh_tokens (id, user_id, token, expires_at, user_agent, ip_address)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(crypto.randomUUID(), user.id, tokens.refreshToken,
           new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
           req.get('User-Agent'), req.ip);

    authLogger.info('Connexion réussie', { userId: user.id, email: user.email });

    res.json({
        success: true,
        message: 'Connexion réussie',
        data: {
            user: {
                id: user.id,
                email: user.email,
                first_name: user.first_name,
                last_name: user.last_name,
                role: user.role,
                avatar_url: user.avatar_url,
                email_verified: !!user.email_verified
            },
            tokens
        }
    });
});

/**
 * Rafraîchir le token d'accès
 * POST /api/auth/refresh
 */
export const refreshToken = asyncHandler(async (req, res) => {
    const { refreshToken: token } = req.body;

    const db = getDatabase();

    // Vérifier si le refresh token existe et est valide
    const storedToken = db.prepare(`
        SELECT rt.*, u.email, u.role, u.status
        FROM refresh_tokens rt
        JOIN users u ON rt.user_id = u.id
        WHERE rt.token = ? AND rt.revoked = 0
    `).get(token);

    if (!storedToken) {
        throw new APIError('Token de rafraîchissement invalide', 401, 'INVALID_REFRESH_TOKEN');
    }

    if (new Date(storedToken.expires_at) < new Date()) {
        throw new APIError('Token de rafraîchissement expiré', 401, 'REFRESH_TOKEN_EXPIRED');
    }

    if (storedToken.status !== 'active') {
        throw new APIError('Compte non actif', 403, 'ACCOUNT_INACTIVE');
    }

    // Générer de nouveaux tokens
    const tokens = generateTokens({
        userId: storedToken.user_id,
        email: storedToken.email,
        role: storedToken.role
    });

    // Révoquer l'ancien refresh token
    db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE token = ?').run(token);

    // Sauvegarder le nouveau refresh token
    db.prepare(`
        INSERT INTO refresh_tokens (id, user_id, token, expires_at, user_agent, ip_address)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(crypto.randomUUID(), storedToken.user_id, tokens.refreshToken,
           new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
           req.get('User-Agent'), req.ip);

    res.json({
        success: true,
        data: { tokens }
    });
});

/**
 * Déconnexion
 * POST /api/auth/logout
 */
export const logout = asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    const db = getDatabase();

    if (refreshToken) {
        // Révoquer le refresh token spécifique
        db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE token = ?').run(refreshToken);
    }

    authLogger.info('Déconnexion', { userId: req.user.id });

    res.json({
        success: true,
        message: 'Déconnexion réussie'
    });
});

/**
 * Obtenir le profil de l'utilisateur connecté
 * GET /api/auth/me
 */
export const getMe = asyncHandler(async (req, res) => {
    const db = getDatabase();

    const user = db.prepare(`
        SELECT id, email, first_name, last_name, phone, address, city, postal_code,
               role, avatar_url, email_verified, created_at, last_login
        FROM users
        WHERE id = ?
    `).get(req.user.id);

    if (!user) {
        throw errors.USER_NOT_FOUND;
    }

    // Récupérer les préférences
    const preferences = db.prepare(`
        SELECT * FROM user_preferences WHERE user_id = ?
    `).get(req.user.id);

    // Récupérer les statistiques
    const stats = {
        projects_count: db.prepare('SELECT COUNT(*) as count FROM projects WHERE user_id = ?').get(req.user.id).count,
        devis_count: db.prepare('SELECT COUNT(*) as count FROM devis WHERE user_id = ?').get(req.user.id).count,
        unread_messages: db.prepare(`
            SELECT COUNT(*) as count FROM messages
            WHERE receiver_id = ? AND read_at IS NULL
        `).get(req.user.id).count
    };

    res.json({
        success: true,
        data: {
            user,
            preferences,
            stats
        }
    });
});

/**
 * Demande de réinitialisation de mot de passe
 * POST /api/auth/forgot-password
 */
export const forgotPassword = asyncHandler(async (req, res) => {
    const { email } = req.body;
    const db = getDatabase();

    const user = db.prepare('SELECT id, email, first_name FROM users WHERE email = ?').get(email);

    // Ne pas révéler si l'email existe ou non
    if (user) {
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetExpiry = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 heure

        db.prepare(`
            UPDATE users
            SET password_reset_token = ?, password_reset_expires = ?
            WHERE id = ?
        `).run(resetToken, resetExpiry, user.id);

        // TODO: Envoyer l'email avec le lien de réinitialisation
        authLogger.info('Demande de réinitialisation de mot de passe', { userId: user.id });
    }

    res.json({
        success: true,
        message: 'Si cette adresse email est associée à un compte, vous recevrez un email de réinitialisation.'
    });
});

/**
 * Réinitialiser le mot de passe
 * POST /api/auth/reset-password
 */
export const resetPassword = asyncHandler(async (req, res) => {
    const { token, password } = req.body;
    const db = getDatabase();

    const user = db.prepare(`
        SELECT id, email FROM users
        WHERE password_reset_token = ?
          AND password_reset_expires > datetime('now')
    `).get(token);

    if (!user) {
        throw new APIError('Token invalide ou expiré', 400, 'INVALID_RESET_TOKEN');
    }

    // Hasher le nouveau mot de passe
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Mettre à jour le mot de passe et supprimer le token
    db.prepare(`
        UPDATE users
        SET password = ?, password_reset_token = NULL, password_reset_expires = NULL
        WHERE id = ?
    `).run(hashedPassword, user.id);

    // Révoquer tous les refresh tokens
    db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ?').run(user.id);

    authLogger.info('Mot de passe réinitialisé', { userId: user.id });

    res.json({
        success: true,
        message: 'Mot de passe réinitialisé avec succès. Vous pouvez maintenant vous connecter.'
    });
});

/**
 * Changer le mot de passe
 * POST /api/auth/change-password
 */
export const changePassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const db = getDatabase();

    const user = db.prepare('SELECT password FROM users WHERE id = ?').get(req.user.id);

    // Vérifier le mot de passe actuel
    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
        throw new APIError('Mot de passe actuel incorrect', 401, 'INVALID_CURRENT_PASSWORD');
    }

    // Hasher le nouveau mot de passe
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, req.user.id);

    authLogger.info('Mot de passe changé', { userId: req.user.id });

    res.json({
        success: true,
        message: 'Mot de passe changé avec succès'
    });
});

/**
 * Vérifier l'email
 * GET /api/auth/verify-email/:token
 */
export const verifyEmail = asyncHandler(async (req, res) => {
    const { token } = req.params;
    const db = getDatabase();

    const user = db.prepare(`
        SELECT id FROM users
        WHERE email_verification_token = ?
          AND email_verification_expires > datetime('now')
          AND email_verified = 0
    `).get(token);

    if (!user) {
        throw new APIError('Token de vérification invalide ou expiré', 400, 'INVALID_VERIFICATION_TOKEN');
    }

    db.prepare(`
        UPDATE users
        SET email_verified = 1,
            email_verification_token = NULL,
            email_verification_expires = NULL
        WHERE id = ?
    `).run(user.id);

    authLogger.info('Email vérifié', { userId: user.id });

    res.json({
        success: true,
        message: 'Email vérifié avec succès'
    });
});

/**
 * Renvoyer l'email de vérification
 * POST /api/auth/resend-verification
 */
export const resendVerification = asyncHandler(async (req, res) => {
    const db = getDatabase();

    const user = db.prepare(`
        SELECT id, email, email_verified FROM users WHERE id = ?
    `).get(req.user.id);

    if (user.email_verified) {
        throw new APIError('Email déjà vérifié', 400, 'EMAIL_ALREADY_VERIFIED');
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    db.prepare(`
        UPDATE users
        SET email_verification_token = ?, email_verification_expires = ?
        WHERE id = ?
    `).run(verificationToken, verificationExpiry, user.id);

    // TODO: Envoyer l'email de vérification

    res.json({
        success: true,
        message: 'Email de vérification envoyé'
    });
});

/**
 * Obtenir les sessions actives
 * GET /api/auth/sessions
 */
export const getSessions = asyncHandler(async (req, res) => {
    const db = getDatabase();

    const sessions = db.prepare(`
        SELECT id, user_agent, ip_address, created_at, expires_at
        FROM refresh_tokens
        WHERE user_id = ? AND revoked = 0 AND expires_at > datetime('now')
        ORDER BY created_at DESC
    `).all(req.user.id);

    res.json({
        success: true,
        data: { sessions }
    });
});

/**
 * Révoquer une session spécifique
 * DELETE /api/auth/sessions/:sessionId
 */
export const revokeSession = asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    const db = getDatabase();

    const result = db.prepare(`
        UPDATE refresh_tokens
        SET revoked = 1
        WHERE id = ? AND user_id = ?
    `).run(sessionId, req.user.id);

    if (result.changes === 0) {
        throw errors.NOT_FOUND;
    }

    res.json({
        success: true,
        message: 'Session révoquée'
    });
});

/**
 * Révoquer toutes les sessions sauf la courante
 * DELETE /api/auth/sessions
 */
export const revokeAllSessions = asyncHandler(async (req, res) => {
    const { currentToken } = req.body;
    const db = getDatabase();

    db.prepare(`
        UPDATE refresh_tokens
        SET revoked = 1
        WHERE user_id = ? AND token != ?
    `).run(req.user.id, currentToken || '');

    authLogger.info('Toutes les sessions révoquées', { userId: req.user.id });

    res.json({
        success: true,
        message: 'Toutes les autres sessions ont été révoquées'
    });
});

export default {
    register,
    login,
    refreshToken,
    logout,
    getMe,
    forgotPassword,
    resetPassword,
    changePassword,
    verifyEmail,
    resendVerification,
    getSessions,
    revokeSession,
    revokeAllSessions
};
