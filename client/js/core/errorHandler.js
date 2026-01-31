/**
 * RenoAI - Gestionnaire d'Erreurs Global
 * Capture, logging et affichage des erreurs
 */

import store from './store.js';

// ============================================
// TYPES D'ERREURS
// ============================================

export const ErrorTypes = {
    NETWORK: 'NETWORK_ERROR',
    API: 'API_ERROR',
    VALIDATION: 'VALIDATION_ERROR',
    AUTH: 'AUTH_ERROR',
    PERMISSION: 'PERMISSION_ERROR',
    NOT_FOUND: 'NOT_FOUND_ERROR',
    SERVER: 'SERVER_ERROR',
    CLIENT: 'CLIENT_ERROR',
    UNKNOWN: 'UNKNOWN_ERROR'
};

// ============================================
// CLASSE D'ERREUR PERSONNALISÉE
// ============================================

export class RenoError extends Error {
    constructor(message, type = ErrorTypes.UNKNOWN, details = {}) {
        super(message);
        this.name = 'RenoError';
        this.type = type;
        this.details = details;
        this.timestamp = new Date().toISOString();
        this.id = this.generateId();
    }

    generateId() {
        return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            message: this.message,
            type: this.type,
            details: this.details,
            timestamp: this.timestamp,
            stack: this.stack
        };
    }
}

// ============================================
// GESTIONNAIRE D'ERREURS
// ============================================

class ErrorHandler {
    constructor() {
        this.errors = [];
        this.maxErrors = 100;
        this.listeners = new Set();
        this.retryConfig = {
            maxRetries: 3,
            baseDelay: 1000,
            maxDelay: 10000
        };

        this.setupGlobalHandlers();
    }

    // ============================================
    // CONFIGURATION
    // ============================================

    setupGlobalHandlers() {
        // Erreurs JavaScript non capturées
        window.addEventListener('error', (event) => {
            this.handle(new RenoError(
                event.message || 'Erreur JavaScript',
                ErrorTypes.CLIENT,
                {
                    filename: event.filename,
                    lineno: event.lineno,
                    colno: event.colno
                }
            ));
        });

        // Rejets de promesses non gérés
        window.addEventListener('unhandledrejection', (event) => {
            const error = event.reason;
            this.handle(new RenoError(
                error?.message || 'Promesse rejetée',
                ErrorTypes.CLIENT,
                { reason: error }
            ));
        });

        // Erreurs réseau (fetch)
        this.interceptFetch();
    }

    interceptFetch() {
        const originalFetch = window.fetch;
        const self = this;

        window.fetch = async function(...args) {
            try {
                const response = await originalFetch.apply(this, args);

                // Capturer les erreurs HTTP
                if (!response.ok) {
                    const error = await self.parseApiError(response);
                    self.handle(error);
                }

                return response;
            } catch (error) {
                // Erreurs réseau (offline, timeout, etc.)
                const networkError = new RenoError(
                    'Erreur de connexion au serveur',
                    ErrorTypes.NETWORK,
                    {
                        url: args[0],
                        originalError: error.message
                    }
                );
                self.handle(networkError);
                throw error;
            }
        };
    }

    // ============================================
    // PARSING DES ERREURS
    // ============================================

    async parseApiError(response) {
        let body = {};
        try {
            body = await response.json();
        } catch {
            body = { message: response.statusText };
        }

        const status = response.status;
        let type = ErrorTypes.API;
        let message = body.error || body.message || 'Erreur serveur';

        switch (status) {
            case 400:
                type = ErrorTypes.VALIDATION;
                message = body.error || 'Données invalides';
                break;
            case 401:
                type = ErrorTypes.AUTH;
                message = 'Session expirée. Veuillez vous reconnecter.';
                // Déconnecter l'utilisateur
                store.auth.logout();
                break;
            case 403:
                type = ErrorTypes.PERMISSION;
                message = 'Accès non autorisé';
                break;
            case 404:
                type = ErrorTypes.NOT_FOUND;
                message = body.error || 'Ressource non trouvée';
                break;
            case 429:
                type = ErrorTypes.API;
                message = 'Trop de requêtes. Veuillez patienter.';
                break;
            case 500:
            case 502:
            case 503:
                type = ErrorTypes.SERVER;
                message = 'Erreur serveur. Veuillez réessayer plus tard.';
                break;
        }

        return new RenoError(message, type, {
            status,
            url: response.url,
            body
        });
    }

    // ============================================
    // GESTION DES ERREURS
    // ============================================

    /**
     * Gérer une erreur
     */
    handle(error, options = {}) {
        const {
            showNotification = true,
            log = true,
            rethrow = false
        } = options;

        // Convertir en RenoError si nécessaire
        const renoError = error instanceof RenoError
            ? error
            : new RenoError(
                error.message || 'Erreur inconnue',
                ErrorTypes.UNKNOWN,
                { originalError: error }
            );

        // Stocker l'erreur
        this.errors.push(renoError);
        if (this.errors.length > this.maxErrors) {
            this.errors.shift();
        }

        // Logger
        if (log) {
            this.log(renoError);
        }

        // Notifier les listeners
        this.notifyListeners(renoError);

        // Afficher notification
        if (showNotification) {
            this.showNotification(renoError);
        }

        // Re-throw si demandé
        if (rethrow) {
            throw renoError;
        }

        return renoError;
    }

