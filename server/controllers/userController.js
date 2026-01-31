/**
 * RenoAI - Contrôleur Utilisateurs
 * Gestion des profils et préférences utilisateurs
 */

import crypto from 'crypto';
import { getDatabase } from '../config/database.js';
import { asyncHandler, APIError, errors } from '../middleware/errorHandler.js';
import { logger } from '../middleware/logger.js';

const userLogger = logger.child('Users');

/**
 * Obtenir son profil complet
 * GET /api/users/profile
 */
export const getProfile = asyncHandler(async (req, res) => {
    const db = getDatabase();

    const user = db.prepare(`
        SELECT id, email, first_name, last_name, phone, address, city, postal_code,
               role, avatar_url, email_verified, created_at, last_login, status
        FROM users
        WHERE id = ?
    `).get(req.user.id);

    if (!user) {
        throw errors.USER_NOT_FOUND;
    }

    res.json({
        success: true,
        data: { user }
    });
});

/**
 * Mettre à jour son profil
 * PUT /api/users/profile
 */
export const updateProfile = asyncHandler(async (req, res) => {
    const { first_name, last_name, phone, address, city, postal_code } = req.body;
    const db = getDatabase();

    const updates = [];
    const values = [];

    if (first_name !== undefined) {
        updates.push('first_name = ?');
        values.push(first_name);
    }
    if (last_name !== undefined) {
        updates.push('last_name = ?');
        values.push(last_name);
    }
    if (phone !== undefined) {
        updates.push('phone = ?');
        values.push(phone);
    }
    if (address !== undefined) {
        updates.push('address = ?');
        values.push(address);
    }
    if (city !== undefined) {
        updates.push('city = ?');
        values.push(city);
    }
    if (postal_code !== undefined) {
        updates.push('postal_code = ?');
        values.push(postal_code);
    }

    if (updates.length === 0) {
        throw new APIError('Aucune donnée à mettre à jour', 400, 'NO_DATA');
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(req.user.id);

    db.prepare(`
        UPDATE users SET ${updates.join(', ')} WHERE id = ?
    `).run(...values);

    const user = db.prepare(`
        SELECT id, email, first_name, last_name, phone, address, city, postal_code,
               role, avatar_url, email_verified, updated_at
        FROM users WHERE id = ?
    `).get(req.user.id);

    userLogger.info('Profil mis à jour', { userId: req.user.id });

    res.json({
        success: true,
        message: 'Profil mis à jour',
        data: { user }
    });
});

/**
 * Obtenir ses préférences
 * GET /api/users/preferences
 */
export const getPreferences = asyncHandler(async (req, res) => {
    const db = getDatabase();

    let preferences = db.prepare(`
        SELECT * FROM user_preferences WHERE user_id = ?
    `).get(req.user.id);

    // Créer les préférences si elles n'existent pas
    if (!preferences) {
        db.prepare('INSERT INTO user_preferences (id, user_id) VALUES (?, ?)').run(crypto.randomUUID(), req.user.id);
        preferences = db.prepare('SELECT * FROM user_preferences WHERE user_id = ?').get(req.user.id);
    }

    res.json({
        success: true,
        data: { preferences }
    });
});

/**
 * Mettre à jour ses préférences
 * PUT /api/users/preferences
 */
export const updatePreferences = asyncHandler(async (req, res) => {
    const {
        notifications_email, notifications_push, notifications_sms,
        language, currency, theme
    } = req.body;

    const db = getDatabase();

    const updates = [];
    const values = [];

    if (notifications_email !== undefined) {
        updates.push('notifications_email = ?');
        values.push(notifications_email ? 1 : 0);
    }
    if (notifications_push !== undefined) {
        updates.push('notifications_push = ?');
        values.push(notifications_push ? 1 : 0);
    }
    if (notifications_sms !== undefined) {
        updates.push('notifications_sms = ?');
        values.push(notifications_sms ? 1 : 0);
    }
    if (language !== undefined) {
        updates.push('language = ?');
        values.push(language);
    }
    if (currency !== undefined) {
        updates.push('currency = ?');
        values.push(currency);
    }
    if (theme !== undefined) {
        updates.push('theme = ?');
        values.push(theme);
    }

    if (updates.length === 0) {
        throw new APIError('Aucune donnée à mettre à jour', 400, 'NO_DATA');
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(req.user.id);

    // Vérifier si les préférences existent
    const existing = db.prepare('SELECT id FROM user_preferences WHERE user_id = ?').get(req.user.id);

    if (!existing) {
        db.prepare('INSERT INTO user_preferences (id, user_id) VALUES (?, ?)').run(crypto.randomUUID(), req.user.id);
    }

    db.prepare(`
        UPDATE user_preferences SET ${updates.join(', ')} WHERE user_id = ?
    `).run(...values);

    const preferences = db.prepare('SELECT * FROM user_preferences WHERE user_id = ?').get(req.user.id);

    res.json({
        success: true,
        message: 'Préférences mises à jour',
        data: { preferences }
    });
});

/**
 * Uploader un avatar
 * POST /api/users/avatar
 */
export const uploadAvatar = asyncHandler(async (req, res) => {
    // L'upload est géré par multer dans la route
    if (!req.file) {
        throw new APIError('Aucun fichier uploadé', 400, 'NO_FILE');
    }

    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    const db = getDatabase();

    db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(avatarUrl, req.user.id);

    userLogger.info('Avatar mis à jour', { userId: req.user.id });

    res.json({
        success: true,
        message: 'Avatar mis à jour',
        data: { avatar_url: avatarUrl }
    });
});

/**
 * Supprimer son avatar
 * DELETE /api/users/avatar
 */
export const deleteAvatar = asyncHandler(async (req, res) => {
    const db = getDatabase();

    db.prepare('UPDATE users SET avatar_url = NULL WHERE id = ?').run(req.user.id);

    res.json({
        success: true,
        message: 'Avatar supprimé'
    });
});

/**
 * Obtenir ses statistiques
 * GET /api/users/stats
 */
export const getUserStats = asyncHandler(async (req, res) => {
    const db = getDatabase();

    const stats = {
        projects: {
            total: db.prepare('SELECT COUNT(*) as count FROM projects WHERE user_id = ?').get(req.user.id).count,
            active: db.prepare(`SELECT COUNT(*) as count FROM projects WHERE user_id = ? AND status IN ('planning', 'in_progress')`).get(req.user.id).count,
            completed: db.prepare(`SELECT COUNT(*) as count FROM projects WHERE user_id = ? AND status = 'completed'`).get(req.user.id).count
        },
        devis: {
            total: db.prepare('SELECT COUNT(*) as count FROM devis WHERE user_id = ?').get(req.user.id).count,
            pending: db.prepare(`SELECT COUNT(*) as count FROM devis WHERE user_id = ? AND status = 'pending'`).get(req.user.id).count,
            approved: db.prepare(`SELECT COUNT(*) as count FROM devis WHERE user_id = ? AND status = 'approved'`).get(req.user.id).count,
            total_amount: db.prepare(`SELECT COALESCE(SUM(total_amount), 0) as sum FROM devis WHERE user_id = ? AND status = 'approved'`).get(req.user.id).sum
        },
        messages: {
            total: db.prepare('SELECT COUNT(*) as count FROM messages WHERE sender_id = ? OR receiver_id = ?').get(req.user.id, req.user.id).count,
            unread: db.prepare('SELECT COUNT(*) as count FROM messages WHERE receiver_id = ? AND read_at IS NULL').get(req.user.id).count
        },
        member_since: db.prepare('SELECT created_at FROM users WHERE id = ?').get(req.user.id).created_at
    };

    res.json({
        success: true,
        data: { stats }
    });
});

/**
 * Obtenir l'historique d'activité
 * GET /api/users/activity
 */
export const getActivityHistory = asyncHandler(async (req, res) => {
    const { limit = 20, offset = 0 } = req.query;
    const db = getDatabase();

    // Récupérer les dernières activités (projets, devis, messages)
    const activities = db.prepare(`
        SELECT 'project' as type, id, name as title, created_at, status
        FROM projects WHERE user_id = ?
        UNION ALL
        SELECT 'devis' as type, id, title, created_at, status
        FROM devis WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
    `).all(req.user.id, req.user.id, parseInt(limit), parseInt(offset));

    res.json({
        success: true,
        data: { activities }
    });
});

/**
 * Supprimer son compte
 * DELETE /api/users/account
 */
export const deleteAccount = asyncHandler(async (req, res) => {
    const db = getDatabase();

    // Soft delete - marquer comme supprimé
    db.prepare(`
        UPDATE users
        SET status = 'deleted',
            email = email || '_deleted_' || id,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(req.user.id);

    // Révoquer tous les tokens
    db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ?').run(req.user.id);

    userLogger.info('Compte supprimé', { userId: req.user.id });

    res.json({
        success: true,
        message: 'Compte supprimé'
    });
});

/**
 * Obtenir le profil public d'un utilisateur
 * GET /api/users/:id/public
 */
export const getPublicProfile = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabase();

    const user = db.prepare(`
        SELECT id, first_name, last_name, avatar_url, role, created_at
        FROM users
        WHERE id = ? AND status = 'active'
    `).get(id);

    if (!user) {
        throw errors.USER_NOT_FOUND;
    }

    // Si c'est un artisan, récupérer son profil public
    let craftsmanProfile = null;
    if (user.role === 'craftsman') {
        craftsmanProfile = db.prepare(`
            SELECT company_name, specialties, rating, review_count,
                   experience_years, verified, description
            FROM craftsmen
            WHERE user_id = ?
        `).get(id);
    }

    res.json({
        success: true,
        data: {
            user,
            craftsman: craftsmanProfile
        }
    });
});

// ============================================
// ROUTES ADMIN
// ============================================

/**
 * Lister tous les utilisateurs (admin)
 * GET /api/users
 */
export const getAllUsers = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, search, role, status, sort = 'created_at', order = 'desc' } = req.query;
    const db = getDatabase();

    let query = `
        SELECT id, email, first_name, last_name, phone, role, status,
               avatar_url, email_verified, created_at, last_login
        FROM users
        WHERE 1=1
    `;
    const params = [];

    if (search) {
        query += ` AND (email LIKE ? OR first_name LIKE ? OR last_name LIKE ?)`;
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (role && role !== 'all') {
        query += ` AND role = ?`;
        params.push(role);
    }

    if (status && status !== 'all') {
        query += ` AND status = ?`;
        params.push(status);
    }

    // Compter le total
    const countQuery = `SELECT COUNT(*) as total FROM (${query})`;
    const countResult = db.prepare(countQuery).get(...params);
    const total = countResult ? countResult.total : 0;

    // Pagination - validation des colonnes de tri contre l'injection SQL
    const validSortFields = ['created_at', 'updated_at', 'email', 'first_name', 'last_name', 'role', 'status'];
    const safeSort = validSortFields.includes(sort) ? sort : 'created_at';
    const safeOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const offset = (parseInt(page) - 1) * parseInt(limit);
    query += ` ORDER BY ${safeSort} ${safeOrder} LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);

    const users = db.prepare(query).all(...params);

    res.json({
        success: true,
        data: {
            users,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        }
    });
});

/**
 * Obtenir un utilisateur par ID (admin)
 * GET /api/users/:id
 */
export const getUserById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabase();

    const user = db.prepare(`
        SELECT id, email, first_name, last_name, phone, address, city, postal_code,
               role, avatar_url, email_verified, status, created_at, last_login
        FROM users WHERE id = ?
    `).get(id);

    if (!user) {
        throw errors.USER_NOT_FOUND;
    }

    res.json({
        success: true,
        data: { user }
    });
});

