/**
 * RenoAI - Service d'Authentification
 * Gestion de l'authentification utilisateur
 */

import api from './api.js';

class AuthService {
    constructor() {
        this.user = this.loadUser();
        this.listeners = [];
    }

    /**
     * Charger l'utilisateur depuis le localStorage
     */
    loadUser() {
        try {
            const userData = localStorage.getItem('user');
            return userData ? JSON.parse(userData) : null;
        } catch {
            return null;
        }
    }

    /**
     * Sauvegarder l'utilisateur
     */
    saveUser(user) {
        this.user = user;
        if (user) {
            localStorage.setItem('user', JSON.stringify(user));
        } else {
            localStorage.removeItem('user');
        }
        this.notifyListeners();
    }

    /**
     * Ajouter un listener pour les changements d'utilisateur
     */
    onUserChange(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(cb => cb !== callback);
        };
    }

    /**
     * Notifier les listeners
     */
    notifyListeners() {
        this.listeners.forEach(cb => cb(this.user));
    }

    /**
     * Vérifier si l'utilisateur est connecté
     */
    isAuthenticated() {
        return !!this.user && !!api.accessToken;
    }

    /**
     * Obtenir l'utilisateur courant
     */
    getCurrentUser() {
        return this.user;
    }

    /**
     * Inscription
     */
    async register(userData) {
        const response = await api.post('/auth/register', userData, { includeAuth: false });

        if (response.success) {
            const tokens = response.data.tokens || response.data;
            api.setTokens(tokens.accessToken || tokens.access_token, tokens.refreshToken || tokens.refresh_token);
            this.saveUser(response.data.user);
        }

        return response;
    }

    /**
     * Connexion
     */
    async login(email, password, rememberMe = false) {
        const response = await api.post('/auth/login', {
            email,
            password,
            remember_me: rememberMe
        }, { includeAuth: false });

        if (response.success) {
            const tokens = response.data.tokens || response.data;
            api.setTokens(tokens.accessToken || tokens.access_token, tokens.refreshToken || tokens.refresh_token);
            this.saveUser(response.data.user);
        }

        return response;
    }

    /**
     * Déconnexion
     */
    async logout() {
        try {
            await api.post('/auth/logout', {});
        } catch (error) {
            console.warn('Erreur lors de la déconnexion côté serveur:', error);
        } finally {
            api.clearTokens();
            this.saveUser(null);
            window.dispatchEvent(new CustomEvent('auth:logout'));
        }
    }

    /**
     * Vérifier l'email (lien envoyé)
     */
    async verifyEmail(token) {
        return api.post('/auth/verify-email', { token }, { includeAuth: false });
    }

    /**
     * Demander réinitialisation mot de passe
     */
    async forgotPassword(email) {
        return api.post('/auth/forgot-password', { email }, { includeAuth: false });
    }

    /**
     * Réinitialiser le mot de passe
     */
    async resetPassword(token, newPassword) {
        return api.post('/auth/reset-password', {
            token,
            new_password: newPassword
        }, { includeAuth: false });
    }

    /**
     * Changer le mot de passe (connecté)
     */
    async changePassword(currentPassword, newPassword) {
        return api.post('/auth/change-password', {
            current_password: currentPassword,
            new_password: newPassword
        });
    }

    /**
     * Obtenir le profil depuis le serveur
     */
    async fetchProfile() {
        const response = await api.get('/auth/me');
        if (response.success) {
            this.saveUser(response.data.user);
        }
        return response;
    }

    /**
     * Mettre à jour le profil
     */
    async updateProfile(updates) {
        const response = await api.put('/users/profile', updates);
        if (response.success) {
            this.saveUser({ ...this.user, ...response.data.user });
        }
        return response;
    }

    /**
     * Mettre à jour l'avatar
     */
    async updateAvatar(file) {
        const response = await api.upload('/uploads/avatar', file);
        if (response.success) {
            this.saveUser({ ...this.user, avatar_url: response.data.avatar_url });
        }
        return response;
    }

    /**
     * Obtenir les préférences utilisateur
     */
    async getPreferences() {
        return api.get('/users/preferences');
    }

    /**
     * Mettre à jour les préférences
     */
    async updatePreferences(preferences) {
        return api.put('/users/preferences', preferences);
    }

    /**
     * Supprimer le compte
     */
    async deleteAccount(password) {
        const response = await api.delete('/users/account', {
            body: { password }
        });
        if (response.success) {
            api.clearTokens();
            this.saveUser(null);
        }
        return response;
    }
}

// Instance singleton
const authService = new AuthService();

// Écouter les déconnexions forcées
window.addEventListener('auth:logout', () => {
    authService.saveUser(null);
});

window.RenoAuth = authService;
export default authService;
