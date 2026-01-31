/**
 * RenoAI - Script d'initialisation de la base de données
 * Utilise les modules ES6 conformément au projet
 */

import 'dotenv/config';
import { initializeDatabase } from './database.js';

async function init() {
    try {
        console.log('Initialisation de la base de données...');
        await initializeDatabase();
        console.log('Base de données initialisée avec succès !');
        process.exit(0);
    } catch (error) {
        console.error('Erreur lors de l\'initialisation:', error);
        process.exit(1);
    }
}

init();
