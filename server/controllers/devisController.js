/**
 * RenoAI - Contrôleur Devis
 * Gestion complète des devis et sous-devis
 */

import crypto from 'crypto';
import { getDatabase } from '../config/database.js';
import { asyncHandler, APIError, errors } from '../middleware/errorHandler.js';
import { logger } from '../middleware/logger.js';
import * as aiService from '../services/aiService.js';

const devisLogger = logger.child('Devis');

/**
 * Lister ses devis
 * GET /api/devis
 */
export const getDevis = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, status = 'all', sort = 'created_at', order = 'desc', project_id } = req.query;
    const db = getDatabase();

    let query = `
        SELECT d.*,
               p.name as project_name,
               (SELECT COUNT(*) FROM sub_devis WHERE devis_id = d.id) as sub_devis_count,
               (SELECT COUNT(*) FROM devis_photos WHERE devis_id = d.id) as photos_count
        FROM devis d
        LEFT JOIN projects p ON d.project_id = p.id
        WHERE d.user_id = ?
    `;
    const params = [req.user.id];

    if (status !== 'all') {
        query += ' AND d.status = ?';
        params.push(status);
    }

    if (project_id) {
        query += ' AND d.project_id = ?';
        params.push(project_id);
    }

    const countQuery = `SELECT COUNT(*) as total FROM (${query})`;
    const countResult = db.prepare(countQuery).get(...params);
    const total = countResult ? countResult.total : 0;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const validSortFields = ['created_at', 'updated_at', 'title', 'total_amount', 'status'];
    const sortField = validSortFields.includes(sort) ? sort : 'created_at';
    query += ` ORDER BY d.${sortField} ${order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'} LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);

    const devisList = db.prepare(query).all(...params);

    res.json({
        success: true,
        data: {
            devis: devisList,
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
 * Créer un nouveau devis
 * POST /api/devis
 */
export const createDevis = asyncHandler(async (req, res) => {
    const { title, project_id, description, room_type, surface_area, urgency = 'normal' } = req.body;
    const db = getDatabase();

    // Vérifier le projet si spécifié
    if (project_id) {
        const project = db.prepare('SELECT id, user_id FROM projects WHERE id = ?').get(project_id);
        if (!project || project.user_id !== req.user.id) {
            throw errors.PROJECT_NOT_FOUND;
        }
    }

    const devisId = crypto.randomUUID();
    db.prepare(`
        INSERT INTO devis (id, user_id, project_id, title, description, room_type, surface_area, urgency, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft')
    `).run(devisId, req.user.id, project_id || null, title, description || null, room_type || null, surface_area || null, urgency);

    const devis = db.prepare('SELECT * FROM devis WHERE id = ?').get(devisId);

    devisLogger.info('Devis créé', { devisId: devis.id, userId: req.user.id });

    res.status(201).json({
        success: true,
        message: 'Devis créé avec succès',
        data: { devis }
    });
});

/**
 * Obtenir les statistiques des devis
 * GET /api/devis/stats
 */
export const getDevisStats = asyncHandler(async (req, res) => {
    const db = getDatabase();

    const stats = {
        total: db.prepare('SELECT COUNT(*) as count FROM devis WHERE user_id = ?').get(req.user.id).count,
        by_status: db.prepare(`
            SELECT status, COUNT(*) as count
            FROM devis WHERE user_id = ?
            GROUP BY status
        `).all(req.user.id),
        total_amount: db.prepare(`
            SELECT COALESCE(SUM(total_amount), 0) as sum
            FROM devis WHERE user_id = ? AND status = 'approved'
        `).get(req.user.id).sum,
        average_amount: db.prepare(`
            SELECT COALESCE(AVG(total_amount), 0) as avg
            FROM devis WHERE user_id = ? AND total_amount > 0
        `).get(req.user.id).avg,
        this_month: db.prepare(`
            SELECT COUNT(*) as count FROM devis
            WHERE user_id = ? AND created_at >= date('now', 'start of month')
        `).get(req.user.id).count
    };

    res.json({
        success: true,
        data: { stats }
    });
});

/**
 * Obtenir un devis par ID
 * GET /api/devis/:id
 */
export const getDevisById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabase();

    const devis = db.prepare(`
        SELECT d.*, p.name as project_name
        FROM devis d
        LEFT JOIN projects p ON d.project_id = p.id
        WHERE d.id = ?
    `).get(id);

    if (!devis) {
        throw errors.DEVIS_NOT_FOUND;
    }

    if (devis.user_id !== req.user.id && req.user.role !== 'admin') {
        throw errors.FORBIDDEN;
    }

    // Récupérer les sous-devis
    const subDevis = db.prepare(`
        SELECT * FROM sub_devis WHERE devis_id = ? ORDER BY priority ASC
    `).all(id);

    // Pour chaque sous-devis, récupérer les matériaux
    for (const sd of subDevis) {
        sd.materials = db.prepare('SELECT * FROM sub_devis_materials WHERE sub_devis_id = ?').all(sd.id);
        sd.images = db.prepare('SELECT * FROM sub_devis_images WHERE sub_devis_id = ?').all(sd.id);
    }

    // Récupérer les photos
    const photos = db.prepare('SELECT * FROM devis_photos WHERE devis_id = ?').all(id);

    res.json({
        success: true,
        data: {
            devis,
            sub_devis: subDevis,
            photos
        }
    });
});

/**
 * Mettre à jour un devis
 * PUT /api/devis/:id
 */
export const updateDevis = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabase();

    const devis = db.prepare('SELECT * FROM devis WHERE id = ?').get(id);
    if (!devis) {
        throw errors.DEVIS_NOT_FOUND;
    }

    if (devis.user_id !== req.user.id && req.user.role !== 'admin') {
        throw errors.FORBIDDEN;
    }

    const allowedFields = [
        'title', 'description', 'status', 'room_type', 'surface_area',
        'urgency', 'total_amount', 'materials_total', 'labor_total',
        'valid_until', 'notes'
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

    db.prepare(`UPDATE devis SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const updatedDevis = db.prepare('SELECT * FROM devis WHERE id = ?').get(id);

    devisLogger.info('Devis mis à jour', { devisId: id, userId: req.user.id });

    res.json({
        success: true,
        message: 'Devis mis à jour',
        data: { devis: updatedDevis }
    });
});

