/**
 * RenoAI - Contrôleur Projets
 * Gestion complète des projets de rénovation
 */

import crypto from 'crypto';
import { getDatabase } from '../config/database.js';
import { asyncHandler, APIError, errors } from '../middleware/errorHandler.js';
import { logger } from '../middleware/logger.js';

const projectLogger = logger.child('Projects');

/**
 * Lister ses projets
 * GET /api/projects
 */
export const getProjects = asyncHandler(async (req, res) => {
    const {
        page = 1, limit = 20, status = 'all', type = 'all',
        sort = 'created_at', order = 'desc', search
    } = req.query;

    const db = getDatabase();

    let query = `
        SELECT p.*,
               (SELECT COUNT(*) FROM devis WHERE project_id = p.id) as devis_count,
               (SELECT COUNT(*) FROM project_craftsmen WHERE project_id = p.id) as craftsmen_count
        FROM projects p
        WHERE p.user_id = ?
    `;
    const params = [req.user.id];

    if (status && status !== 'all') {
        query += ` AND p.status = ?`;
        params.push(status);
    }

    if (type && type !== 'all') {
        query += ` AND p.type = ?`;
        params.push(type);
    }

    if (search) {
        query += ` AND (p.name LIKE ? OR p.description LIKE ?)`;
        params.push(`%${search}%`, `%${search}%`);
    }

    // Count total
    const countQuery = `SELECT COUNT(*) as total FROM (${query})`;
    const countResult = db.prepare(countQuery).get(...params);
    const total = countResult ? countResult.total : 0;

    // Pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const validSortFields = ['created_at', 'updated_at', 'name', 'status', 'progress', 'estimated_budget'];
    const sortField = validSortFields.includes(sort) ? sort : 'created_at';
    const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    query += ` ORDER BY p.${sortField} ${sortOrder} LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);

    const projects = db.prepare(query).all(...params);

    res.json({
        success: true,
        data: {
            projects,
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
 * Créer un nouveau projet
 * POST /api/projects
 */
export const createProject = asyncHandler(async (req, res) => {
    const {
        name, type, description, address, city, postal_code,
        estimated_budget, target_start_date, target_end_date, priority = 'medium'
    } = req.body;

    const db = getDatabase();
    const id = crypto.randomUUID();

    db.prepare(`
        INSERT INTO projects (
            id, user_id, name, type, description, address, city, postal_code,
            estimated_budget, target_start_date, target_end_date, priority, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')
    `).run(
        id, req.user.id, name, type, description || null, address || null,
        city || null, postal_code || null, estimated_budget || null,
        target_start_date || null, target_end_date || null, priority
    );

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);

    projectLogger.info('Projet créé', { projectId: project.id, userId: req.user.id });

    res.status(201).json({
        success: true,
        message: 'Projet créé avec succès',
        data: { project }
    });
});

/**
 * Obtenir les statistiques des projets
 * GET /api/projects/stats
 */
export const getProjectStats = asyncHandler(async (req, res) => {
    const db = getDatabase();

    const stats = {
        total: db.prepare('SELECT COUNT(*) as count FROM projects WHERE user_id = ?').get(req.user.id).count,
        by_status: db.prepare(`
            SELECT status, COUNT(*) as count
            FROM projects
            WHERE user_id = ?
            GROUP BY status
        `).all(req.user.id),
        by_type: db.prepare(`
            SELECT type, COUNT(*) as count
            FROM projects
            WHERE user_id = ?
            GROUP BY type
        `).all(req.user.id),
        total_budget: db.prepare(`
            SELECT COALESCE(SUM(estimated_budget), 0) as sum
            FROM projects
            WHERE user_id = ?
        `).get(req.user.id).sum,
        average_progress: db.prepare(`
            SELECT COALESCE(AVG(progress), 0) as avg
            FROM projects
            WHERE user_id = ? AND status = 'in_progress'
        `).get(req.user.id).avg
    };

    res.json({
        success: true,
        data: { stats }
    });
});

/**
 * Obtenir un projet par ID
 * GET /api/projects/:id
 */
export const getProjectById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabase();

    const project = db.prepare(`
        SELECT p.*,
               u.first_name as owner_first_name,
               u.last_name as owner_last_name
        FROM projects p
        JOIN users u ON p.user_id = u.id
        WHERE p.id = ?
    `).get(id);

    if (!project) {
        throw errors.PROJECT_NOT_FOUND;
    }

    // Vérifier l'accès
    if (project.user_id !== req.user.id && req.user.role !== 'admin') {
        // Vérifier si l'utilisateur est un artisan assigné
        const isAssigned = db.prepare(`
            SELECT 1 FROM project_craftsmen pc
            JOIN craftsmen c ON pc.craftsman_id = c.id
            WHERE pc.project_id = ? AND c.user_id = ?
        `).get(id, req.user.id);

        if (!isAssigned) {
            throw errors.FORBIDDEN;
        }
    }

    // Récupérer les devis associés
    const devis = db.prepare(`
        SELECT id, title, total_amount, status, created_at
        FROM devis
        WHERE project_id = ?
        ORDER BY created_at DESC
    `).all(id);

    // Récupérer les artisans assignés
    const craftsmen = db.prepare(`
        SELECT pc.*, c.company_name, c.specialties, c.rating,
               u.first_name, u.last_name, u.avatar_url
        FROM project_craftsmen pc
        JOIN craftsmen c ON pc.craftsman_id = c.id
        JOIN users u ON c.user_id = u.id
        WHERE pc.project_id = ?
    `).all(id);

    res.json({
        success: true,
        data: {
            project,
            devis,
            craftsmen
        }
    });
});

/**
 * Mettre à jour un projet
 * PUT /api/projects/:id
 */
export const updateProject = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabase();

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    if (!project) {
        throw errors.PROJECT_NOT_FOUND;
    }

    if (project.user_id !== req.user.id && req.user.role !== 'admin') {
        throw errors.FORBIDDEN;
    }

    const allowedFields = [
        'name', 'type', 'description', 'status', 'progress',
        'address', 'city', 'postal_code', 'estimated_budget',
        'target_start_date', 'target_end_date', 'actual_start_date',
        'actual_end_date', 'priority'
    ];

    const updates = [];
    const values = [];

    for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
            updates.push(`${field} = ?`);
            values.push(req.body[field]);
        }
    }

    if (updates.length === 0) {
        throw new APIError('Aucune donnée à mettre à jour', 400, 'NO_DATA');
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    db.prepare(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const updatedProject = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);

    projectLogger.info('Projet mis à jour', { projectId: id, userId: req.user.id });

    res.json({
        success: true,
        message: 'Projet mis à jour',
        data: { project: updatedProject }
    });
});

/**
 * Supprimer un projet
 * DELETE /api/projects/:id
 */
export const deleteProject = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabase();

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    if (!project) {
        throw errors.PROJECT_NOT_FOUND;
    }

    if (project.user_id !== req.user.id && req.user.role !== 'admin') {
        throw errors.FORBIDDEN;
    }

    // Supprimer les données associées
    db.prepare('DELETE FROM project_craftsmen WHERE project_id = ?').run(id);
    db.prepare('DELETE FROM project_photos WHERE project_id = ?').run(id);
    db.prepare('DELETE FROM project_timeline WHERE project_id = ?').run(id);

    // Mettre à jour les devis (ne pas les supprimer)
    db.prepare('UPDATE devis SET project_id = NULL WHERE project_id = ?').run(id);

    // Supprimer le projet
    db.prepare('DELETE FROM projects WHERE id = ?').run(id);

    projectLogger.info('Projet supprimé', { projectId: id, userId: req.user.id });

    res.json({
        success: true,
        message: 'Projet supprimé'
    });
});

/**
 * Dupliquer un projet
 * POST /api/projects/:id/duplicate
 */
export const duplicateProject = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabase();

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    if (!project) {
        throw errors.PROJECT_NOT_FOUND;
    }

    if (project.user_id !== req.user.id) {
        throw errors.FORBIDDEN;
    }

    const newId = crypto.randomUUID();

    db.prepare(`
        INSERT INTO projects (
            id, user_id, name, type, description, address, city, postal_code,
            estimated_budget, priority, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')
    `).run(
        newId, req.user.id, `${project.name} (copie)`, project.type, project.description,
        project.address, project.city, project.postal_code,
        project.estimated_budget, project.priority
    );

    const newProject = db.prepare('SELECT * FROM projects WHERE id = ?').get(newId);

    projectLogger.info('Projet dupliqué', { originalId: id, newId: newProject.id, userId: req.user.id });

    res.status(201).json({
        success: true,
        message: 'Projet dupliqué',
        data: { project: newProject }
    });
});

/**
 * Archiver un projet
 * PUT /api/projects/:id/archive
 */
export const archiveProject = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabase();

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    if (!project) {
        throw errors.PROJECT_NOT_FOUND;
    }

    if (project.user_id !== req.user.id) {
        throw errors.FORBIDDEN;
    }

    db.prepare(`
        UPDATE projects
        SET status = 'archived', archived_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(id);

    res.json({
        success: true,
        message: 'Projet archivé'
    });
});

/**
 * Restaurer un projet archivé
 * PUT /api/projects/:id/restore
 */
export const restoreProject = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabase();

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    if (!project) {
        throw errors.PROJECT_NOT_FOUND;
    }

    if (project.user_id !== req.user.id) {
        throw errors.FORBIDDEN;
    }

    db.prepare(`
        UPDATE projects
        SET status = 'draft', archived_at = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(id);

    res.json({
        success: true,
        message: 'Projet restauré'
    });
});

/**
 * Lister les artisans d'un projet
 * GET /api/projects/:id/craftsmen
 */
export const getProjectCraftsmen = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabase();

    const project = db.prepare('SELECT user_id FROM projects WHERE id = ?').get(id);
    if (!project) {
        throw errors.PROJECT_NOT_FOUND;
    }

    const craftsmen = db.prepare(`
        SELECT pc.*, c.company_name, c.specialties, c.rating, c.hourly_rate,
               u.first_name, u.last_name, u.avatar_url, u.phone, u.email
        FROM project_craftsmen pc
        JOIN craftsmen c ON pc.craftsman_id = c.id
        JOIN users u ON c.user_id = u.id
        WHERE pc.project_id = ?
    `).all(id);

    res.json({
        success: true,
        data: { craftsmen }
    });
});

/**
 * Ajouter un artisan au projet
 * POST /api/projects/:id/craftsmen
 */
export const addCraftsmanToProject = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { craftsman_id, role = 'main' } = req.body;
    const db = getDatabase();

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    if (!project) {
        throw errors.PROJECT_NOT_FOUND;
    }

    if (project.user_id !== req.user.id) {
        throw errors.FORBIDDEN;
    }

    // Vérifier que l'artisan existe
    const craftsman = db.prepare('SELECT id FROM craftsmen WHERE id = ?').get(craftsman_id);
    if (!craftsman) {
        throw errors.CRAFTSMAN_NOT_FOUND;
    }

    // Vérifier s'il n'est pas déjà assigné
    const existing = db.prepare(`
        SELECT id FROM project_craftsmen WHERE project_id = ? AND craftsman_id = ?
    `).get(id, craftsman_id);

    if (existing) {
        throw new APIError('Cet artisan est déjà assigné au projet', 409, 'ALREADY_ASSIGNED');
    }

    const pcId = crypto.randomUUID();

    db.prepare(`
        INSERT INTO project_craftsmen (id, project_id, craftsman_id, role, status)
        VALUES (?, ?, ?, ?, 'pending')
    `).run(pcId, id, craftsman_id, role);

    projectLogger.info('Artisan ajouté au projet', { projectId: id, craftsmanId: craftsman_id });

    res.status(201).json({
        success: true,
        message: 'Artisan ajouté au projet'
    });
});

/**
 * Retirer un artisan du projet
 * DELETE /api/projects/:id/craftsmen/:craftsmanId
 */
export const removeCraftsmanFromProject = asyncHandler(async (req, res) => {
    const { id, craftsmanId } = req.params;
    const db = getDatabase();

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    if (!project) {
        throw errors.PROJECT_NOT_FOUND;
    }

    if (project.user_id !== req.user.id) {
        throw errors.FORBIDDEN;
    }

    db.prepare('DELETE FROM project_craftsmen WHERE project_id = ? AND craftsman_id = ?').run(id, craftsmanId);

    res.json({
        success: true,
        message: 'Artisan retiré du projet'
    });
});

/**
 * Mettre à jour le statut d'un artisan
 * PUT /api/projects/:id/craftsmen/:craftsmanId/status
 */
export const updateCraftsmanStatus = asyncHandler(async (req, res) => {
    const { id, craftsmanId } = req.params;
    const { status } = req.body;
    const db = getDatabase();

    const validStatuses = ['pending', 'accepted', 'rejected', 'completed'];
    if (!validStatuses.includes(status)) {
        throw new APIError('Statut invalide', 400, 'INVALID_STATUS');
    }

    db.prepare(`
        UPDATE project_craftsmen
        SET status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE project_id = ? AND craftsman_id = ?
    `).run(status, id, craftsmanId);

    res.json({
        success: true,
        message: 'Statut mis à jour'
    });
});

/**
 * Lister les devis d'un projet
 * GET /api/projects/:id/devis
 */
export const getProjectDevis = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabase();

    const devis = db.prepare(`
        SELECT d.*,
               (SELECT COUNT(*) FROM sub_devis WHERE devis_id = d.id) as sub_devis_count
        FROM devis d
        WHERE d.project_id = ?
        ORDER BY d.created_at DESC
    `).all(id);

    res.json({
        success: true,
        data: { devis }
    });
});

/**
 * Obtenir la timeline du projet
 * GET /api/projects/:id/timeline
 */
export const getProjectTimeline = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabase();

    const events = db.prepare(`
        SELECT * FROM project_timeline
        WHERE project_id = ?
        ORDER BY event_date DESC
    `).all(id);

    res.json({
        success: true,
        data: { events }
    });
});

/**
 * Ajouter un événement à la timeline
 * POST /api/projects/:id/timeline
 */
export const addTimelineEvent = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { event_type, title, description, event_date } = req.body;
    const db = getDatabase();

    const eventId = crypto.randomUUID();

    db.prepare(`
        INSERT INTO project_timeline (id, project_id, event_type, title, description, event_date, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(eventId, id, event_type, title, description || null, event_date || new Date().toISOString(), req.user.id);

    const event = db.prepare('SELECT * FROM project_timeline WHERE id = ?').get(eventId);

    res.status(201).json({
        success: true,
        data: { event }
    });
});

/**
 * Lister les photos du projet
 * GET /api/projects/:id/photos
 */
export const getProjectPhotos = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabase();

    const photos = db.prepare(`
        SELECT * FROM project_photos
        WHERE project_id = ?
        ORDER BY created_at DESC
    `).all(id);

    res.json({
        success: true,
        data: { photos }
    });
});

