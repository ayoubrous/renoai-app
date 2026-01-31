/**
 * RenoAI - Intégration Frontend-Backend
 * Ce fichier connecte le frontend existant aux APIs backend
 */

import api from './services/api.js';
import auth from './services/auth.js';
import projects from './services/projects.js';
import devis from './services/devis.js';
import ai from './services/ai.js';
import craftsmen from './services/craftsmen.js';
import messages from './services/messages.js';
import uploads from './services/uploads.js';
import toast from './utils/toast.js';
import modal from './utils/modal.js';
import * as helpers from './utils/helpers.js';

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
    useAPI: true, // Basculer entre mode API et données locales
    debugMode: true
};

function log(...args) {
    if (CONFIG.debugMode) {
        console.log('[RenoAI]', ...args);
    }
}

// ============================================
// WRAPPER POUR APPDATA (COMPATIBILITÉ)
// ============================================

/**
 * Proxy pour charger les données depuis l'API ou utiliser les données locales
 */
class DataLoader {
    constructor() {
        this.cache = {
            user: null,
            projects: null,
            craftsmen: null,
            messages: null
        };
        this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
        this.cacheTimestamps = {};
    }

    isCacheValid(key) {
        const timestamp = this.cacheTimestamps[key];
        return timestamp && (Date.now() - timestamp) < this.cacheExpiry;
    }

    setCache(key, data) {
        this.cache[key] = data;
        this.cacheTimestamps[key] = Date.now();
    }

    clearCache(key = null) {
        if (key) {
            this.cache[key] = null;
            this.cacheTimestamps[key] = null;
        } else {
            this.cache = { user: null, projects: null, craftsmen: null, messages: null };
            this.cacheTimestamps = {};
        }
    }

    async getUser() {
        if (!CONFIG.useAPI) return window.AppData?.user;

        if (this.isCacheValid('user')) return this.cache.user;

        try {
            const response = await auth.fetchProfile();
            if (response.success) {
                this.setCache('user', response.data.user);
                return response.data.user;
            }
        } catch (error) {
            log('Erreur chargement user:', error);
        }

        return window.AppData?.user || null;
    }

    async getProjects(forceRefresh = false) {
        if (!CONFIG.useAPI) return window.AppData?.projects || [];

        if (!forceRefresh && this.isCacheValid('projects')) return this.cache.projects;

        try {
            const response = await projects.getProjects({ limit: 100 });
            if (response.success) {
                const projectsList = response.data.projects.map(this.mapProjectFromAPI);
                this.setCache('projects', projectsList);
                return projectsList;
            }
        } catch (error) {
            log('Erreur chargement projets:', error);
        }

        return window.AppData?.projects || [];
    }

    async getCraftsmen(forceRefresh = false) {
        if (!CONFIG.useAPI) return window.AppData?.craftsmen || [];

        if (!forceRefresh && this.isCacheValid('craftsmen')) return this.cache.craftsmen;

        try {
            const response = await craftsmen.search({ limit: 50 });
            if (response.success) {
                const craftsmenList = response.data.craftsmen.map(this.mapCraftsmanFromAPI);
                this.setCache('craftsmen', craftsmenList);
                return craftsmenList;
            }
        } catch (error) {
            log('Erreur chargement artisans:', error);
        }

        return window.AppData?.craftsmen || [];
    }

    async getMessages(forceRefresh = false) {
        if (!CONFIG.useAPI) return window.AppData?.messages || [];

        if (!forceRefresh && this.isCacheValid('messages')) return this.cache.messages;

        try {
            const response = await messages.getConversations({ limit: 50 });
            if (response.success) {
                this.setCache('messages', response.data.conversations);
                return response.data.conversations;
            }
        } catch (error) {
            log('Erreur chargement messages:', error);
        }

        return window.AppData?.messages || [];
    }

