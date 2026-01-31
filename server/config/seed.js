/**
 * RenoAI - Script de Seed
 * Peuple la base de données avec des données de test
 */

import { getDatabase, initializeDatabase } from './database.js';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

console.log('🌱 Démarrage du seed de la base de données...\n');

// Initialiser la base de données
await initializeDatabase();
const db = getDatabase();

// ============================================
// NETTOYAGE
// ============================================

console.log('🧹 Nettoyage des données existantes...');

const tables = [
    'ai_chat_history',
    'ai_analyses',
    'messages',
    'conversations',
    'sub_devis_materials',
    'sub_devis_images',
    'sub_devis',
    'devis_photos',
    'devis',
    'project_timeline',
    'project_photos',
    'project_craftsmen',
    'projects',
    'craftsman_reviews',
    'craftsman_portfolio',
    'craftsmen',
    'user_preferences',
    'refresh_tokens',
    'users'
];

for (const table of tables) {
    try {
        db.prepare(`DELETE FROM ${table}`).run();
    } catch (e) {
        // Table n'existe peut-être pas
    }
}

// ============================================
// UTILISATEURS
// ============================================

console.log('👤 Création des utilisateurs...');

const users = [
    {
        id: uuidv4(),
        email: 'thomas.muller@email.lu',
        password: await bcrypt.hash('Password123', 10),
        first_name: 'Thomas',
        last_name: 'Muller',
        phone: '+352 621 123 456',
        role: 'user',
        email_verified: true,
        address: '12 Rue de la Gare',
        city: 'Luxembourg',
        postal_code: '1234'
    },
    {
        id: uuidv4(),
        email: 'admin@renoai.lu',
        password: await bcrypt.hash('Admin123!', 10),
        first_name: 'Admin',
        last_name: 'RenoAI',
        phone: '+352 621 000 000',
        role: 'admin',
        email_verified: true,
        address: '1 Place Guillaume II',
        city: 'Luxembourg',
        postal_code: '1648'
    },
    {
        id: uuidv4(),
        email: 'marie.dupont@email.lu',
        password: await bcrypt.hash('Password123', 10),
        first_name: 'Marie',
        last_name: 'Dupont',
        phone: '+352 621 987 654',
        role: 'user',
        email_verified: true,
        address: '45 Avenue de la Liberté',
        city: 'Esch-sur-Alzette',
        postal_code: '4210'
    }
];