/**
 * Supprimer un devis
 * DELETE /api/devis/:id
 */
export const deleteDevis = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabase();

    const devis = db.prepare('SELECT * FROM devis WHERE id = ?').get(id);
    if (!devis) {
        throw errors.DEVIS_NOT_FOUND;
    }

    if (devis.user_id !== req.user.id && req.user.role !== 'admin') {
        throw errors.FORBIDDEN;
    }

    // Supprimer les données associées
    const subDevisIds = db.prepare('SELECT id FROM sub_devis WHERE devis_id = ?').all(id).map(s => s.id);

    for (const subId of subDevisIds) {
        db.prepare('DELETE FROM sub_devis_materials WHERE sub_devis_id = ?').run(subId);
        db.prepare('DELETE FROM sub_devis_images WHERE sub_devis_id = ?').run(subId);
    }

    db.prepare('DELETE FROM sub_devis WHERE devis_id = ?').run(id);
    db.prepare('DELETE FROM devis_photos WHERE devis_id = ?').run(id);
    db.prepare('DELETE FROM devis WHERE id = ?').run(id);

    devisLogger.info('Devis supprimé', { devisId: id, userId: req.user.id });

    res.json({
        success: true,
        message: 'Devis supprimé'
    });
});

/**
 * Dupliquer un devis
 * POST /api/devis/:id/duplicate
 */
