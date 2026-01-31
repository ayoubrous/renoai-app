/**
 * RenoAI - Utilitaires Frontend
 * Fonctions helpers communes
 */

// ================================
// FORMATAGE
// ================================

/**
 * Formater un montant en euros
 */
export function formatPrice(amount, options = {}) {
    const { decimals = 2, showSymbol = true } = options;

    const formatted = new Intl.NumberFormat('fr-LU', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(amount || 0);

    return showSymbol ? `${formatted} €` : formatted;
}

/**
 * Formater une date
 */
export function formatDate(date, format = 'short') {
    if (!date) return '';

    const d = new Date(date);
    if (isNaN(d.getTime())) return '';

    const options = {
        short: { day: '2-digit', month: '2-digit', year: 'numeric' },
        long: { day: 'numeric', month: 'long', year: 'numeric' },
        time: { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' },
        relative: null
    };

    if (format === 'relative') {
        return formatRelativeDate(d);
    }

    return new Intl.DateTimeFormat('fr-FR', options[format] || options.short).format(d);
}

/**
 * Formater une date relative (il y a X...)
 */
export function formatRelativeDate(date) {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now - d;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSec < 60) return 'À l\'instant';
    if (diffMin < 60) return `Il y a ${diffMin} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays === 1) return 'Hier';
    if (diffDays < 7) return `Il y a ${diffDays} jours`;

    return formatDate(d, 'short');
}

/**
 * Formater une surface
 */
export function formatSurface(sqm) {
    return `${sqm} m²`;
}

/**
 * Formater un pourcentage
 */
export function formatPercent(value, decimals = 0) {
    return `${value.toFixed(decimals)}%`;
}

// ================================
// VALIDATION
// ================================

/**
 * Valider un email
 */
export function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

/**
 * Valider un numéro de téléphone luxembourgeois
 */
export function isValidPhone(phone) {
    const cleaned = phone.replace(/[\s\-\.\(\)]/g, '');
    // Format luxembourgeois: +352 ou 00352 suivi de 6-9 chiffres
    return /^(\+352|00352)?[0-9]{6,9}$/.test(cleaned);
}

/**
 * Valider un mot de passe (min 8 caractères, 1 majuscule, 1 chiffre)
 */
export function isValidPassword(password) {
    return password.length >= 8 &&
        /[A-Z]/.test(password) &&
        /[0-9]/.test(password);
}

/**
 * Valider un code postal luxembourgeois
 */
export function isValidPostalCode(code) {
    return /^[0-9]{4}$/.test(code);
}

// ================================
// MANIPULATION DE CHAÎNES
// ================================

/**
 * Tronquer un texte
 */
export function truncate(text, maxLength = 100, suffix = '...') {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength - suffix.length).trim() + suffix;
}

/**
 * Capitaliser la première lettre
 */
export function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Convertir en slug
 */
export function slugify(text) {
    return text
        .toString()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/**
 * Générer des initiales
 */
export function getInitials(name, maxLength = 2) {
    if (!name) return '';
    return name
        .split(' ')
        .map(word => word.charAt(0).toUpperCase())
        .slice(0, maxLength)
        .join('');
}

// ================================
// MANIPULATION D'OBJETS
// ================================

/**
 * Copie profonde d'un objet
 */
export function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

/**
 * Fusionner des objets de manière profonde
 */
export function deepMerge(target, ...sources) {
    if (!sources.length) return target;
    const source = sources.shift();

    if (isObject(target) && isObject(source)) {
        for (const key in source) {
            if (isObject(source[key])) {
                if (!target[key]) Object.assign(target, { [key]: {} });
                deepMerge(target[key], source[key]);
            } else {
                Object.assign(target, { [key]: source[key] });
            }
        }
    }

    return deepMerge(target, ...sources);
}

function isObject(item) {
    return item && typeof item === 'object' && !Array.isArray(item);
}

/**
 * Extraire des propriétés d'un objet
 */
export function pick(obj, keys) {
    return keys.reduce((acc, key) => {
        if (key in obj) acc[key] = obj[key];
        return acc;
    }, {});
}

/**
 * Omettre des propriétés d'un objet
 */
export function omit(obj, keys) {
    const keysSet = new Set(keys);
    return Object.fromEntries(
        Object.entries(obj).filter(([key]) => !keysSet.has(key))
    );
}

// ================================
// MANIPULATION DE TABLEAUX
// ================================

/**
 * Grouper par propriété
 */
export function groupBy(array, key) {
    return array.reduce((groups, item) => {
        const value = typeof key === 'function' ? key(item) : item[key];
        (groups[value] = groups[value] || []).push(item);
        return groups;
    }, {});
}

/**
 * Supprimer les doublons
 */
export function unique(array, key = null) {
    if (!key) return [...new Set(array)];
    const seen = new Set();
    return array.filter(item => {
        const value = typeof key === 'function' ? key(item) : item[key];
        if (seen.has(value)) return false;
        seen.add(value);
        return true;
    });
}

/**
 * Trier par propriété
 */
export function sortBy(array, key, order = 'asc') {
    return [...array].sort((a, b) => {
        const valA = typeof key === 'function' ? key(a) : a[key];
        const valB = typeof key === 'function' ? key(b) : b[key];

        if (valA < valB) return order === 'asc' ? -1 : 1;
        if (valA > valB) return order === 'asc' ? 1 : -1;
        return 0;
    });
}

// ================================
// UTILITAIRES ASYNC
// ================================

/**
 * Debounce une fonction
 */
export function debounce(func, wait = 300) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Throttle une fonction
 */
export function throttle(func, limit = 300) {
    let inThrottle;
    return function executedFunction(...args) {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => (inThrottle = false), limit);
        }
    };
}

/**
 * Attendre X millisecondes
 */
export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry une fonction async
 */
export async function retry(fn, maxAttempts = 3, delay = 1000) {
    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            if (attempt < maxAttempts) {
                await sleep(delay * attempt);
            }
        }
    }
    throw lastError;
}

// ================================
// DOM UTILITAIRES
// ================================

/**
 * Créer un élément HTML avec attributs
 */
export function createElement(tag, attributes = {}, children = []) {
    const element = document.createElement(tag);

    for (const [key, value] of Object.entries(attributes)) {
        if (key === 'className') {
            element.className = value;
        } else if (key === 'style' && typeof value === 'object') {
            Object.assign(element.style, value);
        } else if (key.startsWith('on') && typeof value === 'function') {
            element.addEventListener(key.slice(2).toLowerCase(), value);
        } else if (key === 'dataset' && typeof value === 'object') {
            Object.assign(element.dataset, value);
        } else {
            element.setAttribute(key, value);
        }
    }

    children.forEach(child => {
        if (typeof child === 'string') {
            element.appendChild(document.createTextNode(child));
        } else if (child instanceof Node) {
            element.appendChild(child);
        }
    });

    return element;
}

/**
 * Afficher/Masquer un élément avec animation
 */
export function toggleElement(element, show = null) {
    if (show === null) {
        show = element.classList.contains('hidden');
    }

    if (show) {
        element.classList.remove('hidden');
        element.style.opacity = '0';
        requestAnimationFrame(() => {
            element.style.transition = 'opacity 0.3s ease';
            element.style.opacity = '1';
        });
    } else {
        element.style.transition = 'opacity 0.3s ease';
        element.style.opacity = '0';
        setTimeout(() => element.classList.add('hidden'), 300);
    }
}

// ================================
// STORAGE LOCAL
// ================================

/**
 * Stocker avec expiration
 */
export function setStorageWithExpiry(key, value, ttlMs) {
    const item = {
        value,
        expiry: Date.now() + ttlMs
    };
    localStorage.setItem(key, JSON.stringify(item));
}

/**
 * Récupérer avec vérification d'expiration
 */
export function getStorageWithExpiry(key) {
    const itemStr = localStorage.getItem(key);
    if (!itemStr) return null;

    try {
        const item = JSON.parse(itemStr);
        if (Date.now() > item.expiry) {
            localStorage.removeItem(key);
            return null;
        }
        return item.value;
    } catch {
        return null;
    }
}

// ================================
// URL UTILITAIRES
// ================================

/**
 * Parser les paramètres URL
 */
export function getUrlParams() {
    return Object.fromEntries(new URLSearchParams(window.location.search));
}

/**
 * Mettre à jour un paramètre URL sans recharger
 */
export function updateUrlParam(key, value) {
    const url = new URL(window.location);
    if (value === null || value === undefined) {
        url.searchParams.delete(key);
    } else {
        url.searchParams.set(key, value);
    }
    window.history.replaceState({}, '', url);
}

// Export global
window.RenoHelpers = {
    formatPrice,
    formatDate,
    formatRelativeDate,
    formatSurface,
    formatPercent,
    isValidEmail,
    isValidPhone,
    isValidPassword,
    isValidPostalCode,
    truncate,
    capitalize,
    slugify,
    getInitials,
    deepClone,
    deepMerge,
    pick,
    omit,
    groupBy,
    unique,
    sortBy,
    debounce,
    throttle,
    sleep,
    retry,
    createElement,
    toggleElement,
    setStorageWithExpiry,
    getStorageWithExpiry,
    getUrlParams,
    updateUrlParam
};
