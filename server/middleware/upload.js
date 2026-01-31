/**
 * RenoAI - Middleware d'upload
 * Configuration Multer pour la gestion des fichiers
 */

import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dossier de destination des uploads
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024; // 10 MB

// Créer les dossiers nécessaires
const directories = ['photos', 'avatars', 'documents', 'temp', 'photos/thumbnails'];
for (const dir of directories) {
    const dirPath = path.join(UPLOAD_DIR, dir);
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

// Types MIME autorisés
const ALLOWED_IMAGE_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/heic',
    'image/heif'
];

const ALLOWED_DOCUMENT_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
];

const ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_DOCUMENT_TYPES];

/**
 * Configuration du stockage
 */
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        let subDir = 'temp';

        if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
            if (req.path.includes('avatar')) {
                subDir = 'avatars';
            } else {
                subDir = 'photos';
            }
        } else if (ALLOWED_DOCUMENT_TYPES.includes(file.mimetype)) {
            subDir = 'documents';
        }

        const destPath = path.join(UPLOAD_DIR, subDir);
        cb(null, destPath);
    },
    filename: (req, file, cb) => {
        const uniqueId = uuidv4();
        const ext = path.extname(file.originalname).toLowerCase();
        const safeName = `${uniqueId}${ext}`;
        cb(null, safeName);
    }
});

/**
 * Stockage en mémoire pour traitement
 */
const memoryStorage = multer.memoryStorage();

/**
 * Filtre des fichiers
 */
const fileFilter = (req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error(`Type de fichier non autorisé: ${file.mimetype}`), false);
    }
};

/**
 * Filtre pour les images uniquement
 */
const imageFilter = (req, file, cb) => {
    if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Seules les images sont autorisées'), false);
    }
};

/**
 * Configuration Multer principale
 */
export const upload = multer({
    storage: storage,
    limits: {
        fileSize: MAX_FILE_SIZE,
        files: 10
    },
    fileFilter: fileFilter
});

/**
 * Upload avec stockage en mémoire
 */
export const uploadToMemory = multer({
    storage: memoryStorage,
    limits: {
        fileSize: MAX_FILE_SIZE,
        files: 10
    },
    fileFilter: fileFilter
});

/**
 * Upload d'images uniquement
 */
export const uploadImages = multer({
    storage: storage,
    limits: {
        fileSize: MAX_FILE_SIZE,
        files: 10
    },
    fileFilter: imageFilter
});

/**
 * Upload multiple pour les photos
 */
export const uploadMultiple = uploadImages.array('photos', 10);

/**
 * Upload d'avatar (une seule image)
 */
export const uploadAvatar = multer({
    storage: memoryStorage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5 MB pour les avatars
    },
    fileFilter: imageFilter
}).single('avatar');

/**
 * Upload de document (un seul fichier)
 */
export const uploadDocument = multer({
    storage: storage,
    limits: {
        fileSize: MAX_FILE_SIZE
    },
    fileFilter: (req, file, cb) => {
        if (ALLOWED_DOCUMENT_TYPES.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Type de document non autorisé'), false);
        }
    }
}).single('document');

/**
 * Middleware de gestion des erreurs Multer
 */
export function handleUploadError(err, req, res, next) {
    if (err instanceof multer.MulterError) {
        let message = 'Erreur lors de l\'upload';
        let code = 'UPLOAD_ERROR';

        switch (err.code) {
            case 'LIMIT_FILE_SIZE':
                message = `Le fichier dépasse la taille maximale autorisée (${MAX_FILE_SIZE / 1024 / 1024} MB)`;
                code = 'FILE_TOO_LARGE';
                break;
            case 'LIMIT_FILE_COUNT':
                message = 'Trop de fichiers uploadés en une fois';
                code = 'TOO_MANY_FILES';
                break;
            case 'LIMIT_UNEXPECTED_FILE':
                message = 'Champ de fichier inattendu';
                code = 'UNEXPECTED_FILE';
                break;
            default:
                message = err.message;
        }

        return res.status(400).json({
            success: false,
            error: { code, message }
        });
    }

    if (err) {
        return res.status(400).json({
            success: false,
            error: {
                code: 'UPLOAD_ERROR',
                message: err.message
            }
        });
    }

    next();
}

/**
 * Nettoyer les fichiers temporaires
 */
export function cleanupTempFiles() {
    const tempDir = path.join(UPLOAD_DIR, 'temp');

    if (fs.existsSync(tempDir)) {
        const files = fs.readdirSync(tempDir);
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 heures

        for (const file of files) {
            const filePath = path.join(tempDir, file);
            const stats = fs.statSync(filePath);

            if (now - stats.mtimeMs > maxAge) {
                fs.unlinkSync(filePath);
            }
        }
    }
}

// Nettoyer les fichiers temporaires toutes les heures
setInterval(cleanupTempFiles, 60 * 60 * 1000);

export default {
    upload,
    uploadToMemory,
    uploadImages,
    uploadMultiple,
    uploadAvatar,
    uploadDocument,
    handleUploadError,
    cleanupTempFiles
};
