/**
 * RenoAI - Service Uploads
 * Gestion des fichiers uploadés
 */

import api from './api.js';

class UploadsService {
    /**
     * Upload d'un seul fichier
     */
    async uploadSingle(file, onProgress = null) {
        return this._uploadWithProgress('/uploads/single', file, onProgress);
    }

    /**
     * Upload de plusieurs fichiers
     */
    async uploadMultiple(files, onProgress = null) {
        return this._uploadWithProgress('/uploads/multiple', files, onProgress, true);
    }

    /**
     * Upload de photos (optimisé pour images)
     */
    async uploadPhotos(files, onProgress = null) {
        const imageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif'];
        const filesToCheck = Array.isArray(files) ? files : [files];
        for (const file of filesToCheck) {
            const result = this.validateFile(file, { allowedTypes: imageTypes });
            if (!result.valid) {
                throw new Error(result.errors.join(', '));
            }
        }
        return this._uploadWithProgress('/uploads/photos', files, onProgress, true);
    }

    /**
     * Upload d'avatar
     */
    async uploadAvatar(file, onProgress = null) {
        return this._uploadWithProgress('/uploads/avatar', file, onProgress);
    }

    /**
     * Upload de document
     */
    async uploadDocument(file, onProgress = null) {
        return this._uploadWithProgress('/uploads/document', file, onProgress);
    }

    /**
     * Upload avec progression
     */
    async _uploadWithProgress(endpoint, files, onProgress = null, isMultiple = false) {
        const formData = new FormData();

        if (isMultiple && Array.isArray(files)) {
            files.forEach(file => formData.append('photos', file));
        } else if (Array.isArray(files)) {
            formData.append('file', files[0]);
        } else {
            formData.append('file', files);
        }

        // Si pas de callback de progression, utiliser l'API simple
        if (!onProgress) {
            return api.request(endpoint, {
                method: 'POST',
                body: formData
            });
        }

        // Avec progression via XMLHttpRequest
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();

            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const percent = Math.round((e.loaded / e.total) * 100);
                    onProgress(percent, e.loaded, e.total);
                }
            });

            xhr.addEventListener('load', () => {
                try {
                    const response = JSON.parse(xhr.responseText);
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve(response);
                    } else {
                        reject(new Error(response.error?.message || 'Erreur upload'));
                    }
                } catch {
                    reject(new Error('Réponse invalide du serveur'));
                }
            });

            xhr.addEventListener('error', () => {
                reject(new Error('Erreur réseau lors de l\'upload'));
            });

            xhr.addEventListener('abort', () => {
                reject(new Error('Upload annulé'));
            });

            let token = null;
            try { token = localStorage.getItem('accessToken'); } catch { /* private browsing */ }
            const baseURL = window.location.hostname === 'localhost'
                ? 'http://localhost:5000/api'
                : '/api';

            xhr.open('POST', `${baseURL}${endpoint}`);
            if (token) {
                xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            }
            xhr.send(formData);
        });
    }

    // ================================
    // GESTION DES FICHIERS
    // ================================

    /**
     * Obtenir les infos d'un fichier
     */
    async getFileInfo(fileId) {
        return api.get(`/uploads/${fileId}`);
    }

    /**
     * Télécharger un fichier
     */
    async downloadFile(fileId) {
        const baseURL = window.location.hostname === 'localhost'
            ? 'http://localhost:5000/api'
            : '/api';

        let token = null;
        try { token = localStorage.getItem('accessToken'); } catch { /* private browsing */ }
        const url = `${baseURL}/uploads/${fileId}/download`;

        // Créer un lien temporaire pour le téléchargement
        const response = await fetch(url, {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });

        if (!response.ok) {
            throw new Error('Erreur lors du téléchargement');
        }

        const blob = await response.blob();
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = 'download';

        if (contentDisposition) {
            const match = contentDisposition.match(/filename="(.+)"/);
            if (match) filename = match[1];
        }

        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);

        return { success: true, filename };
    }

    /**
     * Supprimer un fichier
     */
    async deleteFile(fileId) {
        return api.delete(`/uploads/${fileId}`);
    }

    /**
     * Supprimer plusieurs fichiers
     */
    async batchDelete(fileIds) {
        return api.post('/uploads/batch-delete', { file_ids: fileIds });
    }

    /**
     * Obtenir la liste de ses fichiers
     */
    async getUserFiles(params = {}) {
        const queryParams = new URLSearchParams();
        if (params.type) queryParams.append('type', params.type);
        if (params.page) queryParams.append('page', params.page);
        if (params.limit) queryParams.append('limit', params.limit);

        const query = queryParams.toString();
        return api.get(`/uploads/user/files${query ? `?${query}` : ''}`);
    }

    /**
     * Obtenir l'utilisation du stockage
     */
    async getStorageUsage() {
        return api.get('/uploads/user/storage');
    }

    // ================================
    // TRAITEMENT D'IMAGES
    // ================================

    /**
     * Traiter une image (redimensionner, filtres, etc.)
     */
    async processImage(fileId, operations) {
        return api.post('/uploads/process', {
            file_id: fileId,
            operations
        });
    }

    /**
     * Redimensionner une image
     */
    async resizeImage(fileId, width, height, fit = 'cover') {
        return this.processImage(fileId, [
            { type: 'resize', width, height, fit }
        ]);
    }

    /**
     * Faire pivoter une image
     */
    async rotateImage(fileId, angle) {
        return this.processImage(fileId, [
            { type: 'rotate', angle }
        ]);
    }

    /**
     * Convertir en niveaux de gris
     */
    async grayscaleImage(fileId) {
        return this.processImage(fileId, [
            { type: 'grayscale' }
        ]);
    }

    // ================================
    // UTILITAIRES
    // ================================

    /**
     * Obtenir l'URL complète d'un fichier
     */
    getFileUrl(relativePath) {
        if (!relativePath) return null;
        if (relativePath.startsWith('http')) return relativePath;

        const baseURL = window.location.hostname === 'localhost'
            ? 'http://localhost:5000'
            : '';

        return `${baseURL}${relativePath.startsWith('/') ? '' : '/'}${relativePath}`;
    }

    /**
     * Vérifier si un fichier est une image
     */
    isImage(file) {
        const imageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif'];
        return imageTypes.includes(file.type || file.mimetype);
    }

    /**
     * Formater la taille du fichier
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
    }

    /**
     * Valider un fichier avant upload
     */
    validateFile(file, options = {}) {
        const {
            maxSize = 10 * 1024 * 1024, // 10 MB
            allowedTypes = null,
            allowedExtensions = null
        } = options;

        const errors = [];

        // Vérifier la taille
        if (file.size > maxSize) {
            errors.push(`Le fichier dépasse la taille maximale (${this.formatFileSize(maxSize)})`);
        }

        // Vérifier le type MIME
        if (allowedTypes && !allowedTypes.includes(file.type)) {
            errors.push(`Type de fichier non autorisé: ${file.type}`);
        }

        // Vérifier l'extension
        if (allowedExtensions) {
            const ext = file.name.split('.').pop().toLowerCase();
            if (!allowedExtensions.includes(ext)) {
                errors.push(`Extension non autorisée: .${ext}`);
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Créer une preview d'image
     */
    createImagePreview(file) {
        return new Promise((resolve, reject) => {
            if (!this.isImage(file)) {
                reject(new Error('Le fichier n\'est pas une image'));
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error('Erreur de lecture du fichier'));
            reader.readAsDataURL(file);
        });
    }
}

const uploadsService = new UploadsService();
window.RenoUploads = uploadsService;
export default uploadsService;
