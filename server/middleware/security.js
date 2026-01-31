/**
 * RenoAI - Middleware de Sécurité Renforcé
 * CSRF, CORS strict, validation headers, sanitization
 */

import crypto from 'crypto';

// ============================================
// CONFIGURATION CORS STRICTE
// ============================================

const ALLOWED_ORIGINS = [
    'http://localhost:3000',
    'http://localhost:5000',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5000'
];

// Ajouter les origines de production depuis l'environnement
if (process.env.CORS_ORIGINS) {
    const envOrigins = process.env.CORS_ORIGINS.split(',').map(o => o.trim());
    ALLOWED_ORIGINS.push(...envOrigins);
}

/**
 * Configuration CORS stricte
 */
export const corsOptions = {
    origin: (origin, callback) => {
        // Autoriser les requêtes sans origin (apps mobiles, Postman, etc.)
        if (!origin) {
            return callback(null, true);
        }

        if (ALLOWED_ORIGINS.includes(origin)) {
            callback(null, true);
        } else {
            console.warn(`[CORS] Origine bloquée: ${origin}`);
            callback(new Error('Non autorisé par CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'X-CSRF-Token',
        'X-Request-ID'
    ],
    exposedHeaders: ['X-Request-ID', 'X-RateLimit-Remaining'],
    credentials: true,
    maxAge: 86400, // 24 heures
    optionsSuccessStatus: 200
};

// ============================================
// PROTECTION CSRF
// ============================================

// Store en mémoire pour les tokens CSRF (en production: Redis)
const csrfTokens = new Map();
const CSRF_TOKEN_EXPIRY = parseInt(process.env.CSRF_TOKEN_EXPIRY_MS, 10) || 3600000; // 1 heure par défaut

/**
 * Génère un token CSRF pour une session
 */
export function generateCsrfToken(sessionId) {
    const token = crypto.randomBytes(32).toString('hex');
    csrfTokens.set(token, {
        sessionId,
        createdAt: Date.now()
    });

    // Nettoyage des tokens expirés
    cleanExpiredCsrfTokens();

    return token;
}

/**
 * Valide un token CSRF
 */
export function validateCsrfToken(token, sessionId) {
    const data = csrfTokens.get(token);

    if (!data) {
        return false;
    }

    // Vérifier expiration
    if (Date.now() - data.createdAt > CSRF_TOKEN_EXPIRY) {
        csrfTokens.delete(token);
        return false;
    }

    // Vérifier que le token appartient à la bonne session
    if (data.sessionId !== sessionId) {
        return false;
    }

    return true;
}

/**
 * Nettoie les tokens CSRF expirés
 */
function cleanExpiredCsrfTokens() {
    const now = Date.now();
    for (const [token, data] of csrfTokens.entries()) {
        if (now - data.createdAt > CSRF_TOKEN_EXPIRY) {
            csrfTokens.delete(token);
        }
    }
}

/**
 * Middleware de protection CSRF
 * Exempte les routes de lecture (GET, HEAD, OPTIONS)
 */
export function csrfProtection(req, res, next) {
    // Routes exemptées
    const exemptMethods = ['GET', 'HEAD', 'OPTIONS'];
    if (exemptMethods.includes(req.method)) {
        return next();
    }

    // Routes exemptées (webhooks, API publique)
    const exemptPaths = [
        '/api/auth/login',
        '/api/auth/register',
        '/api/webhooks'
    ];

    if (exemptPaths.some(path => req.path.startsWith(path))) {
        return next();
    }

    // En mode développement, désactiver CSRF si configuré
    if (process.env.NODE_ENV === 'development' && process.env.DISABLE_CSRF === 'true') {
        return next();
    }

    const token = req.headers['x-csrf-token'] || req.body?._csrf;
    const sessionId = req.user?.id || req.sessionID || req.ip;

    if (!token || !validateCsrfToken(token, sessionId)) {
        return res.status(403).json({
            success: false,
            error: 'Token CSRF invalide ou manquant',
            code: 'CSRF_INVALID'
        });
    }

    // Consommer le token (usage unique)
    csrfTokens.delete(token);

    next();
}

/**
 * Endpoint pour obtenir un nouveau token CSRF
 */
export function csrfTokenEndpoint(req, res) {
    const sessionId = req.user?.id || req.sessionID || req.ip;
    const token = generateCsrfToken(sessionId);

    res.json({
        success: true,
        csrfToken: token,
        expiresIn: CSRF_TOKEN_EXPIRY / 1000 // en secondes
    });
}

// ============================================
// VALIDATION DES HEADERS
// ============================================

/**
 * Vérifie que les headers requis sont présents
 */
export function validateHeaders(req, res, next) {
    // Vérifier Content-Type pour les requêtes avec body
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
        const contentType = req.headers['content-type'];

        // Autoriser multipart pour les uploads
        if (req.path.includes('/upload')) {
            if (!contentType?.includes('multipart/form-data')) {
                // Autoriser aussi JSON pour certains uploads
                if (!contentType?.includes('application/json')) {
                    return res.status(415).json({
                        success: false,
                        error: 'Content-Type doit être multipart/form-data ou application/json',
                        code: 'INVALID_CONTENT_TYPE'
                    });
                }
            }
        } else if (req.body && Object.keys(req.body).length > 0) {
            if (!contentType?.includes('application/json') &&
                !contentType?.includes('application/x-www-form-urlencoded')) {
                return res.status(415).json({
                    success: false,
                    error: 'Content-Type invalide',
                    code: 'INVALID_CONTENT_TYPE'
                });
            }
        }
    }

    next();
}

// ============================================
// SANITIZATION DES ENTRÉES
// ============================================

/**
 * Sanitize les chaînes pour prévenir XSS
 */
export function sanitizeString(str) {
    if (typeof str !== 'string') return str;

    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
}

/**
 * Sanitize récursivement un objet
 */
export function sanitizeObject(obj) {
    if (typeof obj === 'string') {
        return sanitizeString(obj);
    }

    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item));
    }

    if (obj !== null && typeof obj === 'object') {
        const sanitized = {};
        for (const [key, value] of Object.entries(obj)) {
            sanitized[sanitizeString(key)] = sanitizeObject(value);
        }
        return sanitized;
    }

    return obj;
}

