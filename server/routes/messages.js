/**
 * RenoAI - Routes Messages
 * Gestion de la messagerie entre utilisateurs
 */

import { Router } from 'express';
import { body, param, query } from 'express-validator';
import * as messageController from '../controllers/messageController.js';
import { validate } from '../middleware/errorHandler.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// ============================================
// VALIDATIONS
// ============================================

const sendMessageValidation = [
    body('receiver_id')
        .isInt({ min: 1 })
        .withMessage('ID destinataire invalide'),
    body('content')
        .trim()
        .isLength({ min: 1, max: 5000 })
        .withMessage('Le message doit contenir entre 1 et 5000 caractères'),
    body('project_id')
        .optional()
        .isInt({ min: 1 })
        .withMessage('ID projet invalide'),
    body('devis_id')
        .optional()
        .isInt({ min: 1 })
        .withMessage('ID devis invalide'),
    body('attachments')
        .optional()
        .isArray()
        .withMessage('Les pièces jointes doivent être un tableau')
];

const conversationIdValidation = [
    param('conversationId')
        .isInt({ min: 1 })
        .withMessage('ID conversation invalide')
];

const messageIdValidation = [
    param('messageId')
        .isInt({ min: 1 })
        .withMessage('ID message invalide')
];

const paginationValidation = [
    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Numéro de page invalide'),
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limite invalide (1-100)'),
    query('before')
        .optional()
        .isISO8601()
        .withMessage('Date invalide'),
    query('after')
        .optional()
        .isISO8601()
        .withMessage('Date invalide')
];

// ============================================
// ROUTES CONVERSATIONS
// ============================================

// Toutes les routes nécessitent une authentification
router.use(authenticateToken);

/**
 * @route   GET /api/messages/conversations
 * @desc    Lister ses conversations
 * @access  Private
 */
router.get('/conversations', validate(paginationValidation), messageController.getConversations);

/**
 * @route   GET /api/messages/conversations/:conversationId
 * @desc    Obtenir une conversation avec ses messages
 * @access  Private
 */
router.get('/conversations/:conversationId', validate([...conversationIdValidation, ...paginationValidation]), messageController.getConversation);

/**
 * @route   POST /api/messages/conversations
 * @desc    Créer une nouvelle conversation
 * @access  Private
 */
router.post('/conversations', messageController.createConversation);

/**
 * @route   DELETE /api/messages/conversations/:conversationId
 * @desc    Supprimer/quitter une conversation
 * @access  Private
 */
router.delete('/conversations/:conversationId', validate(conversationIdValidation), messageController.deleteConversation);

/**
 * @route   PUT /api/messages/conversations/:conversationId/archive
 * @desc    Archiver une conversation
 * @access  Private
 */
router.put('/conversations/:conversationId/archive', validate(conversationIdValidation), messageController.archiveConversation);

/**
 * @route   PUT /api/messages/conversations/:conversationId/unarchive
 * @desc    Désarchiver une conversation
 * @access  Private
 */
router.put('/conversations/:conversationId/unarchive', validate(conversationIdValidation), messageController.unarchiveConversation);

/**
 * @route   PUT /api/messages/conversations/:conversationId/mute
 * @desc    Mettre une conversation en sourdine
 * @access  Private
 */
router.put('/conversations/:conversationId/mute', validate(conversationIdValidation), messageController.muteConversation);

/**
 * @route   PUT /api/messages/conversations/:conversationId/unmute
 * @desc    Réactiver les notifications d'une conversation
 * @access  Private
 */
router.put('/conversations/:conversationId/unmute', validate(conversationIdValidation), messageController.unmuteConversation);

// ============================================
// ROUTES RECHERCHE & STATISTIQUES (AVANT /:messageId)
// ============================================

/**
 * @route   GET /api/messages/search
 * @desc    Rechercher dans ses messages
 * @access  Private
 */
router.get('/search', messageController.searchMessages);

/**
 * @route   GET /api/messages/stats
 * @desc    Obtenir les statistiques de messagerie
 * @access  Private
 */
router.get('/stats', messageController.getMessageStats);

/**
 * @route   GET /api/messages/unread/count
 * @desc    Obtenir le nombre de messages non lus
 * @access  Private
 */
router.get('/unread/count', messageController.getUnreadCount);

// ============================================
// ROUTES MESSAGES
// ============================================

/**
 * @route   POST /api/messages
 * @desc    Envoyer un message
 * @access  Private
 */
router.post('/', validate(sendMessageValidation), messageController.sendMessage);

/**
 * @route   GET /api/messages/:messageId
 * @desc    Obtenir un message spécifique
 * @access  Private
 */
router.get('/:messageId', validate(messageIdValidation), messageController.getMessage);

/**
 * @route   DELETE /api/messages/:messageId
 * @desc    Supprimer un message
 * @access  Private
 */
router.delete('/:messageId', validate(messageIdValidation), messageController.deleteMessage);

/**
 * @route   PUT /api/messages/:messageId/read
 * @desc    Marquer un message comme lu
 * @access  Private
 */
router.put('/:messageId/read', validate(messageIdValidation), messageController.markAsRead);

/**
 * @route   PUT /api/messages/conversations/:conversationId/read
 * @desc    Marquer tous les messages d'une conversation comme lus
 * @access  Private
 */
router.put('/conversations/:conversationId/read', validate(conversationIdValidation), messageController.markConversationAsRead);

// ============================================
// ROUTES PIÈCES JOINTES
// ============================================

/**
 * @route   POST /api/messages/:messageId/attachments
 * @desc    Ajouter une pièce jointe à un message
 * @access  Private
 */
router.post('/:messageId/attachments', validate(messageIdValidation), messageController.addAttachment);

/**
 * @route   GET /api/messages/conversations/:conversationId/attachments
 * @desc    Lister les pièces jointes d'une conversation
 * @access  Private
 */
router.get('/conversations/:conversationId/attachments', validate(conversationIdValidation), messageController.getConversationAttachments);

export default router;