/**
 * Mettre à jour un utilisateur (admin)
 * PUT /api/users/:id
 */
export const updateUserById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { first_name, last_name, phone, address, city, postal_code } = req.body;
    const db = getDatabase();

    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
    if (!user) {
        throw errors.USER_NOT_FOUND;
    }

    const updates = [];
    const values = [];

    if (first_name) { updates.push('first_name = ?'); values.push(first_name); }
    if (last_name) { updates.push('last_name = ?'); values.push(last_name); }
    if (phone !== undefined) { updates.push('phone = ?'); values.push(phone); }
    if (address !== undefined) { updates.push('address = ?'); values.push(address); }
    if (city !== undefined) { updates.push('city = ?'); values.push(city); }
    if (postal_code !== undefined) { updates.push('postal_code = ?'); values.push(postal_code); }

    if (updates.length > 0) {
        updates.push('updated_at = CURRENT_TIMESTAMP');
        values.push(id);
        db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(id);

    userLogger.info('Utilisateur mis à jour par admin', { userId: id, adminId: req.user.id });

    res.json({
        success: true,
        data: { user: updatedUser }
    });
});

/**
 * Changer le rôle d'un utilisateur (admin)
 * PUT /api/users/:id/role
 */
export const updateUserRole = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { role } = req.body;
    const db = getDatabase();

    if (!['user', 'craftsman', 'admin'].includes(role)) {
        throw new APIError('Rôle invalide', 400, 'INVALID_ROLE');
    }

    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
    if (!user) {
        throw errors.USER_NOT_FOUND;
    }

    db.prepare('UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(role, id);

    userLogger.info('Rôle utilisateur changé', { userId: id, newRole: role, adminId: req.user.id });

    res.json({
        success: true,
        message: `Rôle changé en ${role}`
    });
});

