/**
 * RenoAI - Service Artisans
 * Gestion du marketplace et des artisans
 */

import api from './api.js';

class CraftsmenService {
    /**
     * Rechercher des artisans
     */
    async search(params = {}) {
        const queryParams = new URLSearchParams();

        if (params.page) queryParams.append('page', params.page);
        if (params.limit) queryParams.append('limit', params.limit);
        if (params.specialty) queryParams.append('specialty', params.specialty);
        if (params.location) queryParams.append('location', params.location);
        if (params.radius) queryParams.append('radius', params.radius);
        if (params.min_rating) queryParams.append('min_rating', params.min_rating);
        if (params.verified_only) queryParams.append('verified_only', 'true');
        if (params.available_now) queryParams.append('available_now', 'true');
        if (params.sort) queryParams.append('sort', params.sort);
        if (params.search) queryParams.append('search', params.search);

        const query = queryParams.toString();
        return api.get(`/craftsmen${query ? `?${query}` : ''}`);
    }

    /**
     * Obtenir un artisan par ID
     */
    async getCraftsman(craftsmanId) {
        return api.get(`/craftsmen/${craftsmanId}`);
    }

    /**
     * Obtenir les artisans mis en avant
     */
    async getFeatured(limit = 6) {
        return api.get(`/craftsmen/featured?limit=${limit}`);
    }

    /**
     * Obtenir les artisans à proximité
     */
    async getNearby(lat, lng, radius = 20, specialty = null) {
        const params = new URLSearchParams({
            lat: lat.toString(),
            lng: lng.toString(),
            radius: radius.toString()
        });

        if (specialty) params.append('specialty', specialty);

        return api.get(`/craftsmen/nearby?${params.toString()}`);
    }

    // ================================
    // PROFIL ARTISAN (pour les artisans connectés)
    // ================================

    /**
     * Obtenir son propre profil artisan
     */
    async getMyProfile() {
        return api.get('/craftsmen/me');
    }

    /**
     * Créer/Mettre à jour le profil artisan
     */
    async updateProfile(profileData) {
        return api.put('/craftsmen/me', profileData);
    }

    /**
     * Mettre à jour la disponibilité
     */
    async updateAvailability(availability) {
        return api.patch('/craftsmen/me/availability', { availability });
    }

    /**
     * Mettre à jour la zone d'intervention
     */
    async updateServiceArea(serviceArea) {
        return api.patch('/craftsmen/me/service-area', serviceArea);
    }

    // ================================
    // PORTFOLIO
    // ================================

    /**
     * Obtenir le portfolio d'un artisan
     */
    async getPortfolio(craftsmanId) {
        return api.get(`/craftsmen/${craftsmanId}/portfolio`);
    }

    /**
     * Ajouter un projet au portfolio
     */
    async addToPortfolio(portfolioData) {
        return api.post('/craftsmen/me/portfolio', portfolioData);
    }

    /**
     * Ajouter des photos au portfolio
     */
    async addPortfolioPhotos(portfolioItemId, files) {
        return api.upload(`/craftsmen/me/portfolio/${portfolioItemId}/photos`, files);
    }

    /**
     * Mettre à jour un élément du portfolio
     */
    async updatePortfolioItem(portfolioItemId, updates) {
        return api.put(`/craftsmen/me/portfolio/${portfolioItemId}`, updates);
    }

    /**
     * Supprimer un élément du portfolio
     */
    async deletePortfolioItem(portfolioItemId) {
        return api.delete(`/craftsmen/me/portfolio/${portfolioItemId}`);
    }

    // ================================
    // AVIS
    // ================================

    /**
     * Obtenir les avis d'un artisan
     */
    async getReviews(craftsmanId, params = {}) {
        const queryParams = new URLSearchParams();
        if (params.page) queryParams.append('page', params.page);
        if (params.limit) queryParams.append('limit', params.limit);
        if (params.sort) queryParams.append('sort', params.sort);

        const query = queryParams.toString();
        return api.get(`/craftsmen/${craftsmanId}/reviews${query ? `?${query}` : ''}`);
    }

    /**
     * Laisser un avis
     */
    async addReview(craftsmanId, reviewData) {
        return api.post(`/craftsmen/${craftsmanId}/reviews`, reviewData);
    }

    /**
     * Répondre à un avis (en tant qu'artisan)
     */
    async respondToReview(reviewId, response) {
        return api.post(`/craftsmen/me/reviews/${reviewId}/respond`, { response });
    }

    // ================================
    // CONTACT
    // ================================

    /**
     * Contacter un artisan
     */
    async contact(craftsmanId, messageData) {
        return api.post(`/craftsmen/${craftsmanId}/contact`, messageData);
    }

    /**
     * Demander un devis à un artisan
     */
    async requestQuote(craftsmanId, quoteRequest) {
        return api.post(`/craftsmen/${craftsmanId}/request-quote`, quoteRequest);
    }

    // ================================
    // STATISTIQUES
    // ================================

    /**
     * Obtenir les statistiques (artisan connecté)
     */
    async getMyStats() {
        return api.get('/craftsmen/me/stats');
    }

    /**
     * Obtenir les demandes reçues
     */
    async getReceivedRequests(params = {}) {
        const queryParams = new URLSearchParams();
        if (params.page) queryParams.append('page', params.page);
        if (params.limit) queryParams.append('limit', params.limit);
        if (params.status) queryParams.append('status', params.status);

        const query = queryParams.toString();
        return api.get(`/craftsmen/me/requests${query ? `?${query}` : ''}`);
    }

    /**
     * Répondre à une demande
     */
    async respondToRequest(requestId, response) {
        return api.post(`/craftsmen/me/requests/${requestId}/respond`, response);
    }

    // ================================
    // SPÉCIALITÉS
    // ================================

    /**
     * Obtenir la liste des spécialités
     */
    async getSpecialties() {
        return api.get('/craftsmen/specialties');
    }

    /**
     * Obtenir les artisans par spécialité
     */
    async getBySpecialty(specialty, params = {}) {
        return this.search({ ...params, specialty });
    }
}

const craftsmenService = new CraftsmenService();
window.RenoCraftsmen = craftsmenService;
export default craftsmenService;
