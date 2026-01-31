/**
 * RenoAI - Contrôleur Messages
 * Gestion de la messagerie entre utilisateurs
 */

import crypto from 'crypto';
import { getDatabase } from '../config/database.js';
import { asyncHandler, APIError, errors } from '../middleware/errorHandler.js';
import { logger } from '../middleware/logger.js';

const messageLogger = logger.child('Messages');

/**
 * Lister ses conversations
 * GET /api/messages/conversations
 */
export const getConversations = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, archived = 'false' } = req.query;
    const db = getDatabase();

    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = `
        SELECT c.*,
               CASE WHEN c.user1_id = ? THEN u2.id ELSE u1.id END as other_user_id,
               CASE WHEN c.user1_id = ? THEN u2.first_name ELSE u1.first_name END as other_first_name,
               CASE WHEN c.user1_id = ? THEN u2.last_name ELSE u1.last_name END as other_last_name,
               CASE WHEN c.user1_id = ? THEN u2.avatar_url ELSE u1.avatar_url END as other_avatar_url,
               p.name as project_name,
               (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
               (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_at,
               (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id AND receiver_id = ? AND read_at IS NULL) as unread_count
        FROM conversations c
        JOIN users u1 ON c.user1_id = u1.id
        JOIN users u2 ON c.user2_id = u2.id
        LEFT JOIN projects p ON c.project_id = p.id
        WHERE (c.user1_id = ? OR c.user2_id = ?)
    `;

    const params = [
        req.user.id, req.user.id, req.user.id, req.user.id,
        req.user.id, req.user.id, req.user.id
    ];

    if (archived === 'true') {
        query += ` AND c.archived_by LIKE ?`;
        params.push(`%${req.user.id}%`);
    } else {
        query += ` AND (c.archived_by IS NULL OR c.archived_by NOT LIKE ?)`;
        params.push(`%${req.user.id}%`);
    }

    // Count total
    const countQuery = `SELECT COUNT(*) as total FROM (${query})`;
    const countResult = db.prepare(countQuery).get(...params);
    const total = countResult ? countResult.total : 0;

    query += ` ORDER BY c.last_message_at DESC NULLS LAST LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);

    const conversations = db.prepare(query).all(...params);

    res.json({
        success: true,
        data: {
            conversations,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        }
    });
});

/**
 * Obtenir une conversation avec ses messages
 * GET /api/messages/conversations/:conversationId
 */
export const getConversation = asyncHandler(async (req, res) => {
    const { conversationId } = req.params;
    const { page = 1, limit = 50, before, after } = req.query;
    const db = getDatabase();

    // Vérifier l'accès
    const conversation = db.prepare(`
        SELECT c.*,
               u1.first_name as user1_first_name, u1.last_name as user1_last_name, u1.avatar_url as user1_avatar,
               u2.first_name as user2_first_name, u2.last_name as user2_last_name, u2.avatar_url as user2_avatar,
               p.name as project_name
        FROM conversations c
        JOIN users u1 ON c.user1_id = u1.id
        JOIN users u2 ON c.user2_id = u2.id
        LEFT JOIN projects p ON c.project_id = p.id
        WHERE c.id = ? AND (c.user1_id = ? OR c.user2_id = ?)
    `).get(conversationId, req.user.id, req.user.id);

    if (!conversation) {
        throw new APIError('Conversation non trouvée', 404, 'CONVERSATION_NOT_FOUND');
    }

    // Récupérer les messages
    let messagesQuery = `
        SELECT m.*, u.first_name, u.last_name, u.avatar_url
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.conversation_id = ?
    `;
    const params = [conversationId];

    if (before) {
        messagesQuery += ` AND m.created_at < ?`;
        params.push(before);
    }

    if (after) {
        messagesQuery += ` AND m.created_at > ?`;
        params.push(after);
    }

    messagesQuery += ` ORDER BY m.created_at DESC LIMIT ?`;
    params.push(parseInt(limit));

    const messages = db.prepare(messagesQuery).all(...params);

    // Marquer comme lus
    db.prepare(`
        UPDATE messages
        SET read_at = CURRENT_TIMESTAMP
        WHERE conversation_id = ? AND receiver_id = ? AND read_at IS NULL
    `).run(conversationId, req.user.id);

    res.json({
        success: true,
        data: {
            conversation,
            messages: messages.reverse() // Ordre chronologique
        }
    });
});

/**
 * Créer une nouvelle conversation
 * POST /api/messages/conversations
 */
export const createConversation = asyncHandler(async (req, res) => {
    const { user_id, project_id, initial_message } = req.body;
    const db = getDatabase();

    if (!user_id) {
        throw new APIError('ID utilisateur requis', 400, 'USER_ID_REQUIRED');
    }

    // Vérifier que l'utilisateur existe
    const targetUser = db.prepare('SELECT id FROM users WHERE id = ? AND status = \'active\'').get(user_id);
    if (!targetUser) {
        throw errors.USER_NOT_FOUND;
    }

    // Vérifier si une conversation existe déjà
    let conversation = db.prepare(`
        SELECT id FROM conversations
        WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)
    `).get(req.user.id, user_id, user_id, req.user.id);

    if (conversation) {
        // Si un message initial, l'ajouter
        if (initial_message) {
            const messageId = crypto.randomUUID();
            db.prepare(`
                INSERT INTO messages (id, sender_id, receiver_id, conversation_id, project_id, content)
                VALUES (?, ?, ?, ?, ?, ?)
            `).run(messageId, req.user.id, user_id, conversation.id, project_id || null, initial_message);

            db.prepare('UPDATE conversations SET last_message_at = CURRENT_TIMESTAMP WHERE id = ?').run(conversation.id);
        }

        res.json({
            success: true,
            message: 'Conversation existante',
            data: { conversation_id: conversation.id }
        });
        return;
    }

    // Créer la conversation
    const conversationId = crypto.randomUUID();
    db.prepare(`
        INSERT INTO conversations (id, user1_id, user2_id, project_id)
        VALUES (?, ?, ?, ?)
    `).run(conversationId, req.user.id, user_id, project_id || null);

    // Ajouter le message initial
    if (initial_message) {
        const messageId = crypto.randomUUID();
        db.prepare(`
            INSERT INTO messages (id, sender_id, receiver_id, conversation_id, project_id, content)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(messageId, req.user.id, user_id, conversationId, project_id || null, initial_message);

        db.prepare('UPDATE conversations SET last_message_at = CURRENT_TIMESTAMP WHERE id = ?').run(conversationId);
    }

    messageLogger.info('Conversation créée', { conversationId, userId: req.user.id });

    res.status(201).json({
        success: true,
        message: 'Conversation créée',
        data: { conversation_id: conversationId }
    });
});

