/**
 * RenoAI - Contrôleur Uploads
 * Gestion des uploads de fichiers (sans dépendances natives)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../config/database.js';
import { asyncHandler, APIError, errors } from '../middleware/errorHandler.js';
import { logger } from '../middleware/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadLogger = logger.child('Uploads');
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');

// Créer les dossiers si nécessaire
const dirs = ['photos', 'avatars', 'documents', 'temp', 'photos/thumbnails'];
for (const dir of dirs) {
    const dirPath = path.join(UPLOAD_DIR, dir);
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

/**
 * Upload d'un seul fichier
 * POST /api/uploads/single
 */
export const uploadSingle = asyncHandler(async (req, res) => {
    if (!req.file) {
        throw new APIError('Aucun fichier uploadé', 400, 'NO_FILE');
    }

    const fileInfo = await processUploadedFile(req.file, req.user.id);

    uploadLogger.info('Fichier uploadé', { fileId: fileInfo.id, userId: req.user.id });

    res.status(201).json({
        success: true,
        message: 'Fichier uploadé avec succès',
        data: { file: fileInfo }
    });
});

/**
 * Upload de plusieurs fichiers
 * POST /api/uploads/multiple
 */
export const uploadMultiple = asyncHandler(async (req, res) => {
    if (!req.files || req.files.length === 0) {
        throw new APIError('Aucun fichier uploadé', 400, 'NO_FILE');
    }

    const files = [];
    for (const file of req.files) {
        const fileInfo = await processUploadedFile(file, req.user.id);
        files.push(fileInfo);
    }

    uploadLogger.info('Fichiers uploadés', { count: files.length, userId: req.user.id });

    res.status(201).json({
        success: true,
        message: `${files.length} fichier(s) uploadé(s)`,
        data: { files }
    });
});

/**
 * Upload de photos (pour devis/projets)
 * POST /api/uploads/photos
 */
export const uploadPhotos = asyncHandler(async (req, res) => {
    if (!req.files || req.files.length === 0) {
        throw new APIError('Aucune photo uploadée', 400, 'NO_FILE');
    }

    const photos = [];
    for (const file of req.files) {
        // Vérifier que c'est une image
        if (!file.mimetype.startsWith('image/')) {
            continue;
        }

        const fileInfo = await processUploadedFile(file, req.user.id, 'photos');
        photos.push(fileInfo);
    }

    res.status(201).json({
        success: true,
        message: `${photos.length} photo(s) uploadée(s)`,
        data: { photos }
    });
});

/**
 * Upload d'avatar
 * POST /api/uploads/avatar
 */
export const uploadAvatar = asyncHandler(async (req, res) => {
    if (!req.file) {
        throw new APIError('Aucune image uploadée', 400, 'NO_FILE');
    }

    if (!req.file.mimetype.startsWith('image/')) {
        throw new APIError('Le fichier doit être une image', 400, 'INVALID_FILE_TYPE');
    }

    const filename = `avatar_${req.user.id}_${Date.now()}${path.extname(req.file.originalname)}`;
    const outputPath = path.join(UPLOAD_DIR, 'avatars', filename);

    // Copier le fichier (sans traitement d'image)
    if (req.file.buffer) {
        fs.writeFileSync(outputPath, req.file.buffer);
    } else if (req.file.path) {
        fs.copyFileSync(req.file.path, outputPath);
        fs.unlinkSync(req.file.path);
    }

    const avatarUrl = `/uploads/avatars/${filename}`;

    // Mettre à jour l'utilisateur
    const db = getDatabase();
    db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(avatarUrl, req.user.id);

    uploadLogger.info('Avatar uploadé', { userId: req.user.id });

    res.json({
        success: true,
        message: 'Avatar mis à jour',
        data: { avatar_url: avatarUrl }
    });
});

/**
 * Upload de document
 * POST /api/uploads/document
 */
