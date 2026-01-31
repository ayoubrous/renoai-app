/**
 * RenoAI - Service Messages
 * Gestion de la messagerie et des conversations
 */

import api from './api.js';

class MessagesService {
    constructor() {
        this.socket = null;
        this.messageListeners = [];
        this.typingListeners = [];
        this.onlineListeners = [];
    }

    // ================================
    // CONVERSATIONS
    // ================================

    /**
     * Obtenir la liste des conversations
     */
    async getConversations(params = {}) {
        const queryParams = new URLSearchParams();
        if (params.page) queryParams.append('page', params.page);
        if (params.limit) queryParams.append('limit', params.limit);
        if (params.unread_only) queryParams.append('unread_only', 'true');

        const query = queryParams.toString();
        return api.get(`/messages/conversations${query ? `?${query}` : ''}`);
    }

    /**
     * Obtenir une conversation par ID
     */
    async getConversation(conversationId) {
        return api.get(`/messages/conversations/${conversationId}`);
    }

    /**
     * Créer une nouvelle conversation
     */
    async createConversation(participantId, projectId = null, initialMessage = null) {
        return api.post('/messages/conversations', {
            participant_id: participantId,
            project_id: projectId,
            initial_message: initialMessage
        });
    }

    /**
     * Supprimer/Archiver une conversation
     */
    async archiveConversation(conversationId) {
        return api.delete(`/messages/conversations/${conversationId}`);
    }

    /**
     * Marquer une conversation comme lue
     */
    async markConversationAsRead(conversationId) {
        return api.patch(`/messages/conversations/${conversationId}/read`);
    }

    // ================================
    // MESSAGES
    // ================================

    /**
     * Obtenir les messages d'une conversation
     */
    async getMessages(conversationId, params = {}) {
        const queryParams = new URLSearchParams();
        if (params.page) queryParams.append('page', params.page);
        if (params.limit) queryParams.append('limit', params.limit);
        if (params.before) queryParams.append('before', params.before);
        if (params.after) queryParams.append('after', params.after);

        const query = queryParams.toString();
        return api.get(`/messages/conversations/${conversationId}/messages${query ? `?${query}` : ''}`);
    }

    /**
     * Envoyer un message
     */
    async sendMessage(conversationId, content, attachments = []) {
        const messageData = { content };

        if (attachments.length > 0) {
            // Si ce sont des fichiers, les uploader d'abord
            if (attachments[0] instanceof File) {
                const uploadResponse = await api.upload('/uploads/multiple', attachments);
                if (!uploadResponse.success) {
                    throw new Error('Erreur lors de l\'upload des pièces jointes');
                }
                messageData.attachments = uploadResponse.data.files.map(f => f.id);
            } else {
                messageData.attachments = attachments;
            }
        }

        return api.post(`/messages/conversations/${conversationId}/messages`, messageData);
    }

    /**
     * Supprimer un message
     */
    async deleteMessage(conversationId, messageId) {
        return api.delete(`/messages/conversations/${conversationId}/messages/${messageId}`);
    }

    /**
     * Marquer un message comme lu
     */
    async markMessageAsRead(conversationId, messageId) {
        return api.patch(`/messages/conversations/${conversationId}/messages/${messageId}/read`);
    }

    // ================================
    // NOTIFICATIONS
    // ================================

    /**
     * Obtenir le nombre de messages non lus
     */
    async getUnreadCount() {
        return api.get('/messages/unread-count');
    }

    /**
     * Obtenir les notifications
     */
    async getNotifications(params = {}) {
        const queryParams = new URLSearchParams();
        if (params.page) queryParams.append('page', params.page);
        if (params.limit) queryParams.append('limit', params.limit);
        if (params.unread_only) queryParams.append('unread_only', 'true');

        const query = queryParams.toString();
        return api.get(`/messages/notifications${query ? `?${query}` : ''}`);
    }

    /**
     * Marquer toutes les notifications comme lues
     */
    async markAllNotificationsAsRead() {
        return api.patch('/messages/notifications/read-all');
    }

    // ================================
    // WEBSOCKET / TEMPS RÉEL
    // ================================

    /**
     * Connecter au WebSocket
     */
    connectSocket(token) {
        if (this.socket) return;

        const wsUrl = window.location.hostname === 'localhost'
            ? 'http://localhost:5000'
            : window.location.origin;

        // Import dynamique de socket.io-client
        import('https://cdn.socket.io/4.7.4/socket.io.esm.min.js').then(({ io }) => {
            this.socket = io(wsUrl, {
                auth: { token },
                transports: ['websocket', 'polling']
            });

            this.socket.on('connect', () => {
                // connecté
            });

            this.socket.on('disconnect', () => {
                // déconnecté
            });

            this.socket.on('new_message', (message) => {
                this.messageListeners.forEach(cb => cb(message));
            });

            this.socket.on('user_typing', (data) => {
                this.typingListeners.forEach(cb => cb(data));
            });

            this.socket.on('user_online', (data) => {
                this.onlineListeners.forEach(cb => cb(data));
            });
        });
    }

    /**
     * Déconnecter le WebSocket
     */
    disconnectSocket() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }

    /**
     * Joindre une conversation (WebSocket)
     */
    joinConversation(conversationId) {
        if (this.socket) {
            this.socket.emit('join_conversation', conversationId);
        }
    }

    /**
     * Quitter une conversation (WebSocket)
     */
    leaveConversation(conversationId) {
        if (this.socket) {
            this.socket.emit('leave_conversation', conversationId);
        }
    }

    /**
     * Envoyer un indicateur de frappe
     */
    sendTypingIndicator(conversationId, isTyping) {
        if (this.socket) {
            this.socket.emit('typing', { conversationId, isTyping });
        }
    }

    /**
     * Écouter les nouveaux messages
     */
    onNewMessage(callback) {
        this.messageListeners.push(callback);
        return () => {
            this.messageListeners = this.messageListeners.filter(cb => cb !== callback);
        };
    }

    /**
     * Écouter les indicateurs de frappe
     */
    onTyping(callback) {
        this.typingListeners.push(callback);
        return () => {
            this.typingListeners = this.typingListeners.filter(cb => cb !== callback);
        };
    }

    /**
     * Écouter les changements de statut en ligne
     */
    onOnlineStatus(callback) {
        this.onlineListeners.push(callback);
        return () => {
            this.onlineListeners = this.onlineListeners.filter(cb => cb !== callback);
        };
    }

    // ================================
    // RECHERCHE
    // ================================

    /**
     * Rechercher dans les messages
     */
    async searchMessages(query, params = {}) {
        const queryParams = new URLSearchParams({ q: query });
        if (params.conversation_id) queryParams.append('conversation_id', params.conversation_id);
        if (params.page) queryParams.append('page', params.page);
        if (params.limit) queryParams.append('limit', params.limit);

        return api.get(`/messages/search?${queryParams.toString()}`);
    }
}

const messagesService = new MessagesService();
window.RenoMessages = messagesService;
export default messagesService;