/**
 * Middleware de sanitization
 */
export function sanitizeInput(req, res, next) {
    // Ne pas sanitizer certains champs (passwords, HTML intentionnel)
    const preserveFields = ['password', 'currentPassword', 'newPassword', 'html_content'];

    if (req.body) {
        const sanitized = {};
        for (const [key, value] of Object.entries(req.body)) {
            if (preserveFields.includes(key)) {
                sanitized[key] = value;
            } else {
                sanitized[key] = sanitizeObject(value);
            }
        }
        req.body = sanitized;
    }

    if (req.query) {
        req.query = sanitizeObject(req.query);
    }

    if (req.params) {
        req.params = sanitizeObject(req.params);
    }

    next();
}

// ============================================
// RATE LIMITING PAR ENDPOINT
// ============================================

import rateLimit from 'express-rate-limit';

/**
 * Rate limiter pour les requêtes générales
 */
export const generalLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
    message: {
        success: false,
        error: 'Trop de requêtes, veuillez réessayer plus tard.',
        code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        // Utiliser l'IP + user ID si disponible
        return req.user?.id ? `${req.ip}-${req.user.id}` : req.ip;
    }
});

/**
 * Rate limiter strict pour l'authentification
 */
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'development' ? 50 : 5, // Plus permissif en dev
    message: {
        success: false,
        error: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.',
        code: 'AUTH_RATE_LIMIT'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true // Ne pas compter les connexions réussies
});

/**
 * Rate limiter pour les uploads
 */