export const uploadDocument = asyncHandler(async (req, res) => {
    if (!req.file) {
        throw new APIError('Aucun document uploadé', 400, 'NO_FILE');
    }

    const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    if (!allowedTypes.includes(req.file.mimetype)) {
        throw new APIError('Type de document non autorisé', 415, 'INVALID_FILE_TYPE');
    }

    const fileInfo = await processUploadedFile(req.file, req.user.id, 'documents');

    res.status(201).json({
        success: true,
        message: 'Document uploadé',
        data: { file: fileInfo }
    });
});

/**
 * Obtenir les infos d'un fichier
 * GET /api/uploads/:fileId
 */
export const getFileInfo = asyncHandler(async (req, res) => {
    const { fileId } = req.params;
    const db = getDatabase();

    const file = db.prepare('SELECT * FROM uploads WHERE id = ? AND user_id = ?').get(fileId, req.user.id);

    if (!file) {
        throw new APIError('Fichier non trouvé', 404, 'FILE_NOT_FOUND');
    }

    res.json({
        success: true,
        data: { file }
    });
});

/**
 * Télécharger un fichier
 * GET /api/uploads/:fileId/download
 */
export const downloadFile = asyncHandler(async (req, res) => {
    const { fileId } = req.params;
    const db = getDatabase();

    // Vérification de propriété
    const file = db.prepare('SELECT * FROM uploads WHERE id = ? AND user_id = ?').get(fileId, req.user.id);

    if (!file) {
        throw new APIError('Fichier non trouvé', 404, 'FILE_NOT_FOUND');
    }

    const filePath = path.join(UPLOAD_DIR, file.path);

    if (!fs.existsSync(filePath)) {
        throw new APIError('Fichier physique non trouvé', 404, 'FILE_MISSING');
    }

    res.download(filePath, file.original_name);
});

/**
 * Supprimer un fichier
 * DELETE /api/uploads/:fileId
 */
export const deleteFile = asyncHandler(async (req, res) => {
    const { fileId } = req.params;
    const db = getDatabase();

    const file = db.prepare('SELECT * FROM uploads WHERE id = ? AND user_id = ?').get(fileId, req.user.id);

    if (!file) {
        throw new APIError('Fichier non trouvé', 404, 'FILE_NOT_FOUND');
    }

    // Supprimer le fichier physique
    const filePath = path.join(UPLOAD_DIR, file.path);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }

    // Supprimer la miniature si elle existe
    if (file.thumbnail_path) {
        const thumbPath = path.join(UPLOAD_DIR, file.thumbnail_path);
        if (fs.existsSync(thumbPath)) {
            fs.unlinkSync(thumbPath);
        }
    }

    // Supprimer de la base
    db.prepare('DELETE FROM uploads WHERE id = ?').run(fileId);

    uploadLogger.info('Fichier supprimé', { fileId, userId: req.user.id });

    res.json({
        success: true,
        message: 'Fichier supprimé'
    });
});

/**
 * Lister ses fichiers
 * GET /api/uploads/user/files
 */
