/**
 * RenoAI - Service Projets
 * Gestion des projets de rénovation
 */

import api from './api.js';

class ProjectsService {
    /**
     * Lister les projets de l'utilisateur
     */
    async getProjects(params = {}) {
        const queryParams = new URLSearchParams();
        if (params.page) queryParams.append('page', params.page);
        if (params.limit) queryParams.append('limit', params.limit);
        if (params.status) queryParams.append('status', params.status);
        if (params.search) queryParams.append('search', params.search);
        if (params.sort) queryParams.append('sort', params.sort);

        const query = queryParams.toString();
        return api.get(`/projects${query ? `?${query}` : ''}`);
    }

    /**
     * Obtenir un projet par ID
     */
    async getProject(projectId) {
        return api.get(`/projects/${projectId}`);
    }

    /**
     * Créer un nouveau projet
     */
    async createProject(projectData) {
        return api.post('/projects', projectData);
    }

    /**
     * Mettre à jour un projet
     */
    async updateProject(projectId, updates) {
        return api.put(`/projects/${projectId}`, updates);
    }

    /**
     * Supprimer un projet
     */
    async deleteProject(projectId) {
        return api.delete(`/projects/${projectId}`);
    }

    /**
     * Changer le statut d'un projet
     */
    async updateStatus(projectId, status) {
        return api.patch(`/projects/${projectId}/status`, { status });
    }

    /**
     * Dupliquer un projet
     */
    async duplicateProject(projectId) {
        return api.post(`/projects/${projectId}/duplicate`);
    }

    /**
     * Archiver/Désarchiver un projet
     */
    async archiveProject(projectId, archive = true) {
        return api.patch(`/projects/${projectId}/archive`, { archive });
    }

    // ================================
    // PHOTOS DU PROJET
    // ================================

    /**
     * Obtenir les photos d'un projet
     */
    async getPhotos(projectId) {
        return api.get(`/projects/${projectId}/photos`);
    }

    /**
     * Ajouter des photos à un projet
     */
    async addPhotos(projectId, files, metadata = {}) {
        return api.upload(`/projects/${projectId}/photos`, files, metadata);
    }

    /**
     * Supprimer une photo
     */
    async deletePhoto(projectId, photoId) {
        return api.delete(`/projects/${projectId}/photos/${photoId}`);
    }

    /**
     * Définir la photo principale
     */
    async setPrimaryPhoto(projectId, photoId) {
        return api.patch(`/projects/${projectId}/photos/${photoId}/primary`);
    }

    // ================================
    // ARTISANS DU PROJET
    // ================================

    /**
     * Obtenir les artisans d'un projet
     */
    async getCraftsmen(projectId) {
        return api.get(`/projects/${projectId}/craftsmen`);
    }

    /**
     * Ajouter un artisan au projet
     */
    async addCraftsman(projectId, craftsmanId, data = {}) {
        return api.post(`/projects/${projectId}/craftsmen`, {
            craftsman_id: craftsmanId,
            ...data
        });
    }

    /**
     * Retirer un artisan du projet
     */
    async removeCraftsman(projectId, craftsmanId) {
        return api.delete(`/projects/${projectId}/craftsmen/${craftsmanId}`);
    }

    /**
     * Mettre à jour le statut d'un artisan
     */
    async updateCraftsmanStatus(projectId, craftsmanId, status) {
        return api.patch(`/projects/${projectId}/craftsmen/${craftsmanId}`, { status });
    }

    // ================================
    // TIMELINE DU PROJET
    // ================================

    /**
     * Obtenir la timeline d'un projet
     */
    async getTimeline(projectId) {
        return api.get(`/projects/${projectId}/timeline`);
    }

    /**
     * Ajouter un événement à la timeline
     */
    async addTimelineEvent(projectId, eventData) {
        return api.post(`/projects/${projectId}/timeline`, eventData);
    }

    /**
     * Mettre à jour un événement
     */
    async updateTimelineEvent(projectId, eventId, updates) {
        return api.put(`/projects/${projectId}/timeline/${eventId}`, updates);
    }

    /**
     * Supprimer un événement
     */
    async deleteTimelineEvent(projectId, eventId) {
        return api.delete(`/projects/${projectId}/timeline/${eventId}`);
    }

    // ================================
    // STATISTIQUES
    // ================================

    /**
     * Obtenir les statistiques des projets
     */
    async getStats() {
        return api.get('/projects/stats');
    }

    /**
     * Obtenir les statistiques d'un projet
     */
    async getProjectStats(projectId) {
        return api.get(`/projects/${projectId}/stats`);
    }
}

const projectsService = new ProjectsService();
window.RenoProjects = projectsService;
export default projectsService;
