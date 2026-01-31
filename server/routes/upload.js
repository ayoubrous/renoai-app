/**
 * RenoAI - Routes Upload
 * Gestion des uploads de fichiers
 */

import { Router } from 'express';
import { body, param, query } from 'express-validator';
import * as uploadController from '../controllers/uploadController.js';
import { validate } from '../middleware/errorHandler.js';
import { authenticateToken } from '../middleware/auth.js';
import { upload, uploadMultiple } from '../middleware/upload.js';

const router = Router();

// ============================================
// VALIDATIONS
// ============================================

const fileIdValidation = [
    param('fileId')
        .notEmpty()
        .withMessage('ID fichier requis')
];

// ============================================
// ROUTES UPLOAD
// ============================================

// Toutes les routes nécessitent une authentification
router.use(authenticateToken);

/**
 * @route   POST /api/uploads/single
 * @desc    Upload un seul fichier
 * @access  Private
 */
router.post('/single', upload.single('file'), uploadController.uploadSingle);

/**
 * @route   POST /api/uploads/multiple
 * @desc    Upload plusieurs fichiers
 * @access  Private
 */
router.post('/multiple', upload.array('files', 10), uploadController.uploadMultiple);

/**
 * @route   POST /api/uploads/photos
 * @desc    Upload de photos (pour devis/projets)
 * @access  Private
 */
router.post('/photos', uploadMultiple, uploadController.uploadPhotos);

/**
 * @route   POST /api/uploads/avatar
 * @desc    Upload d'avatar utilisateur
 * @access  Private
 */
router.post('/avatar', upload.single('avatar'), uploadController.uploadAvatar);

/**
 * @route   POST /api/uploads/document
 * @desc    Upload de document (PDF, etc.)
 * @access  Private
 */
router.post('/document', upload.single('document'), uploadController.uploadDocument);

/**
 * @route   GET /api/uploads/:fileId
 * @desc    Obtenir les infos d'un fichier
 * @access  Private
 */
router.get('/:fileId', validate(fileIdValidation), uploadController.getFileInfo);

/**
 * @route   GET /api/uploads/:fileId/download
 * @desc    Télécharger un fichier
 * @access  Private
 */
router.get('/:fileId/download', validate(fileIdValidation), uploadController.downloadFile);

/**
 * @route   DELETE /api/uploads/:fileId
 * @desc    Supprimer un fichier
 * @access  Private
 */
router.delete('/:fileId', validate(fileIdValidation), uploadController.deleteFile);

/**
 * @route   GET /api/uploads/user/files
 * @desc    Lister ses fichiers uploadés
 * @access  Private
 */
router.get('/user/files', uploadController.getUserFiles);

/**
 * @route   GET /api/uploads/user/storage
 * @desc    Obtenir l'utilisation du stockage
 * @access  Private
 */
router.get('/user/storage', uploadController.getStorageUsage);

/**
 * @route   POST /api/uploads/process
 * @desc    Traiter une image (redimensionner, etc.)
 * @access  Private
 */
router.post('/process', uploadController.processImage);

/**
 * @route   POST /api/uploads/batch-delete
 * @desc    Supprimer plusieurs fichiers
 * @access  Private
 */
router.post('/batch-delete', uploadController.batchDelete);

export default router;
