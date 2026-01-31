/**
 * RenoAI - Service de Cache
 * Cache en mémoire avec TTL et stratégies d'invalidation
 */

// ============================================
// CONFIGURATION
// ============================================

const DEFAULT_CONFIG = {
    defaultTTL: 5 * 60 * 1000,      // 5 minutes
    maxSize: 1000,                   // Nombre max d'entrées
    checkInterval: 60 * 1000,        // Vérification toutes les minutes
    compressionThreshold: 1024       // Compresser au-delà de 1KB (futur)
};

// ============================================
// CACHE ENTRY CLASS
// ============================================

class CacheEntry {
    constructor(value, ttl) {
        this.value = value;
        this.createdAt = Date.now();
        this.expiresAt = Date.now() + ttl;
        this.accessCount = 0;
        this.lastAccess = Date.now();
    }

    isExpired() {
        return Date.now() > this.expiresAt;
    }

    touch() {
        this.accessCount++;
        this.lastAccess = Date.now();
    }
}

// ============================================
// CACHE SERVICE CLASS
// ============================================

class CacheService {
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.cache = new Map();
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0,
            evictions: 0
        };

        // Démarrer le nettoyage périodique
        this.cleanupInterval = setInterval(
            () => this.cleanup(),
            this.config.checkInterval
        );
    }

    // ============================================
    // OPÉRATIONS DE BASE
    // ============================================

    /**
     * Récupérer une valeur du cache
     */
    get(key) {
        const entry = this.cache.get(key);

        if (!entry) {
            this.stats.misses++;
            return undefined;
        }

        if (entry.isExpired()) {
            this.cache.delete(key);
            this.stats.misses++;
            return undefined;
        }

        entry.touch();
        this.stats.hits++;
        return entry.value;
    }

    /**
     * Stocker une valeur dans le cache
     */
    set(key, value, ttl = this.config.defaultTTL) {
        // Vérifier la taille max
        if (this.cache.size >= this.config.maxSize && !this.cache.has(key)) {
            this.evict();
        }

        const entry = new CacheEntry(value, ttl);
        this.cache.set(key, entry);
        this.stats.sets++;

        return true;
    }

    /**
     * Supprimer une entrée du cache
     */
    delete(key) {
        const deleted = this.cache.delete(key);
        if (deleted) {
            this.stats.deletes++;
        }
        return deleted;
    }

    /**
     * Vérifier si une clé existe
     */
    has(key) {
        const entry = this.cache.get(key);
        if (!entry) return false;
        if (entry.isExpired()) {
            this.cache.delete(key);
            return false;
        }
        return true;
    }

    /**
     * Vider tout le cache
     */
    clear() {
        this.cache.clear();
        return true;
    }

    // ============================================
    // OPÉRATIONS AVANCÉES
    // ============================================

    /**
     * Get or Set - Récupérer ou calculer et stocker
     */
    async getOrSet(key, factory, ttl = this.config.defaultTTL) {
        const cached = this.get(key);
        if (cached !== undefined) {
            return cached;
        }

        // Calculer la valeur
        const value = await factory();

        // Stocker dans le cache
        this.set(key, value, ttl);

        return value;
    }

    /**
     * Récupérer plusieurs valeurs
     */
    mget(keys) {
        const result = {};
        for (const key of keys) {
            const value = this.get(key);
            if (value !== undefined) {
                result[key] = value;
            }
        }
        return result;
    }

    /**
     * Stocker plusieurs valeurs
     */
    mset(entries, ttl = this.config.defaultTTL) {
        for (const [key, value] of Object.entries(entries)) {
            this.set(key, value, ttl);
        }
        return true;
    }

    /**
     * Supprimer par pattern (préfixe)
     */
    deleteByPrefix(prefix) {
        let count = 0;
        for (const key of this.cache.keys()) {
            if (key.startsWith(prefix)) {
                this.cache.delete(key);
                count++;
            }
        }
        this.stats.deletes += count;
        return count;
    }

    /**
     * Supprimer par tags
     */
    deleteByTag(tag) {
        return this.deleteByPrefix(`tag:${tag}:`);
    }

    // ============================================
    // HELPERS POUR REQUÊTES
    // ============================================

    /**
     * Générer une clé de cache pour une requête
     */
    static requestKey(req) {
        const userId = req.user?.id || 'anonymous';
        const path = req.path;
        const query = JSON.stringify(req.query);
        return `req:${userId}:${path}:${query}`;
    }

    /**
     * Cache pour les projets
     */
    projectKey(projectId) {
        return `project:${projectId}`;
    }

    projectsListKey(userId, filters = {}) {
        return `projects:user:${userId}:${JSON.stringify(filters)}`;
    }

    /**
     * Cache pour les devis
     */
    devisKey(devisId) {
        return `devis:${devisId}`;
    }

    devisListKey(userId, filters = {}) {
        return `devis:user:${userId}:${JSON.stringify(filters)}`;
    }

    /**
     * Cache pour les artisans
     */
    craftsmanKey(craftsmanId) {
        return `craftsman:${craftsmanId}`;
    }

    craftsmenListKey(filters = {}) {
        return `craftsmen:list:${JSON.stringify(filters)}`;
    }

    // ============================================
    // INVALIDATION
    // ============================================

    /**
     * Invalider le cache d'un projet
     */
    invalidateProject(projectId, userId) {
        this.delete(this.projectKey(projectId));
        this.deleteByPrefix(`projects:user:${userId}`);
    }

    /**
     * Invalider le cache d'un devis
     */
    invalidateDevis(devisId, userId) {
        this.delete(this.devisKey(devisId));
        this.deleteByPrefix(`devis:user:${userId}`);
    }

    /**
     * Invalider le cache d'un artisan
     */
    invalidateCraftsman(craftsmanId) {
        this.delete(this.craftsmanKey(craftsmanId));
        this.deleteByPrefix('craftsmen:list');
    }

    /**
     * Invalider tout le cache d'un utilisateur
     */
    invalidateUser(userId) {
        this.deleteByPrefix(`projects:user:${userId}`);
        this.deleteByPrefix(`devis:user:${userId}`);
        this.deleteByPrefix(`messages:user:${userId}`);
    }

    // ============================================
    // MAINTENANCE
    // ============================================

    /**
     * Nettoyer les entrées expirées
     */
    cleanup() {
        let cleaned = 0;
        for (const [key, entry] of this.cache.entries()) {
            if (entry.isExpired()) {
                this.cache.delete(key);
                cleaned++;
            }
        }
        if (cleaned > 0) {
            console.log(`[Cache] Nettoyage: ${cleaned} entrées expirées supprimées`);
        }
        return cleaned;
    }

    /**
     * Évincer les entrées les moins utilisées (LRU)
     */
    evict() {
        // Trouver l'entrée avec le plus ancien dernier accès
        let oldestKey = null;
        let oldestTime = Infinity;

        for (const [key, entry] of this.cache.entries()) {
            if (entry.lastAccess < oldestTime) {
                oldestTime = entry.lastAccess;
                oldestKey = key;
            }
        }

        if (oldestKey) {
            this.cache.delete(oldestKey);
            this.stats.evictions++;
            return true;
        }

        return false;
    }

    // ============================================
    // STATISTIQUES
    // ============================================

    /**
     * Obtenir les statistiques
     */
    getStats() {
        const total = this.stats.hits + this.stats.misses;
        const hitRate = total > 0 ? (this.stats.hits / total * 100).toFixed(2) : 0;

        return {
            ...this.stats,
            size: this.cache.size,
            maxSize: this.config.maxSize,
            hitRate: `${hitRate}%`,
            memoryUsage: this.estimateMemoryUsage()
        };
    }

    /**
     * Estimer l'utilisation mémoire
     */
    estimateMemoryUsage() {
        let totalSize = 0;
        for (const [key, entry] of this.cache.entries()) {
            totalSize += key.length * 2; // Caractères Unicode
            totalSize += JSON.stringify(entry.value).length * 2;
            totalSize += 64; // Overhead de l'entrée
        }
        return this.formatBytes(totalSize);
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Réinitialiser les statistiques
     */
    resetStats() {
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0,
            evictions: 0
        };
    }

    // ============================================
    // DEBUG
    // ============================================

    /**
     * Lister toutes les clés
     */
    keys() {
        return Array.from(this.cache.keys());
    }

    /**
     * Debug - afficher l'état du cache
     */
    debug() {
        console.group('[Cache] État actuel');
        console.log('Taille:', this.cache.size);
        console.log('Stats:', this.getStats());
        console.log('Clés:', this.keys());
        console.groupEnd();
    }

    // ============================================
    // LIFECYCLE
    // ============================================

    /**
     * Arrêter le service
     */
    stop() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }

    /**
     * Redémarrer le nettoyage
     */
    start() {
        if (!this.cleanupInterval) {
            this.cleanupInterval = setInterval(
                () => this.cleanup(),
                this.config.checkInterval
            );
        }
    }
}

