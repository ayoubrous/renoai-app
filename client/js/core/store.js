/**
 * RenoAI - Store Centralisé (State Management)
 * Gestion d'état réactive avec événements pub/sub
 */

// ============================================
// EVENT BUS
// ============================================

class EventBus {
    constructor() {
        this.listeners = new Map();
    }

    /**
     * S'abonner à un événement
     * @param {string} event - Nom de l'événement
     * @param {Function} callback - Fonction à appeler
     * @returns {Function} Fonction de désabonnement
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);

        // Retourner fonction de désabonnement
        return () => this.off(event, callback);
    }

    /**
     * S'abonner une seule fois
     */
    once(event, callback) {
        const wrapper = (...args) => {
            callback(...args);
            this.off(event, wrapper);
        };
        return this.on(event, wrapper);
    }

    /**
     * Se désabonner d'un événement
     */
    off(event, callback) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).delete(callback);
        }
    }

    /**
     * Émettre un événement
     */
    emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`[EventBus] Erreur dans listener ${event}:`, error);
                }
            });
        }
    }

    /**
     * Supprimer tous les listeners d'un événement
     */
    clear(event) {
        if (event) {
            this.listeners.delete(event);
        } else {
            this.listeners.clear();
        }
    }
}

// ============================================
// STORE PRINCIPAL
// ============================================

class Store {
    constructor() {
        this.state = {
            // Authentification
            auth: {
                user: null,
                token: null,
                refreshToken: null,
                isAuthenticated: false,
                loading: false
            },

            // Navigation
            ui: {
                currentPage: 'dashboard',
                sidebarOpen: true,
                theme: 'light',
                loading: false,
                notifications: []
            },

            // Données métier
            projects: {
                items: [],
                current: null,
                loading: false,
                error: null,
                pagination: { page: 1, limit: 10, total: 0 }
            },

            devis: {
                items: [],
                current: null,
                draft: null,
                loading: false,
                error: null
            },

            craftsmen: {
                items: [],
                current: null,
                favorites: [],
                loading: false,
                error: null
            },

            messages: {
                conversations: [],
                currentConversation: null,
                unreadCount: 0,
                loading: false
            },

            // Cache
            cache: {
                timestamp: null,
                version: '1.0.0'
            }
        };

        this.eventBus = new EventBus();
        this.middlewares = [];
        this.history = [];
        this.maxHistory = 50;

        // Charger l'état persisté
        this.loadPersistedState();

        // Auto-save
        this.setupAutoPersist();
    }

    // ============================================
    // GETTERS
    // ============================================

    /**
     * Obtenir une partie de l'état
     */
    get(path) {
        return path.split('.').reduce((obj, key) => obj?.[key], this.state);
    }

    /**
     * Obtenir l'état complet (copie)
     */
    getState() {
        return JSON.parse(JSON.stringify(this.state));
    }

    // ============================================
    // SETTERS
    // ============================================

    /**
     * Mettre à jour l'état
     * @param {string} path - Chemin (ex: 'auth.user')
     * @param {*} value - Nouvelle valeur
     * @param {Object} options - Options (silent, persist)
     */
    set(path, value, options = {}) {
        const { silent = false, persist = true } = options;
        const oldValue = this.get(path);

        // Appliquer les middlewares
        let newValue = value;
        for (const middleware of this.middlewares) {
            newValue = middleware(path, newValue, oldValue, this.state);
        }

        // Mettre à jour l'état
        const keys = path.split('.');
        let current = this.state;

        for (let i = 0; i < keys.length - 1; i++) {
            if (!current[keys[i]]) {
                current[keys[i]] = {};
            }
            current = current[keys[i]];
        }

        current[keys[keys.length - 1]] = newValue;

        // Historique
        this.history.push({
            path,
            oldValue,
            newValue,
            timestamp: Date.now()
        });

        if (this.history.length > this.maxHistory) {
            this.history.shift();
        }

        // Émettre les événements
        if (!silent) {
            this.eventBus.emit(`change:${path}`, { path, value: newValue, oldValue });
            this.eventBus.emit('change', { path, value: newValue, oldValue });

            // Émettre aussi pour les chemins parents
            const parentPath = keys.slice(0, -1).join('.');
            if (parentPath) {
                this.eventBus.emit(`change:${parentPath}`, {
                    path: parentPath,
                    value: this.get(parentPath)
                });
            }
        }

        // Persister si nécessaire
        if (persist && this.shouldPersist(path)) {
            this.persistState();
        }

        return newValue;
    }