export const duplicateDevis = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabase();

    const devis = db.prepare('SELECT * FROM devis WHERE id = ?').get(id);
    if (!devis) {
        throw errors.DEVIS_NOT_FOUND;
    }

    if (devis.user_id !== req.user.id) {
        throw errors.FORBIDDEN;
    }

    // Dupliquer le devis principal
    const newDevisId = crypto.randomUUID();
    db.prepare(`
        INSERT INTO devis (id, user_id, project_id, title, description, room_type, surface_area, urgency, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft')
    `).run(newDevisId, req.user.id, devis.project_id, `${devis.title} (copie)`, devis.description, devis.room_type, devis.surface_area, devis.urgency);

    // Dupliquer les sous-devis
    const subDevisList = db.prepare('SELECT * FROM sub_devis WHERE devis_id = ?').all(id);

    for (const sd of subDevisList) {
        const newSubDevisId = crypto.randomUUID();
        db.prepare(`
            INSERT INTO sub_devis (id, devis_id, work_type, title, description, materials_cost, labor_hours, labor_rate, labor_cost, total_cost, priority)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(newSubDevisId, newDevisId, sd.work_type, sd.title, sd.description, sd.materials_cost, sd.labor_hours, sd.labor_rate, sd.labor_cost, sd.total_cost, sd.priority);

        // Dupliquer les matériaux
        const materials = db.prepare('SELECT * FROM sub_devis_materials WHERE sub_devis_id = ?').all(sd.id);
        for (const mat of materials) {
            const materialId = crypto.randomUUID();
            db.prepare(`
                INSERT INTO sub_devis_materials (id, sub_devis_id, name, quantity, unit, unit_price, total_price, brand, reference)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(materialId, newSubDevisId, mat.name, mat.quantity, mat.unit, mat.unit_price, mat.total_price, mat.brand, mat.reference);
        }
    }

    const newDevis = db.prepare('SELECT * FROM devis WHERE id = ?').get(newDevisId);

    devisLogger.info('Devis dupliqué', { originalId: id, newId: newDevisId, userId: req.user.id });

    res.status(201).json({
        success: true,
        message: 'Devis dupliqué',
        data: { devis: newDevis }
    });
});

/**
 * Approuver un devis
 * PUT /api/devis/:id/approve
 */
export const approveDevis = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabase();

    const devis = db.prepare('SELECT * FROM devis WHERE id = ?').get(id);
    if (!devis) {
        throw errors.DEVIS_NOT_FOUND;
    }

    if (devis.user_id !== req.user.id) {
        throw errors.FORBIDDEN;
    }

    db.prepare(`
        UPDATE devis
        SET status = 'approved', approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(id);

    devisLogger.info('Devis approuvé', { devisId: id, userId: req.user.id });

    res.json({
        success: true,
        message: 'Devis approuvé'
    });
});

/**
 * Rejeter un devis
 * PUT /api/devis/:id/reject
 */
export const rejectDevis = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    const db = getDatabase();

    const devis = db.prepare('SELECT * FROM devis WHERE id = ?').get(id);
    if (!devis) {
        throw errors.DEVIS_NOT_FOUND;
    }

    if (devis.user_id !== req.user.id) {
        throw errors.FORBIDDEN;
    }

    db.prepare(`
        UPDATE devis
        SET status = 'rejected', rejection_reason = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(reason || null, id);

    res.json({
        success: true,
        message: 'Devis rejeté'
    });
});

/**
 * Générer le PDF d'un devis
 * GET /api/devis/:id/pdf
 */
export const generateDevisPDF = asyncHandler(async (req, res) => {
    const { id } = req.params;

    // TODO: Implémenter la génération PDF
    res.json({
        success: true,
        message: 'Génération PDF en cours de développement',
        data: { url: `/api/devis/${id}/pdf/download` }
    });
});

/**
 * Envoyer le devis par email
 * POST /api/devis/:id/send
 */
export const sendDevisByEmail = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { email, message } = req.body;

    // TODO: Implémenter l'envoi par email
    res.json({
        success: true,
        message: 'Envoi email en cours de développement'
    });
});

/**
 * Lister les photos d'un devis
 * GET /api/devis/:id/photos
 */
export const getDevisPhotos = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabase();

    const photos = db.prepare('SELECT * FROM devis_photos WHERE devis_id = ? ORDER BY created_at DESC').all(id);

    res.json({
        success: true,
        data: { photos }
    });
});

/**
 * Ajouter des photos au devis
 * POST /api/devis/:id/photos
 */
