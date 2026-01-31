/**
 * RenoAI - Contrôleur Artisans
 * Gestion du marketplace d'artisans
 */

import crypto from 'crypto';
import { getDatabase } from '../config/database.js';
import { asyncHandler, APIError, errors } from '../middleware/errorHandler.js';
import { logger } from '../middleware/logger.js';

const craftsmenLogger = logger.child('Craftsmen');

/**
 * Rechercher des artisans
 * GET /api/craftsmen
 */
export const searchCraftsmen = asyncHandler(async (req, res) => {
    const {
        page = 1, limit = 20, specialty = 'all', city, min_rating,
        max_rate, available, verified, sort = 'rating', order = 'desc', search
    } = req.query;

    const db = getDatabase();

    let query = `
        SELECT c.*,
               u.first_name, u.last_name, u.avatar_url, u.email,
               (SELECT COUNT(*) FROM craftsman_reviews WHERE craftsman_id = c.id) as total_reviews
        FROM craftsmen c
        LEFT JOIN users u ON c.user_id = u.id
        WHERE (u.status = 'active' OR c.user_id IS NULL)
    `;
    const params = [];

    if (specialty && specialty !== 'all') {
        query += ` AND c.specialties LIKE ?`;
        params.push(`%${specialty}%`);
    }

    if (city) {
        query += ` AND (c.city LIKE ? OR c.service_area LIKE ?)`;
        params.push(`%${city}%`, `%${city}%`);
    }

    if (min_rating) {
        query += ` AND c.rating >= ?`;
        params.push(parseFloat(min_rating));
    }

    if (max_rate) {
        query += ` AND c.hourly_rate <= ?`;
        params.push(parseFloat(max_rate));
    }

    if (available === 'true') {
        query += ` AND c.available = 1`;
    }

    if (verified === 'true') {
        query += ` AND c.verified = 1`;
    }

    if (search) {
        query += ` AND (c.company_name LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ? OR c.description LIKE ?)`;
        params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    // Count total using subquery wrapper
    const countQuery = `SELECT COUNT(*) as total FROM (${query})`;
    const countResult = db.prepare(countQuery).get(...params);
    const total = countResult ? countResult.total : 0;

    // Sorting
    const validSortFields = ['rating', 'review_count', 'hourly_rate', 'experience_years', 'created_at'];
    const sortField = validSortFields.includes(sort) ? sort : 'rating';
    query += ` ORDER BY c.${sortField} ${order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'}`;

    // Pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    query += ` LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);

    const craftsmen = db.prepare(query).all(...params);

    // Parser les spécialités JSON
    for (const c of craftsmen) {
        try {
            c.specialties = JSON.parse(c.specialties);
        } catch {
            c.specialties = [];
        }
    }

    res.json({
        success: true,
        data: {
            craftsmen,
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
 * Obtenir les artisans mis en avant
 * GET /api/craftsmen/featured
 */
export const getFeaturedCraftsmen = asyncHandler(async (req, res) => {
    const db = getDatabase();

    const craftsmen = db.prepare(`
        SELECT c.*,
               u.first_name, u.last_name, u.avatar_url
        FROM craftsmen c
        JOIN users u ON c.user_id = u.id
        WHERE c.featured = 1 AND c.verified = 1 AND u.status = 'active'
        ORDER BY c.rating DESC
        LIMIT 6
    `).all();

    for (const c of craftsmen) {
        try {
            c.specialties = JSON.parse(c.specialties);
        } catch {
            c.specialties = [];
        }
    }

    res.json({
        success: true,
        data: { craftsmen }
    });
});

/**
 * Lister les spécialités disponibles
 * GET /api/craftsmen/specialties
 */
export const getSpecialties = asyncHandler(async (req, res) => {
    const specialties = [
        { id: 'demolition', name: 'Démolition', icon: 'hammer' },
        { id: 'plumbing', name: 'Plomberie', icon: 'water' },
        { id: 'electrical', name: 'Électricité', icon: 'bolt' },
        { id: 'tiling', name: 'Carrelage', icon: 'th' },
        { id: 'painting', name: 'Peinture', icon: 'paint-brush' },
        { id: 'carpentry', name: 'Menuiserie', icon: 'tools' },
        { id: 'insulation', name: 'Isolation', icon: 'layer-group' },
        { id: 'masonry', name: 'Maçonnerie', icon: 'cubes' },
        { id: 'roofing', name: 'Toiture', icon: 'home' },
        { id: 'flooring', name: 'Sol', icon: 'border-all' },
        { id: 'general', name: 'Général', icon: 'wrench' }
    ];

    res.json({
        success: true,
        data: { specialties }
    });
});

/**
 * Obtenir un artisan par ID
 * GET /api/craftsmen/:id
 */
export const getCraftsmanById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabase();

    const craftsman = db.prepare(`
        SELECT c.*,
               u.first_name, u.last_name, u.avatar_url, u.email, u.phone, u.created_at as member_since
        FROM craftsmen c
        JOIN users u ON c.user_id = u.id
        WHERE c.id = ?
    `).get(id);

    if (!craftsman) {
        throw errors.CRAFTSMAN_NOT_FOUND;
    }

    try {
        craftsman.specialties = JSON.parse(craftsman.specialties);
        craftsman.service_area = JSON.parse(craftsman.service_area || '[]');
        craftsman.certifications = JSON.parse(craftsman.certifications || '[]');
    } catch {
        craftsman.specialties = [];
        craftsman.service_area = [];
        craftsman.certifications = [];
    }

    // Statistiques
    const stats = {
        total_reviews: db.prepare('SELECT COUNT(*) as count FROM craftsman_reviews WHERE craftsman_id = ?').get(id).count,
        projects_completed: db.prepare(`
            SELECT COUNT(*) as count FROM project_craftsmen
            WHERE craftsman_id = ? AND status = 'completed'
        `).get(id).count,
        average_response_time: '< 24h' // TODO: calculer réellement
    };

    // Derniers avis
    const recent_reviews = db.prepare(`
        SELECT cr.*, u.first_name, u.last_name, u.avatar_url
        FROM craftsman_reviews cr
        JOIN users u ON cr.user_id = u.id
        WHERE cr.craftsman_id = ?
        ORDER BY cr.created_at DESC
        LIMIT 3
    `).all(id);

    res.json({
        success: true,
        data: {
            craftsman,
            stats,
            recent_reviews
        }
    });
});

/**
 * Obtenir les avis d'un artisan
 * GET /api/craftsmen/:id/reviews
 */
export const getCraftsmanReviews = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const db = getDatabase();

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const total = db.prepare('SELECT COUNT(*) as count FROM craftsman_reviews WHERE craftsman_id = ?').get(id).count;

    const reviews = db.prepare(`
        SELECT cr.*, u.first_name, u.last_name, u.avatar_url,
               p.name as project_name
        FROM craftsman_reviews cr
        JOIN users u ON cr.user_id = u.id
        LEFT JOIN projects p ON cr.project_id = p.id
        WHERE cr.craftsman_id = ?
        ORDER BY cr.created_at DESC
        LIMIT ? OFFSET ?
    `).all(id, parseInt(limit), offset);

    // Distribution des notes
    const rating_distribution = db.prepare(`
        SELECT rating, COUNT(*) as count
        FROM craftsman_reviews
        WHERE craftsman_id = ?
        GROUP BY rating
        ORDER BY rating DESC
    `).all(id);

    res.json({
        success: true,
        data: {
            reviews,
            rating_distribution,
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
 * Obtenir le portfolio d'un artisan
 * GET /api/craftsmen/:id/portfolio
 */
export const getCraftsmanPortfolio = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabase();

    const portfolio = db.prepare(`
        SELECT * FROM craftsman_portfolio
        WHERE craftsman_id = ?
        ORDER BY created_at DESC
    `).all(id);

    res.json({
        success: true,
        data: { portfolio }
    });
});

/**
 * Obtenir les disponibilités d'un artisan
 * GET /api/craftsmen/:id/availability
 */
export const getCraftsmanAvailability = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabase();

    const craftsman = db.prepare('SELECT available, availability_schedule FROM craftsmen WHERE id = ?').get(id);

    if (!craftsman) {
        throw errors.CRAFTSMAN_NOT_FOUND;
    }

    let schedule = null;
    try {
        schedule = JSON.parse(craftsman.availability_schedule || '{}');
    } catch {
        schedule = {};
    }

    res.json({
        success: true,
        data: {
            available: !!craftsman.available,
            schedule
        }
    });
});

/**
 * Ajouter un avis
 * POST /api/craftsmen/:id/reviews
 */
export const addReview = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { rating, comment, project_id } = req.body;
    const db = getDatabase();

    // Vérifier que l'artisan existe
    const craftsman = db.prepare('SELECT id FROM craftsmen WHERE id = ?').get(id);
    if (!craftsman) {
        throw errors.CRAFTSMAN_NOT_FOUND;
    }

    // Vérifier qu'on n'a pas déjà donné un avis
    const existingReview = db.prepare(`
        SELECT id FROM craftsman_reviews
        WHERE craftsman_id = ? AND user_id = ? AND (project_id = ? OR (project_id IS NULL AND ? IS NULL))
    `).get(id, req.user.id, project_id, project_id);

    if (existingReview) {
        throw new APIError('Vous avez déjà donné un avis', 409, 'REVIEW_EXISTS');
    }

    const reviewId = crypto.randomUUID();
    db.prepare(`
        INSERT INTO craftsman_reviews (id, craftsman_id, user_id, project_id, rating, comment)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(reviewId, id, req.user.id, project_id || null, rating, comment || null);

    // Mettre à jour la note moyenne
    const avgRating = db.prepare(`
        SELECT AVG(rating) as avg, COUNT(*) as count FROM craftsman_reviews WHERE craftsman_id = ?
    `).get(id);

    db.prepare(`
        UPDATE craftsmen SET rating = ?, review_count = ? WHERE id = ?
    `).run(avgRating.avg, avgRating.count, id);

    const review = db.prepare('SELECT * FROM craftsman_reviews WHERE id = ?').get(reviewId);

    craftsmenLogger.info('Avis ajouté', { craftsmanId: id, userId: req.user.id, rating });

    res.status(201).json({
        success: true,
        message: 'Avis ajouté',
        data: { review }
    });
});

/**
 * Contacter un artisan
 * POST /api/craftsmen/:id/contact
 */
export const contactCraftsman = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { message, project_id } = req.body;
    const db = getDatabase();

    const craftsman = db.prepare('SELECT user_id FROM craftsmen WHERE id = ?').get(id);
    if (!craftsman) {
        throw errors.CRAFTSMAN_NOT_FOUND;
    }

    // Créer une conversation
    let conversation = db.prepare(`
        SELECT id FROM conversations
        WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)
    `).get(req.user.id, craftsman.user_id, craftsman.user_id, req.user.id);

    if (!conversation) {
        const conversationId = crypto.randomUUID();
        db.prepare(`
            INSERT INTO conversations (id, user1_id, user2_id, project_id)
            VALUES (?, ?, ?, ?)
        `).run(conversationId, req.user.id, craftsman.user_id, project_id || null);
        conversation = { id: conversationId };
    }

    // Créer le message
    const messageId = crypto.randomUUID();
    db.prepare(`
        INSERT INTO messages (id, sender_id, receiver_id, conversation_id, project_id, content)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(messageId, req.user.id, craftsman.user_id, conversation.id, project_id || null, message);

    res.json({
        success: true,
        message: 'Message envoyé',
        data: { conversation_id: conversation.id }
    });
});

/**
 * Ajouter aux favoris
 * POST /api/craftsmen/:id/favorite
 */
export const addToFavorites = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabase();

    const existing = db.prepare('SELECT id FROM user_favorite_craftsmen WHERE user_id = ? AND craftsman_id = ?').get(req.user.id, id);

    if (existing) {
        throw new APIError('Déjà dans vos favoris', 409, 'ALREADY_FAVORITE');
    }

    db.prepare('INSERT INTO user_favorite_craftsmen (user_id, craftsman_id) VALUES (?, ?)').run(req.user.id, id);

    res.json({
        success: true,
        message: 'Ajouté aux favoris'
    });
});

