/**
 * RenoAI - Service IA
 * Interaction avec les fonctionnalités d'intelligence artificielle
 */

import api from './api.js';

class AIService {
    constructor() {
        this.pollingIntervals = new Map();
    }

    /**
     * Analyser des photos de rénovation
     */
    async analyzePhotos(photos, options = {}) {
        const { room_type, work_types, description } = options;

        // Si ce sont des fichiers, d'abord les uploader
        let photoUrls = photos;
        if (photos[0] instanceof File) {
            const uploadResponse = await api.upload('/uploads/photos', photos);
            if (!uploadResponse.success) {
                throw new Error('Erreur lors de l\'upload des photos');
            }
            photoUrls = uploadResponse.data.photos.map(p => p.url);
        }

        return api.post('/ai/analyze-photos', {
            photos: photoUrls,
            room_type,
            work_types,
            description
        });
    }

    /**
     * Obtenir le statut d'une analyse
     */
    async getAnalysisStatus(analysisId) {
        return api.get(`/ai/analysis/${analysisId}/status`);
    }

    /**
     * Obtenir les résultats d'une analyse
     */
    async getAnalysisResults(analysisId) {
        return api.get(`/ai/analysis/${analysisId}`);
    }

    /**
     * Attendre la fin d'une analyse (polling)
     */
    async waitForAnalysis(analysisId, options = {}) {
        const { onProgress, interval = 2000, timeout = 120000 } = options;
        const startTime = Date.now();

        // Annuler un éventuel polling existant pour cette analyse
        this.cancelPolling(analysisId);

        const promise = new Promise((resolve, reject) => {
            const cleanup = () => {
                clearInterval(intervalId);
                this.pollingIntervals.delete(analysisId);
            };

            const checkStatus = async () => {
                try {
                    if (Date.now() - startTime > timeout) {
                        cleanup();
                        reject(new Error('Timeout: l\'analyse prend trop de temps'));
                        return;
                    }

                    const response = await this.getAnalysisStatus(analysisId);

                    if (onProgress && response.data.progress !== undefined) {
                        onProgress(response.data.progress, response.data.message);
                    }

                    if (response.data.status === 'completed') {
                        cleanup();
                        const results = await this.getAnalysisResults(analysisId);
                        resolve(results);
                    } else if (response.data.status === 'failed') {
                        cleanup();
                        reject(new Error(response.data.error || 'Analyse échouée'));
                    }
                } catch (error) {
                    cleanup();
                    reject(error);
                }
            };

            const intervalId = setInterval(checkStatus, interval);
            this.pollingIntervals.set(analysisId, intervalId);
            checkStatus(); // Premier appel immédiat
        });

        return promise;
    }

    /**
     * Annuler le polling d'une analyse
     */
    cancelPolling(analysisId) {
        if (this.pollingIntervals.has(analysisId)) {
            clearInterval(this.pollingIntervals.get(analysisId));
            this.pollingIntervals.delete(analysisId);
        }
    }

    /**
     * Annuler tous les pollings en cours
     */
    cancelAllPolling() {
        for (const [id, intervalId] of this.pollingIntervals) {
            clearInterval(intervalId);
        }
        this.pollingIntervals.clear();
    }

    /**
     * Obtenir une estimation rapide
     */
    async getEstimate(params) {
        const { work_type, room_type, surface_area, quality_level = 'standard', details } = params;

        return api.post('/ai/estimate', {
            work_type,
            room_type,
            surface_area,
            quality_level,
            details
        });
    }

    /**
     * Générer un devis complet avec l'IA
     */
    async generateDevis(params) {
        const {
            analysis_id,
            photos,
            room_type,
            work_types,
            quality_level = 'standard',
            surface_area
        } = params;

        return api.post('/ai/generate-devis', {
            analysis_id,
            photos,
            room_type,
            work_types,
            quality_level,
            surface_area
        });
    }

    /**
     * Suggérer des matériaux
     */
    async suggestMaterials(params) {
        const { work_type, room_type, quality_level = 'standard', surface_area, budget } = params;

        return api.post('/ai/suggest-materials', {
            work_type,
            room_type,
            quality_level,
            surface_area,
            budget
        });
    }

    /**
     * Optimiser un devis existant
     */
    async optimizeDevis(devisId, optimizationGoal = 'cost') {
        return api.post('/ai/optimize-devis', {
            devis_id: devisId,
            optimization_goal: optimizationGoal
        });
    }

    /**
     * Détecter les types de travaux depuis une description
     */
    async detectWorkTypes(description, photos = []) {
        return api.post('/ai/detect-work-types', {
            description,
            photos
        });
    }

    /**
     * Annoter une image
     */
    async annotateImage(imageUrl, options = {}) {
        const { work_types, annotations } = options;

        return api.post('/ai/annotate-image', {
            image_url: imageUrl,
            work_types,
            annotations
        });
    }

    // ================================
    // CHAT IA
    // ================================

    /**
     * Envoyer un message au chatbot
     */
    async chat(message, context = {}) {
        return api.post('/ai/chat', {
            message,
            context
        });
    }

    /**
     * Obtenir l'historique de chat
     */
    async getChatHistory(limit = 50) {
        return api.get(`/ai/chat/history?limit=${limit}`);
    }

    /**
     * Effacer l'historique de chat
     */
    async clearChatHistory() {
        return api.delete('/ai/chat/history');
    }

    // ================================
    // RÉFÉRENCES
    // ================================

    /**
     * Obtenir les tarifs de référence
     */
    async getPricingReference(workType, roomType) {
        const params = new URLSearchParams();
        if (workType) params.append('work_type', workType);
        if (roomType) params.append('room_type', roomType);

        return api.get(`/ai/pricing?${params.toString()}`);
    }

    /**
     * Obtenir le catalogue de matériaux
     */
    async getMaterialsCatalog(options = {}) {
        const { work_type, quality_level, search } = options;
        const params = new URLSearchParams();

        if (work_type) params.append('work_type', work_type);
        if (quality_level) params.append('quality_level', quality_level);
        if (search) params.append('search', search);

        return api.get(`/ai/materials-catalog?${params.toString()}`);
    }

    /**
     * Comparer plusieurs devis avec l'IA
     */
    async compareQuotes(devisIds) {
        return api.post('/ai/compare-quotes', {
            devis_ids: devisIds
        });
    }

    /**
     * Obtenir les statistiques d'utilisation IA
     */
    async getUsageStats() {
        return api.get('/ai/stats');
    }
}

const aiService = new AIService();
window.RenoAI = aiService;
export default aiService;
