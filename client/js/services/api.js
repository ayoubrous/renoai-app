/**
 * RenoAI - Client API Principal
 * Gestion centralisée des appels API
 */

const API_BASE_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:5000/api'
    : '/api';

class APIClient {
    constructor() {
        this.baseURL = API_BASE_URL;
        try {
            this.accessToken = localStorage.getItem('accessToken');
            this.refreshToken = localStorage.getItem('refreshToken');
        } catch {
            this.accessToken = null;
            this.refreshToken = null;
        }
        this.refreshPromise = null;

        // Event emitter pour les changements d'auth
        this.authListeners = [];
    }

    /**
     * Ajouter un listener pour les changements d'authentification
     */
    onAuthChange(callback) {
        this.authListeners.push(callback);
        return () => {
            this.authListeners = this.authListeners.filter(cb => cb !== callback);
        };
    }

    /**
     * Notifier les listeners des changements d'auth
     */
    notifyAuthChange(isAuthenticated, user = null) {
        this.authListeners.forEach(cb => cb(isAuthenticated, user));
    }

    /**
     * Définir les tokens
     */
    setTokens(accessToken, refreshToken) {
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;

        if (accessToken) {
            localStorage.setItem('accessToken', accessToken);
        } else {
            localStorage.removeItem('accessToken');
        }

        if (refreshToken) {
            localStorage.setItem('refreshToken', refreshToken);
        } else {
            localStorage.removeItem('refreshToken');
        }
    }

    /**
     * Effacer les tokens
     */
    clearTokens() {
        this.accessToken = null;
        this.refreshToken = null;
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        this.notifyAuthChange(false);
    }

    /**
     * Obtenir les headers de requête
     */
    getHeaders(includeAuth = true, contentType = 'application/json') {
        const headers = {};

        if (contentType) {
            headers['Content-Type'] = contentType;
        }

        if (includeAuth && this.accessToken) {
            headers['Authorization'] = `Bearer ${this.accessToken}`;
        }

        return headers;
    }

    /**
     * Rafraîchir le token d'accès
     */
    async refreshAccessToken() {
        if (!this.refreshToken) {
            this.clearTokens();
            throw new Error('No refresh token');
        }

        // Éviter les appels simultanés
        if (this.refreshPromise) {
            return this.refreshPromise;
        }

        this.refreshPromise = (async () => {
            try {
                const response = await fetch(`${this.baseURL}/auth/refresh`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ refreshToken: this.refreshToken })
                });

                if (!response.ok) {
                    throw new Error('Token refresh failed');
                }

                const data = await response.json();
                const tokens = data.data?.tokens || data.data;
                this.setTokens(tokens.accessToken || tokens.access_token, tokens.refreshToken || tokens.refresh_token);
                return tokens.accessToken || tokens.access_token;
            } catch (error) {
                this.clearTokens();
                throw error;
            } finally {
                this.refreshPromise = null;
            }
        })();

        return this.refreshPromise;
    }

    /**
     * Requête HTTP générique avec retry automatique
     */
    async request(endpoint, options = {}) {
        const {
            method = 'GET',
            body = null,
            includeAuth = true,
            contentType = 'application/json',
            retryOnUnauthorized = true
        } = options;

        const url = `${this.baseURL}${endpoint}`;
        const headers = this.getHeaders(includeAuth, body instanceof FormData ? null : contentType);

        const fetchOptions = {
            method,
            headers,
            credentials: 'include'
        };

        if (body) {
            fetchOptions.body = body instanceof FormData ? body : JSON.stringify(body);
        }

        try {
            let response = await fetch(url, fetchOptions);

            // Retry avec nouveau token si 401
            if (response.status === 401 && retryOnUnauthorized && this.refreshToken) {
                try {
                    await this.refreshAccessToken();
                    fetchOptions.headers = this.getHeaders(includeAuth, body instanceof FormData ? null : contentType);
                    response = await fetch(url, fetchOptions);
                } catch {
                    this.clearTokens();
                    window.dispatchEvent(new CustomEvent('auth:logout'));
                    throw new Error('Session expirée, veuillez vous reconnecter');
                }
            }

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                const error = new Error(data.error?.message || data.message || 'Erreur serveur');
                error.code = data.error?.code || 'UNKNOWN_ERROR';
                error.status = response.status;
                throw error;
            }

            return data;
        } catch (error) {
            if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
                throw new Error('Impossible de contacter le serveur');
            }
            throw error;
        }
    }

    // ================================
    // RACCOURCIS HTTP
    // ================================

    get(endpoint, options = {}) {
        return this.request(endpoint, { ...options, method: 'GET' });
    }

    post(endpoint, body, options = {}) {
        return this.request(endpoint, { ...options, method: 'POST', body });
    }

    put(endpoint, body, options = {}) {
        return this.request(endpoint, { ...options, method: 'PUT', body });
    }

    patch(endpoint, body, options = {}) {
        return this.request(endpoint, { ...options, method: 'PATCH', body });
    }

    delete(endpoint, options = {}) {
        return this.request(endpoint, { ...options, method: 'DELETE' });
    }

    /**
     * Upload de fichiers
     */
    upload(endpoint, files, additionalData = {}) {
        const formData = new FormData();

        if (Array.isArray(files)) {
            files.forEach((file, index) => {
                formData.append('photos', file);
            });
        } else {
            formData.append('file', files);
        }

        Object.entries(additionalData).forEach(([key, value]) => {
            formData.append(key, typeof value === 'object' ? JSON.stringify(value) : value);
        });

        return this.request(endpoint, {
            method: 'POST',
            body: formData
        });
    }
}

// Instance singleton
const api = new APIClient();

// Export pour usage global
window.RenoAPI = api;
export default api;
