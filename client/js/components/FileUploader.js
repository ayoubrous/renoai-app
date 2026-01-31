/**
 * RenoAI - FileUploader Component
 * Upload de fichiers avec drag-drop, prévisualisation et progression
 */

import store from '../core/store.js';
import errorHandler, { RenoError, ErrorTypes } from '../core/errorHandler.js';

// ============================================
// CONFIGURATION
// ============================================

const DEFAULT_CONFIG = {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 10,
    acceptedTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    acceptedExtensions: ['.jpg', '.jpeg', '.png', '.webp', '.pdf'],
    uploadEndpoint: '/api/uploads',
    chunkSize: 1024 * 1024, // 1MB pour upload chunked
    autoUpload: true,
    showPreview: true,
    multiple: true
};

// ============================================
// FILE UPLOADER CLASS
// ============================================

export class FileUploader {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            throw new Error(`Container #${containerId} non trouvé`);
        }

        this.config = { ...DEFAULT_CONFIG, ...options };
        this.files = new Map();
        this.uploadQueue = [];
        this.isUploading = false;
        this.listeners = new Map();

        this.init();
    }

    // ============================================
    // INITIALISATION
    // ============================================

    init() {
        this.render();
        this.bindEvents();
    }

    render() {
        this.container.innerHTML = `
            <div class="file-uploader" role="region" aria-label="Zone d'upload de fichiers">
                <!-- Drop Zone -->
                <div class="upload-zone"
                     tabindex="0"
                     role="button"
                     aria-label="Glissez des fichiers ici ou cliquez pour sélectionner"
                     aria-describedby="upload-instructions">
                    <input type="file"
                           class="upload-input"
                           id="upload-input-${this.container.id}"
                           ${this.config.multiple ? 'multiple' : ''}
                           accept="${this.config.acceptedExtensions.join(',')}"
                           aria-hidden="true">

                    <div class="upload-zone-content">
                        <div class="upload-icon">
                            <i class="fas fa-cloud-upload-alt" aria-hidden="true"></i>
                        </div>
                        <div class="upload-zone-text">
                            <p class="upload-main-text">
                                Glissez vos fichiers ici
                            </p>
                            <p class="upload-sub-text">
                                ou <span class="upload-browse">parcourez</span> votre appareil
                            </p>
                        </div>
                        <p class="upload-instructions" id="upload-instructions">
                            Formats acceptés: ${this.config.acceptedExtensions.join(', ')}
                            (max ${this.formatSize(this.config.maxFileSize)})
                        </p>
                    </div>
                </div>

                <!-- File List -->
                <div class="upload-file-list" role="list" aria-label="Fichiers sélectionnés">
                    <!-- Files will be rendered here -->
                </div>

                <!-- Actions -->
                <div class="upload-actions" style="display: none;">
                    <button type="button" class="btn btn-secondary upload-clear-btn">
                        <i class="fas fa-trash" aria-hidden="true"></i>
                        Tout supprimer
                    </button>
                    <button type="button" class="btn btn-primary upload-submit-btn">
                        <i class="fas fa-upload" aria-hidden="true"></i>
                        Uploader (<span class="file-count">0</span>)
                    </button>
                </div>

                <!-- Progress -->
                <div class="upload-progress" style="display: none;" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
                    <div class="progress-bar">
                        <div class="progress-fill"></div>
                    </div>
                    <div class="progress-text">0%</div>
                </div>
            </div>
        `;

        // Cache les éléments
        this.elements = {
            zone: this.container.querySelector('.upload-zone'),
            input: this.container.querySelector('.upload-input'),
            fileList: this.container.querySelector('.upload-file-list'),
            actions: this.container.querySelector('.upload-actions'),
            clearBtn: this.container.querySelector('.upload-clear-btn'),
            submitBtn: this.container.querySelector('.upload-submit-btn'),
            fileCount: this.container.querySelector('.file-count'),
            progress: this.container.querySelector('.upload-progress'),
            progressFill: this.container.querySelector('.progress-fill'),
            progressText: this.container.querySelector('.progress-text')
        };
    }

    bindEvents() {
        const { zone, input, clearBtn, submitBtn } = this.elements;

        // Click sur la zone
        zone.addEventListener('click', () => input.click());

        // Keyboard support
        zone.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                input.click();
            }
        });

        // File input change
        input.addEventListener('change', (e) => this.handleFiles(e.target.files));

        // Drag & Drop
        zone.addEventListener('dragenter', (e) => this.handleDragEnter(e));
        zone.addEventListener('dragover', (e) => this.handleDragOver(e));
        zone.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        zone.addEventListener('drop', (e) => this.handleDrop(e));

        // Buttons
        clearBtn.addEventListener('click', () => this.clearAll());
        submitBtn.addEventListener('click', () => this.uploadAll());

        // Paste support
        document.addEventListener('paste', (e) => this.handlePaste(e));
    }

    // ============================================
    // DRAG & DROP HANDLERS
    // ============================================

    handleDragEnter(e) {
        e.preventDefault();
        e.stopPropagation();
        this.elements.zone.classList.add('dragover');
        this.elements.zone.setAttribute('aria-dropeffect', 'copy');
    }

    handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    handleDragLeave(e) {
        e.preventDefault();
        e.stopPropagation();

        // Vérifier qu'on quitte vraiment la zone
        if (!this.elements.zone.contains(e.relatedTarget)) {
            this.elements.zone.classList.remove('dragover');
            this.elements.zone.removeAttribute('aria-dropeffect');
        }
    }

    handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        this.elements.zone.classList.remove('dragover');
        this.elements.zone.removeAttribute('aria-dropeffect');

        const files = e.dataTransfer?.files;
        if (files?.length) {
            this.handleFiles(files);
        }
    }

    handlePaste(e) {
        // Ne gérer que si le focus est dans notre composant
        if (!this.container.contains(document.activeElement)) return;

        const items = e.clipboardData?.items;
        if (!items) return;

        const files = [];
        for (const item of items) {
            if (item.kind === 'file') {
                const file = item.getAsFile();
                if (file) files.push(file);
            }
        }

        if (files.length) {
            e.preventDefault();
            this.handleFiles(files);
        }
    }

    // ============================================
    // FILE HANDLING
    // ============================================

    handleFiles(fileList) {
        const files = Array.from(fileList);
        const validFiles = [];

        for (const file of files) {
            const validation = this.validateFile(file);
            if (validation.valid) {
                validFiles.push(file);
            } else {
                this.emit('error', { file, error: validation.error });
                store.ui.addNotification({
                    type: 'warning',
                    title: 'Fichier refusé',
                    message: `${file.name}: ${validation.error}`
                });
            }
        }

        // Vérifier le nombre total de fichiers
        if (this.files.size + validFiles.length > this.config.maxFiles) {
            store.ui.addNotification({
                type: 'warning',
                title: 'Limite atteinte',
                message: `Maximum ${this.config.maxFiles} fichiers autorisés`
            });
            validFiles.splice(this.config.maxFiles - this.files.size);
        }

        // Ajouter les fichiers valides
        for (const file of validFiles) {
            const id = this.generateId();
            const fileData = {
                id,
                file,
                name: file.name,
                size: file.size,
                type: file.type,
                status: 'pending', // pending, uploading, success, error
                progress: 0,
                preview: null,
                response: null
            };

            this.files.set(id, fileData);
            this.renderFileItem(fileData);

            // Générer prévisualisation si c'est une image
            if (this.config.showPreview && file.type.startsWith('image/')) {
                this.generatePreview(fileData);
            }
        }

        this.updateUI();
        this.emit('filesAdded', { files: validFiles });

        // Auto-upload si configuré
        if (this.config.autoUpload && validFiles.length > 0) {
            this.uploadAll();
        }

        // Reset l'input
        this.elements.input.value = '';
    }

    validateFile(file) {
        // Vérifier la taille
        if (file.size > this.config.maxFileSize) {
            return {
                valid: false,
                error: `Fichier trop volumineux (max ${this.formatSize(this.config.maxFileSize)})`
            };
        }

        // Vérifier le type MIME
        if (this.config.acceptedTypes.length > 0) {
            const isTypeValid = this.config.acceptedTypes.some(type => {
                if (type.endsWith('/*')) {
                    return file.type.startsWith(type.replace('/*', '/'));
                }
                return file.type === type;
            });

            if (!isTypeValid) {
                return {
                    valid: false,
                    error: 'Type de fichier non autorisé'
                };
            }
        }

        return { valid: true };
    }

    generatePreview(fileData) {
        const reader = new FileReader();
        reader.onload = (e) => {
            fileData.preview = e.target.result;
            this.updateFileItem(fileData);
        };
        reader.readAsDataURL(fileData.file);
    }

    // ============================================
    // UI RENDERING
    // ============================================

    renderFileItem(fileData) {
        const item = document.createElement('div');
        item.className = 'upload-file-item';
        item.id = `file-item-${fileData.id}`;
        item.setAttribute('role', 'listitem');

        item.innerHTML = `
            <div class="file-preview">
                ${fileData.preview
                    ? `<img src="${fileData.preview}" alt="Prévisualisation de ${fileData.name}">`
                    : `<i class="fas ${this.getFileIcon(fileData.type)}" aria-hidden="true"></i>`
                }
            </div>
            <div class="file-info">
                <div class="file-name" title="${fileData.name}">${this.truncateName(fileData.name)}</div>
                <div class="file-meta">
                    <span class="file-size">${this.formatSize(fileData.size)}</span>
                    <span class="file-status" data-status="${fileData.status}">
                        ${this.getStatusText(fileData.status)}
                    </span>
                </div>
                <div class="file-progress-bar" style="display: ${fileData.status === 'uploading' ? 'block' : 'none'};">
                    <div class="file-progress-fill" style="width: ${fileData.progress}%"></div>
                </div>
            </div>
            <div class="file-actions">
                <button type="button"
                        class="btn-icon file-remove"
                        aria-label="Supprimer ${fileData.name}"
                        ${fileData.status === 'uploading' ? 'disabled' : ''}>
                    <i class="fas fa-times" aria-hidden="true"></i>
                </button>
            </div>
        `;

        // Event listener pour suppression
        item.querySelector('.file-remove').addEventListener('click', () => {
            this.removeFile(fileData.id);
        });

        this.elements.fileList.appendChild(item);
    }

    updateFileItem(fileData) {
        const item = document.getElementById(`file-item-${fileData.id}`);
        if (!item) return;

        // Mettre à jour la prévisualisation
        if (fileData.preview) {
            const preview = item.querySelector('.file-preview');
            preview.innerHTML = `<img src="${fileData.preview}" alt="Prévisualisation de ${fileData.name}">`;
        }

        // Mettre à jour le statut
        const statusEl = item.querySelector('.file-status');
        statusEl.dataset.status = fileData.status;
        statusEl.textContent = this.getStatusText(fileData.status);

        // Mettre à jour la progression
        const progressBar = item.querySelector('.file-progress-bar');
        const progressFill = item.querySelector('.file-progress-fill');

        if (fileData.status === 'uploading') {
            progressBar.style.display = 'block';
            progressFill.style.width = `${fileData.progress}%`;
        } else {
            progressBar.style.display = 'none';
        }

        // Mettre à jour le bouton de suppression
        const removeBtn = item.querySelector('.file-remove');
        removeBtn.disabled = fileData.status === 'uploading';

        // Classes de statut
        item.classList.remove('status-pending', 'status-uploading', 'status-success', 'status-error');
        item.classList.add(`status-${fileData.status}`);
    }

    updateUI() {
        const fileCount = this.files.size;
        const hasFiles = fileCount > 0;

        // Afficher/cacher les actions
        this.elements.actions.style.display = hasFiles ? 'flex' : 'none';
        this.elements.fileCount.textContent = fileCount;

        // Mettre à jour ARIA
        this.elements.fileList.setAttribute('aria-label',
            `${fileCount} fichier${fileCount > 1 ? 's' : ''} sélectionné${fileCount > 1 ? 's' : ''}`
        );
    }

    // ============================================
    // UPLOAD
    // ============================================

    async uploadAll() {
        if (this.isUploading) return;

        const pendingFiles = Array.from(this.files.values())
            .filter(f => f.status === 'pending');

        if (pendingFiles.length === 0) return;

        this.isUploading = true;
        this.elements.progress.style.display = 'block';
        this.emit('uploadStart', { files: pendingFiles });

        let completed = 0;
        const total = pendingFiles.length;

        for (const fileData of pendingFiles) {
            try {
                await this.uploadFile(fileData);
                fileData.status = 'success';
            } catch (error) {
                fileData.status = 'error';
                this.emit('error', { file: fileData, error });
            }

            completed++;
            this.updateProgress((completed / total) * 100);
            this.updateFileItem(fileData);
        }

        this.isUploading = false;
        this.elements.progress.style.display = 'none';

        const successCount = pendingFiles.filter(f => f.status === 'success').length;
        const errorCount = pendingFiles.filter(f => f.status === 'error').length;

        this.emit('uploadComplete', {
            total,
            success: successCount,
            errors: errorCount
        });

        // Notification
        if (errorCount === 0) {
            store.ui.addNotification({
                type: 'success',
                title: 'Upload terminé',
                message: `${successCount} fichier${successCount > 1 ? 's' : ''} uploadé${successCount > 1 ? 's' : ''}`
            });
        } else {
            store.ui.addNotification({
                type: 'warning',
                title: 'Upload partiel',
                message: `${successCount} réussi${successCount > 1 ? 's' : ''}, ${errorCount} échec${errorCount > 1 ? 's' : ''}`
            });
        }
    }

    async uploadFile(fileData) {
        fileData.status = 'uploading';
        fileData.progress = 0;
        this.updateFileItem(fileData);

        return new Promise((resolve, reject) => {
            const formData = new FormData();
            formData.append('file', fileData.file);

            // Ajouter des métadonnées si configurées
            if (this.config.projectId) {
                formData.append('project_id', this.config.projectId);
            }
            if (this.config.devisId) {
                formData.append('devis_id', this.config.devisId);
            }

            const xhr = new XMLHttpRequest();

            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    fileData.progress = Math.round((e.loaded / e.total) * 100);
                    this.updateFileItem(fileData);
                }
            });

            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        fileData.response = JSON.parse(xhr.responseText);
                        resolve(fileData.response);
                    } catch {
                        resolve({ success: true });
                    }
                } else {
                    reject(new Error(`Upload failed: ${xhr.status}`));
                }
            });

            xhr.addEventListener('error', () => {
                reject(new Error('Erreur réseau'));
            });

            xhr.addEventListener('abort', () => {
                reject(new Error('Upload annulé'));
            });

            // Récupérer le token d'authentification
            const token = store.get('auth.token');

            xhr.open('POST', this.config.uploadEndpoint);
            if (token) {
                xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            }
            xhr.send(formData);

            // Stocker le XHR pour pouvoir annuler
            fileData.xhr = xhr;
        });
    }

    updateProgress(percent) {
        this.elements.progressFill.style.width = `${percent}%`;
        this.elements.progressText.textContent = `${Math.round(percent)}%`;
        this.elements.progress.setAttribute('aria-valuenow', Math.round(percent));
    }

    // ============================================
    // FILE MANAGEMENT
    // ============================================

    removeFile(id) {
        const fileData = this.files.get(id);
        if (!fileData) return;

        // Annuler l'upload si en cours
        if (fileData.status === 'uploading' && fileData.xhr) {
            fileData.xhr.abort();
        }

        // Supprimer du DOM
        const item = document.getElementById(`file-item-${id}`);
        if (item) {
            item.remove();
        }

        // Supprimer de la Map
        this.files.delete(id);

        this.updateUI();
        this.emit('fileRemoved', { file: fileData });
    }

    clearAll() {
        // Annuler tous les uploads en cours
        for (const fileData of this.files.values()) {
            if (fileData.status === 'uploading' && fileData.xhr) {
                fileData.xhr.abort();
            }
        }

        this.files.clear();
        this.elements.fileList.innerHTML = '';
        this.updateUI();
        this.emit('cleared');
    }

    getFiles() {
        return Array.from(this.files.values());
    }

    getUploadedFiles() {
        return this.getFiles().filter(f => f.status === 'success');
    }

    // ============================================
    // EVENTS
    // ============================================

    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);
        return () => this.off(event, callback);
    }

    off(event, callback) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).delete(callback);
        }
    }

    emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(cb => cb(data));
        }
    }

    // ============================================
    // UTILITIES
    // ============================================

    generateId() {
        return `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    formatSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    truncateName(name, maxLength = 30) {
        if (name.length <= maxLength) return name;
        const ext = name.split('.').pop();
        const base = name.slice(0, name.length - ext.length - 1);
        const truncated = base.slice(0, maxLength - ext.length - 4) + '...';
        return truncated + '.' + ext;
    }

    getFileIcon(mimeType) {
        const icons = {
            'image/': 'fa-image',
            'application/pdf': 'fa-file-pdf',
            'application/msword': 'fa-file-word',
            'application/vnd.openxmlformats-officedocument.wordprocessingml': 'fa-file-word',
            'application/vnd.ms-excel': 'fa-file-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml': 'fa-file-excel',
            'text/': 'fa-file-alt',
            'video/': 'fa-file-video',
            'audio/': 'fa-file-audio',
            'application/zip': 'fa-file-archive',
            'default': 'fa-file'
        };

        for (const [type, icon] of Object.entries(icons)) {
            if (mimeType.startsWith(type)) return icon;
        }
        return icons.default;
    }

    getStatusText(status) {
        const texts = {
            pending: 'En attente',
            uploading: 'Upload en cours...',
            success: 'Uploadé',
            error: 'Erreur'
        };
        return texts[status] || status;
    }

    // ============================================
    // CLEANUP
    // ============================================

    destroy() {
        this.clearAll();
        this.listeners.clear();
        this.container.innerHTML = '';
    }
}

// ============================================
// STYLES (à ajouter au CSS)
// ============================================

const styles = `
.file-uploader {
    width: 100%;
}

.upload-zone {
    border: 2px dashed var(--color-border);
    border-radius: var(--radius-xl);
    padding: var(--spacing-8);
    text-align: center;
    cursor: pointer;
    transition: var(--transition-base);
    background-color: var(--color-surface-elevated);
}

.upload-zone:hover,
.upload-zone:focus {
    border-color: var(--color-primary);
    background-color: var(--color-primary-50);
}

.upload-zone.dragover {
    border-color: var(--color-primary);
    background-color: var(--color-primary-100);
    border-style: solid;
}

.upload-zone:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
}