/**
 * Ajouter des photos au projet
 * POST /api/projects/:id/photos
 */
export const addProjectPhotos = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { photos } = req.body; // Array of { url, description, category }
    const db = getDatabase();

    const inserted = [];
    for (const photo of photos) {
        const photoId = crypto.randomUUID();

        db.prepare(`
            INSERT INTO project_photos (id, project_id, url, description, category, uploaded_by)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(photoId, id, photo.url, photo.description || null, photo.category || 'general', req.user.id);

        inserted.push(db.prepare('SELECT * FROM project_photos WHERE id = ?').get(photoId));
    }

    res.status(201).json({
        success: true,
        data: { photos: inserted }
    });
});

/**
 * Supprimer une photo du projet
 * DELETE /api/projects/:id/photos/:photoId
 */
export const deleteProjectPhoto = asyncHandler(async (req, res) => {
    const { id, photoId } = req.params;
    const db = getDatabase();

    db.prepare('DELETE FROM project_photos WHERE id = ? AND project_id = ?').run(photoId, id);

    res.json({
        success: true,
        message: 'Photo supprimée'
    });
});

/**
 * Lister tous les projets (admin)
 * GET /api/projects/admin/all
 */
export const getAllProjectsAdmin = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, status, type, search } = req.query;
    const db = getDatabase();

    let query = `
        SELECT p.*, u.email, u.first_name, u.last_name
        FROM projects p
        JOIN users u ON p.user_id = u.id
        WHERE 1=1
    `;
    const params = [];

    if (status && status !== 'all') {
        query += ' AND p.status = ?';
        params.push(status);
    }

    if (type && type !== 'all') {
        query += ' AND p.type = ?';
        params.push(type);
    }

    if (search) {
        query += ' AND (p.name LIKE ? OR u.email LIKE ?)';
        params.push(`%${search}%`, `%${search}%`);
    }

    const countQuery = `SELECT COUNT(*) as total FROM (${query})`;
    const countResult = db.prepare(countQuery).get(...params);
    const total = countResult ? countResult.total : 0;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    query += ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const projects = db.prepare(query).all(...params);

    res.json({
        success: true,
        data: {
            projects,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        }
    });
});

export default {
    getProjects,
    createProject,
    getProjectStats,
    getProjectById,
    updateProject,
    deleteProject,
    duplicateProject,
    archiveProject,
    restoreProject,
    getProjectCraftsmen,
    addCraftsmanToProject,
    removeCraftsmanFromProject,
    updateCraftsmanStatus,
    getProjectDevis,
    getProjectTimeline,
    addTimelineEvent,
    getProjectPhotos,
    addProjectPhotos,
    deleteProjectPhoto,
    getAllProjectsAdmin
};