export const addDevisPhotos = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { photos } = req.body; // Array of { url, description }
    const db = getDatabase();

    const inserted = [];
    for (const photo of photos) {
        const photoId = crypto.randomUUID();
        db.prepare(`
            INSERT INTO devis_photos (id, devis_id, original_url, description)
            VALUES (?, ?, ?, ?)
        `).run(photoId, id, photo.url, photo.description || null);

        inserted.push(db.prepare('SELECT * FROM devis_photos WHERE id = ?').get(photoId));
    }

    res.status(201).json({
        success: true,
        data: { photos: inserted }
    });
});

/**
 * Supprimer une photo du devis
 * DELETE /api/devis/:id/photos/:photoId
 */
export const deleteDevisPhoto = asyncHandler(async (req, res) => {
    const { id, photoId } = req.params;
    const db = getDatabase();

    db.prepare('DELETE FROM devis_photos WHERE id = ? AND devis_id = ?').run(photoId, id);

    res.json({
        success: true,
        message: 'Photo supprimée'
    });
});

/**
 * Lister les sous-devis
 * GET /api/devis/:id/sub-devis
 */
export const getSubDevis = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabase();

    const subDevis = db.prepare(`
        SELECT * FROM sub_devis WHERE devis_id = ? ORDER BY priority ASC
    `).all(id);

    for (const sd of subDevis) {
        sd.materials = db.prepare('SELECT * FROM sub_devis_materials WHERE sub_devis_id = ?').all(sd.id);
    }

    res.json({
        success: true,
        data: { sub_devis: subDevis }
    });
});

/**
 * Créer un sous-devis
 * POST /api/devis/:id/sub-devis
 */
export const createSubDevis = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { work_type, title, description, materials_cost = 0, labor_hours = 0, labor_rate = 45, priority } = req.body;
    const db = getDatabase();

    const laborCost = labor_hours * labor_rate;
    const totalCost = materials_cost + laborCost;

    // Déterminer la priorité
    const maxPriority = db.prepare('SELECT COALESCE(MAX(priority), 0) as max FROM sub_devis WHERE devis_id = ?').get(id).max;

    const subDevisId = crypto.randomUUID();
    db.prepare(`
        INSERT INTO sub_devis (id, devis_id, work_type, title, description, materials_cost, labor_hours, labor_rate, labor_cost, total_cost, priority)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(subDevisId, id, work_type, title, description || null, materials_cost, labor_hours, labor_rate, laborCost, totalCost, priority || maxPriority + 1);

    // Mettre à jour le total du devis
    updateDevisTotals(id);

    const subDevis = db.prepare('SELECT * FROM sub_devis WHERE id = ?').get(subDevisId);

    res.status(201).json({
        success: true,
        data: { sub_devis: subDevis }
    });
});

/**
 * Obtenir un sous-devis par ID
 * GET /api/devis/:id/sub-devis/:subId
 */
export const getSubDevisById = asyncHandler(async (req, res) => {
    const { id, subId } = req.params;
    const db = getDatabase();

    const subDevis = db.prepare('SELECT * FROM sub_devis WHERE id = ? AND devis_id = ?').get(subId, id);
    if (!subDevis) {
        throw new APIError('Sous-devis non trouvé', 404, 'SUB_DEVIS_NOT_FOUND');
    }

    subDevis.materials = db.prepare('SELECT * FROM sub_devis_materials WHERE sub_devis_id = ?').all(subId);
    subDevis.images = db.prepare('SELECT * FROM sub_devis_images WHERE sub_devis_id = ?').all(subId);

    res.json({
        success: true,
        data: { sub_devis: subDevis }
    });
});

/**
 * Mettre à jour un sous-devis
 * PUT /api/devis/:id/sub-devis/:subId
 */
export const updateSubDevis = asyncHandler(async (req, res) => {
    const { id, subId } = req.params;
    const db = getDatabase();

    const subDevis = db.prepare('SELECT * FROM sub_devis WHERE id = ? AND devis_id = ?').get(subId, id);
    if (!subDevis) {
        throw new APIError('Sous-devis non trouvé', 404, 'SUB_DEVIS_NOT_FOUND');
    }

    const allowedFields = ['work_type', 'title', 'description', 'materials_cost', 'labor_hours', 'labor_rate', 'priority'];
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

    // Calculer les coûts
    const laborHours = req.body.labor_hours ?? subDevis.labor_hours;
    const laborRate = req.body.labor_rate ?? subDevis.labor_rate;
    const materialsCost = req.body.materials_cost ?? subDevis.materials_cost;
    const laborCost = laborHours * laborRate;
    const totalCost = materialsCost + laborCost;

    updates.push('labor_cost = ?', 'total_cost = ?', 'updated_at = CURRENT_TIMESTAMP');
    values.push(laborCost, totalCost, subId);

    db.prepare(`UPDATE sub_devis SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    // Mettre à jour le total du devis
    updateDevisTotals(id);

    const updatedSubDevis = db.prepare('SELECT * FROM sub_devis WHERE id = ?').get(subId);

    res.json({
        success: true,
        data: { sub_devis: updatedSubDevis }
    });
});