    /**
     * Mettre à jour plusieurs valeurs
     */
    setMany(updates, options = {}) {
        Object.entries(updates).forEach(([path, value]) => {
            this.set(path, value, { ...options, persist: false });
        });

        if (options.persist !== false) {
            this.persistState();
        }
    }

    /**
     * Merge un objet dans l'état
     */
    merge(path, data) {
        const current = this.get(path) || {};
        this.set(path, { ...current, ...data });
    }

    // ============================================
    // ACTIONS
    // ============================================

    /**
     * Actions pour l'authentification
     */
    auth = {
        login: (user, token, refreshToken) => {
            this.setMany({
                'auth.user': user,
                'auth.token': token,
                'auth.refreshToken': refreshToken,
                'auth.isAuthenticated': true,
                'auth.loading': false
            });
        },

        logout: () => {
            this.setMany({
                'auth.user': null,
                'auth.token': null,
                'auth.refreshToken': null,
                'auth.isAuthenticated': false
            });
            // Nettoyer les données utilisateur
            this.set('projects.items', []);
            this.set('devis.items', []);
            this.set('messages.conversations', []);
            localStorage.removeItem('renoai_auth');
        },

        updateUser: (updates) => {
            const user = this.get('auth.user');
            if (user) {
                this.set('auth.user', { ...user, ...updates });
            }
        },

        setLoading: (loading) => {
            this.set('auth.loading', loading);
        }
    };

    /**
     * Actions pour l'UI
     */
    ui = {
        navigate: (page) => {
            this.set('ui.currentPage', page);
            this.eventBus.emit('navigate', { page });
        },

        toggleSidebar: () => {
            this.set('ui.sidebarOpen', !this.get('ui.sidebarOpen'));
        },

        setTheme: (theme) => {
            this.set('ui.theme', theme);
            document.documentElement.setAttribute('data-theme', theme);
            localStorage.setItem('renoai_theme', theme);
        },

        toggleTheme: () => {
            const current = this.get('ui.theme');
            this.ui.setTheme(current === 'light' ? 'dark' : 'light');
        },

        setLoading: (loading) => {
            this.set('ui.loading', loading);
        },

        addNotification: (notification) => {
            const notifications = this.get('ui.notifications') || [];
            const id = Date.now().toString();
            const newNotification = {
                id,
                ...notification,
                timestamp: Date.now()
            };
            this.set('ui.notifications', [...notifications, newNotification]);

            // Auto-dismiss après durée
            if (notification.duration !== 0) {
                setTimeout(() => {
                    this.ui.removeNotification(id);
                }, notification.duration || 5000);
            }

            return id;
        },

        removeNotification: (id) => {
            const notifications = this.get('ui.notifications') || [];
            this.set('ui.notifications', notifications.filter(n => n.id !== id));
        }
    };

    /**
     * Actions pour les projets
     */
    projects = {
        setItems: (items) => {
            this.set('projects.items', items);
        },

        addItem: (project) => {
            const items = this.get('projects.items') || [];
            this.set('projects.items', [project, ...items]);
        },

        updateItem: (id, updates) => {
            const items = this.get('projects.items') || [];
            const index = items.findIndex(p => p.id === id);
            if (index !== -1) {
                items[index] = { ...items[index], ...updates };
                this.set('projects.items', [...items]);
            }
        },

        removeItem: (id) => {
            const items = this.get('projects.items') || [];
            this.set('projects.items', items.filter(p => p.id !== id));
        },

        setCurrent: (project) => {
            this.set('projects.current', project);
        },

        setLoading: (loading) => {
            this.set('projects.loading', loading);
        },

        setError: (error) => {
            this.set('projects.error', error);
        },

        setPagination: (pagination) => {
            this.merge('projects.pagination', pagination);
        }
    };

    /**
     * Actions pour les devis
     */
    devis = {
        setItems: (items) => {
            this.set('devis.items', items);
        },

        addItem: (devis) => {
            const items = this.get('devis.items') || [];
            this.set('devis.items', [devis, ...items]);
        },

        updateItem: (id, updates) => {
            const items = this.get('devis.items') || [];
            const index = items.findIndex(d => d.id === id);
            if (index !== -1) {
                items[index] = { ...items[index], ...updates };
                this.set('devis.items', [...items]);
            }
        },

        setCurrent: (devis) => {
            this.set('devis.current', devis);
        },

        setDraft: (draft) => {
            this.set('devis.draft', draft);
        },

        clearDraft: () => {
            this.set('devis.draft', null);
        }
    };