const insertUser = db.prepare(`
    INSERT INTO users (id, email, password, first_name, last_name, phone, role, email_verified, address, city, postal_code)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

for (const user of users) {
    insertUser.run(
        user.id, user.email, user.password, user.first_name, user.last_name,
        user.phone, user.role, user.email_verified ? 1 : 0, user.address, user.city, user.postal_code
    );
}

console.log(`   ✓ ${users.length} utilisateurs créés`);

// ============================================
// ARTISANS
// ============================================

console.log('🔧 Création des artisans...');

const craftsmenData = [
    {
        id: uuidv4(),
        user_id: null,
        company_name: 'Martin Plomberie',
        siret: 'LU12345678',
        description: 'Plombier certifié avec 15 ans d\'expérience. Spécialiste en rénovation de salles de bain et installation de systèmes de chauffage.',
        specialties: JSON.stringify(['Plomberie générale', 'Chauffage', 'Sanitaires', 'Dépannage urgent']),
        experience_years: 15,
        hourly_rate: 55,
        address: '78 Rue de Hollerich',
        city: 'Luxembourg-Ville',
        postal_code: '1741',
        service_radius: 30,
        rating: 4.9,
        review_count: 127,
        projects_completed: 234,
        response_time: '2h',
        verified: true,
        availability_status: 'available'
    },
    {
        id: uuidv4(),
        user_id: null,
        company_name: 'Schneider Électricité',
        siret: 'LU23456789',
        description: 'Électricienne agréée spécialisée dans les installations résidentielles et la mise aux normes.',
        specialties: JSON.stringify(['Installation électrique', 'Mise aux normes', 'Domotique', 'Dépannage']),
        experience_years: 12,
        hourly_rate: 50,
        address: '23 Rue de l\'Alzette',
        city: 'Esch-sur-Alzette',
        postal_code: '4011',
        service_radius: 25,
        rating: 4.8,
        review_count: 98,
        projects_completed: 189,
        response_time: '4h',
        verified: true,
        availability_status: 'available'
    },
    {
        id: uuidv4(),
        user_id: null,
        company_name: 'Hoffmann Rénovation',
        siret: 'LU34567890',
        description: 'Entrepreneur général spécialisé dans la rénovation complète. Coordination de tous corps de métiers.',
        specialties: JSON.stringify(['Rénovation complète', 'Gestion de projet', 'Coordination', 'Conseil']),
        experience_years: 20,
        hourly_rate: 65,
        address: '56 Route de Pétange',
        city: 'Differdange',
        postal_code: '4501',
        service_radius: 40,
        rating: 4.9,
        review_count: 215,
        projects_completed: 312,
        response_time: '1h',
        verified: true,
        availability_status: 'available'
    },
    {
        id: uuidv4(),
        user_id: null,
        company_name: 'Weber Design Intérieur',
        siret: 'LU45678901',
        description: 'Designer d\'intérieur créative, spécialisée dans les espaces contemporains et le home staging.',
        specialties: JSON.stringify(['Design intérieur', 'Home staging', 'Plans 3D', 'Conseil déco']),
        experience_years: 8,
        hourly_rate: 70,
        address: '12 Boulevard Royal',
        city: 'Luxembourg-Ville',
        postal_code: '2449',
        service_radius: 35,
        rating: 5.0,
        review_count: 76,
        projects_completed: 145,
        response_time: '3h',
        verified: true,
        availability_status: 'busy'
    },
    {
        id: uuidv4(),
        user_id: null,
        company_name: 'Kremer Carrelage',
        siret: 'LU56789012',
        description: 'Carreleur spécialisé dans les salles de bain et cuisines. Travail soigné et précis.',
        specialties: JSON.stringify(['Carrelage', 'Mosaïque', 'Faïence', 'Pose de sols']),
        experience_years: 10,
        hourly_rate: 45,
        address: '89 Avenue Grande-Duchesse Charlotte',
        city: 'Dudelange',
        postal_code: '3440',
        service_radius: 20,
        rating: 4.7,
        review_count: 89,
        projects_completed: 178,
        response_time: '2h',
        verified: true,
        availability_status: 'available'
    },
    {
        id: uuidv4(),
        user_id: null,
        company_name: 'Klein Peinture',
        siret: 'LU67890123',
        description: 'Peintre décoratrice passionnée par les finitions haut de gamme et les techniques spéciales.',
        specialties: JSON.stringify(['Peinture intérieure', 'Effets décoratifs', 'Papier peint', 'Enduits']),
        experience_years: 14,
        hourly_rate: 40,
        address: '34 Grand-Rue',
        city: 'Ettelbruck',
        postal_code: '9051',
        service_radius: 30,
        rating: 4.8,
        review_count: 156,
        projects_completed: 267,
        response_time: '3h',
        verified: true,
        availability_status: 'available'
    }
];

const insertCraftsman = db.prepare(`
    INSERT INTO craftsmen (id, user_id, company_name, siret, description, specialties, experience_years, hourly_rate,
        address, city, postal_code, service_radius, rating, review_count, projects_completed, response_time, verified, availability_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

for (const c of craftsmenData) {
    insertCraftsman.run(
        c.id, c.user_id, c.company_name, c.siret, c.description, c.specialties, c.experience_years, c.hourly_rate,
        c.address, c.city, c.postal_code, c.service_radius, c.rating, c.review_count, c.projects_completed,
        c.response_time, c.verified ? 1 : 0, c.availability_status
    );
}

console.log(`   ✓ ${craftsmenData.length} artisans créés`);

// ============================================
// PROJETS
// ============================================

console.log('📁 Création des projets...');

const mainUser = users[0];
const projectsData = [
    {
        id: uuidv4(),
        user_id: mainUser.id,
        title: 'Rénovation Cuisine',
        description: 'Rénovation complète de la cuisine avec nouveau plan de travail et électroménagers.',
        room_type: 'kitchen',
        work_types: JSON.stringify(['demolition', 'plumbing', 'electrical', 'tiling', 'carpentry']),
        status: 'in_progress',
        surface_area: 18,
        budget: 15500,
        estimated_cost: 14200,
        address: '12 Rue de la Gare, 1234 Luxembourg',
        progress: 65
    },
    {
        id: uuidv4(),
        user_id: mainUser.id,
        title: 'Salle de bain complète',
        description: 'Nouvelle salle de bain avec douche italienne et double vasque.',
        room_type: 'bathroom',
        work_types: JSON.stringify(['demolition', 'plumbing', 'tiling', 'electrical']),
        status: 'pending',
        surface_area: 8,
        budget: 9000,
        estimated_cost: 8500,
        address: '12 Rue de la Gare, 1234 Luxembourg',
        progress: 0
    },
    {
        id: uuidv4(),
        user_id: mainUser.id,
        title: 'Peinture Salon',
        description: 'Rafraîchissement complet des peintures du salon et de la salle à manger.',
        room_type: 'living_room',
        work_types: JSON.stringify(['painting']),
        status: 'completed',
        surface_area: 35,
        budget: 3500,
        estimated_cost: 3200,
        address: '12 Rue de la Gare, 1234 Luxembourg',
        progress: 100
    }
];

const insertProject = db.prepare(`
    INSERT INTO projects (id, user_id, name, description, room_type, work_types, status, surface_area, estimated_budget, address, progress)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

for (const p of projectsData) {
    insertProject.run(
        p.id, p.user_id, p.title, p.description, p.room_type, p.work_types, p.status,
        p.surface_area, p.budget, p.address, p.progress
    );
}

console.log(`   ✓ ${projectsData.length} projets créés`);

// ============================================
// DEVIS
// ============================================

console.log('📄 Création des devis...');

const devisData = [
    {
        id: uuidv4(),
        user_id: mainUser.id,
        project_id: projectsData[0].id,
        title: 'Devis Cuisine - Phase 1',
        description: 'Travaux de démolition et préparation',
        type: 'ai_generated',
        status: 'accepted',
        room_type: 'kitchen',
        work_types: JSON.stringify(['demolition', 'plumbing']),
        surface_area: 18,
        quality_level: 'standard',
        subtotal: 4500,
        tax_rate: 17,
        tax_amount: 765,
        total: 5265,
        validity_days: 30
    },
    {
        id: uuidv4(),
        user_id: mainUser.id,
        project_id: projectsData[1].id,
        title: 'Devis Salle de bain complète',
        description: 'Rénovation complète avec douche italienne',
        type: 'ai_generated',
        status: 'draft',
        room_type: 'bathroom',
        work_types: JSON.stringify(['demolition', 'plumbing', 'tiling', 'electrical']),
        surface_area: 8,
        quality_level: 'premium',
        subtotal: 8500,
        tax_rate: 17,
        tax_amount: 1445,
        total: 9945,
        validity_days: 30
    }
];

const insertDevis = db.prepare(`
    INSERT INTO devis (id, user_id, project_id, title, description, type, status, room_type, work_types, surface_area, quality_level, subtotal, tax_rate, tax_amount, total_amount, validity_days)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

for (const d of devisData) {
    insertDevis.run(
        d.id, d.user_id, d.project_id, d.title, d.description, d.type, d.status, d.room_type,
        d.work_types, d.surface_area, d.quality_level, d.subtotal, d.tax_rate, d.tax_amount, d.total, d.validity_days
    );
}

console.log(`   ✓ ${devisData.length} devis créés`);

// ============================================
// SOUS-DEVIS
// ============================================

console.log('📋 Création des sous-devis...');

const subDevisData = [
    {
        id: uuidv4(),
        devis_id: devisData[0].id,
        title: 'Démolition et évacuation',
        description: 'Démolition des anciens éléments et évacuation des gravats',
        work_type: 'demolition',
        status: 'completed',
        order_index: 1,
        labor_cost: 450,
        materials_cost: 0,
        total: 450
    },
    {
        id: uuidv4(),
        devis_id: devisData[0].id,
        title: 'Plomberie cuisine',
        description: 'Installation des arrivées et évacuations d\'eau',
        work_type: 'plumbing',
        status: 'in_progress',
        order_index: 2,
        labor_cost: 800,
        materials_cost: 350,
        total: 1150
    },
    {
        id: uuidv4(),
        devis_id: devisData[1].id,
        title: 'Démolition salle de bain',
        description: 'Démolition complète des anciens sanitaires et revêtements',
        work_type: 'demolition',
        status: 'pending',
        order_index: 1,
        labor_cost: 600,
        materials_cost: 0,
        total: 600
    },
    {
        id: uuidv4(),
        devis_id: devisData[1].id,
        title: 'Plomberie complète',
        description: 'Installation douche italienne, WC suspendu, double vasque',
        work_type: 'plumbing',
        status: 'pending',
        order_index: 2,
        labor_cost: 1500,
        materials_cost: 2200,
        total: 3700
    },
    {
        id: uuidv4(),
        devis_id: devisData[1].id,
        title: 'Carrelage sol et murs',
        description: 'Pose de carrelage grand format au sol et faïence aux murs',
        work_type: 'tiling',
        status: 'pending',
        order_index: 3,
        labor_cost: 1200,
        materials_cost: 1800,
        total: 3000
    }
];

const insertSubDevis = db.prepare(`
    INSERT INTO sub_devis (id, devis_id, title, description, work_type, status, priority, labor_cost, materials_cost, total_cost)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

for (const sd of subDevisData) {
    insertSubDevis.run(
        sd.id, sd.devis_id, sd.title, sd.description, sd.work_type, sd.status,
        sd.order_index, sd.labor_cost, sd.materials_cost, sd.total
    );
}

console.log(`   ✓ ${subDevisData.length} sous-devis créés`);

// ============================================
// CONVERSATIONS & MESSAGES
// ============================================

console.log('💬 Création des conversations...');

const conversations = [
    {
        id: uuidv4(),
        user1_id: mainUser.id,
        user2_id: null,
        craftsman_id: craftsmenData[1].id,
        project_id: projectsData[0].id,
        last_message_at: new Date().toISOString()
    }
];

const insertConversation = db.prepare(`
    INSERT INTO conversations (id, user1_id, user2_id, craftsman_id, project_id, last_message_at)
    VALUES (?, ?, ?, ?, ?, ?)
`);

for (const conv of conversations) {
    insertConversation.run(conv.id, conv.user1_id, conv.user2_id, conv.craftsman_id, conv.project_id, conv.last_message_at);
}

// Messages
const messagesData = [
    {
        id: uuidv4(),
        conversation_id: conversations[0].id,
        sender_id: null,
        sender_type: 'craftsman',
        content: 'Bonjour ! J\'ai bien reçu votre demande pour la rénovation de cuisine. Quand pourrions-nous convenir d\'une visite ?',
        created_at: '2025-01-16 09:30:00'
    },
    {
        id: uuidv4(),
        conversation_id: conversations[0].id,
        sender_id: mainUser.id,
        sender_type: 'user',
        content: 'Bonjour Marie, je suis disponible ce samedi matin si cela vous convient.',
        created_at: '2025-01-16 10:15:00'
    },
    {
        id: uuidv4(),
        conversation_id: conversations[0].id,
        sender_id: null,
        sender_type: 'craftsman',
        content: 'Parfait, samedi 10h ça vous va ? Je prendrai les mesures et on discutera du projet en détail.',
        created_at: '2025-01-16 10:45:00'
    },
    {
        id: uuidv4(),
        conversation_id: conversations[0].id,
        sender_id: mainUser.id,
        sender_type: 'user',
        content: 'C\'est noté, à samedi !',
        created_at: '2025-01-16 11:00:00'
    }
];

const insertMessage = db.prepare(`
    INSERT INTO messages (id, conversation_id, sender_id, sender_type, content, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
`);

for (const msg of messagesData) {
    insertMessage.run(msg.id, msg.conversation_id, msg.sender_id, msg.sender_type, msg.content, msg.created_at);
}

console.log(`   ✓ ${conversations.length} conversations créées`);
console.log(`   ✓ ${messagesData.length} messages créés`);

// ============================================
// RÉSUMÉ
// ============================================

console.log('\n✅ Seed terminé avec succès !\n');
console.log('📊 Résumé:');
console.log(`   - ${users.length} utilisateurs`);
console.log(`   - ${craftsmenData.length} artisans`);
console.log(`   - ${projectsData.length} projets`);
console.log(`   - ${devisData.length} devis`);
console.log(`   - ${subDevisData.length} sous-devis`);
console.log(`   - ${messagesData.length} messages`);

console.log('\n🔑 Comptes de test:');
console.log('   Email: thomas.muller@email.lu');
console.log('   Mot de passe: Password123');
console.log('');
console.log('   Email: admin@renoai.lu (admin)');
console.log('   Mot de passe: Admin123!');
console.log('');

process.exit(0);
