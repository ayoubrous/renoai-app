/**
 * RenoAI - Service Devis
 * Gestion des devis et estimations
 */

import api from './api.js';

class DevisService {
    /**
     * Lister les devis de l'utilisateur
     */
    async getDevis(params = {}) {
        const queryParams = new URLSearchParams();
        if (params.page) queryParams.append('page', params.page);
        if (params.limit) queryParams.append('limit', params.limit);
        if (params.project_id) queryParams.append('project_id', params.project_id);
        if (params.status) queryParams.append('status', params.status);
        if (params.type) queryParams.append('type', params.type);

        const query = queryParams.toString();
        return api.get(`/devis${query ? `?${query}` : ''}`);
    }

    /**
     * Obtenir un devis par ID
     */
    async getDevisById(devisId) {
        return api.get(`/devis/${devisId}`);
    }

    /**
     * Créer un nouveau devis
     */
    async createDevis(devisData) {
        return api.post('/devis', devisData);
    }

    /**
     * Mettre à jour un devis
     */
    async updateDevis(devisId, updates) {
        return api.put(`/devis/${devisId}`, updates);
    }

    /**
     * Supprimer un devis
     */
    async deleteDevis(devisId) {
        return api.delete(`/devis/${devisId}`);
    }

    /**
     * Dupliquer un devis
     */
    async duplicateDevis(devisId) {
        return api.post(`/devis/${devisId}/duplicate`);
    }

    /**
     * Changer le statut d'un devis
     */
    async updateStatus(devisId, status) {
        return api.patch(`/devis/${devisId}/status`, { status });
    }

    /**
     * Valider/Accepter un devis
     */
    async acceptDevis(devisId) {
        return api.post(`/devis/${devisId}/accept`);
    }

    /**
     * Refuser un devis
     */
    async rejectDevis(devisId, reason = '') {
        return api.post(`/devis/${devisId}/reject`, { reason });
    }

    // ================================
    // SOUS-DEVIS
    // ================================

    /**
     * Obtenir les sous-devis d'un devis
     */
    async getSubDevis(devisId) {
        return api.get(`/devis/${devisId}/sub-devis`);
    }

    /**
     * Ajouter un sous-devis
     */
    async addSubDevis(devisId, subDevisData) {
        return api.post(`/devis/${devisId}/sub-devis`, subDevisData);
    }

    /**
     * Mettre à jour un sous-devis
     */
    async updateSubDevis(devisId, subDevisId, updates) {
        return api.put(`/devis/${devisId}/sub-devis/${subDevisId}`, updates);
    }

    /**
     * Supprimer un sous-devis
     */
    async deleteSubDevis(devisId, subDevisId) {
        return api.delete(`/devis/${devisId}/sub-devis/${subDevisId}`);
    }

    /**
     * Réorganiser les sous-devis
     */
    async reorderSubDevis(devisId, orderedIds) {
        return api.patch(`/devis/${devisId}/sub-devis/reorder`, { ordered_ids: orderedIds });
    }

    // ================================
    // MATÉRIAUX
    // ================================

    /**
     * Obtenir les matériaux d'un sous-devis
     */
    async getMaterials(devisId, subDevisId) {
        return api.get(`/devis/${devisId}/sub-devis/${subDevisId}/materials`);
    }

    /**
     * Ajouter un matériau
     */
    async addMaterial(devisId, subDevisId, materialData) {
        return api.post(`/devis/${devisId}/sub-devis/${subDevisId}/materials`, materialData);
    }

    /**
     * Mettre à jour un matériau
     */
    async updateMaterial(devisId, subDevisId, materialId, updates) {
        return api.put(`/devis/${devisId}/sub-devis/${subDevisId}/materials/${materialId}`, updates);
    }

    /**
     * Supprimer un matériau
     */
    async deleteMaterial(devisId, subDevisId, materialId) {
        return api.delete(`/devis/${devisId}/sub-devis/${subDevisId}/materials/${materialId}`);
    }

    // ================================
    // EXPORT & PARTAGE
    // ================================

    /**
     * Exporter le devis en PDF
     */
    async exportPDF(devisId, options = {}) {
        const queryParams = new URLSearchParams();
        if (options.include_photos) queryParams.append('include_photos', 'true');
        if (options.include_materials) queryParams.append('include_materials', 'true');
        if (options.template) queryParams.append('template', options.template);

        const query = queryParams.toString();
        return api.get(`/devis/${devisId}/export/pdf${query ? `?${query}` : ''}`);
    }

    /**
     * Générer un lien de partage
     */
    async generateShareLink(devisId, options = {}) {
        return api.post(`/devis/${devisId}/share`, options);
    }

    /**
     * Envoyer le devis par email
     */
    async sendByEmail(devisId, recipientEmail, message = '') {
        return api.post(`/devis/${devisId}/send-email`, {
            recipient_email: recipientEmail,
            message
        });
    }

    // ================================
    // PHOTOS
    // ================================

    /**
     * Obtenir les photos d'un devis
     */
    async getPhotos(devisId) {
        return api.get(`/devis/${devisId}/photos`);
    }

    /**
     * Ajouter des photos au devis
     */
    async addPhotos(devisId, files) {
        return api.upload(`/devis/${devisId}/photos`, files);
    }

    /**
     * Supprimer une photo
     */
    async deletePhoto(devisId, photoId) {
        return api.delete(`/devis/${devisId}/photos/${photoId}`);
    }

    // ================================
    // CALCULS
    // ================================

    /**
     * Recalculer les totaux d'un devis
     */
    async recalculateTotals(devisId) {
        return api.post(`/devis/${devisId}/recalculate`);
    }

    /**
     * Appliquer une remise
     */
    async applyDiscount(devisId, discountData) {
        return api.post(`/devis/${devisId}/discount`, discountData);
    }

    // ================================
    // COMPARAISON
    // ================================

    /**
     * Comparer plusieurs devis
     */
    async compareDevis(devisIds) {
        return api.post('/devis/compare', { devis_ids: devisIds });
    }

    /**
     * Obtenir les statistiques des devis
     */
    async getStats() {
        return api.get('/devis/stats');
    }
}

const devisService = new DevisService();
window.RenoDevis = devisService;
export default devisService;
