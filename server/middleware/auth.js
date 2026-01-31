/**
 * RenoAI - Middleware d'authentification
 * JWT, contrôle d'accès et gestion des tokens
 */

import jwt from 'jsonwebtoken';
import { getDatabase } from '../config/database.js';
import { APIError } from './errorHandler.js';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('FATAL: JWT_SECRET environment variable is required');
}
const JWT_ACCESS_EXPIRY = process.env.JWT_ACCESS_EXPIRY || '24h';
const JWT_REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';

/**
 * Middleware d'authentification obligatoire
 */
export function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        // Mode démo uniquement en développement
        if (process.env.NODE_ENV === 'development') {
            req.user = {
                id: 'demo-user',
                email: 'demo@renoai.lu',
                first_name: 'Utilisateur',
                last_name: 'Démo',
                role: 'user',
                status: 'active',
                avatar_url: null
            };
            return next();
        }

        return res.status(401).json({
            success: false,
            error: {
                code: 'TOKEN_MISSING',
                message: 'Token d\'authentification requis'
            }
        });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        // Récupérer l'utilisateur de la base de données
        const db = getDatabase();
        const user = db.prepare(`
            SELECT id, email, first_name, last_name, role, status, avatar_url
            FROM users
            WHERE id = ?
        `).get(decoded.userId);

        if (!user) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'USER_NOT_FOUND',
                    message: 'Utilisateur non trouvé'
                }
            });
        }

        if (user.status !== 'active') {
            return res.status(403).json({
                success: false,
                error: {
                    code: 'ACCOUNT_INACTIVE',
                    message: user.status === 'suspended' ? 'Compte suspendu' : 'Compte désactivé'
                }
            });
        }

        req.user = user;
        next();

    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'TOKEN_EXPIRED',
                    message: 'Token expiré'
                }
            });
        }

        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'TOKEN_INVALID',
                    message: 'Token invalide'
                }
            });
        }

        return res.status(500).json({
            success: false,
            error: {
                code: 'AUTH_ERROR',
                message: 'Erreur d\'authentification'
            }
        });
    }
}

/**
 * Middleware d'authentification optionnelle
 * Permet les requêtes anonymes mais enrichit avec l'utilisateur si authentifié
 */
export function optionalAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return next();
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const db = getDatabase();
        const user = db.prepare(`
            SELECT id, email, first_name, last_name, role, status, avatar_url
            FROM users
            WHERE id = ? AND status = 'active'
        `).get(decoded.userId);

        if (user) {
            req.user = user;
        }
    } catch {
        // Token invalide, continuer sans utilisateur
    }

    next();
}

/**
 * Middleware de contrôle d'accès par rôle
 * @param {string|string[]} roles - Rôle(s) autorisé(s)
 */
export function requireRole(roles) {
    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Authentification requise'
                }
            });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                error: {
                    code: 'FORBIDDEN',
                    message: 'Accès non autorisé'
                }
            });
        }

        next();
    };
}

/**
 * Générer les tokens d'accès et de rafraîchissement
 */
export function generateTokens(payload) {
    const { userId, email, role } = payload;

    const accessToken = jwt.sign(
        { userId, email, role, type: 'access' },
        JWT_SECRET,
        { expiresIn: JWT_ACCESS_EXPIRY }
    );

    const refreshToken = jwt.sign(
        { userId, email, type: 'refresh' },
        JWT_SECRET,
        { expiresIn: JWT_REFRESH_EXPIRY }
    );

    return {
        accessToken,
        refreshToken,
        expiresIn: JWT_ACCESS_EXPIRY
    };
}

/**
 * Vérifier un token sans middleware
 */
export function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch {
        return null;
    }
}

/**
 * Décoder un token sans vérification
 */
export function decodeToken(token) {
    return jwt.decode(token);
}

/**
 * Middleware pour vérifier la propriété d'une ressource
 * @param {string} paramName - Nom du paramètre contenant l'ID de la ressource
 * @param {string} table - Nom de la table
 * @param {string} userIdColumn - Nom de la colonne contenant l'ID utilisateur
 */
export function requireOwnership(paramName, table, userIdColumn = 'user_id') {
    return async (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Authentification requise'
                }
            });
        }

        // Les admins ont accès à tout
        if (req.user.role === 'admin') {
            return next();
        }

        const resourceId = req.params[paramName];
        if (!resourceId) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_PARAM',
                    message: `Paramètre ${paramName} requis`
                }
            });
        }

        const db = getDatabase();
        const resource = db.prepare(`SELECT ${userIdColumn} FROM ${table} WHERE id = ?`).get(resourceId);

        if (!resource) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    message: 'Ressource non trouvée'
                }
            });
        }

        if (resource[userIdColumn] !== req.user.id) {
            return res.status(403).json({
                success: false,
                error: {
                    code: 'FORBIDDEN',
                    message: 'Vous n\'êtes pas autorisé à accéder à cette ressource'
                }
            });
        }

        next();
    };
}

/**
 * Middleware de rate limiting par utilisateur
 */
const userRateLimits = new Map();

export function userRateLimit(maxRequests = 100, windowMs = 60000) {
    return (req, res, next) => {
        if (!req.user) {
            return next();
        }

        const key = `${req.user.id}:${req.path}`;
        const now = Date.now();

        if (!userRateLimits.has(key)) {
            userRateLimits.set(key, { count: 1, resetAt: now + windowMs });
            return next();
        }

        const limit = userRateLimits.get(key);

        if (now > limit.resetAt) {
            limit.count = 1;
            limit.resetAt = now + windowMs;
            return next();
        }

        if (limit.count >= maxRequests) {
            return res.status(429).json({
                success: false,
                error: {
                    code: 'RATE_LIMIT',
                    message: 'Trop de requêtes, veuillez patienter'
                }
            });
        }

        limit.count++;
        next();
    };
}

export default {
    authenticateToken,
    optionalAuth,
    requireRole,
    generateTokens,
    verifyToken,
    decodeToken,
    requireOwnership,
    userRateLimit
};