    // Mappers API -> Format existant
    mapProjectFromAPI(apiProject) {
        return {
            id: apiProject.id,
            title: apiProject.title,
            type: apiProject.room_type || 'full',
            status: apiProject.status,
            surface: apiProject.surface_area,
            budget: apiProject.budget,
            estimatedCost: apiProject.estimated_cost,
            craftsman: apiProject.craftsman_id,
            createdAt: apiProject.created_at,
            progress: apiProject.progress || 0,
            address: apiProject.address,
            description: apiProject.description
        };
    }

    mapCraftsmanFromAPI(apiCraftsman) {
        return {
            id: apiCraftsman.id,
            name: apiCraftsman.company_name || `${apiCraftsman.first_name} ${apiCraftsman.last_name}`,
            initials: helpers.getInitials(apiCraftsman.company_name || `${apiCraftsman.first_name} ${apiCraftsman.last_name}`),
            specialty: apiCraftsman.specialties?.[0] || 'Rénovation',
            type: apiCraftsman.specialties?.[0]?.toLowerCase() || 'renovation',
            rating: parseFloat(apiCraftsman.rating) || 0,
            reviews: apiCraftsman.review_count || 0,
            projects: apiCraftsman.projects_completed || 0,
            experience: apiCraftsman.experience_years || 0,
            responseTime: apiCraftsman.response_time || '24h',
            hourlyRate: apiCraftsman.hourly_rate || 50,
            location: apiCraftsman.city || 'Luxembourg',
            verified: apiCraftsman.verified || false,
            pro: apiCraftsman.verified || false,
            fast: apiCraftsman.response_time?.includes('h') && parseInt(apiCraftsman.response_time) <= 4,
            description: apiCraftsman.description || '',
            skills: apiCraftsman.specialties || [],
            availability: apiCraftsman.availability_status || 'Disponible'
        };
    }
}

const dataLoader = new DataLoader();

// ============================================
// OVERRIDE DES FONCTIONS EXISTANTES
// ============================================

/**
 * Connecter les fonctions de l'app existante aux APIs
 */
function initAPIIntegration() {
    log('Initialisation de l\'intégration API...');

    // Authentification désactivée pour le mode démo
    // checkAuthentication();

    // Écouter les changements d'auth
    auth.onUserChange((user) => {
        if (user) {
            log('Utilisateur connecté:', user.email);
            dataLoader.clearCache();
            if (typeof window.renderPage === 'function') {
                window.renderPage();
            }
        } else {
            log('Utilisateur déconnecté');
            // Mode démo: pas de redirection vers login
            // showLoginModal();
        }
    });

    // Override des fonctions globales si elles existent
    overrideAppFunctions();

    log('Intégration API initialisée');
}

/**
 * Vérifier l'état d'authentification
 */
async function checkAuthentication() {
    const isAuth = auth.isAuthenticated();

    if (isAuth) {
        try {
            await auth.fetchProfile();
            log('Session valide');
        } catch (error) {
            log('Session expirée');
            // La session sera gérée par le refresh token
        }
    } else {
        log('Non authentifié - affichage du login');
        // Attendre que la page soit chargée avant d'afficher le login
        setTimeout(() => {
            if (!auth.isAuthenticated()) {
                showLoginModal();
            }
        }, 1000);
    }
}

/**
 * Afficher la modale de connexion
 */