// ============================================
// MIDDLEWARE EXPRESS
// ============================================

/**
 * Middleware de cache pour les routes GET
 */
export function cacheMiddleware(options = {}) {
    const {
        ttl = 60 * 1000,
        keyGenerator = CacheService.requestKey,
        condition = () => true
    } = options;

    return async (req, res, next) => {
        // Uniquement pour les requêtes GET
        if (req.method !== 'GET') {
            return next();
        }

        // Vérifier la condition
        if (!condition(req)) {
            return next();
        }

        const key = keyGenerator(req);
        const cached = cache.get(key);

        if (cached) {
            res.set('X-Cache', 'HIT');
            return res.json(cached);
        }

        // Intercepter la réponse
        const originalJson = res.json.bind(res);
        res.json = (data) => {
            if (res.statusCode === 200 && data?.success !== false) {
                cache.set(key, data, ttl);
            }
            res.set('X-Cache', 'MISS');
            return originalJson(data);
        };

        next();
    };
}

/**
 * Middleware pour invalider le cache
 */
export function invalidateCacheMiddleware(keyPatterns) {
    return (req, res, next) => {
        const originalJson = res.json.bind(res);

        res.json = (data) => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
                for (const pattern of keyPatterns) {
                    if (typeof pattern === 'function') {
                        const key = pattern(req);
                        cache.delete(key);
                    } else {
                        cache.deleteByPrefix(pattern);
                    }
                }
            }
            return originalJson(data);
        };

        next();
    };
}

// ============================================
// SINGLETON & EXPORT
// ============================================

const cache = new CacheService();

// Export nommé et par défaut
export { CacheService, cache };
export default cache;