/**
 * Supprimer/quitter une conversation
 * DELETE /api/messages/conversations/:conversationId
 */
export const deleteConversation = asyncHandler(async (req, res) => {
    const { conversationId } = req.params;
    const db = getDatabase();

    // Vérifier l'accès
    const conversation = db.prepare(`
        SELECT * FROM conversations
        WHERE id = ? AND (user1_id = ? OR user2_id = ?)
    `).get(conversationId, req.user.id, req.user.id);

    if (!conversation) {
        throw new APIError('Conversation non trouvée', 404, 'CONVERSATION_NOT_FOUND');
    }

    // Soft delete - marquer comme supprimée pour l'utilisateur
    const deletedBy = conversation.deleted_by ? JSON.parse(conversation.deleted_by) : [];
    if (!deletedBy.includes(req.user.id)) {
        deletedBy.push(req.user.id);
    }

    db.prepare('UPDATE conversations SET deleted_by = ? WHERE id = ?').run(JSON.stringify(deletedBy), conversationId);

    // Si les deux utilisateurs ont supprimé, supprimer vraiment
    if (deletedBy.length >= 2) {
        db.prepare('DELETE FROM messages WHERE conversation_id = ?').run(conversationId);
        db.prepare('DELETE FROM conversations WHERE id = ?').run(conversationId);
    }

    res.json({
        success: true,
        message: 'Conversation supprimée'
    });
});

/**
 * Archiver une conversation
 * PUT /api/messages/conversations/:conversationId/archive
 */