    /**
     * Actions pour les messages
     */
    messages = {
        setConversations: (conversations) => {
            this.set('messages.conversations', conversations);
        },

        addMessage: (conversationId, message) => {
            const conversations = this.get('messages.conversations') || [];
            const index = conversations.findIndex(c => c.id === conversationId);
            if (index !== -1) {
                conversations[index].messages = [
                    ...(conversations[index].messages || []),
                    message
                ];
                conversations[index].last_message = message;
                this.set('messages.conversations', [...conversations]);
            }
        },

        setUnreadCount: (count) => {
            this.set('messages.unreadCount', count);
        },

        incrementUnread: () => {
            const current = this.get('messages.unreadCount') || 0;
            this.set('messages.unreadCount', current + 1);
        }
    };

    // ============================================
    // ABONNEMENTS
    // ============================================

    /**
     * S'abonner aux changements d'un chemin
     */
    subscribe(path, callback) {
        return this.eventBus.on(`change:${path}`, callback);
    }

    /**
     * S'abonner à tous les changements
     */
    subscribeAll(callback) {
        return this.eventBus.on('change', callback);
    }

    /**
     * S'abonner à la navigation
     */
    onNavigate(callback) {
        return this.eventBus.on('navigate', callback);
    }

    // ============================================
    // MIDDLEWARES
    // ============================================

    /**
     * Ajouter un middleware
     */
    use(middleware) {
        this.middlewares.push(middleware);
    }

    // ============================================
    // PERSISTANCE
    // ============================================

    /**
     * Chemins à persister
     */
    persistedPaths = ['auth', 'ui.theme', 'ui.sidebarOpen'];

    shouldPersist(path) {
        return this.persistedPaths.some(p => path.startsWith(p));
    }

    persistState() {
        try {
            const toPersist = {
                auth: {
                    user: this.state.auth.user,
                    token: this.state.auth.token,
                    refreshToken: this.state.auth.refreshToken,
                    isAuthenticated: this.state.auth.isAuthenticated
                },
                ui: {
                    theme: this.state.ui.theme,
                    sidebarOpen: this.state.ui.sidebarOpen
                },
                cache: {
                    timestamp: Date.now(),
                    version: this.state.cache.version
                }
            };

            localStorage.setItem('renoai_state', JSON.stringify(toPersist));
        } catch (error) {
            console.error('[Store] Erreur persistance:', error);
        }
    }

    loadPersistedState() {
        try {
            const saved = localStorage.getItem('renoai_state');
            if (saved) {
                const parsed = JSON.parse(saved);

                // Vérifier la version
                if (parsed.cache?.version !== this.state.cache.version) {
                    console.log('[Store] Version différente, reset du state');
                    localStorage.removeItem('renoai_state');
                    return;
                }

                // Restaurer l'état
                if (parsed.auth) {
                    this.state.auth = { ...this.state.auth, ...parsed.auth };
                }
                if (parsed.ui) {
                    this.state.ui = { ...this.state.ui, ...parsed.ui };
                }

                // Appliquer le thème
                if (parsed.ui?.theme) {
                    document.documentElement.setAttribute('data-theme', parsed.ui.theme);
                }

                // État restauré
            }
        } catch (error) {
            console.error('[Store] Erreur chargement état:', error);
        }
    }

    setupAutoPersist() {
        // Persister avant fermeture de la page
        window.addEventListener('beforeunload', () => {
            this.persistState();
        });
    }

    // ============================================
    // DEBUG
    // ============================================

    /**
     * Mode debug
     */
    debug() {
        console.group('[Store] État actuel');
        console.log('State:', this.getState());
        console.log('History:', this.history);
        console.log('Listeners:', this.eventBus.listeners);
        console.groupEnd();
    }

    /**
     * Reset complet
     */
    reset() {
        localStorage.removeItem('renoai_state');
        localStorage.removeItem('renoai_auth');
        localStorage.removeItem('renoai_theme');
        window.location.reload();
    }
}

// ============================================
// SINGLETON & EXPORT
// ============================================

const store = new Store();

// Middleware de logging en développement
if (process.env.NODE_ENV === 'development' || window.location.hostname === 'localhost') {
    store.use((path, newValue, oldValue) => {
        console.log(`[Store] ${path}:`, oldValue, '→', newValue);
        return newValue;
    });
}

// Export global pour accès facile
window.RenoStore = store;

export { EventBus };
export default store;