function showLoginModal() {
    const content = `
        <div class="auth-form">
            <div class="auth-tabs" style="display: flex; margin-bottom: 24px; border-bottom: 2px solid #e5e7eb;">
                <button class="auth-tab active" data-tab="login" style="flex: 1; padding: 12px; border: none; background: none; cursor: pointer; font-weight: 600; color: #667eea; border-bottom: 2px solid #667eea; margin-bottom: -2px;">
                    Connexion
                </button>
                <button class="auth-tab" data-tab="register" style="flex: 1; padding: 12px; border: none; background: none; cursor: pointer; font-weight: 500; color: #6b7280;">
                    Inscription
                </button>
            </div>

            <div id="login-form">
                <div style="margin-bottom: 16px;">
                    <label style="display: block; font-weight: 500; margin-bottom: 6px; color: #374151;">Email</label>
                    <input type="email" id="login-email" placeholder="votre@email.com" style="width: 100%; padding: 12px 16px; border: 1px solid #d1d5db; border-radius: 10px; font-size: 14px;">
                </div>
                <div style="margin-bottom: 16px;">
                    <label style="display: block; font-weight: 500; margin-bottom: 6px; color: #374151;">Mot de passe</label>
                    <input type="password" id="login-password" placeholder="Votre mot de passe" style="width: 100%; padding: 12px 16px; border: 1px solid #d1d5db; border-radius: 10px; font-size: 14px;">
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                        <input type="checkbox" id="remember-me">
                        <span style="font-size: 14px; color: #6b7280;">Se souvenir de moi</span>
                    </label>
                    <a href="#" id="forgot-password-link" style="font-size: 14px; color: #667eea; text-decoration: none;">Mot de passe oublié ?</a>
                </div>
                <button id="login-btn" style="width: 100%; padding: 14px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 10px; font-weight: 600; font-size: 16px; cursor: pointer;">
                    Se connecter
                </button>
            </div>

            <div id="register-form" style="display: none;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
                    <div>
                        <label style="display: block; font-weight: 500; margin-bottom: 6px; color: #374151;">Prénom</label>
                        <input type="text" id="register-firstname" placeholder="Jean" style="width: 100%; padding: 12px 16px; border: 1px solid #d1d5db; border-radius: 10px; font-size: 14px;">
                    </div>
                    <div>
                        <label style="display: block; font-weight: 500; margin-bottom: 6px; color: #374151;">Nom</label>
                        <input type="text" id="register-lastname" placeholder="Dupont" style="width: 100%; padding: 12px 16px; border: 1px solid #d1d5db; border-radius: 10px; font-size: 14px;">
                    </div>
                </div>
                <div style="margin-bottom: 16px;">
                    <label style="display: block; font-weight: 500; margin-bottom: 6px; color: #374151;">Email</label>
                    <input type="email" id="register-email" placeholder="votre@email.com" style="width: 100%; padding: 12px 16px; border: 1px solid #d1d5db; border-radius: 10px; font-size: 14px;">
                </div>
                <div style="margin-bottom: 16px;">
                    <label style="display: block; font-weight: 500; margin-bottom: 6px; color: #374151;">Mot de passe</label>
                    <input type="password" id="register-password" placeholder="Min. 8 caractères" style="width: 100%; padding: 12px 16px; border: 1px solid #d1d5db; border-radius: 10px; font-size: 14px;">
                </div>
                <div style="margin-bottom: 20px;">
                    <label style="display: flex; align-items: flex-start; gap: 8px; cursor: pointer;">
                        <input type="checkbox" id="accept-terms" style="margin-top: 4px;">
                        <span style="font-size: 14px; color: #6b7280;">J'accepte les conditions d'utilisation et la politique de confidentialité</span>
                    </label>
                </div>
                <button id="register-btn" style="width: 100%; padding: 14px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 10px; font-weight: 600; font-size: 16px; cursor: pointer;">
                    Créer un compte
                </button>
            </div>

            <div style="text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                <p style="font-size: 13px; color: #9ca3af;">
                    <span style="display: inline-flex; align-items: center; gap: 6px;">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 14C11.3137 14 14 11.3137 14 8C14 4.68629 11.3137 2 8 2C4.68629 2 2 4.68629 2 8C2 11.3137 4.68629 14 8 14Z" stroke="#9ca3af" stroke-width="1.5"/><path d="M8 5V8L10 10" stroke="#9ca3af" stroke-width="1.5" stroke-linecap="round"/></svg>
                        Essai gratuit - Devis illimités pendant 14 jours
                    </span>
                </p>
            </div>
        </div>
    `;

    const loginModal = modal.open({
        title: 'Bienvenue sur RenoAI',
        content,
        size: 'small',
        closable: false,
        className: 'auth-modal',
        onOpen: (m) => {
            // Tab switching
            m.querySelectorAll('.auth-tab').forEach(tab => {
                tab.addEventListener('click', () => {
                    m.querySelectorAll('.auth-tab').forEach(t => {
                        t.classList.remove('active');
                        t.style.color = '#6b7280';
                        t.style.borderBottom = 'none';
                    });
                    tab.classList.add('active');
                    tab.style.color = '#667eea';
                    tab.style.borderBottom = '2px solid #667eea';

                    const isLogin = tab.dataset.tab === 'login';
                    m.querySelector('#login-form').style.display = isLogin ? 'block' : 'none';
                    m.querySelector('#register-form').style.display = isLogin ? 'none' : 'block';
                });
            });

            // Login
            m.querySelector('#login-btn').addEventListener('click', async () => {
                const email = m.querySelector('#login-email').value;
                const password = m.querySelector('#login-password').value;
                const remember = m.querySelector('#remember-me').checked;

                if (!email || !password) {
                    toast.warning('Veuillez remplir tous les champs');
                    return;
                }

                try {
                    m.querySelector('#login-btn').disabled = true;
                    m.querySelector('#login-btn').textContent = 'Connexion...';

                    const response = await auth.login(email, password, remember);
                    if (response.success) {
                        toast.success('Connexion réussie !');
                        modal.close(loginModal);
                        dataLoader.clearCache();
                        if (typeof window.renderPage === 'function') {
                            window.renderPage();
                        }
                    }
                } catch (error) {
                    toast.error(error.message || 'Erreur de connexion');
                    m.querySelector('#login-btn').disabled = false;
                    m.querySelector('#login-btn').textContent = 'Se connecter';
                }
            });

            // Register
            m.querySelector('#register-btn').addEventListener('click', async () => {
                const firstName = m.querySelector('#register-firstname').value;
                const lastName = m.querySelector('#register-lastname').value;
                const email = m.querySelector('#register-email').value;
                const password = m.querySelector('#register-password').value;
                const acceptTerms = m.querySelector('#accept-terms').checked;

                if (!firstName || !lastName || !email || !password) {
                    toast.warning('Veuillez remplir tous les champs');
                    return;
                }

                if (!acceptTerms) {
                    toast.warning('Veuillez accepter les conditions d\'utilisation');
                    return;
                }

                if (!helpers.isValidPassword(password)) {
                    toast.warning('Le mot de passe doit contenir au moins 8 caractères, une majuscule et un chiffre');
                    return;
                }

                try {
                    m.querySelector('#register-btn').disabled = true;
                    m.querySelector('#register-btn').textContent = 'Inscription...';

                    const response = await auth.register({
                        first_name: firstName,
                        last_name: lastName,
                        email,
                        password
                    });

                    if (response.success) {
                        toast.success('Compte créé avec succès !');
                        modal.close(loginModal);
                        dataLoader.clearCache();
                        if (typeof window.renderPage === 'function') {
                            window.renderPage();
                        }
                    }
                } catch (error) {
                    toast.error(error.message || 'Erreur lors de l\'inscription');
                    m.querySelector('#register-btn').disabled = false;
                    m.querySelector('#register-btn').textContent = 'Créer un compte';
                }
            });

            // Enter key support
            ['#login-email', '#login-password'].forEach(sel => {
                m.querySelector(sel)?.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') m.querySelector('#login-btn').click();
                });
            });
        }
    });
}

