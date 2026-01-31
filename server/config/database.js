/**
 * RenoAI - Configuration Base de Données
 * SQLite avec sql.js (pure JavaScript, pas de compilation native)
 */

import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../data/renoai.db');

let db = null;
let SQL = null;

// Logger simple si le module logger n'est pas encore chargé
const log = {
    info: (msg) => console.log(`[DB] ${msg}`),
    error: (msg, data) => console.error(`[DB ERROR] ${msg}`, data || '')
};

/**
 * Initialiser sql.js
 */
async function initSQL() {
    if (!SQL) {
        SQL = await initSqlJs();
    }
    return SQL;
}

/**
 * Obtenir l'instance de la base de données
 */
export function getDatabase() {
    if (!db) {
        throw new Error('Base de données non initialisée. Appelez initializeDatabase() d\'abord.');
    }
    return db;
}

/**
 * Sauvegarder la base de données sur le disque
 */
export function saveDatabase() {
    if (db && db.sqlDb) {
        const data = db.sqlDb.export();
        const buffer = Buffer.from(data);

        // Créer le dossier si nécessaire
        const dir = path.dirname(dbPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(dbPath, buffer);
    }
}

/**
 * Wrapper pour créer une API compatible avec better-sqlite3
 */
class DatabaseWrapper {
    constructor(sqlDb) {
        this.sqlDb = sqlDb;
    }

    prepare(sql) {
        const self = this;
        return {
            run(...params) {
                try {
                    self.sqlDb.run(sql, params);
                    saveDatabase();
                    // Récupérer le lastInsertRowid via SQLite
                    const lastIdStmt = self.sqlDb.prepare('SELECT last_insert_rowid() as id');
                    lastIdStmt.step();
                    const lastId = lastIdStmt.getAsObject().id;
                    lastIdStmt.free();
                    return { changes: self.sqlDb.getRowsModified(), lastInsertRowid: lastId };
                } catch (error) {
                    console.error('SQL Error:', error.message, 'SQL:', sql);
                    throw error;
                }
            },
            get(...params) {
                try {
                    const stmt = self.sqlDb.prepare(sql);
                    stmt.bind(params);
                    if (stmt.step()) {
                        const row = stmt.getAsObject();
                        stmt.free();
                        return row;
                    }
                    stmt.free();
                    return undefined;
                } catch (error) {
                    console.error('SQL Error:', error.message, 'SQL:', sql);
                    throw error;
                }
            },
            all(...params) {
                try {
                    const results = [];
                    const stmt = self.sqlDb.prepare(sql);
                    stmt.bind(params);
                    while (stmt.step()) {
                        results.push(stmt.getAsObject());
                    }
                    stmt.free();
                    return results;
                } catch (error) {
                    console.error('SQL Error:', error.message, 'SQL:', sql);
                    throw error;
                }
            }
        };
    }

    exec(sql) {
        try {
            this.sqlDb.exec(sql);
            saveDatabase();
        } catch (error) {
            // Ne pas logger les erreurs de migration (duplicate column, etc.)
            if (!error.message.includes('duplicate column')) {
                console.error('SQL Exec Error:', error.message);
            }
            throw error;
        }
    }

    pragma(pragma) {
        try {
            this.sqlDb.exec(`PRAGMA ${pragma}`);
        } catch (error) {
            // Les pragmas peuvent échouer silencieusement
        }
    }

    close() {
        saveDatabase();
        this.sqlDb.close();
    }
}

/**
 * Initialiser le schéma de la base de données
 */
export async function initializeDatabase() {
    await initSQL();

    // Créer le dossier data si nécessaire
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    // Charger ou créer la base de données
    let sqlDb;
    if (fs.existsSync(dbPath)) {
        const fileBuffer = fs.readFileSync(dbPath);
        sqlDb = new SQL.Database(fileBuffer);
        log.info('Base de données chargée depuis le disque');
    } else {
        sqlDb = new SQL.Database();
        log.info('Nouvelle base de données créée');
    }

    db = new DatabaseWrapper(sqlDb);

    try {
        // ============================================
        // TABLES UTILISATEURS
        // ============================================

        db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                first_name TEXT NOT NULL,
                last_name TEXT NOT NULL,
                phone TEXT,
                address TEXT,
                city TEXT,
                postal_code TEXT,
                avatar_url TEXT,
                role TEXT DEFAULT 'user',
                status TEXT DEFAULT 'active',
                email_verified INTEGER DEFAULT 0,
                email_verification_token TEXT,
                email_verification_expires TEXT,
                password_reset_token TEXT,
                password_reset_expires TEXT,
                failed_login_attempts INTEGER DEFAULT 0,
                last_failed_login TEXT,
                last_login TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `);

        db.exec(`
            CREATE TABLE IF NOT EXISTS user_preferences (
                id TEXT PRIMARY KEY,
                user_id TEXT UNIQUE NOT NULL,
                notifications_email INTEGER DEFAULT 1,
                notifications_push INTEGER DEFAULT 1,
                notifications_sms INTEGER DEFAULT 0,
                language TEXT DEFAULT 'fr',
                currency TEXT DEFAULT 'EUR',
                theme TEXT DEFAULT 'light',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        db.exec(`
            CREATE TABLE IF NOT EXISTS refresh_tokens (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                token TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                revoked INTEGER DEFAULT 0,
                user_agent TEXT,
                ip_address TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // ============================================
        // TABLES ARTISANS
        // ============================================

        db.exec(`
            CREATE TABLE IF NOT EXISTS craftsmen (
                id TEXT PRIMARY KEY,
                user_id TEXT,
                company_name TEXT NOT NULL,
                siret TEXT,
                description TEXT,
                specialties TEXT,
                experience_years INTEGER DEFAULT 0,
                hourly_rate REAL DEFAULT 0,
                address TEXT,
                city TEXT,
                postal_code TEXT,
                service_radius INTEGER DEFAULT 20,
                rating REAL DEFAULT 0,
                review_count INTEGER DEFAULT 0,
                projects_completed INTEGER DEFAULT 0,
                response_time TEXT,
                verified INTEGER DEFAULT 0,
                availability_status TEXT DEFAULT 'available',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
            )
        `);

        db.exec(`
            CREATE TABLE IF NOT EXISTS craftsman_portfolio (
                id TEXT PRIMARY KEY,
                craftsman_id TEXT NOT NULL,
                title TEXT,
                description TEXT,
                image_url TEXT,
                project_type TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (craftsman_id) REFERENCES craftsmen(id) ON DELETE CASCADE
            )
        `);

        db.exec(`
            CREATE TABLE IF NOT EXISTS craftsman_reviews (
                id TEXT PRIMARY KEY,
                craftsman_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                project_id TEXT,
                rating INTEGER NOT NULL,
                comment TEXT,
                response TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (craftsman_id) REFERENCES craftsmen(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // ============================================
        // TABLES PROJETS
        // ============================================

        db.exec(`
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                name TEXT NOT NULL,
                type TEXT DEFAULT 'renovation',
                description TEXT,
                room_type TEXT,
                work_types TEXT,
                status TEXT DEFAULT 'draft',
                surface_area REAL,
                estimated_budget REAL,
                address TEXT,
                city TEXT,
                postal_code TEXT,
                progress INTEGER DEFAULT 0,
                priority TEXT DEFAULT 'medium',
                target_start_date TEXT,
                target_end_date TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        db.exec(`
            CREATE TABLE IF NOT EXISTS project_craftsmen (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                craftsman_id TEXT NOT NULL,
                role TEXT,
                status TEXT DEFAULT 'pending',
                assigned_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
                FOREIGN KEY (craftsman_id) REFERENCES craftsmen(id) ON DELETE CASCADE
            )
        `);

        db.exec(`
            CREATE TABLE IF NOT EXISTS project_photos (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                url TEXT NOT NULL,
                description TEXT,
                is_primary INTEGER DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            )
        `);

        db.exec(`
            CREATE TABLE IF NOT EXISTS project_timeline (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                event_type TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                event_date TEXT,
                created_by TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            )
        `);

        // ============================================
        // TABLES DEVIS
        // ============================================

        db.exec(`
            CREATE TABLE IF NOT EXISTS devis (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                project_id TEXT,
                title TEXT NOT NULL,
                description TEXT,
                type TEXT DEFAULT 'manual',
                status TEXT DEFAULT 'draft',
                room_type TEXT,
                work_types TEXT,
                surface_area REAL,
                urgency TEXT DEFAULT 'normal',
                quality_level TEXT DEFAULT 'standard',
                subtotal REAL DEFAULT 0,
                tax_rate REAL DEFAULT 17,
                tax_amount REAL DEFAULT 0,
                total_amount REAL DEFAULT 0,
                materials_total REAL DEFAULT 0,
                labor_total REAL DEFAULT 0,
                validity_days INTEGER DEFAULT 30,
                notes TEXT,
                valid_until TEXT,
                ai_analysis TEXT,
                analyzed_at TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
            )
        `);

        db.exec(`
            CREATE TABLE IF NOT EXISTS devis_photos (
                id TEXT PRIMARY KEY,
                devis_id TEXT NOT NULL,
                original_url TEXT NOT NULL,
                description TEXT,
                ai_analysis TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (devis_id) REFERENCES devis(id) ON DELETE CASCADE
            )
        `);

        db.exec(`
            CREATE TABLE IF NOT EXISTS sub_devis (
                id TEXT PRIMARY KEY,
                devis_id TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                work_type TEXT,
                status TEXT DEFAULT 'pending',
                priority INTEGER DEFAULT 0,
                labor_hours REAL DEFAULT 0,
                labor_rate REAL DEFAULT 45,
                labor_cost REAL DEFAULT 0,
                materials_cost REAL DEFAULT 0,
                total_cost REAL DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (devis_id) REFERENCES devis(id) ON DELETE CASCADE
            )
        `);

        db.exec(`
            CREATE TABLE IF NOT EXISTS sub_devis_materials (
                id TEXT PRIMARY KEY,
                sub_devis_id TEXT NOT NULL,
                name TEXT NOT NULL,
                quantity REAL DEFAULT 1,
                unit TEXT DEFAULT 'unité',
                unit_price REAL DEFAULT 0,
                total_price REAL DEFAULT 0,
                brand TEXT,
                reference TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (sub_devis_id) REFERENCES sub_devis(id) ON DELETE CASCADE
            )
        `);

        db.exec(`
            CREATE TABLE IF NOT EXISTS sub_devis_images (
                id TEXT PRIMARY KEY,
                sub_devis_id TEXT NOT NULL,
                url TEXT NOT NULL,
                annotations TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (sub_devis_id) REFERENCES sub_devis(id) ON DELETE CASCADE
            )
        `);

        // ============================================
        // TABLES MESSAGERIE
        // ============================================

        db.exec(`
            CREATE TABLE IF NOT EXISTS conversations (
                id TEXT PRIMARY KEY,
                user1_id TEXT,
                user2_id TEXT,
                craftsman_id TEXT,
                project_id TEXT,
                last_message_at TEXT,
                deleted_by TEXT,
                archived_by TEXT,
                muted_by TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user1_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (user2_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (craftsman_id) REFERENCES craftsmen(id) ON DELETE CASCADE,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
            )
        `);

        db.exec(`
            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                conversation_id TEXT NOT NULL,
                sender_id TEXT,
                receiver_id TEXT,
                sender_type TEXT DEFAULT 'user',
                content TEXT NOT NULL,
                project_id TEXT,
                devis_id TEXT,
                attachments TEXT,
                read_at TEXT,
                deleted_at TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
                FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE SET NULL,
                FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE SET NULL
            )
        `);

        // ============================================
        // TABLES IA
        // ============================================

        db.exec(`
            CREATE TABLE IF NOT EXISTS ai_analyses (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                type TEXT NOT NULL,
                input_data TEXT,
                output_data TEXT,
                status TEXT DEFAULT 'pending',
                error TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                completed_at TEXT,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        db.exec(`
            CREATE TABLE IF NOT EXISTS ai_chat_history (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                context TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // ============================================
        // TABLES UPLOADS
        // ============================================

        db.exec(`
            CREATE TABLE IF NOT EXISTS uploads (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                original_name TEXT NOT NULL,
                filename TEXT NOT NULL,
                path TEXT NOT NULL,
                mimetype TEXT NOT NULL,
                size INTEGER NOT NULL,
                type TEXT DEFAULT 'documents',
                thumbnail_path TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // ============================================
        // INDEX
        // ============================================

        // ============================================
        // MIGRATIONS (ALTER TABLE pour bases existantes)
        // ============================================
        const migrations = [
            // Projects: ajouter colonnes manquantes
            'ALTER TABLE projects ADD COLUMN name TEXT',
            'ALTER TABLE projects ADD COLUMN type TEXT DEFAULT \'renovation\'',
            'ALTER TABLE projects ADD COLUMN city TEXT',
            'ALTER TABLE projects ADD COLUMN postal_code TEXT',
            'ALTER TABLE projects ADD COLUMN estimated_budget REAL',
            'ALTER TABLE projects ADD COLUMN priority TEXT DEFAULT \'medium\'',
            'ALTER TABLE projects ADD COLUMN target_start_date TEXT',
            'ALTER TABLE projects ADD COLUMN target_end_date TEXT',
            // Devis: ajouter colonnes manquantes
            'ALTER TABLE devis ADD COLUMN urgency TEXT DEFAULT \'normal\'',
            'ALTER TABLE devis ADD COLUMN total_amount REAL DEFAULT 0',
            'ALTER TABLE devis ADD COLUMN materials_total REAL DEFAULT 0',
            'ALTER TABLE devis ADD COLUMN labor_total REAL DEFAULT 0',
            'ALTER TABLE devis ADD COLUMN valid_until TEXT',
            // Devis photos: ajouter colonnes manquantes
            'ALTER TABLE devis_photos ADD COLUMN original_url TEXT',
            'ALTER TABLE devis_photos ADD COLUMN description TEXT',
            // Sub devis: ajouter colonnes manquantes
            'ALTER TABLE sub_devis ADD COLUMN labor_hours REAL DEFAULT 0',
            'ALTER TABLE sub_devis ADD COLUMN labor_rate REAL DEFAULT 45',
            'ALTER TABLE sub_devis ADD COLUMN total_cost REAL DEFAULT 0',
            'ALTER TABLE sub_devis ADD COLUMN priority INTEGER DEFAULT 0',
            // Conversations: ajouter colonnes manquantes
            'ALTER TABLE conversations ADD COLUMN deleted_by TEXT',
            'ALTER TABLE conversations ADD COLUMN archived_by TEXT',
            'ALTER TABLE conversations ADD COLUMN muted_by TEXT',
            // Messages: ajouter colonnes manquantes
            'ALTER TABLE messages ADD COLUMN receiver_id TEXT',
            'ALTER TABLE messages ADD COLUMN project_id TEXT',
            'ALTER TABLE messages ADD COLUMN devis_id TEXT',
            'ALTER TABLE messages ADD COLUMN deleted_at TEXT',
            // Users: migration is_verified -> email_verified
            'ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0',
            'ALTER TABLE users ADD COLUMN email_verification_expires TEXT',
            'ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER DEFAULT 0',
            'ALTER TABLE users ADD COLUMN last_failed_login TEXT',
            // Project craftsmen: ajouter role
            'ALTER TABLE project_craftsmen ADD COLUMN role TEXT',
            // Project timeline: ajouter created_by
            'ALTER TABLE project_timeline ADD COLUMN created_by TEXT',
            // Devis: ajouter colonnes AI
            'ALTER TABLE devis ADD COLUMN ai_analysis TEXT',
            'ALTER TABLE devis ADD COLUMN analyzed_at TEXT',
        ];

        for (const migration of migrations) {
            try {
                db.exec(migration);
            } catch {
                // Colonne existe déjà - ignorer
            }
        }

        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
            'CREATE INDEX IF NOT EXISTS idx_craftsmen_city ON craftsmen(city)',
            'CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id)',
            'CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status)',
            'CREATE INDEX IF NOT EXISTS idx_devis_user_id ON devis(user_id)',
            'CREATE INDEX IF NOT EXISTS idx_devis_status ON devis(status)',
            'CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id)',
            'CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON messages(receiver_id)',
            'CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token)'
        ];

        for (const idx of indexes) {
            try {
                db.exec(idx);
            } catch (e) {
                // Index peut déjà exister
            }
        }

        // ============================================
        // UTILISATEUR DÉMO
        // ============================================

        db.exec(`
            INSERT OR IGNORE INTO users (id, email, password, first_name, last_name, role, status, email_verified)
            VALUES ('demo-user', 'demo@renoai.lu', 'no-password', 'Utilisateur', 'Démo', 'user', 'active', 1)
        `);

        saveDatabase();
        log.info('Schéma de base de données initialisé avec succès');

    } catch (error) {
        log.error('Erreur lors de l\'initialisation du schéma', { error: error.message });
        throw error;
    }

    return db;
}

/**
 * Fermer la connexion à la base de données
 */
export function closeDatabase() {
    if (db) {
        saveDatabase();
        db.close();
        db = null;
        log.info('Connexion à la base de données fermée');
    }
}

export default { getDatabase, initializeDatabase, closeDatabase, saveDatabase };