/**
 * Supprimer un sous-devis
 * DELETE /api/devis/:id/sub-devis/:subId
 */
export const deleteSubDevis = asyncHandler(async (req, res) => {
    const { id, subId } = req.params;
    const db = getDatabase();

    db.prepare('DELETE FROM sub_devis_materials WHERE sub_devis_id = ?').run(subId);
    db.prepare('DELETE FROM sub_devis_images WHERE sub_devis_id = ?').run(subId);
    db.prepare('DELETE FROM sub_devis WHERE id = ? AND devis_id = ?').run(subId, id);

    updateDevisTotals(id);

    res.json({
        success: true,
        message: 'Sous-devis supprimé'
    });
});

/**
 * Réordonner les sous-devis
 * PUT /api/devis/:id/sub-devis/reorder
 */
export const reorderSubDevis = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { order } = req.body; // Array of { id, priority }
    const db = getDatabase();

    for (const item of order) {
        db.prepare('UPDATE sub_devis SET priority = ? WHERE id = ? AND devis_id = ?').run(item.priority, item.id, id);
    }

    res.json({
        success: true,
        message: 'Ordre mis à jour'
    });
});

/**
 * Lister les matériaux d'un sous-devis
 * GET /api/devis/:id/sub-devis/:subId/materials
 */
export const getSubDevisMaterials = asyncHandler(async (req, res) => {
    const { subId } = req.params;
    const db = getDatabase();

    const materials = db.prepare('SELECT * FROM sub_devis_materials WHERE sub_devis_id = ?').all(subId);

    res.json({
        success: true,
        data: { materials }
    });
});

/**
 * Ajouter un matériau
 * POST /api/devis/:id/sub-devis/:subId/materials
 */