/**
 * Override des fonctions globales de l'app
 */
function overrideAppFunctions() {
    // Stocker les références originales
    const originalAppData = window.AppData;

    // Créer un proxy pour AppData qui charge depuis l'API
    if (CONFIG.useAPI && originalAppData) {
        // Garder AppData comme fallback mais préférer les données API
        window.loadAppData = async () => {
            const [user, projectsList, craftsmenList] = await Promise.all([
                dataLoader.getUser(),
                dataLoader.getProjects(),
                dataLoader.getCraftsmen()
            ]);

            if (user) window.AppData.user = user;
            if (projectsList?.length) window.AppData.projects = projectsList;
            if (craftsmenList?.length) window.AppData.craftsmen = craftsmenList;

            return window.AppData;
        };
    }

    // Override logout si elle existe
    const originalLogout = window.logout;
    window.logout = async () => {
        try {
            await auth.logout();
            toast.info('Déconnecté avec succès');
        } catch (error) {
            log('Erreur logout:', error);
        }
        if (originalLogout) originalLogout();
    };

    // Ajouter une fonction de refresh des données
    window.refreshData = async () => {
        dataLoader.clearCache();
        await window.loadAppData?.();
        if (typeof window.renderPage === 'function') {
            window.renderPage();
        }
        toast.success('Données actualisées');
    };
}