export const archiveConversation = asyncHandler(async (req, res) => {
    const { conversationId } = req.params;
    const db = getDatabase();

    const conversation = db.prepare(`
        SELECT archived_by FROM conversations
        WHERE id = ? AND (user1_id = ? OR user2_id = ?)
    `).get(conversationId, req.user.id, req.user.id);

    if (!conversation) {
        throw new APIError('Conversation non trouvée', 404, 'CONVERSATION_NOT_FOUND');
    }

    const archivedBy = conversation.archived_by ? JSON.parse(conversation.archived_by) : [];
    if (!archivedBy.includes(req.user.id)) {
        archivedBy.push(req.user.id);
    }

    db.prepare('UPDATE conversations SET archived_by = ? WHERE id = ?').run(JSON.stringify(archivedBy), conversationId);

    res.json({
        success: true,
        message: 'Conversation archivée'
    });
});

/**
 * Désarchiver une conversation
 * PUT /api/messages/conversations/:conversationId/unarchive
 */
export const unarchiveConversation = asyncHandler(async (req, res) => {
    const { conversationId } = req.params;
    const db = getDatabase();

    const conversation = db.prepare(`
        SELECT archived_by FROM conversations
        WHERE id = ? AND (user1_id = ? OR user2_id = ?)
    `).get(conversationId, req.user.id, req.user.id);

    if (!conversation) {
        throw new APIError('Conversation non trouvée', 404, 'CONVERSATION_NOT_FOUND');
    }

    let archivedBy = conversation.archived_by ? JSON.parse(conversation.archived_by) : [];
    archivedBy = archivedBy.filter(id => id !== req.user.id);

    db.prepare('UPDATE conversations SET archived_by = ? WHERE id = ?').run(
        archivedBy.length > 0 ? JSON.stringify(archivedBy) : null,
        conversationId
    );

    res.json({
        success: true,
        message: 'Conversation désarchivée'
    });
});

/**
 * Mettre en sourdine
 * PUT /api/messages/conversations/:conversationId/mute
 */
export const muteConversation = asyncHandler(async (req, res) => {
    const { conversationId } = req.params;
    const db = getDatabase();

    const conversation = db.prepare(`
        SELECT muted_by FROM conversations
        WHERE id = ? AND (user1_id = ? OR user2_id = ?)
    `).get(conversationId, req.user.id, req.user.id);

    if (!conversation) {
        throw new APIError('Conversation non trouvée', 404, 'CONVERSATION_NOT_FOUND');
    }

    const mutedBy = conversation.muted_by ? JSON.parse(conversation.muted_by) : [];
    if (!mutedBy.includes(req.user.id)) {
        mutedBy.push(req.user.id);
    }

    db.prepare('UPDATE conversations SET muted_by = ? WHERE id = ?').run(JSON.stringify(mutedBy), conversationId);

    res.json({
        success: true,
        message: 'Conversation mise en sourdine'
    });
});

/**
 * Réactiver les notifications
 * PUT /api/messages/conversations/:conversationId/unmute
 */
export const unmuteConversation = asyncHandler(async (req, res) => {
    const { conversationId } = req.params;
    const db = getDatabase();

    const conversation = db.prepare(`
        SELECT muted_by FROM conversations
        WHERE id = ? AND (user1_id = ? OR user2_id = ?)
    `).get(conversationId, req.user.id, req.user.id);

    if (!conversation) {
        throw new APIError('Conversation non trouvée', 404, 'CONVERSATION_NOT_FOUND');
    }

    let mutedBy = conversation.muted_by ? JSON.parse(conversation.muted_by) : [];
    mutedBy = mutedBy.filter(id => id !== req.user.id);

    db.prepare('UPDATE conversations SET muted_by = ? WHERE id = ?').run(
        mutedBy.length > 0 ? JSON.stringify(mutedBy) : null,
        conversationId
    );

    res.json({
        success: true,
        message: 'Notifications réactivées'
    });
});

/**
 * Envoyer un message
 * POST /api/messages
 */