export const addMaterial = asyncHandler(async (req, res) => {
    const { id, subId } = req.params;
    const { name, quantity, unit, unit_price, brand, reference } = req.body;
    const db = getDatabase();

    const totalPrice = quantity * unit_price;

    const materialId = crypto.randomUUID();
    db.prepare(`
        INSERT INTO sub_devis_materials (id, sub_devis_id, name, quantity, unit, unit_price, total_price, brand, reference)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(materialId, subId, name, quantity, unit, unit_price, totalPrice, brand || null, reference || null);

    // Mettre à jour le coût matériaux du sous-devis
    const totalMaterials = db.prepare('SELECT COALESCE(SUM(total_price), 0) as sum FROM sub_devis_materials WHERE sub_devis_id = ?').get(subId).sum;
    db.prepare('UPDATE sub_devis SET materials_cost = ? WHERE id = ?').run(totalMaterials, subId);

    // Recalculer les totaux
    const subDevis = db.prepare('SELECT * FROM sub_devis WHERE id = ?').get(subId);
    const totalCost = totalMaterials + subDevis.labor_cost;
    db.prepare('UPDATE sub_devis SET total_cost = ? WHERE id = ?').run(totalCost, subId);

    updateDevisTotals(id);

    const material = db.prepare('SELECT * FROM sub_devis_materials WHERE id = ?').get(materialId);

    res.status(201).json({
        success: true,
        data: { material }
    });
});

/**
 * Mettre à jour un matériau
 * PUT /api/devis/:id/sub-devis/:subId/materials/:materialId
 */
export const updateMaterial = asyncHandler(async (req, res) => {
    const { id, subId, materialId } = req.params;
    const { name, quantity, unit, unit_price, brand, reference } = req.body;
    const db = getDatabase();

    const material = db.prepare('SELECT * FROM sub_devis_materials WHERE id = ?').get(materialId);
    if (!material) {
        throw new APIError('Matériau non trouvé', 404, 'MATERIAL_NOT_FOUND');
    }

    const newQuantity = quantity ?? material.quantity;
    const newUnitPrice = unit_price ?? material.unit_price;
    const totalPrice = newQuantity * newUnitPrice;

    db.prepare(`
        UPDATE sub_devis_materials
        SET name = COALESCE(?, name),
            quantity = ?,
            unit = COALESCE(?, unit),
            unit_price = ?,
            total_price = ?,
            brand = COALESCE(?, brand),
            reference = COALESCE(?, reference),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(name, newQuantity, unit, newUnitPrice, totalPrice, brand, reference, materialId);

    // Mettre à jour les totaux
    const totalMaterials = db.prepare('SELECT COALESCE(SUM(total_price), 0) as sum FROM sub_devis_materials WHERE sub_devis_id = ?').get(subId).sum;
    db.prepare('UPDATE sub_devis SET materials_cost = ? WHERE id = ?').run(totalMaterials, subId);

    const subDevis = db.prepare('SELECT * FROM sub_devis WHERE id = ?').get(subId);
    const totalCost = totalMaterials + subDevis.labor_cost;
    db.prepare('UPDATE sub_devis SET total_cost = ? WHERE id = ?').run(totalCost, subId);

    updateDevisTotals(id);

    const updatedMaterial = db.prepare('SELECT * FROM sub_devis_materials WHERE id = ?').get(materialId);

    res.json({
        success: true,
        data: { material: updatedMaterial }
    });
});

/**
 * Supprimer un matériau
 * DELETE /api/devis/:id/sub-devis/:subId/materials/:materialId
 */
export const deleteMaterial = asyncHandler(async (req, res) => {
    const { id, subId, materialId } = req.params;
    const db = getDatabase();

    db.prepare('DELETE FROM sub_devis_materials WHERE id = ?').run(materialId);

    // Mettre à jour les totaux
    const totalMaterials = db.prepare('SELECT COALESCE(SUM(total_price), 0) as sum FROM sub_devis_materials WHERE sub_devis_id = ?').get(subId).sum;
    db.prepare('UPDATE sub_devis SET materials_cost = ? WHERE id = ?').run(totalMaterials, subId);

    const subDevis = db.prepare('SELECT * FROM sub_devis WHERE id = ?').get(subId);
    const totalCost = totalMaterials + subDevis.labor_cost;
    db.prepare('UPDATE sub_devis SET total_cost = ? WHERE id = ?').run(totalCost, subId);

    updateDevisTotals(id);

    res.json({
        success: true,
        message: 'Matériau supprimé'
    });
});

/**
 * Lancer l'analyse IA
 * POST /api/devis/:id/analyze
 */
export const analyzeDevis = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabase();

    const devis = db.prepare('SELECT * FROM devis WHERE id = ?').get(id);
    if (!devis) {
        throw errors.DEVIS_NOT_FOUND;
    }

    // Récupérer les photos
    const photos = db.prepare('SELECT * FROM devis_photos WHERE devis_id = ?').all(id);

    if (photos.length === 0) {
        throw new APIError('Aucune photo à analyser', 400, 'NO_PHOTOS');
    }

    // Mettre à jour le statut
    db.prepare('UPDATE devis SET status = \'analyzing\' WHERE id = ?').run(id);

    // Lancer l'analyse
    const analysis = await aiService.analyzePhotos(photos, {
        room_type: devis.room_type,
        description: devis.description
    });

    // Sauvegarder les résultats
    db.prepare(`
        UPDATE devis
        SET ai_analysis = ?, analyzed_at = CURRENT_TIMESTAMP, status = 'pending'
        WHERE id = ?
    `).run(JSON.stringify(analysis), id);

    devisLogger.info('Analyse IA terminée', { devisId: id });

    res.json({
        success: true,
        data: { analysis }
    });
});

