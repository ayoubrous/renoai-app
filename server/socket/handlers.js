/**
 * RenoAI - Gestionnaires WebSocket
 * Gestion des événements temps réel
 */

import crypto from 'crypto';
import { logger } from '../middleware/logger.js';
import {
    registerConnectedUser,
    unregisterConnectedUser,
    getUserSocketIds,
    isUserConnected,
    requireSocketAuth
} from '../middleware/socketAuth.js';
import { getDatabase } from '../config/database.js';

const socketLogger = logger.child('Socket');

/**
 * Configuration des handlers WebSocket
 */
export function setupSocketHandlers(io) {
    io.on('connection', (socket) => {
        socketLogger.info('Nouvelle connexion', {
            socketId: socket.id,
            userId: socket.user?.id,
            ip: socket.handshake.address
        });

        // Enregistrer l'utilisateur connecté
        if (socket.user) {
            registerConnectedUser(socket.user.id, socket.id);

            // Rejoindre la room personnelle de l'utilisateur
            socket.join(`user:${socket.user.id}`);

            // Notifier les autres de la connexion
            socket.broadcast.emit('user:online', {
                userId: socket.user.id,
                timestamp: new Date().toISOString()
            });
        }

        // ========================================
        // ÉVÉNEMENTS DE MESSAGERIE
        // ========================================

        /**
         * Envoyer un message
         */
        socket.on('message:send', requireSocketAuth(socket, async (data) => {
            try {
                const { receiverId, content, projectId, conversationId } = data;

                if (!receiverId || !content) {
                    socket.emit('error', {
                        code: 'INVALID_DATA',
                        message: 'Destinataire et contenu requis'
                    });
                    return;
                }

                const db = getDatabase();

                // Créer ou récupérer la conversation
                let convId = conversationId;
                if (!convId) {
                    const existingConv = db.prepare(`
                        SELECT id FROM conversations
                        WHERE (user1_id = ? AND user2_id = ?)
                           OR (user1_id = ? AND user2_id = ?)
                    `).get(socket.user.id, receiverId, receiverId, socket.user.id);

                    if (existingConv) {
                        convId = existingConv.id;
                    } else {
                        const convUuid = crypto.randomUUID();
                        db.prepare(`
                            INSERT INTO conversations (id, user1_id, user2_id, project_id)
                            VALUES (?, ?, ?, ?)
                        `).run(convUuid, socket.user.id, receiverId, projectId || null);
                        convId = convUuid;
                    }
                }

                // Insérer le message
                const msgUuid = crypto.randomUUID();
                db.prepare(`
                    INSERT INTO messages (id, sender_id, receiver_id, conversation_id, project_id, content)
                    VALUES (?, ?, ?, ?, ?, ?)
                `).run(msgUuid, socket.user.id, receiverId, convId, projectId || null, content);

                // Mettre à jour la conversation
                db.prepare(`
                    UPDATE conversations
                    SET last_message_at = CURRENT_TIMESTAMP,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `).run(convId);

                // Récupérer le message complet
                const message = db.prepare(`
                    SELECT m.*,
                           u.first_name as sender_first_name,
                           u.last_name as sender_last_name
                    FROM messages m
                    JOIN users u ON m.sender_id = u.id
                    WHERE m.id = ?
                `).get(msgUuid);

                // Envoyer au destinataire s'il est connecté
                const receiverSockets = getUserSocketIds(receiverId);
                receiverSockets.forEach(socketId => {
                    io.to(socketId).emit('message:received', {
                        message,
                        conversationId: convId
                    });
                });

                // Confirmer l'envoi à l'expéditeur
                socket.emit('message:sent', {
                    success: true,
                    message,
                    conversationId: convId
                });

                socketLogger.debug('Message envoyé', {
                    from: socket.user.id,
                    to: receiverId,
                    messageId: message.id
                });

            } catch (error) {
                socketLogger.error('Erreur envoi message', { error: error.message });
                socket.emit('error', {
                    code: 'MESSAGE_ERROR',
                    message: 'Erreur lors de l\'envoi du message'
                });
            }
        }));

        /**
         * Marquer les messages comme lus
         */
        socket.on('message:read', requireSocketAuth(socket, async (data) => {
            try {
                const { conversationId, messageIds } = data;
                const db = getDatabase();

                if (messageIds && messageIds.length > 0) {
                    const placeholders = messageIds.map(() => '?').join(',');
                    db.prepare(`
                        UPDATE messages
                        SET read_at = CURRENT_TIMESTAMP
                        WHERE id IN (${placeholders})
                          AND receiver_id = ?
                          AND read_at IS NULL
                    `).run(...messageIds, socket.user.id);
                } else if (conversationId) {
                    db.prepare(`
                        UPDATE messages
                        SET read_at = CURRENT_TIMESTAMP
                        WHERE conversation_id = ?
                          AND receiver_id = ?
                          AND read_at IS NULL
                    `).run(conversationId, socket.user.id);
                }

                socket.emit('message:read:ack', { success: true });

            } catch (error) {
                socketLogger.error('Erreur marquage lu', { error: error.message });
            }
        }));

        /**
         * Indicateur de frappe
         */
        socket.on('typing:start', requireSocketAuth(socket, (data) => {
            const { receiverId, conversationId } = data;

            const receiverSockets = getUserSocketIds(receiverId);
            receiverSockets.forEach(socketId => {
                io.to(socketId).emit('typing:started', {
                    userId: socket.user.id,
                    userName: `${socket.user.first_name} ${socket.user.last_name}`,
                    conversationId
                });
            });
        }));

        socket.on('typing:stop', requireSocketAuth(socket, (data) => {
            const { receiverId, conversationId } = data;

            const receiverSockets = getUserSocketIds(receiverId);
            receiverSockets.forEach(socketId => {
                io.to(socketId).emit('typing:stopped', {
                    userId: socket.user.id,
                    conversationId
                });
            });
        }));

        // ========================================
        // ÉVÉNEMENTS DE PROJET
        // ========================================

        /**
         * Rejoindre la room d'un projet
         */
        socket.on('project:join', requireSocketAuth(socket, (data) => {
            const { projectId } = data;
            socket.join(`project:${projectId}`);

            socketLogger.debug('Utilisateur rejoint projet', {
                userId: socket.user.id,
                projectId
            });
        }));

        /**
         * Quitter la room d'un projet
         */
        socket.on('project:leave', requireSocketAuth(socket, (data) => {
            const { projectId } = data;
            socket.leave(`project:${projectId}`);
        }));

        /**
         * Mise à jour de projet (broadcast aux membres)
         */
        socket.on('project:update', requireSocketAuth(socket, (data) => {
            const { projectId, update } = data;

            socket.to(`project:${projectId}`).emit('project:updated', {
                projectId,
                update,
                updatedBy: {
                    id: socket.user.id,
                    name: `${socket.user.first_name} ${socket.user.last_name}`
                },
                timestamp: new Date().toISOString()
            });
        }));

        // ========================================
        // ÉVÉNEMENTS DE DEVIS
        // ========================================

        /**
         * Progression de l'analyse IA
         */
        socket.on('devis:ai:progress', requireSocketAuth(socket, (data) => {
            const { devisId, progress, step, message } = data;

            // Broadcast à tous les sockets de l'utilisateur
            io.to(`user:${socket.user.id}`).emit('devis:ai:progress', {
                devisId,
                progress,
                step,
                message,
                timestamp: new Date().toISOString()
            });
        }));

        // ========================================
        // ÉVÉNEMENTS DE NOTIFICATIONS
        // ========================================

        /**
         * Souscrire aux notifications
         */
        socket.on('notifications:subscribe', requireSocketAuth(socket, () => {
            socket.join(`notifications:${socket.user.id}`);
        }));

        // ========================================
        // ÉVÉNEMENTS DE STATUT
        // ========================================

        /**
         * Vérifier si un utilisateur est en ligne
         */
        socket.on('user:check:online', (data) => {
            const { userId } = data;
            const online = isUserConnected(userId);

            socket.emit('user:status', {
                userId,
                online,
                timestamp: new Date().toISOString()
            });
        });

        /**
         * Mettre à jour le statut
         */
        socket.on('status:update', requireSocketAuth(socket, (data) => {
            const { status } = data;

            socket.broadcast.emit('user:status:changed', {
                userId: socket.user.id,
                status,
                timestamp: new Date().toISOString()
            });
        }));

        // ========================================
        // DÉCONNEXION
        // ========================================

        socket.on('disconnect', (reason) => {
            socketLogger.info('Déconnexion', {
                socketId: socket.id,
                userId: socket.user?.id,
                reason
            });

            if (socket.user) {
                unregisterConnectedUser(socket.user.id, socket.id);

                // Vérifier si l'utilisateur a encore d'autres connexions
                if (!isUserConnected(socket.user.id)) {
                    socket.broadcast.emit('user:offline', {
                        userId: socket.user.id,
                        timestamp: new Date().toISOString()
                    });
                }
            }
        });

        // ========================================
        // GESTION DES ERREURS
        // ========================================

        socket.on('error', (error) => {
            socketLogger.error('Erreur socket', {
                socketId: socket.id,
                userId: socket.user?.id,
                error: error.message
            });
        });
    });

    socketLogger.info('Handlers WebSocket configurés');
}

/**
 * Émettre une notification à un utilisateur
 */
export function emitToUser(io, userId, event, data) {
    io.to(`user:${userId}`).emit(event, data);
}

/**
 * Émettre à tous les membres d'un projet
 */
export function emitToProject(io, projectId, event, data) {
    io.to(`project:${projectId}`).emit(event, data);
}

/**
 * Émettre une notification globale
 */
export function broadcast(io, event, data) {
    io.emit(event, data);
}

export default { setupSocketHandlers, emitToUser, emitToProject, broadcast };
