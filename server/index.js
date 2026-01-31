/**
 * RenoAI - Serveur Principal
 * Architecture Express modulaire avec WebSocket, logging et sécurité
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

// Import routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import projectRoutes from './routes/projects.js';
import devisRoutes from './routes/devis.js';
import craftsmenRoutes from './routes/craftsmen.js';
import messageRoutes from './routes/messages.js';
import uploadRoutes from './routes/upload.js';
import aiRoutes from './routes/ai.js';

// Import middleware
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/logger.js';
import { setupSocketAuth } from './middleware/socketAuth.js';
import {
    corsOptions,
    csrfProtection,
    csrfTokenEndpoint,
    validateHeaders,
    sanitizeInput,
    securityHeaders,
    detectAttacks,
    authLimiter,
    uploadLimiter,
    aiLimiter
} from './middleware/security.js';
import {
    registerValidation,
    loginValidation
} from './middleware/validators.js';

// Import database
import { initializeDatabase } from './config/database.js';

// Import WebSocket handlers
import { setupSocketHandlers } from './socket/handlers.js';

// Validation des variables d'environnement requises
const REQUIRED_ENV_VARS = ['JWT_SECRET'];
const missingVars = REQUIRED_ENV_VARS.filter(v => !process.env[v]);
if (missingVars.length > 0) {
    console.error(`FATAL: Missing required environment variables: ${missingVars.join(', ')}`);
    process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);

// WebSocket Server
const io = new SocketServer(httpServer, {
    cors: {
        origin: process.env.CORS_ORIGIN || '*',
        methods: ['GET', 'POST'],
        credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000
});

// Configuration globale
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// ============================================
// MIDDLEWARE DE SÉCURITÉ
// ============================================

// Helmet pour les headers de sécurité
app.use(helmet({
    contentSecurityPolicy: NODE_ENV === 'production' ? undefined : false,
    crossOriginEmbedderPolicy: false
}));

// CORS - Configuration stricte
app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requêtes par fenêtre
    message: {
        success: false,
        error: 'Trop de requêtes, veuillez réessayer plus tard.',
        code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false
});

app.use('/api/', limiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/uploads', uploadLimiter);
app.use('/api/ai', aiLimiter);

// Headers de sécurité personnalisés
app.use(securityHeaders);

// Détection d'attaques
app.use(detectAttacks);

// Validation des headers
app.use(validateHeaders);

// Sanitization des entrées
app.use(sanitizeInput);

// ============================================
// MIDDLEWARE GÉNÉRAUX
// ============================================

// Compression des réponses
app.use(compression());

// Parsing JSON et URL-encoded
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging des requêtes
app.use(requestLogger);

// Fichiers statiques
app.use(express.static(path.join(__dirname, '..'))); // Racine du projet
app.use(express.static(path.join(__dirname, '../public'))); // Dossier public
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ============================================
// HEALTH CHECK & INFO
// ============================================

app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: NODE_ENV,
        version: process.env.npm_package_version || '1.0.0'
    });
});

app.get('/api/info', (req, res) => {
    res.json({
        success: true,
        name: 'RenoAI API',
        version: '1.0.0',
        description: 'Plateforme IA d\'estimation de travaux de rénovation au Luxembourg',
        endpoints: {
            auth: '/api/auth',
            users: '/api/users',
            projects: '/api/projects',
            devis: '/api/devis',
            craftsmen: '/api/craftsmen',
            messages: '/api/messages',
            uploads: '/api/uploads',
            ai: '/api/ai'
        }
    });
});

// Endpoint CSRF Token
app.get('/api/csrf-token', csrfTokenEndpoint);

// ============================================
// ROUTES API
// ============================================

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/devis', devisRoutes);
app.use('/api/craftsmen', craftsmenRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/ai', aiRoutes);

// ============================================
// SERVIR LE FRONTEND
// ============================================

// En production, servir le frontend (SPA fallback)
// Uniquement pour les routes qui ne correspondent pas à des fichiers statiques
app.get('*', (req, res, next) => {
    // Si c'est une requête API, passer au middleware suivant
    if (req.path.startsWith('/api/')) {
        return next();
    }

    // Si c'est un fichier statique (a une extension), laisser passer
    if (req.path.includes('.')) {
        return next();
    }

    // Sinon, servir index.html (SPA routing)
    res.sendFile(path.join(__dirname, '../index.html'));
});

// ============================================
// GESTION DES ERREURS
// ============================================

app.use(notFoundHandler);
app.use(errorHandler);

// ============================================
// WEBSOCKET SETUP
// ============================================

setupSocketAuth(io);
setupSocketHandlers(io);

// Rendre io accessible dans les routes
app.set('io', io);

// ============================================
// DÉMARRAGE DU SERVEUR
// ============================================

async function startServer() {
    try {
        // Initialiser la base de données
        console.log('📦 Initialisation de la base de données...');
        await initializeDatabase();
        console.log('✅ Base de données initialisée');

        // Démarrer le serveur HTTP
        httpServer.listen(PORT, () => {
            console.log('');
            console.log('🏠 ═══════════════════════════════════════════════════════');
            console.log('   RenoAI Server v1.0.0');
            console.log('═══════════════════════════════════════════════════════════');
            console.log(`   🌍 Environment: ${NODE_ENV}`);
            console.log(`   🚀 Server:      http://localhost:${PORT}`);
            console.log(`   📡 WebSocket:   ws://localhost:${PORT}`);
            console.log(`   📚 API Docs:    http://localhost:${PORT}/api/docs`);
            console.log(`   💚 Health:      http://localhost:${PORT}/api/health`);
            console.log('═══════════════════════════════════════════════════════════');
            console.log('');
        });

    } catch (error) {
        console.error('❌ Erreur au démarrage du serveur:', error);
        process.exit(1);
    }
}

// Gestion des signaux de terminaison
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

async function gracefulShutdown() {
    console.log('\n🛑 Arrêt gracieux du serveur...');

    // Fermer les connexions WebSocket
    io.close(() => {
        console.log('📡 Connexions WebSocket fermées');
    });

    // Fermer le serveur HTTP
    httpServer.close(() => {
        console.log('🚪 Serveur HTTP fermé');
        process.exit(0);
    });

    // Force exit après 10 secondes
    setTimeout(() => {
        console.error('⚠️ Fermeture forcée après timeout');
        process.exit(1);
    }, 10000);
}

// Démarrer le serveur
startServer();

export { app, httpServer, io };