export const uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 heure
    max: 20, // 20 uploads par heure
    message: {
        success: false,
        error: 'Limite d\'uploads atteinte. Réessayez plus tard.',
        code: 'UPLOAD_RATE_LIMIT'
    }
});

/**
 * Rate limiter pour l'API IA
 */
export const aiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 requêtes par minute
    message: {
        success: false,
        error: 'Limite de requêtes IA atteinte. Réessayez dans une minute.',
        code: 'AI_RATE_LIMIT'
    }
});

// ============================================
// HEADERS DE SÉCURITÉ ADDITIONNELS
// ============================================

/**
 * Headers de sécurité personnalisés
 */
export function securityHeaders(req, res, next) {
    // ID unique pour tracer les requêtes
    const requestId = crypto.randomUUID();
    req.requestId = requestId;
    res.setHeader('X-Request-ID', requestId);

    // Empêcher le MIME sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Protection XSS pour anciens navigateurs
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // Empêcher le clickjacking
    res.setHeader('X-Frame-Options', 'DENY');

    // Referrer policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Permissions policy
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

    next();
}

// ============================================
// DÉTECTION D'ATTAQUES
// ============================================

// Compteur de tentatives suspectes par IP
const suspiciousActivity = new Map();
const SUSPICIOUS_THRESHOLD = 10;
const SUSPICIOUS_WINDOW = 60000; // 1 minute

/**
 * Détecte et bloque les activités suspectes
 */
export function detectAttacks(req, res, next) {
    const ip = req.ip;

    // Patterns suspects dans l'URL
    const suspiciousPatterns = [
        /(\.\.|%2e%2e)/i,           // Path traversal
        /<script/i,                  // XSS
        /union\s+select/i,          // SQL injection
        /exec\s*\(/i,               // Command injection
        /\$\{|\$\(/,                // Template injection
        /javascript:/i,             // JS protocol
        /data:/i,                   // Data protocol
        /vbscript:/i                // VBScript protocol
    ];

    const fullUrl = req.originalUrl;
    const body = JSON.stringify(req.body || {});
    const combined = fullUrl + body;

    for (const pattern of suspiciousPatterns) {
        if (pattern.test(combined)) {
            // Incrémenter le compteur
            const now = Date.now();
            const activity = suspiciousActivity.get(ip) || { count: 0, firstSeen: now };

            // Reset si fenêtre expirée
            if (now - activity.firstSeen > SUSPICIOUS_WINDOW) {
                activity.count = 1;
                activity.firstSeen = now;
            } else {
                activity.count++;
            }

            suspiciousActivity.set(ip, activity);

            console.warn(`[SECURITY] Activité suspecte détectée de ${ip}: ${pattern}`);

            // Bloquer si trop de tentatives
            if (activity.count >= SUSPICIOUS_THRESHOLD) {
                console.error(`[SECURITY] IP bloquée temporairement: ${ip}`);
                return res.status(403).json({
                    success: false,
                    error: 'Requête bloquée pour raisons de sécurité',
                    code: 'SECURITY_BLOCK'
                });
            }

            return res.status(400).json({
                success: false,
                error: 'Requête invalide',
                code: 'INVALID_REQUEST'
            });
        }
    }

    next();
}

// Nettoyage périodique
setInterval(() => {
    const now = Date.now();
    for (const [ip, activity] of suspiciousActivity.entries()) {
        if (now - activity.firstSeen > SUSPICIOUS_WINDOW) {
            suspiciousActivity.delete(ip);
        }
    }
    cleanExpiredCsrfTokens();
}, 60000);

export default {
    corsOptions,
    csrfProtection,
    csrfTokenEndpoint,
    generateCsrfToken,
    validateHeaders,
    sanitizeInput,
    sanitizeString,
    sanitizeObject,
    securityHeaders,
    detectAttacks,
    generalLimiter,
    authLimiter,
    uploadLimiter,
    aiLimiter
};