    /**
     * Logger l'erreur
     */
    log(error) {
        const logData = error.toJSON();

        // Console
        console.group(`[RenoError] ${error.type}`);
        console.error('Message:', error.message);
        console.error('Details:', error.details);
        if (error.stack) {
            console.error('Stack:', error.stack);
        }
        console.groupEnd();

        // Envoyer au serveur en production
        if (window.location.hostname !== 'localhost') {
            this.sendToServer(logData);
        }
    }

    /**
     * Envoyer l'erreur au serveur pour monitoring
     */
    async sendToServer(errorData) {
        try {
            // Utiliser fetch directement pour éviter la boucle
            const originalFetch = window.__originalFetch || window.fetch;
            await originalFetch('/api/logs/error', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(errorData)
            });
        } catch {
            // Silencieux - on ne veut pas de boucle infinie
        }
    }

    /**
     * Afficher une notification
     */
    showNotification(error) {
        const config = this.getNotificationConfig(error);

        // Utiliser le store pour la notification
        store.ui.addNotification({
            type: config.type,
            title: config.title,
            message: error.message,
            duration: config.duration,
            action: config.action
        });
    }

    getNotificationConfig(error) {
        const configs = {
            [ErrorTypes.NETWORK]: {
                type: 'error',
                title: 'Connexion perdue',
                duration: 0, // Persistant
                action: {
                    label: 'Réessayer',
                    onClick: () => window.location.reload()
                }
            },
            [ErrorTypes.AUTH]: {
                type: 'warning',
                title: 'Session expirée',
                duration: 5000,
                action: {
                    label: 'Se connecter',
                    onClick: () => store.ui.navigate('login')
                }
            },
            [ErrorTypes.VALIDATION]: {
                type: 'warning',
                title: 'Données invalides',
                duration: 5000
            },
            [ErrorTypes.PERMISSION]: {
                type: 'error',
                title: 'Accès refusé',
                duration: 5000
            },
            [ErrorTypes.NOT_FOUND]: {
                type: 'info',
                title: 'Non trouvé',
                duration: 4000
            },
            [ErrorTypes.SERVER]: {
                type: 'error',
                title: 'Erreur serveur',
                duration: 0,
                action: {
                    label: 'Réessayer',
                    onClick: () => window.location.reload()
                }
            },
            [ErrorTypes.CLIENT]: {
                type: 'error',
                title: 'Erreur application',
                duration: 5000
            },
            default: {
                type: 'error',
                title: 'Erreur',
                duration: 5000
            }
        };

        return configs[error.type] || configs.default;
    }

    // ============================================
    // LISTENERS
    // ============================================

    /**
     * Ajouter un listener
     */
    onError(callback) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    notifyListeners(error) {
        this.listeners.forEach(callback => {
            try {
                callback(error);
            } catch (e) {
                console.error('[ErrorHandler] Listener error:', e);
            }
        });
    }

    // ============================================
    // RETRY LOGIC
    // ============================================

    /**
     * Exécuter avec retry automatique
     */
    async withRetry(fn, options = {}) {
        const {
            maxRetries = this.retryConfig.maxRetries,
            baseDelay = this.retryConfig.baseDelay,
            maxDelay = this.retryConfig.maxDelay,
            shouldRetry = (error) => error.type === ErrorTypes.NETWORK
        } = options;

        let lastError;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error instanceof RenoError
                    ? error
                    : this.handle(error, { showNotification: false });

                if (attempt === maxRetries || !shouldRetry(lastError)) {
                    throw lastError;
                }

                // Délai exponentiel avec jitter
                const delay = Math.min(
                    baseDelay * Math.pow(2, attempt) + Math.random() * 1000,
                    maxDelay
                );

                console.log(`[ErrorHandler] Retry ${attempt + 1}/${maxRetries} dans ${delay}ms`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        throw lastError;
    }

    // ============================================
    // UTILITAIRES
    // ============================================

    /**
     * Wrapper pour les appels API
     */
    async apiCall(fn, options = {}) {
        try {
            store.ui.setLoading(true);
            const result = await fn();
            return result;
        } catch (error) {
            this.handle(error, options);
            return null;
        } finally {
            store.ui.setLoading(false);
        }
    }

    /**
     * Obtenir les erreurs récentes
     */
    getRecentErrors(count = 10) {
        return this.errors.slice(-count);
    }

    /**
     * Vider les erreurs
     */
    clearErrors() {
        this.errors = [];
    }

    /**
     * Créer une erreur de validation
     */
    validation(message, field = null) {
        return new RenoError(message, ErrorTypes.VALIDATION, { field });
    }

    /**
     * Créer une erreur API
     */
    api(message, status = 500, details = {}) {
        return new RenoError(message, ErrorTypes.API, { status, ...details });
    }
}

// ============================================
// SINGLETON & EXPORT
// ============================================

const errorHandler = new ErrorHandler();

// Sauvegarder le fetch original avant interception
window.__originalFetch = window.fetch;

// Export global
window.RenoError = RenoError;
window.RenoErrorHandler = errorHandler;

export { ErrorTypes, RenoError };
export default errorHandler;