export const sendMessage = asyncHandler(async (req, res) => {
    const { receiver_id, content, project_id, devis_id, attachments } = req.body;
    const db = getDatabase();

    // Vérifier que le destinataire existe
    const receiver = db.prepare('SELECT id FROM users WHERE id = ? AND status = \'active\'').get(receiver_id);
    if (!receiver) {
        throw errors.USER_NOT_FOUND;
    }

    // Trouver ou créer la conversation
    let conversation = db.prepare(`
        SELECT id FROM conversations
        WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)
    `).get(req.user.id, receiver_id, receiver_id, req.user.id);

    if (!conversation) {
        const newConversationId = crypto.randomUUID();
        db.prepare(`
            INSERT INTO conversations (id, user1_id, user2_id, project_id)
            VALUES (?, ?, ?, ?)
        `).run(newConversationId, req.user.id, receiver_id, project_id || null);
        conversation = { id: newConversationId };
    }

    // Créer le message
    const messageId = crypto.randomUUID();
    db.prepare(`
        INSERT INTO messages (id, sender_id, receiver_id, conversation_id, project_id, devis_id, content, attachments)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        messageId, req.user.id, receiver_id, conversation.id,
        project_id || null, devis_id || null, content,
        attachments ? JSON.stringify(attachments) : null
    );

    // Mettre à jour la conversation
    db.prepare('UPDATE conversations SET last_message_at = CURRENT_TIMESTAMP WHERE id = ?').run(conversation.id);

    const message = db.prepare(`
        SELECT m.*, u.first_name, u.last_name, u.avatar_url
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.id = ?
    `).get(messageId);

    // TODO: Émettre via WebSocket

    res.status(201).json({
        success: true,
        data: {
            message,
            conversation_id: conversation.id
        }
    });
});

/**
 * Obtenir un message
 * GET /api/messages/:messageId
 */
export const getMessage = asyncHandler(async (req, res) => {
    const { messageId } = req.params;
    const db = getDatabase();

    const message = db.prepare(`
        SELECT m.*, u.first_name, u.last_name, u.avatar_url
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.id = ? AND (m.sender_id = ? OR m.receiver_id = ?)
    `).get(messageId, req.user.id, req.user.id);

    if (!message) {
        throw new APIError('Message non trouvé', 404, 'MESSAGE_NOT_FOUND');
    }

    res.json({
        success: true,
        data: { message }
    });
});

/**
 * Supprimer un message
 * DELETE /api/messages/:messageId
 */
export const deleteMessage = asyncHandler(async (req, res) => {
    const { messageId } = req.params;
    const db = getDatabase();

    const message = db.prepare(`
        SELECT * FROM messages WHERE id = ? AND sender_id = ?
    `).get(messageId, req.user.id);

    if (!message) {
        throw new APIError('Message non trouvé ou non autorisé', 404, 'MESSAGE_NOT_FOUND');
    }

    // Soft delete
    db.prepare('UPDATE messages SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?').run(messageId);

    res.json({
        success: true,
        message: 'Message supprimé'
    });
});

/**
 * Marquer un message comme lu
 * PUT /api/messages/:messageId/read
 */
export const markAsRead = asyncHandler(async (req, res) => {
    const { messageId } = req.params;
    const db = getDatabase();

    db.prepare(`
        UPDATE messages
        SET read_at = CURRENT_TIMESTAMP
        WHERE id = ? AND receiver_id = ? AND read_at IS NULL
    `).run(messageId, req.user.id);

    res.json({
        success: true,
        message: 'Message marqué comme lu'
    });
});

/**
 * Marquer tous les messages d'une conversation comme lus
 * PUT /api/messages/conversations/:conversationId/read
 */
export const markConversationAsRead = asyncHandler(async (req, res) => {
    const { conversationId } = req.params;
    const db = getDatabase();

    db.prepare(`
        UPDATE messages
        SET read_at = CURRENT_TIMESTAMP
        WHERE conversation_id = ? AND receiver_id = ? AND read_at IS NULL
    `).run(conversationId, req.user.id);

    res.json({
        success: true,
        message: 'Messages marqués comme lus'
    });
});

/**
 * Rechercher dans ses messages
 * GET /api/messages/search
 */
export const searchMessages = asyncHandler(async (req, res) => {
    const { q, page = 1, limit = 20 } = req.query;
    const db = getDatabase();

    if (!q || q.length < 2) {
        throw new APIError('Recherche trop courte', 400, 'SEARCH_TOO_SHORT');
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const messages = db.prepare(`
        SELECT m.*, u.first_name, u.last_name, u.avatar_url,
               c.id as conversation_id
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        JOIN conversations c ON m.conversation_id = c.id
        WHERE (m.sender_id = ? OR m.receiver_id = ?)
          AND m.content LIKE ?
          AND m.deleted_at IS NULL
        ORDER BY m.created_at DESC
        LIMIT ? OFFSET ?
    `).all(req.user.id, req.user.id, `%${q}%`, parseInt(limit), offset);

    res.json({
        success: true,
        data: { messages }
    });
});

/**
 * Obtenir les statistiques de messagerie
 * GET /api/messages/stats
 */
export const getMessageStats = asyncHandler(async (req, res) => {
    const db = getDatabase();

    const stats = {
        total_conversations: db.prepare(`
            SELECT COUNT(*) as count FROM conversations
            WHERE user1_id = ? OR user2_id = ?
        `).get(req.user.id, req.user.id).count,
        total_messages_sent: db.prepare(`
            SELECT COUNT(*) as count FROM messages WHERE sender_id = ?
        `).get(req.user.id).count,
        total_messages_received: db.prepare(`
            SELECT COUNT(*) as count FROM messages WHERE receiver_id = ?
        `).get(req.user.id).count,
        unread_count: db.prepare(`
            SELECT COUNT(*) as count FROM messages
            WHERE receiver_id = ? AND read_at IS NULL
        `).get(req.user.id).count
    };

    res.json({
        success: true,
        data: { stats }
    });
});

/**
 * Obtenir le nombre de messages non lus
 * GET /api/messages/unread/count
 */
export const getUnreadCount = asyncHandler(async (req, res) => {
    const db = getDatabase();

    const count = db.prepare(`
        SELECT COUNT(*) as count FROM messages
        WHERE receiver_id = ? AND read_at IS NULL AND deleted_at IS NULL
    `).get(req.user.id).count;

    res.json({
        success: true,
        data: { count }
    });
});

/**
 * Ajouter une pièce jointe
 * POST /api/messages/:messageId/attachments
 */
export const addAttachment = asyncHandler(async (req, res) => {
    const { messageId } = req.params;
    const { attachment } = req.body; // { url, type, name, size }
    const db = getDatabase();

    const message = db.prepare(`
        SELECT * FROM messages WHERE id = ? AND sender_id = ?
    `).get(messageId, req.user.id);

    if (!message) {
        throw new APIError('Message non trouvé', 404, 'MESSAGE_NOT_FOUND');
    }

    let attachments = message.attachments ? JSON.parse(message.attachments) : [];
    attachments.push(attachment);

    db.prepare('UPDATE messages SET attachments = ? WHERE id = ?').run(JSON.stringify(attachments), messageId);

    res.json({
        success: true,
        message: 'Pièce jointe ajoutée'
    });
});

/**
 * Lister les pièces jointes d'une conversation
 * GET /api/messages/conversations/:conversationId/attachments
 */
export const getConversationAttachments = asyncHandler(async (req, res) => {
    const { conversationId } = req.params;
    const db = getDatabase();

    // Vérifier l'accès
    const conversation = db.prepare(`
        SELECT id FROM conversations
        WHERE id = ? AND (user1_id = ? OR user2_id = ?)
    `).get(conversationId, req.user.id, req.user.id);

    if (!conversation) {
        throw new APIError('Conversation non trouvée', 404, 'CONVERSATION_NOT_FOUND');
    }

    const messages = db.prepare(`
        SELECT id, attachments, created_at, sender_id
        FROM messages
        WHERE conversation_id = ? AND attachments IS NOT NULL
        ORDER BY created_at DESC
    `).all(conversationId);

    const attachments = [];
    for (const msg of messages) {
        try {
            const msgAttachments = JSON.parse(msg.attachments);
            for (const att of msgAttachments) {
                attachments.push({
                    ...att,
                    message_id: msg.id,
                    sender_id: msg.sender_id,
                    created_at: msg.created_at
                });
            }
        } catch {
            // Ignore parsing errors
        }
    }

    res.json({
        success: true,
        data: { attachments }
    });
});

export default {
    getConversations,
    getConversation,
    createConversation,
    deleteConversation,
    archiveConversation,
    unarchiveConversation,
    muteConversation,
    unmuteConversation,
    sendMessage,
    getMessage,
    deleteMessage,
    markAsRead,
    markConversationAsRead,
    searchMessages,
    getMessageStats,
    getUnreadCount,
    addAttachment,
    getConversationAttachments
};