/**
 * Retirer des favoris
 * DELETE /api/craftsmen/:id/favorite
 */
export const removeFromFavorites = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabase();

    db.prepare('DELETE FROM user_favorite_craftsmen WHERE user_id = ? AND craftsman_id = ?').run(req.user.id, id);

    res.json({
        success: true,
        message: 'Retiré des favoris'
    });
});

/**
 * Obtenir ses favoris
 * GET /api/craftsmen/user/favorites
 */
export const getFavorites = asyncHandler(async (req, res) => {
    const db = getDatabase();

    const craftsmen = db.prepare(`
        SELECT c.*, u.first_name, u.last_name, u.avatar_url
        FROM user_favorite_craftsmen ufc
        JOIN craftsmen c ON ufc.craftsman_id = c.id
        JOIN users u ON c.user_id = u.id
        WHERE ufc.user_id = ?
        ORDER BY ufc.created_at DESC
    `).all(req.user.id);

    for (const c of craftsmen) {
        try {
            c.specialties = JSON.parse(c.specialties);
        } catch {
            c.specialties = [];
        }
    }

    res.json({
        success: true,
        data: { craftsmen }
    });
});

/**
 * Créer son profil artisan
 * POST /api/craftsmen/profile
 */
export const createCraftsmanProfile = asyncHandler(async (req, res) => {
    const {
        company_name, specialties, description, hourly_rate,
        experience_years, service_area, certifications,
        insurance_number, vat_number
    } = req.body;

    const db = getDatabase();

    // Vérifier qu'on n'a pas déjà un profil
    const existing = db.prepare('SELECT id FROM craftsmen WHERE user_id = ?').get(req.user.id);
    if (existing) {
        throw new APIError('Vous avez déjà un profil artisan', 409, 'PROFILE_EXISTS');
    }

    const craftsmanId = crypto.randomUUID();
    db.prepare(`
        INSERT INTO craftsmen (
            id, user_id, company_name, specialties, description, hourly_rate,
            experience_years, service_area, certifications, insurance_number, vat_number
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        craftsmanId, req.user.id, company_name, JSON.stringify(specialties), description || null,
        hourly_rate || null, experience_years || 0, JSON.stringify(service_area || []),
        JSON.stringify(certifications || []), insurance_number || null, vat_number || null
    );

    // Mettre à jour le rôle de l'utilisateur
    db.prepare('UPDATE users SET role = \'craftsman\' WHERE id = ?').run(req.user.id);

    const craftsman = db.prepare('SELECT * FROM craftsmen WHERE id = ?').get(craftsmanId);

    craftsmenLogger.info('Profil artisan créé', { craftsmanId: craftsman.id, userId: req.user.id });

    res.status(201).json({
        success: true,
        message: 'Profil artisan créé',
        data: { craftsman }
    });
});

/**
 * Obtenir son profil artisan
 * GET /api/craftsmen/profile/me
 */
export const getMyCraftsmanProfile = asyncHandler(async (req, res) => {
    const db = getDatabase();

    const craftsman = db.prepare('SELECT * FROM craftsmen WHERE user_id = ?').get(req.user.id);

    if (!craftsman) {
        throw new APIError('Profil artisan non trouvé', 404, 'CRAFTSMAN_PROFILE_NOT_FOUND');
    }

    try {
        craftsman.specialties = JSON.parse(craftsman.specialties);
        craftsman.service_area = JSON.parse(craftsman.service_area || '[]');
        craftsman.certifications = JSON.parse(craftsman.certifications || '[]');
    } catch {
        // Ignore parsing errors
    }

    res.json({
        success: true,
        data: { craftsman }
    });
});

/**
 * Mettre à jour son profil artisan
 * PUT /api/craftsmen/profile/me
 */
export const updateMyCraftsmanProfile = asyncHandler(async (req, res) => {
    const db = getDatabase();

    const craftsman = db.prepare('SELECT id FROM craftsmen WHERE user_id = ?').get(req.user.id);
    if (!craftsman) {
        throw new APIError('Profil artisan non trouvé', 404, 'CRAFTSMAN_PROFILE_NOT_FOUND');
    }

    const allowedFields = [
        'company_name', 'specialties', 'description', 'hourly_rate',
        'experience_years', 'service_area', 'certifications',
        'insurance_number', 'vat_number', 'available', 'availability_schedule'
    ];

    const updates = [];
    const values = [];

    for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
            let value = req.body[field];
            if (['specialties', 'service_area', 'certifications', 'availability_schedule'].includes(field) && typeof value !== 'string') {
                value = JSON.stringify(value);
            }
            updates.push(`${field} = ?`);
            values.push(value);
        }
    }

    if (updates.length === 0) {
        throw new APIError('Aucune donnée à mettre à jour', 400, 'NO_DATA');
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(craftsman.id);

    db.prepare(`UPDATE craftsmen SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const updatedCraftsman = db.prepare('SELECT * FROM craftsmen WHERE id = ?').get(craftsman.id);

    res.json({
        success: true,
        message: 'Profil mis à jour',
        data: { craftsman: updatedCraftsman }
    });
});

/**
 * Ajouter des photos au portfolio
 * POST /api/craftsmen/profile/portfolio
 */
export const addPortfolioPhotos = asyncHandler(async (req, res) => {
    const { photos } = req.body; // Array of { url, title, description, category }
    const db = getDatabase();

    const craftsman = db.prepare('SELECT id FROM craftsmen WHERE user_id = ?').get(req.user.id);
    if (!craftsman) {
        throw new APIError('Profil artisan non trouvé', 404, 'CRAFTSMAN_PROFILE_NOT_FOUND');
    }

    const inserted = [];
    for (const photo of photos) {
        const portfolioId = crypto.randomUUID();
        db.prepare(`
            INSERT INTO craftsman_portfolio (id, craftsman_id, url, title, description, category)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(portfolioId, craftsman.id, photo.url, photo.title || null, photo.description || null, photo.category || 'general');

        inserted.push(db.prepare('SELECT * FROM craftsman_portfolio WHERE id = ?').get(portfolioId));
    }

    res.status(201).json({
        success: true,
        data: { photos: inserted }
    });
});

/**
 * Supprimer une photo du portfolio
 * DELETE /api/craftsmen/profile/portfolio/:photoId
 */
export const deletePortfolioPhoto = asyncHandler(async (req, res) => {
    const { photoId } = req.params;
    const db = getDatabase();

    const craftsman = db.prepare('SELECT id FROM craftsmen WHERE user_id = ?').get(req.user.id);
    if (!craftsman) {
        throw new APIError('Profil artisan non trouvé', 404, 'CRAFTSMAN_PROFILE_NOT_FOUND');
    }

    db.prepare('DELETE FROM craftsman_portfolio WHERE id = ? AND craftsman_id = ?').run(photoId, craftsman.id);

    res.json({
        success: true,
        message: 'Photo supprimée'
    });
});

/**
 * Mettre à jour ses disponibilités
 * PUT /api/craftsmen/profile/availability
 */
export const updateAvailability = asyncHandler(async (req, res) => {
    const { available, schedule } = req.body;
    const db = getDatabase();

    const craftsman = db.prepare('SELECT id FROM craftsmen WHERE user_id = ?').get(req.user.id);
    if (!craftsman) {
        throw new APIError('Profil artisan non trouvé', 404, 'CRAFTSMAN_PROFILE_NOT_FOUND');
    }

    db.prepare(`
        UPDATE craftsmen
        SET available = ?, availability_schedule = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(available ? 1 : 0, JSON.stringify(schedule || {}), craftsman.id);

    res.json({
        success: true,
        message: 'Disponibilités mises à jour'
    });
});

/**
 * Obtenir ses statistiques artisan
 * GET /api/craftsmen/profile/stats
 */
export const getCraftsmanStats = asyncHandler(async (req, res) => {
    const db = getDatabase();

    const craftsman = db.prepare('SELECT id FROM craftsmen WHERE user_id = ?').get(req.user.id);
    if (!craftsman) {
        throw new APIError('Profil artisan non trouvé', 404, 'CRAFTSMAN_PROFILE_NOT_FOUND');
    }

    const stats = {
        total_reviews: db.prepare('SELECT COUNT(*) as count FROM craftsman_reviews WHERE craftsman_id = ?').get(craftsman.id).count,
        average_rating: db.prepare('SELECT COALESCE(AVG(rating), 0) as avg FROM craftsman_reviews WHERE craftsman_id = ?').get(craftsman.id).avg,
        projects: {
            total: db.prepare('SELECT COUNT(*) as count FROM project_craftsmen WHERE craftsman_id = ?').get(craftsman.id).count,
            pending: db.prepare(`SELECT COUNT(*) as count FROM project_craftsmen WHERE craftsman_id = ? AND status = 'pending'`).get(craftsman.id).count,
            accepted: db.prepare(`SELECT COUNT(*) as count FROM project_craftsmen WHERE craftsman_id = ? AND status = 'accepted'`).get(craftsman.id).count,
            completed: db.prepare(`SELECT COUNT(*) as count FROM project_craftsmen WHERE craftsman_id = ? AND status = 'completed'`).get(craftsman.id).count
        },
        profile_views: 0, // TODO: implémenter le tracking
        favorites_count: db.prepare('SELECT COUNT(*) as count FROM user_favorite_craftsmen WHERE craftsman_id = ?').get(craftsman.id).count
    };

    res.json({
        success: true,
        data: { stats }
    });
});

/**
 * Obtenir ses demandes de projet
 * GET /api/craftsmen/profile/requests
 */
export const getProjectRequests = asyncHandler(async (req, res) => {
    const { status = 'all' } = req.query;
    const db = getDatabase();

    const craftsman = db.prepare('SELECT id FROM craftsmen WHERE user_id = ?').get(req.user.id);
    if (!craftsman) {
        throw new APIError('Profil artisan non trouvé', 404, 'CRAFTSMAN_PROFILE_NOT_FOUND');
    }

    let query = `
        SELECT pc.*, p.name as project_name, p.type, p.description, p.address, p.city,
               u.first_name, u.last_name, u.email, u.phone
        FROM project_craftsmen pc
        JOIN projects p ON pc.project_id = p.id
        JOIN users u ON p.user_id = u.id
        WHERE pc.craftsman_id = ?
    `;
    const params = [craftsman.id];

    if (status !== 'all') {
        query += ' AND pc.status = ?';
        params.push(status);
    }

    query += ' ORDER BY pc.created_at DESC';

    const requests = db.prepare(query).all(...params);

    res.json({
        success: true,
        data: { requests }
    });
});

/**
 * Répondre à une demande de projet
 * PUT /api/craftsmen/profile/requests/:requestId
 */
export const respondToRequest = asyncHandler(async (req, res) => {
    const { requestId } = req.params;
    const { status, message } = req.body;
    const db = getDatabase();

    const craftsman = db.prepare('SELECT id FROM craftsmen WHERE user_id = ?').get(req.user.id);
    if (!craftsman) {
        throw new APIError('Profil artisan non trouvé', 404, 'CRAFTSMAN_PROFILE_NOT_FOUND');
    }

    const validStatuses = ['accepted', 'rejected'];
    if (!validStatuses.includes(status)) {
        throw new APIError('Statut invalide', 400, 'INVALID_STATUS');
    }

    const request = db.prepare(`
        SELECT pc.*, p.user_id as project_owner_id
        FROM project_craftsmen pc
        JOIN projects p ON pc.project_id = p.id
        WHERE pc.id = ? AND pc.craftsman_id = ?
    `).get(requestId, craftsman.id);

    if (!request) {
        throw new APIError('Demande non trouvée', 404, 'REQUEST_NOT_FOUND');
    }

    db.prepare(`
        UPDATE project_craftsmen
        SET status = ?, response_message = ?, responded_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(status, message || null, requestId);

    // Notifier le propriétaire du projet (via message)
    if (message) {
        const responseMessageId = crypto.randomUUID();
        db.prepare(`
            INSERT INTO messages (id, sender_id, receiver_id, project_id, content)
            VALUES (?, ?, ?, ?, ?)
        `).run(responseMessageId, req.user.id, request.project_owner_id, request.project_id, message);
    }

    res.json({
        success: true,
        message: `Demande ${status === 'accepted' ? 'acceptée' : 'refusée'}`
    });
});

/**
 * Vérifier un artisan (admin)
 * PUT /api/craftsmen/:id/verify
 */
export const verifyCraftsman = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { verified } = req.body;
    const db = getDatabase();

    db.prepare(`
        UPDATE craftsmen SET verified = ?, verified_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(verified ? 1 : 0, id);

    craftsmenLogger.info('Artisan vérifié', { craftsmanId: id, verified, adminId: req.user.id });

    res.json({
        success: true,
        message: verified ? 'Artisan vérifié' : 'Vérification retirée'
    });
});

/**
 * Mettre en avant un artisan (admin)
 * PUT /api/craftsmen/:id/feature
 */
export const featureCraftsman = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { featured } = req.body;
    const db = getDatabase();

    db.prepare('UPDATE craftsmen SET featured = ? WHERE id = ?').run(featured ? 1 : 0, id);

    res.json({
        success: true,
        message: featured ? 'Artisan mis en avant' : 'Mise en avant retirée'
    });
});

/**
 * Supprimer un profil artisan (admin)
 * DELETE /api/craftsmen/:id
 */
export const deleteCraftsmanProfile = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabase();

    const craftsman = db.prepare('SELECT user_id FROM craftsmen WHERE id = ?').get(id);
    if (!craftsman) {
        throw errors.CRAFTSMAN_NOT_FOUND;
    }

    // Supprimer les données associées
    db.prepare('DELETE FROM craftsman_portfolio WHERE craftsman_id = ?').run(id);
    db.prepare('DELETE FROM craftsman_reviews WHERE craftsman_id = ?').run(id);
    db.prepare('DELETE FROM user_favorite_craftsmen WHERE craftsman_id = ?').run(id);
    db.prepare('DELETE FROM project_craftsmen WHERE craftsman_id = ?').run(id);
    db.prepare('DELETE FROM craftsmen WHERE id = ?').run(id);

    // Remettre le rôle utilisateur
    db.prepare('UPDATE users SET role = \'user\' WHERE id = ?').run(craftsman.user_id);

    craftsmenLogger.info('Profil artisan supprimé', { craftsmanId: id, adminId: req.user.id });

    res.json({
        success: true,
        message: 'Profil artisan supprimé'
    });
});

export default {
    searchCraftsmen,
    getFeaturedCraftsmen,
    getSpecialties,
    getCraftsmanById,
    getCraftsmanReviews,
    getCraftsmanPortfolio,
    getCraftsmanAvailability,
    addReview,
    contactCraftsman,
    addToFavorites,
    removeFromFavorites,
    getFavorites,
    createCraftsmanProfile,
    getMyCraftsmanProfile,
    updateMyCraftsmanProfile,
    addPortfolioPhotos,
    deletePortfolioPhoto,
    updateAvailability,
    getCraftsmanStats,
    getProjectRequests,
    respondToRequest,
    verifyCraftsman,
    featureCraftsman,
    deleteCraftsmanProfile
};
