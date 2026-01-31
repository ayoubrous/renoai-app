/**
 * RenoAI - Validateurs Centralisés
 * Validation des entrées avec express-validator
 */

import { body, param, query, validationResult } from 'express-validator';

// ============================================
// MIDDLEWARE DE VALIDATION
// ============================================

/**
 * Middleware qui vérifie les erreurs de validation
 */
export function validate(req, res, next) {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        const formattedErrors = errors.array().map(err => ({
            field: err.path || err.param,
            message: err.msg,
            value: err.value
        }));

        return res.status(400).json({
            success: false,
            error: 'Données invalides',
            code: 'VALIDATION_ERROR',
            details: formattedErrors
        });
    }

    next();
}

// ============================================
// RÈGLES COMMUNES
// ============================================

// Email valide
export const emailRule = body('email')
    .trim()
    .isEmail()
    .withMessage('Email invalide')
    .normalizeEmail()
    .isLength({ max: 255 })
    .withMessage('Email trop long (max 255 caractères)');

// Mot de passe fort
export const passwordRule = body('password')
    .isLength({ min: 8 })
    .withMessage('Le mot de passe doit contenir au moins 8 caractères')
    .matches(/[a-z]/)
    .withMessage('Le mot de passe doit contenir au moins une minuscule')
    .matches(/[A-Z]/)
    .withMessage('Le mot de passe doit contenir au moins une majuscule')
    .matches(/[0-9]/)
    .withMessage('Le mot de passe doit contenir au moins un chiffre')
    .matches(/[!@#$%^&*(),.?":{}|<>]/)
    .withMessage('Le mot de passe doit contenir au moins un caractère spécial');

// ID MongoDB/UUID
export const idParam = param('id')
    .trim()
    .notEmpty()
    .withMessage('ID requis')
    .matches(/^[a-zA-Z0-9-_]+$/)
    .withMessage('ID invalide');

// Numéro de téléphone Luxembourg
export const phoneRule = body('phone')
    .optional()
    .trim()
    .matches(/^(\+352)?[0-9\s-]{6,15}$/)
    .withMessage('Numéro de téléphone invalide (format Luxembourg)');

// Code postal Luxembourg
export const postalCodeRule = body('postal_code')
    .optional()
    .trim()
    .matches(/^L-?\d{4}$/)
    .withMessage('Code postal invalide (format: L-XXXX)');

// Montant financier
export const amountRule = (field) => body(field)
    .optional()
    .isFloat({ min: 0, max: 10000000 })
    .withMessage(`${field} doit être un montant valide (0 - 10M €)`);

// Pagination
export const paginationRules = [
    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page doit être un entier positif')
        .toInt(),
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit doit être entre 1 et 100')
        .toInt(),
    query('sort')
        .optional()
        .isIn(['asc', 'desc', 'ASC', 'DESC'])
        .withMessage('Sort doit être asc ou desc')
];

// ============================================
// VALIDATEURS PAR ENTITÉ
// ============================================

// --- AUTH ---

export const registerValidation = [
    body('first_name')
        .trim()
        .notEmpty()
        .withMessage('Prénom requis')
        .isLength({ min: 2, max: 50 })
        .withMessage('Prénom: 2-50 caractères')
        .matches(/^[a-zA-ZÀ-ÿ\s'-]+$/)
        .withMessage('Prénom invalide'),

    body('last_name')
        .trim()
        .notEmpty()
        .withMessage('Nom requis')
        .isLength({ min: 2, max: 50 })
        .withMessage('Nom: 2-50 caractères')
        .matches(/^[a-zA-ZÀ-ÿ\s'-]+$/)
        .withMessage('Nom invalide'),

    emailRule,
    passwordRule,
    phoneRule,

    body('user_type')
        .optional()
        .isIn(['client', 'craftsman', 'admin'])
        .withMessage('Type utilisateur invalide'),

    validate
];

export const loginValidation = [
    body('email')
        .trim()
        .notEmpty()
        .withMessage('Email requis')
        .isEmail()
        .withMessage('Email invalide'),

    body('password')
        .notEmpty()
        .withMessage('Mot de passe requis'),

    validate
];

export const changePasswordValidation = [
    body('currentPassword')
        .notEmpty()
        .withMessage('Mot de passe actuel requis'),

    body('newPassword')
        .isLength({ min: 8 })
        .withMessage('Le nouveau mot de passe doit contenir au moins 8 caractères')
        .matches(/[a-z]/)
        .withMessage('Le mot de passe doit contenir au moins une minuscule')
        .matches(/[A-Z]/)
        .withMessage('Le mot de passe doit contenir au moins une majuscule')
        .matches(/[0-9]/)
        .withMessage('Le mot de passe doit contenir au moins un chiffre'),

    body('confirmPassword')
        .custom((value, { req }) => {
            if (value !== req.body.newPassword) {
                throw new Error('Les mots de passe ne correspondent pas');
            }
            return true;
        }),

    validate
];

// --- PROJETS ---

export const createProjectValidation = [
    body('name')
        .trim()
        .notEmpty()
        .withMessage('Nom du projet requis')
        .isLength({ min: 3, max: 100 })
        .withMessage('Nom: 3-100 caractères'),

    body('description')
        .optional()
        .trim()
        .isLength({ max: 2000 })
        .withMessage('Description: max 2000 caractères'),

    body('project_type')
        .notEmpty()
        .withMessage('Type de projet requis')
        .isIn([
            'renovation_complete',
            'renovation_partielle',
            'extension',
            'construction_neuve',
            'amenagement_interieur',
            'renovation_energetique',
            'facade',
            'toiture',
            'autre'
        ])
        .withMessage('Type de projet invalide'),

    body('address')
        .optional()
        .trim()
        .isLength({ max: 255 })
        .withMessage('Adresse: max 255 caractères'),

    postalCodeRule,

    body('city')
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage('Ville: max 100 caractères'),

    body('surface_m2')
        .optional()
        .isFloat({ min: 1, max: 10000 })
        .withMessage('Surface: 1-10000 m²'),

    amountRule('budget_min'),
    amountRule('budget_max'),

    body('priority')
        .optional()
        .isIn(['low', 'medium', 'high', 'urgent'])
        .withMessage('Priorité invalide'),

    validate
];

export const updateProjectValidation = [
    idParam,

    body('name')
        .optional()
        .trim()
        .isLength({ min: 3, max: 100 })
        .withMessage('Nom: 3-100 caractères'),

    body('status')
        .optional()
        .isIn(['draft', 'active', 'in_progress', 'completed', 'cancelled', 'archived'])
        .withMessage('Statut invalide'),

    body('surface_m2')
        .optional()
        .isFloat({ min: 1, max: 10000 })
        .withMessage('Surface: 1-10000 m²'),

    validate
];

// --- DEVIS ---

export const createDevisValidation = [
    body('project_id')
        .notEmpty()
        .withMessage('ID du projet requis'),

    body('title')
        .optional()
        .trim()
        .isLength({ max: 200 })
        .withMessage('Titre: max 200 caractères'),

    body('work_type')
        .notEmpty()
        .withMessage('Type de travaux requis')
        .isIn([
            'plomberie',
            'electricite',
            'peinture',
            'carrelage',
            'menuiserie',
            'maconnerie',
            'isolation',
            'chauffage',
            'toiture',
            'facade',
            'cuisine',
            'salle_de_bain',
            'autre'
        ])
        .withMessage('Type de travaux invalide'),

    body('description')
        .optional()
        .trim()
        .isLength({ max: 5000 })
        .withMessage('Description: max 5000 caractères'),

    body('items')
        .optional()
        .isArray()
        .withMessage('Items doit être un tableau'),

    body('items.*.description')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('Description item: max 500 caractères'),

    body('items.*.quantity')
        .optional()
        .isFloat({ min: 0.01 })
        .withMessage('Quantité doit être positive'),

    body('items.*.unit_price')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Prix unitaire doit être positif'),

    validate
];

export const updateDevisValidation = [
    idParam,

    body('status')
        .optional()
        .isIn(['draft', 'sent', 'accepted', 'rejected', 'expired', 'revised'])
        .withMessage('Statut invalide'),

    body('valid_until')
        .optional()
        .isISO8601()
        .withMessage('Date de validité invalide'),

    validate
];

// --- ARTISANS ---

export const createCraftsmanValidation = [
    body('company_name')
        .trim()
        .notEmpty()
        .withMessage('Nom de l\'entreprise requis')
        .isLength({ min: 2, max: 100 })
        .withMessage('Nom entreprise: 2-100 caractères'),

    body('specialties')
        .isArray({ min: 1 })
        .withMessage('Au moins une spécialité requise'),

    body('specialties.*')
        .isIn([
            'plomberie',
            'electricite',
            'peinture',
            'carrelage',
            'menuiserie',
            'maconnerie',
            'isolation',
            'chauffage',
            'toiture',
            'facade',
            'cuisine',
            'salle_de_bain',
            'general'
        ])
        .withMessage('Spécialité invalide'),

    body('rcs_number')
        .optional()
        .trim()
        .matches(/^B\d{5,6}$/)
        .withMessage('Numéro RCS invalide (format: BXXXXX)'),

    body('tva_number')
        .optional()
        .trim()
        .matches(/^LU\d{8}$/)
        .withMessage('Numéro TVA invalide (format: LUXXXXXXXX)'),

    body('hourly_rate')
        .optional()
        .isFloat({ min: 20, max: 500 })
        .withMessage('Taux horaire: 20-500 €'),

    body('service_area')
        .optional()
        .isArray()
        .withMessage('Zone de service doit être un tableau'),

    validate
];

export const searchCraftsmanValidation = [
    query('specialty')
        .optional()
        .isIn([
            'plomberie', 'electricite', 'peinture', 'carrelage',
            'menuiserie', 'maconnerie', 'isolation', 'chauffage',
            'toiture', 'facade', 'cuisine', 'salle_de_bain', 'general'
        ])
        .withMessage('Spécialité invalide'),

    query('city')
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage('Ville: max 100 caractères'),

    query('rating_min')
        .optional()
        .isFloat({ min: 0, max: 5 })
        .withMessage('Note minimum: 0-5'),

    ...paginationRules,

    validate
];

// --- MESSAGES ---

export const sendMessageValidation = [
    body('recipient_id')
        .notEmpty()
        .withMessage('Destinataire requis'),

    body('content')
        .trim()
        .notEmpty()
        .withMessage('Contenu du message requis')
        .isLength({ min: 1, max: 5000 })
        .withMessage('Message: 1-5000 caractères'),

    body('project_id')
        .optional()
        .notEmpty()
        .withMessage('ID projet invalide'),

    validate
];

// --- UPLOADS ---

export const uploadValidation = [
    body('project_id')
        .optional()
        .notEmpty()
        .withMessage('ID projet invalide'),

    body('devis_id')
        .optional()
        .notEmpty()
        .withMessage('ID devis invalide'),

    body('file_type')
        .optional()
        .isIn(['image', 'document', 'plan', 'other'])
        .withMessage('Type de fichier invalide'),

    validate
];

// --- AI ---

export const aiAnalysisValidation = [
    body('project_id')
        .optional()
        .notEmpty()
        .withMessage('ID projet invalide'),

    body('image_ids')
        .optional()
        .isArray()
        .withMessage('image_ids doit être un tableau'),

    body('prompt')
        .optional()
        .trim()
        .isLength({ max: 2000 })
        .withMessage('Prompt: max 2000 caractères'),

    body('work_type')
        .optional()
        .isIn([
            'plomberie', 'electricite', 'peinture', 'carrelage',
            'menuiserie', 'maconnerie', 'isolation', 'chauffage',
            'toiture', 'facade', 'cuisine', 'salle_de_bain', 'general'
        ])
        .withMessage('Type de travaux invalide'),

    validate
];

// ============================================
// VALIDATEURS UTILITAIRES
// ============================================

/**
 * Crée une règle de validation pour un champ enum
 */
export function enumRule(field, values, options = {}) {
    const { optional = false, location = 'body' } = options;
    const validator = location === 'query' ? query(field) : body(field);

    let rule = validator;

    if (optional) {
        rule = rule.optional();
    } else {
        rule = rule.notEmpty().withMessage(`${field} requis`);
    }

    return rule.isIn(values).withMessage(`${field} invalide. Valeurs: ${values.join(', ')}`);
}

/**
 * Crée une règle de validation pour un champ texte
 */
export function textRule(field, options = {}) {
    const {
        optional = false,
        minLength = 1,
        maxLength = 255,
        pattern = null,
        location = 'body'
    } = options;

    const validator = location === 'query' ? query(field) : body(field);

    let rule = validator.trim();

    if (optional) {
        rule = rule.optional();
    } else {
        rule = rule.notEmpty().withMessage(`${field} requis`);
    }

    rule = rule.isLength({ min: minLength, max: maxLength })
        .withMessage(`${field}: ${minLength}-${maxLength} caractères`);

    if (pattern) {
        rule = rule.matches(pattern).withMessage(`${field} format invalide`);
    }

    return rule;
}

/**
 * Crée une règle de validation pour un nombre
 */
export function numberRule(field, options = {}) {
    const {
        optional = false,
        min = 0,
        max = Number.MAX_SAFE_INTEGER,
        integer = false,
        location = 'body'
    } = options;

    const validator = location === 'query' ? query(field) : body(field);

    let rule = validator;

    if (optional) {
        rule = rule.optional();
    }

    if (integer) {
        rule = rule.isInt({ min, max }).withMessage(`${field}: entier entre ${min} et ${max}`);
    } else {
        rule = rule.isFloat({ min, max }).withMessage(`${field}: nombre entre ${min} et ${max}`);
    }

    return rule;
}

export default {
    validate,
    registerValidation,
    loginValidation,
    changePasswordValidation,
    createProjectValidation,
    updateProjectValidation,
    createDevisValidation,
    updateDevisValidation,
    createCraftsmanValidation,
    searchCraftsmanValidation,
    sendMessageValidation,
    uploadValidation,
    aiAnalysisValidation,
    paginationRules,
    enumRule,
    textRule,
    numberRule
};
