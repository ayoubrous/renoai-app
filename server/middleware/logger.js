/**
 * RenoAI - Système de Logging
 * Logger personnalisé avec niveaux et formatage
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const LOG_DIR = process.env.LOG_DIR || path.join(__dirname, '../../logs');
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const LOG_TO_FILE = process.env.LOG_TO_FILE === 'true';

// Niveaux de log
const LOG_LEVELS = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4
};

// Couleurs pour la console
const COLORS = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    gray: '\x1b[90m'
};

// Icônes pour les niveaux
const ICONS = {
    error: '❌',
    warn: '⚠️ ',
    info: 'ℹ️ ',
    http: '🌐',
    debug: '🔍'
};

// Couleurs par niveau
const LEVEL_COLORS = {
    error: COLORS.red,
    warn: COLORS.yellow,
    info: COLORS.blue,
    http: COLORS.cyan,
    debug: COLORS.gray
};

// Créer le dossier de logs si nécessaire
if (LOG_TO_FILE && !fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Formater la date
function formatDate(date = new Date()) {
    return date.toISOString();
}

// Formater le message pour la console
function formatConsoleMessage(level, message, meta = {}) {
    const timestamp = formatDate();
    const icon = ICONS[level];
    const color = LEVEL_COLORS[level];
    const levelStr = level.toUpperCase().padEnd(5);

    let output = `${COLORS.gray}${timestamp}${COLORS.reset} ${icon} ${color}${levelStr}${COLORS.reset} ${message}`;

    if (Object.keys(meta).length > 0) {
        const metaStr = JSON.stringify(meta, null, 2)
            .split('\n')
            .map(line => `   ${COLORS.dim}${line}${COLORS.reset}`)
            .join('\n');
        output += `\n${metaStr}`;
    }

    return output;
}

// Formater le message pour les fichiers
function formatFileMessage(level, message, meta = {}) {
    return JSON.stringify({
        timestamp: formatDate(),
        level,
        message,
        ...meta
    });
}

// Écrire dans un fichier
function writeToFile(level, message) {
    if (!LOG_TO_FILE) return;

    const date = new Date().toISOString().split('T')[0];
    const filename = level === 'error' ? `error-${date}.log` : `combined-${date}.log`;
    const filepath = path.join(LOG_DIR, filename);

    fs.appendFileSync(filepath, message + '\n');

    // Toujours écrire les erreurs dans le fichier combiné aussi
    if (level === 'error') {
        const combinedPath = path.join(LOG_DIR, `combined-${date}.log`);
        fs.appendFileSync(combinedPath, message + '\n');
    }
}

// Logger principal
class Logger {
    constructor(options = {}) {
        this.level = options.level || LOG_LEVEL;
        this.prefix = options.prefix || '';
    }

    shouldLog(level) {
        return LOG_LEVELS[level] <= LOG_LEVELS[this.level];
    }

    log(level, message, meta = {}) {
        if (!this.shouldLog(level)) return;

        const fullMessage = this.prefix ? `[${this.prefix}] ${message}` : message;

        // Console
        console.log(formatConsoleMessage(level, fullMessage, meta));

        // Fichier
        if (LOG_TO_FILE) {
            writeToFile(level, formatFileMessage(level, fullMessage, meta));
        }
    }

    error(message, meta = {}) {
        this.log('error', message, meta);
    }

    warn(message, meta = {}) {
        this.log('warn', message, meta);
    }

    info(message, meta = {}) {
        this.log('info', message, meta);
    }

    http(message, meta = {}) {
        this.log('http', message, meta);
    }

    debug(message, meta = {}) {
        this.log('debug', message, meta);
    }

    // Créer un logger enfant avec un préfixe
    child(prefix) {
        return new Logger({
            level: this.level,
            prefix: this.prefix ? `${this.prefix}:${prefix}` : prefix
        });
    }
}

// Instance par défaut
export const logger = new Logger();

// Middleware de logging des requêtes HTTP
export function requestLogger(req, res, next) {
    const start = Date.now();

    // Log de la requête entrante
    const requestId = Math.random().toString(36).substring(7);
    req.requestId = requestId;

    // Capturer la fin de la réponse
    res.on('finish', () => {
        const duration = Date.now() - start;
        const statusCode = res.statusCode;

        // Déterminer le niveau de log selon le status
        let level = 'http';
        if (statusCode >= 500) level = 'error';
        else if (statusCode >= 400) level = 'warn';

        // Couleur du status
        let statusColor = COLORS.green;
        if (statusCode >= 500) statusColor = COLORS.red;
        else if (statusCode >= 400) statusColor = COLORS.yellow;
        else if (statusCode >= 300) statusColor = COLORS.cyan;

        const method = req.method.padEnd(7);
        const url = req.originalUrl;
        const status = `${statusColor}${statusCode}${COLORS.reset}`;
        const durationStr = `${duration}ms`;

        logger.log(level, `${method} ${url} ${status} - ${durationStr}`, {
            requestId,
            method: req.method,
            url: req.originalUrl,
            statusCode,
            duration,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            userId: req.user?.id
        });
    });

    next();
}

// Export pour créer des loggers personnalisés
export function createLogger(prefix) {
    return new Logger({ prefix });
}

export default logger;