/**
 * Obtenir les résultats de l'analyse
 * GET /api/devis/:id/analysis
 */
export const getDevisAnalysis = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabase();

    const devis = db.prepare('SELECT ai_analysis, analyzed_at FROM devis WHERE id = ?').get(id);
    if (!devis) {
        throw errors.DEVIS_NOT_FOUND;
    }

    const analysis = devis.ai_analysis ? JSON.parse(devis.ai_analysis) : null;

    res.json({
        success: true,
        data: {
            analysis,
            analyzed_at: devis.analyzed_at
        }
    });
});

/**
 * Générer les sous-devis depuis l'analyse
 * POST /api/devis/:id/generate
 */
export const generateFromAnalysis = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const db = getDatabase();

    const devis = db.prepare('SELECT * FROM devis WHERE id = ?').get(id);
    if (!devis) {
        throw errors.DEVIS_NOT_FOUND;
    }

    const analysis = devis.ai_analysis ? JSON.parse(devis.ai_analysis) : null;
    if (!analysis) {
        throw new APIError('Aucune analyse disponible', 400, 'NO_ANALYSIS');
    }

    // Générer les sous-devis depuis l'analyse
    const generatedSubDevis = await aiService.generateSubDevisFromAnalysis(analysis, devis);

    let priority = 1;
    for (const sd of generatedSubDevis) {
        const subDevisId = crypto.randomUUID();
        db.prepare(`
            INSERT INTO sub_devis (id, devis_id, work_type, title, description, materials_cost, labor_hours, labor_rate, labor_cost, total_cost, priority)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(subDevisId, id, sd.work_type, sd.title, sd.description, sd.materials_cost, sd.labor_hours, sd.labor_rate, sd.labor_cost, sd.total_cost, priority++);

        // Ajouter les matériaux
        for (const mat of sd.materials) {
            const materialId = crypto.randomUUID();
            db.prepare(`
                INSERT INTO sub_devis_materials (id, sub_devis_id, name, quantity, unit, unit_price, total_price)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(materialId, subDevisId, mat.name, mat.quantity, mat.unit, mat.unit_price, mat.total_price);
        }
    }

    updateDevisTotals(id);

    const subDevisList = db.prepare('SELECT * FROM sub_devis WHERE devis_id = ?').all(id);

    res.json({
        success: true,
        message: 'Sous-devis générés',
        data: { sub_devis: subDevisList }
    });
});

/**
 * Fonction utilitaire pour mettre à jour les totaux du devis
 */
function updateDevisTotals(devisId) {
    const db = getDatabase();

    const totals = db.prepare(`
        SELECT
            COALESCE(SUM(materials_cost), 0) as materials_total,
            COALESCE(SUM(labor_cost), 0) as labor_total,
            COALESCE(SUM(total_cost), 0) as total
        FROM sub_devis
        WHERE devis_id = ?
    `).get(devisId);

    db.prepare(`
        UPDATE devis
        SET materials_total = ?, labor_total = ?, total_amount = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(totals.materials_total, totals.labor_total, totals.total, devisId);
}

export default {
    getDevis,
    createDevis,
    getDevisStats,
    getDevisById,
    updateDevis,
    deleteDevis,
    duplicateDevis,
    approveDevis,
    rejectDevis,
    generateDevisPDF,
    sendDevisByEmail,
    getDevisPhotos,
    addDevisPhotos,
    deleteDevisPhoto,
    getSubDevis,
    createSubDevis,
    getSubDevisById,
    updateSubDevis,
    deleteSubDevis,
    reorderSubDevis,
    getSubDevisMaterials,
    addMaterial,
    updateMaterial,
    deleteMaterial,
    analyzeDevis,
    getDevisAnalysis,
    generateFromAnalysis
};