// ============================================
// FONCTIONS UTILITAIRES GLOBALES
// ============================================

/**
 * Créer un nouveau projet via l'API
 */
window.createProject = async (projectData) => {
    try {
        const response = await projects.createProject(projectData);
        if (response.success) {
            toast.success('Projet créé avec succès !');
            dataLoader.clearCache('projects');
            return response.data.project;
        }
    } catch (error) {
        toast.error(error.message || 'Erreur lors de la création du projet');
        throw error;
    }
};

/**
 * Générer un devis via l'IA
 */
window.generateAIDevis = async (params) => {
    try {
        toast.info('Génération du devis en cours...');

        // Si des photos sont fournies, les uploader d'abord
        let photoUrls = params.photos || [];
        if (photoUrls.length > 0 && photoUrls[0] instanceof File) {
            const uploadResponse = await uploads.uploadPhotos(photoUrls);
            if (uploadResponse.success) {
                photoUrls = uploadResponse.data.photos.map(p => p.url);
            }
        }

        // Lancer l'analyse
        const analysisResponse = await ai.analyzePhotos(photoUrls, {
            room_type: params.room_type,
            work_types: params.work_types,
            description: params.description
        });

        if (analysisResponse.success) {
            // Attendre les résultats avec progression
            const results = await ai.waitForAnalysis(analysisResponse.data.analysis_id, {
                onProgress: (progress, message) => {
                    log(`Analyse: ${progress}% - ${message}`);
                }
            });

            // Générer le devis complet
            const devisResponse = await ai.generateDevis({
                analysis_id: analysisResponse.data.analysis_id,
                ...params
            });

            if (devisResponse.success) {
                toast.success('Devis généré avec succès !');
                return devisResponse.data.devis;
            }
        }
    } catch (error) {
        toast.error(error.message || 'Erreur lors de la génération du devis');
        throw error;
    }
};

/**
 * Envoyer un message
 */
window.sendMessage = async (conversationId, content, attachments = []) => {
    try {
        const response = await messages.sendMessage(conversationId, content, attachments);
        if (response.success) {
            return response.data.message;
        }
    } catch (error) {
        toast.error(error.message || 'Erreur lors de l\'envoi du message');
        throw error;
    }
};

/**
 * Contacter un artisan
 */
window.contactCraftsman = async (craftsmanId, message, projectId = null) => {
    try {
        const response = await craftsmen.contact(craftsmanId, {
            message,
            project_id: projectId
        });
        if (response.success) {
            toast.success('Message envoyé à l\'artisan !');
            return response.data;
        }
    } catch (error) {
        toast.error(error.message || 'Erreur lors de l\'envoi du message');
        throw error;
    }
};

// ============================================
// INITIALISATION
// ============================================

// Attendre que le DOM soit chargé
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAPIIntegration);
} else {
    initAPIIntegration();
}

// Exporter pour usage dans d'autres modules
export {
    dataLoader,
    initAPIIntegration,
    showLoginModal,
    CONFIG
};

// Export global
window.RenoIntegration = {
    dataLoader,
    config: CONFIG,
    showLoginModal,
    api, auth, projects, devis, ai, craftsmen, messages, uploads,
    toast, modal, helpers
};