export const getUserFiles = asyncHandler(async (req, res) => {
    const { type, page = 1, limit = 20 } = req.query;
    const db = getDatabase();

    let query = 'SELECT * FROM uploads WHERE user_id = ?';
    const params = [req.user.id];

    if (type) {
        query += ' AND type = ?';
        params.push(type);
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const files = db.prepare(query).all(...params);

    const total = db.prepare('SELECT COUNT(*) as count FROM uploads WHERE user_id = ?').get(req.user.id).count;

    res.json({
        success: true,
        data: {
            files,
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
 * Obtenir l'utilisation du stockage
 * GET /api/uploads/user/storage
 */
export const getStorageUsage = asyncHandler(async (req, res) => {
    const db = getDatabase();

    const usage = db.prepare(`
        SELECT
            COALESCE(SUM(size), 0) as total_bytes,
            COUNT(*) as total_files
        FROM uploads WHERE user_id = ?
    `).get(req.user.id);

    const byType = db.prepare(`
        SELECT type, COALESCE(SUM(size), 0) as bytes, COUNT(*) as count
        FROM uploads WHERE user_id = ?
        GROUP BY type
    `).all(req.user.id);

    const maxStorage = 100 * 1024 * 1024; // 100 MB par utilisateur

    res.json({
        success: true,
        data: {
            used_bytes: usage.total_bytes,
            max_bytes: maxStorage,
            used_percentage: Math.round((usage.total_bytes / maxStorage) * 100),
            total_files: usage.total_files,
            by_type: byType
        }
    });
});

/**
 * Traiter une image (version simplifiée sans sharp)
 * POST /api/uploads/process
 */
export const processImage = asyncHandler(async (req, res) => {
    const { file_id } = req.body;
    const db = getDatabase();

    const file = db.prepare('SELECT * FROM uploads WHERE id = ? AND user_id = ?').get(file_id, req.user.id);

    if (!file) {
        throw new APIError('Fichier non trouvé', 404, 'FILE_NOT_FOUND');
    }

    if (!file.mimetype.startsWith('image/')) {
        throw new APIError('Le fichier doit être une image', 400, 'NOT_AN_IMAGE');
    }

    // Sans sharp, on retourne simplement le fichier existant
    // Pour le traitement d'images réel, installer sharp ou utiliser un service externe
    res.json({
        success: true,
        message: 'Traitement d\'image non disponible (nécessite sharp)',
        data: { file }
    });
});

/**
 * Supprimer plusieurs fichiers
 * POST /api/uploads/batch-delete
 */
export const batchDelete = asyncHandler(async (req, res) => {
    const { file_ids } = req.body;
    const db = getDatabase();

    if (!file_ids || !Array.isArray(file_ids) || file_ids.length === 0) {
        throw new APIError('IDs de fichiers requis', 400, 'NO_FILE_IDS');
    }

    let deleted = 0;

    for (const fileId of file_ids) {
        const file = db.prepare('SELECT * FROM uploads WHERE id = ? AND user_id = ?').get(fileId, req.user.id);

        if (file) {
            const filePath = path.join(UPLOAD_DIR, file.path);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }

            db.prepare('DELETE FROM uploads WHERE id = ?').run(fileId);
            deleted++;
        }
    }

    uploadLogger.info('Fichiers supprimés en lot', { count: deleted, userId: req.user.id });

    res.json({
        success: true,
        message: `${deleted} fichier(s) supprimé(s)`
    });
});

// ============================================
// FONCTIONS UTILITAIRES
// ============================================

/**
 * Traiter un fichier uploadé et l'enregistrer en base
 */
async function processUploadedFile(file, userId, type = 'documents') {
    const db = getDatabase();
    const fileId = uuidv4();
    const ext = path.extname(file.originalname);
    const filename = `${fileId}${ext}`;
    const relativePath = `${type}/${filename}`;
    const absolutePath = path.join(UPLOAD_DIR, relativePath);

    // Si le fichier est en mémoire (buffer), l'écrire
    if (file.buffer) {
        fs.writeFileSync(absolutePath, file.buffer);
    } else if (file.path) {
        // Déplacer le fichier temporaire
        fs.renameSync(file.path, absolutePath);
    }

    const size = file.size || fs.statSync(absolutePath).size;

    db.prepare(`
        INSERT INTO uploads (id, user_id, original_name, filename, path, mimetype, size, type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(fileId, userId, file.originalname, filename, relativePath, file.mimetype, size, type);

    return {
        id: fileId,
        original_name: file.originalname,
        filename,
        path: relativePath,
        url: `/uploads/${relativePath}`,
        mimetype: file.mimetype,
        size,
        type
    };
}

export default {
    uploadSingle,
    uploadMultiple,
    uploadPhotos,
    uploadAvatar,
    uploadDocument,
    getFileInfo,
    downloadFile,
    deleteFile,
    getUserFiles,
    getStorageUsage,
    processImage,
    batchDelete
};