/**
 * Changer le statut d'un utilisateur (admin)
 * PUT /api/users/:id/status
 */
export const updateUserStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const db = getDatabase();

    if (!['active', 'suspended', 'deleted'].includes(status)) {
        throw new APIError('Statut invalide', 400, 'INVALID_STATUS');
    }

    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
    if (!user) {
        throw errors.USER_NOT_FOUND;
    }

    db.prepare('UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, id);

    // Révoquer les tokens si suspendu ou supprimé
    if (status !== 'active') {
        db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ?').run(id);
    }

    userLogger.info('Statut utilisateur changé', { userId: id, newStatus: status, adminId: req.user.id });

    res.json({
        success: true,
        message: `Statut changé en ${status}`
    });
});

/**
 * Supprimer un utilisateur (admin)
 * DELETE /api/users/:id
 */
export const deleteUserById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabase();

    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
    if (!user) {
        throw errors.USER_NOT_FOUND;
    }

    // Soft delete
    db.prepare(`
        UPDATE users
        SET status = 'deleted',
            email = email || '_deleted_' || id,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(id);

    db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ?').run(id);

    userLogger.info('Utilisateur supprimé par admin', { userId: id, adminId: req.user.id });

    res.json({
        success: true,
        message: 'Utilisateur supprimé'
    });
});

export default {
    getProfile,
    updateProfile,
    getPreferences,
    updatePreferences,
    uploadAvatar,
    deleteAvatar,
    getUserStats,
    getActivityHistory,
    deleteAccount,
    getPublicProfile,
    getAllUsers,
    getUserById,
    updateUserById,
    updateUserRole,
    updateUserStatus,
    deleteUserById
};
