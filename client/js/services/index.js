/**
 * RenoAI - Services Client
 * Point d'entrée pour tous les services API
 */

import api from './api.js';
import auth from './auth.js';
import projects from './projects.js';
import devis from './devis.js';
import ai from './ai.js';
import craftsmen from './craftsmen.js';
import messages from './messages.js';
import uploads from './uploads.js';

// Export groupé
const services = {
    api,
    auth,
    projects,
    devis,
    ai,
    craftsmen,
    messages,
    uploads
};

// Export global pour utilisation sans modules
window.RenoServices = services;

export {
    api,
    auth,
    projects,
    devis,
    ai,
    craftsmen,
    messages,
    uploads
};

export default services;