.upload-input {
    display: none;
}

.upload-icon {
    font-size: 3rem;
    color: var(--color-text-muted);
    margin-bottom: var(--spacing-4);
}

.upload-zone:hover .upload-icon,
.upload-zone.dragover .upload-icon {
    color: var(--color-primary);
}

.upload-main-text {
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-semibold);
    color: var(--color-text);
    margin-bottom: var(--spacing-2);
}

.upload-sub-text {
    color: var(--color-text-muted);
}

.upload-browse {
    color: var(--color-primary);
    font-weight: var(--font-weight-medium);
}

.upload-instructions {
    font-size: var(--font-size-sm);
    color: var(--color-text-disabled);
    margin-top: var(--spacing-4);
}

/* File List */
.upload-file-list {
    margin-top: var(--spacing-4);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2);
}

.upload-file-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-3);
    padding: var(--spacing-3);
    background-color: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    transition: var(--transition-base);
}

.upload-file-item.status-success {
    border-color: var(--color-success);
    background-color: var(--color-success-bg);
}

.upload-file-item.status-error {
    border-color: var(--color-error);
    background-color: var(--color-error-bg);
}

.file-preview {
    width: 48px;
    height: 48px;
    border-radius: var(--radius-md);
    overflow: hidden;
    background-color: var(--color-surface-elevated);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.file-preview img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.file-preview i {
    font-size: 1.5rem;
    color: var(--color-text-muted);
}

.file-info {
    flex: 1;
    min-width: 0;
}

.file-name {
    font-weight: var(--font-weight-medium);
    color: var(--color-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.file-meta {
    display: flex;
    gap: var(--spacing-2);
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
}

.file-status[data-status="success"] {
    color: var(--color-success);
}

.file-status[data-status="error"] {
    color: var(--color-error);
}

.file-progress-bar {
    height: 4px;
    background-color: var(--color-border);
    border-radius: var(--radius-full);
    margin-top: var(--spacing-2);
    overflow: hidden;
}

.file-progress-fill {
    height: 100%;
    background-color: var(--color-primary);
    transition: width var(--transition-fast);
}

.file-actions {
    flex-shrink: 0;
}

.file-remove {
    padding: var(--spacing-2);
    color: var(--color-text-muted);
    background: none;
    border: none;
    cursor: pointer;
    border-radius: var(--radius-md);
    transition: var(--transition-fast);
}

.file-remove:hover {
    color: var(--color-error);
    background-color: var(--color-error-bg);
}

.file-remove:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

/* Actions */
.upload-actions {
    display: flex;
    gap: var(--spacing-3);
    justify-content: flex-end;
    margin-top: var(--spacing-4);
}

/* Progress */
.upload-progress {
    margin-top: var(--spacing-4);
}

.progress-bar {
    height: 8px;
    background-color: var(--color-border);
    border-radius: var(--radius-full);
    overflow: hidden;
}

.progress-fill {
    height: 100%;
    background-color: var(--color-primary);
    transition: width var(--transition-fast);
}

.progress-text {
    text-align: center;
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
    margin-top: var(--spacing-2);
}
`;

// Injecter les styles si pas déjà présents
if (!document.getElementById('file-uploader-styles')) {
    const styleSheet = document.createElement('style');
    styleSheet.id = 'file-uploader-styles';
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
}

// Export global
window.FileUploader = FileUploader;

export default FileUploader;
