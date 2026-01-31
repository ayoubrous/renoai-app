/**
 * RenoAI - Middleware d'authentification WebSocket
 * Gestion de l'authentification pour les connexions Socket.io
 */

import jwt from 'jsonwebtoken';
import { getDatabase } from '../config/database.js';
import { logger } from './logger.js';

const socketLogger = logger.child('WebSocket');

// Map des utilisateurs connectés
const connectedUsers = new Map();

/**
 * Configuration de l'authentification Socket.io
 */
export function setupSocketAuth(io) {
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token || socket.handshake.query.token;

            if (!token) {
                // Permettre les connexions anonymes mais avec des droits limités
                socket.user = null;
                socketLogger.debug('Connexion anonyme acceptée', { socketId: socket.id });
                return next();
            }

            // Vérifier le token JWT
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret');

            // Récupérer l'utilisateur de la base de données
            const db = getDatabase();
            const user = db.prepare(`
                SELECT id, email, first_name, last_name, role
                FROM users
                WHERE id = ?
            `).get(decoded.userId);

            if (!user) {
                return next(new Error('Utilisateur non trouvé'));
            }

            // Attacher l'utilisateur au socket
            socket.user = user;

            socketLogger.info('Utilisateur authentifié via WebSocket', {
                socketId: socket.id,
                userId: user.id,
                email: user.email
            });

            next();

        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                return next(new Error('Token expiré'));
            }
            if (error.name === 'JsonWebTokenError') {
                return next(new Error('Token invalide'));
            }

            socketLogger.error('Erreur d\'authentification WebSocket', {
                socketId: socket.id,
                error: error.message
            });

            next(new Error('Erreur d\'authentification'));
        }
    });
}

/**
 * Enregistrer un utilisateur comme connecté
 */
export function registerConnectedUser(userId, socketId) {
    if (!connectedUsers.has(userId)) {
        connectedUsers.set(userId, new Set());
    }
    connectedUsers.get(userId).add(socketId);

    socketLogger.debug('Utilisateur enregistré', {
        userId,
        socketId,
        totalConnections: connectedUsers.get(userId).size
    });
}

/**
 * Désenregistrer un utilisateur
 */
export function unregisterConnectedUser(userId, socketId) {
    if (connectedUsers.has(userId)) {
        connectedUsers.get(userId).delete(socketId);

        if (connectedUsers.get(userId).size === 0) {
            connectedUsers.delete(userId);
        }

        socketLogger.debug('Utilisateur désenregistré', {
            userId,
            socketId
        });
    }
}

/**
 * Vérifier si un utilisateur est connecté
 */
export function isUserConnected(userId) {
    return connectedUsers.has(userId) && connectedUsers.get(userId).size > 0;
}

/**
 * Obtenir les socket IDs d'un utilisateur
 */
export function getUserSocketIds(userId) {
    return connectedUsers.get(userId) || new Set();
}

/**
 * Obtenir le nombre d'utilisateurs connectés
 */
export function getConnectedUsersCount() {
    return connectedUsers.size;
}

/**
 * Obtenir la liste des utilisateurs connectés
 */
export function getConnectedUserIds() {
    return Array.from(connectedUsers.keys());
}

/**
 * Middleware pour vérifier l'authentification sur un événement socket
 */
export function requireSocketAuth(socket, callback) {
    return (...args) => {
        if (!socket.user) {
            socket.emit('error', {
                code: 'UNAUTHORIZED',
                message: 'Authentification requise'
            });
            return;
        }
        callback(...args);
    };
}

/**
 * Middleware pour vérifier un rôle spécifique
 */
export function requireSocketRole(socket, roles, callback) {
    return (...args) => {
        if (!socket.user) {
            socket.emit('error', {
                code: 'UNAUTHORIZED',
                message: 'Authentification requise'
            });
            return;
        }

        const userRoles = Array.isArray(roles) ? roles : [roles];
        if (!userRoles.includes(socket.user.role)) {
            socket.emit('error', {
                code: 'FORBIDDEN',
                message: 'Permissions insuffisantes'
            });
            return;
        }

        callback(...args);
    };
}

export default {
    setupSocketAuth,
    registerConnectedUser,
    unregisterConnectedUser,
    isUserConnected,
    getUserSocketIds,
    getConnectedUsersCount,
    getConnectedUserIds,
    requireSocketAuth,
    requireSocketRole
};
