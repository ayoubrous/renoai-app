/**
 * RenoAI - Middleware de gestion des erreurs
 * Gestion centralisée des erreurs avec logging
 */

import { logger } from './logger.js';

// Classe d'erreur personnalisée pour l'API
export class APIError extends Error {
    constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        this.isOperational = true;

        Error.captureStackTrace(this, this.constructor);
    }
}

// Erreurs prédéfinies
export const errors = {
    // Authentification
    UNAUTHORIZED: new APIError('Non autorisé', 401, 'UNAUTHORIZED'),
    INVALID_CREDENTIALS: new APIError('Identifiants invalides', 401, 'INVALID_CREDENTIALS'),
    TOKEN_EXPIRED: new APIError('Token expiré', 401, 'TOKEN_EXPIRED'),
    TOKEN_INVALID: new APIError('Token invalide', 401, 'TOKEN_INVALID'),

    // Autorisation
    FORBIDDEN: new APIError('Accès interdit', 403, 'FORBIDDEN'),
    INSUFFICIENT_PERMISSIONS: new APIError('Permissions insuffisantes', 403, 'INSUFFICIENT_PERMISSIONS'),

    // Ressources
    NOT_FOUND: new APIError('Ressource non trouvée', 404, 'NOT_FOUND'),
    USER_NOT_FOUND: new APIError('Utilisateur non trouvé', 404, 'USER_NOT_FOUND'),
    PROJECT_NOT_FOUND: new APIError('Projet non trouvé', 404, 'PROJECT_NOT_FOUND'),
    DEVIS_NOT_FOUND: new APIError('Devis non trouvé', 404, 'DEVIS_NOT_FOUND'),
    CRAFTSMAN_NOT_FOUND: new APIError('Artisan non trouvé', 404, 'CRAFTSMAN_NOT_FOUND'),

    // Validation
    VALIDATION_ERROR: new APIError('Erreur de validation', 400, 'VALIDATION_ERROR'),
    MISSING_FIELDS: new APIError('Champs requis manquants', 400, 'MISSING_FIELDS'),
    INVALID_INPUT: new APIError('Données invalides', 400, 'INVALID_INPUT'),

    // Conflit
    CONFLICT: new APIError('Conflit de ressource', 409, 'CONFLICT'),
    EMAIL_EXISTS: new APIError('Cet email est déjà utilisé', 409, 'EMAIL_EXISTS'),

    // Upload
    FILE_TOO_LARGE: new APIError('Fichier trop volumineux', 413, 'FILE_TOO_LARGE'),
    INVALID_FILE_TYPE: new APIError('Type de fichier non autorisé', 415, 'INVALID_FILE_TYPE'),
    UPLOAD_FAILED: new APIError('Échec de l\'upload', 500, 'UPLOAD_FAILED'),

    // Serveur
    INTERNAL_ERROR: new APIError('Erreur interne du serveur', 500, 'INTERNAL_ERROR'),
    DATABASE_ERROR: new APIError('Erreur de base de données', 500, 'DATABASE_ERROR'),
    AI_SERVICE_ERROR: new APIError('Erreur du service IA', 503, 'AI_SERVICE_ERROR')
};

// Créer une erreur personnalisée
export function createError(message, statusCode, code, details = null) {
    return new APIError(message, statusCode, code, details);
}

// Handler pour les routes non trouvées
export function notFoundHandler(req, res, next) {
    const error = new APIError(
        `Route non trouvée: ${req.method} ${req.originalUrl}`,
        404,
        'ROUTE_NOT_FOUND'
    );
    next(error);
}

// Handler principal des erreurs
export function errorHandler(err, req, res, next) {
    // Valeurs par défaut
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Erreur interne du serveur';
    let code = err.code || 'INTERNAL_ERROR';
    let details = err.details || null;

    // Log de l'erreur
    const errorLog = {
        timestamp: new Date().toISOString(),
        method: req.method,
        url: req.originalUrl,
        statusCode,
        code,
        message,
        stack: err.stack,
        userId: req.user?.id,
        ip: req.ip,
        userAgent: req.get('User-Agent')
    };

    if (statusCode >= 500) {
        logger.error('Server Error', errorLog);
    } else if (statusCode >= 400) {
        logger.warn('Client Error', errorLog);
    }

    // Gestion des erreurs spécifiques

    // Erreur de validation express-validator
    if (err.array && typeof err.array === 'function') {
        statusCode = 400;
        code = 'VALIDATION_ERROR';
        message = 'Erreur de validation';
        details = err.array();
    }

    // Erreur Multer (upload)
    if (err.code === 'LIMIT_FILE_SIZE') {
        statusCode = 413;
        code = 'FILE_TOO_LARGE';
        message = 'Le fichier dépasse la taille maximale autorisée (10 MB)';
    }

    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        statusCode = 400;
        code = 'INVALID_FILE_FIELD';
        message = 'Champ de fichier inattendu';
    }

    // Erreur JWT
    if (err.name === 'JsonWebTokenError') {
        statusCode = 401;
        code = 'TOKEN_INVALID';
        message = 'Token invalide';
    }

    if (err.name === 'TokenExpiredError') {
        statusCode = 401;
        code = 'TOKEN_EXPIRED';
        message = 'Token expiré';
    }

    // Erreur SQLite
    if (err.code && err.code.startsWith('SQLITE')) {
        statusCode = 500;
        code = 'DATABASE_ERROR';

        if (err.code === 'SQLITE_CONSTRAINT') {
            statusCode = 409;
            code = 'CONSTRAINT_VIOLATION';
            message = 'Violation de contrainte de base de données';

            if (err.message.includes('UNIQUE')) {
                message = 'Cette valeur existe déjà';
            }
        }
    }

    // En production, masquer les détails des erreurs serveur
    if (process.env.NODE_ENV === 'production' && statusCode >= 500) {
        message = 'Une erreur est survenue, veuillez réessayer plus tard';
        details = null;
    }

    // Réponse d'erreur
    const errorResponse = {
        success: false,
        error: {
            code,
            message,
            ...(details && { details }),
            ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
        },
        timestamp: new Date().toISOString(),
        path: req.originalUrl
    };

    res.status(statusCode).json(errorResponse);
}

// Wrapper async pour les controllers
export function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

// Middleware de validation
export function validate(validations) {
    return async (req, res, next) => {
        for (let validation of validations) {
            const result = await validation.run(req);
            if (result.errors.length) break;
        }

        const { validationResult } = await import('express-validator');
        const errors = validationResult(req);

        if (errors.isEmpty()) {
            return next();
        }

        const error = new APIError(
            'Erreur de validation',
            400,
            'VALIDATION_ERROR',
            errors.array().map(e => ({
                field: e.path,
                message: e.msg,
                value: e.value
            }))
        );

        next(error);
    };
}

export default { errorHandler, notFoundHandler, APIError, errors, createError, asyncHandler, validate };
