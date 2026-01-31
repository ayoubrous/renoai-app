/* ========================================
   RenoAI - Application JavaScript
   ======================================== */

// ========================================
// Data Store (Simulated Database)
// ========================================

const AppData = {
    user: {
        id: 1,
        firstName: 'Thomas',
        lastName: 'Muller',
        email: 'thomas.muller@email.lu',
        phone: '+352 621 123 456',
        address: '12 Rue de la Gare, 1234 Luxembourg'
    },

    projects: [
        {
            id: 1,
            title: 'Rénovation Cuisine',
            type: 'kitchen',
            status: 'in_progress',
            surface: 18,
            budget: 15500,
            estimatedCost: 14200,
            craftsman: 2,
            createdAt: '2025-01-15',
            progress: 65,
            address: '12 Rue de la Gare, 1234 Luxembourg'
        },
        {
            id: 2,
            title: 'Salle de bain complète',
            type: 'bathroom',
            status: 'pending',
            surface: 8,
            budget: 9000,
            estimatedCost: 8500,
            craftsman: null,
            createdAt: '2025-01-20',
            progress: 0,
            address: '12 Rue de la Gare, 1234 Luxembourg'
        },
        {
            id: 3,
            title: 'Peinture Salon',
            type: 'living',
            status: 'completed',
            surface: 35,
            budget: 3500,
            estimatedCost: 3200,
            craftsman: 4,
            createdAt: '2024-12-01',
            progress: 100,
            address: '12 Rue de la Gare, 1234 Luxembourg'
        }
    ],

    craftsmen: [
        {
            id: 1,
            name: 'Jean-Pierre Martin',
            initials: 'JP',
            specialty: 'Plombier certifié',
            type: 'plumber',
            rating: 4.9,
            reviews: 127,
            projects: 234,
            experience: 15,
            responseTime: '2h',
            hourlyRate: 55,
            location: 'Luxembourg-Ville',
            verified: true,
            pro: true,
            fast: true,
            description: 'Plombier certifié avec 15 ans d\'experience. Specialiste en renovation de salles de bain et installation de systemes de chauffage.',
            skills: ['Plomberie generale', 'Chauffage', 'Sanitaires', 'Depannage urgent'],
            availability: 'Disponible sous 48h'
        },
        {
            id: 2,
            name: 'Marie Schneider',
            initials: 'MS',
            specialty: 'Électricienne agréée',
            type: 'electrician',
            rating: 4.8,
            reviews: 98,
            projects: 189,
            experience: 12,
            responseTime: '4h',
            hourlyRate: 50,
            location: 'Esch-sur-Alzette',
            verified: true,
            pro: true,
            fast: false,
            description: 'Électricienne agréée specialisee dans les installations residentielles et la mise aux normes.',
            skills: ['Installation electrique', 'Mise aux normes', 'Domotique', 'Depannage'],
            availability: 'Disponible la semaine prochaine'
        },
        {
            id: 3,
            name: 'Luc Hoffmann',
            initials: 'LH',
            specialty: 'Rénovation complète',
            type: 'renovation',
            rating: 4.9,
            reviews: 215,
            projects: 312,
            experience: 20,
            responseTime: '1h',
            hourlyRate: 65,
            location: 'Differdange',
            verified: true,
            pro: true,
            fast: true,
            description: 'Entrepreneur general specialise dans la renovation complete. Coordination de tous corps de metiers.',
            skills: ['Rénovation complète', 'Gestion de projet', 'Coordination', 'Conseil'],
            availability: 'Disponible immediatement'
        },
        {
            id: 4,
            name: 'Sophie Weber',
            initials: 'SW',
            specialty: 'Designer d\'interieur',
            type: 'designer',
            rating: 5.0,
            reviews: 76,
            projects: 145,
            experience: 8,
            responseTime: '3h',
            hourlyRate: 70,
            location: 'Luxembourg-Ville',
            verified: true,
            pro: true,
            fast: false,
            description: 'Designer d\'interieur creative, specialisee dans les espaces contemporains et le home staging.',
            skills: ['Design interieur', 'Home staging', 'Plans 3D', 'Conseil deco'],
            availability: 'Consultation sous 72h'
        },
        {
            id: 5,
            name: 'Paul Kremer',
            initials: 'PK',
            specialty: 'Carreleur-Mosaiste',
            type: 'renovation',
            rating: 4.7,
            reviews: 89,
            projects: 178,
            experience: 10,
            responseTime: '2h',
            hourlyRate: 45,
            location: 'Dudelange',
            verified: true,
            pro: false,
            fast: true,
            description: 'Carreleur specialise dans les salles de bain et cuisines. Travail soigne et precis.',
            skills: ['Carrelage', 'Mosaique', 'Faience', 'Pose de sols'],
            availability: 'Disponible sous 1 semaine'
        },
        {
            id: 6,
            name: 'Anna Klein',
            initials: 'AK',
            specialty: 'Peintre décoratrice',
            type: 'painter',
            rating: 4.8,
            reviews: 156,
            projects: 267,
            experience: 14,
            responseTime: '3h',
            hourlyRate: 40,
            location: 'Ettelbruck',
            verified: true,
            pro: true,
            fast: false,
            description: 'Peintre décoratrice passionnee par les finitions haut de gamme et les techniques speciales.',
            skills: ['Peinture interieure', 'Effets decoratifs', 'Papier peint', 'Enduits'],
            availability: 'Planning a voir'
        }
    ],

    messages: [
        {
            id: 1,
            craftsmanId: 2,
            projectId: 1,
            messages: [
                { sender: 'craftsman', text: 'Bonjour ! J\'ai bien recu votre demande pour la renovation de cuisine. Quand pourrions-nous convenir d\'une visite ?', time: '2025-01-16 09:30' },
                { sender: 'user', text: 'Bonjour Marie, je suis disponible ce samedi matin si cela vous convient.', time: '2025-01-16 10:15' },
                { sender: 'craftsman', text: 'Parfait, samedi 10h ca vous va ? Je prendrai les mesures et on discutera du projet en detail.', time: '2025-01-16 10:45' },
                { sender: 'user', text: 'C\'est note, a samedi !', time: '2025-01-16 11:00' }
            ]
        },
        {
            id: 2,
            craftsmanId: 4,
            projectId: 3,
            messages: [
                { sender: 'craftsman', text: 'Les travaux sont termines ! Merci pour votre confiance.', time: '2024-12-20 16:00' },
                { sender: 'user', text: 'Merci Sophie, le resultat est magnifique !', time: '2024-12-20 18:30' }
            ]
        }
    ],

    estimates: [],

    // Estimation pricing data
    pricing: {
        baseRates: {
            kitchen: { min: 400, max: 600, label: 'Cuisine' },
            bathroom: { min: 500, max: 700, label: 'Salle de bain' },
            living: { min: 200, max: 350, label: 'Salon/Sejour' },
            bedroom: { min: 180, max: 300, label: 'Chambre' },
            full: { min: 300, max: 500, label: 'Rénovation complète' }
        },
        materialMultipliers: {
            eco: { value: 0.75, label: 'Economique' },
            standard: { value: 1.0, label: 'Standard' },
            premium: { value: 1.5, label: 'Premium' },
            luxury: { value: 2.2, label: 'Luxe' }
        },
        workTypes: {
            demolition: { perSqm: 25, label: 'Demolition' },
            plumbing: { perSqm: 55, label: 'Plomberie' },
            electrical: { perSqm: 45, label: 'Electricite' },
            flooring: { perSqm: 60, label: 'Revetement sol' },
            painting: { perSqm: 25, label: 'Peinture' },
            tiling: { perSqm: 70, label: 'Carrelage' },
            carpentry: { perSqm: 80, label: 'Menuiserie' }
        }
    }
};

// ========================================
// State Management
// ========================================

const AppState = {
    currentPage: 'dashboard',
    sidebarOpen: false,
    currentEstimate: null,
    estimateStep: 1,
    filters: {
        craftsmen: 'all'
    },
    selectedCraftsman: null,
    activeConversation: null
};

// ========================================
// Utility Functions
// ========================================

function formatCurrency(amount) {
    return new Intl.NumberFormat('fr-LU', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('fr-LU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
}

function formatShortDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('fr-LU', {
        day: '2-digit',
        month: '2-digit'
    });
}

function getStatusLabel(status) {
    const labels = {
        pending: { text: 'En attente', class: 'tag-warning' },
        in_progress: { text: 'En cours', class: 'tag-primary' },
        completed: { text: 'Termine', class: 'tag-success' },
        cancelled: { text: 'Annule', class: 'tag-danger' }
    };
    return labels[status] || { text: status, class: 'tag-gray' };
}

function getTypeIcon(type) {
    const icons = {
        kitchen: 'fa-utensils',
        bathroom: 'fa-bath',
        living: 'fa-couch',
        bedroom: 'fa-bed',
        full: 'fa-home',
        plumber: 'fa-faucet',
        electrician: 'fa-bolt',
        renovation: 'fa-tools',
        designer: 'fa-paint-brush',
        painter: 'fa-paint-roller'
    };
    return icons[type] || 'fa-wrench';
}

function getCraftsman(id) {
    return AppData.craftsmen.find(c => c.id === id);
}

// ========================================
// Navigation
// ========================================

function navigateTo(page, params = {}) {
    AppState.currentPage = page;
    AppState.pageParams = params;

    // Update active nav item
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.page === page) {
            item.classList.add('active');
        }
    });

    // Close sidebar on mobile
    closeSidebar();

    // Render the page
    renderPage();
}

function renderPage() {
    const content = document.getElementById('page-content');
    const pageTitle = document.getElementById('page-title');

    switch (AppState.currentPage) {
        case 'dashboard':
            pageTitle.textContent = 'Tableau de bord';
            content.innerHTML = renderDashboard();
            break;
        case 'devis':
            pageTitle.textContent = 'Devis Intelligent';
            content.innerHTML = initDevisPage();
            break;
        case 'estimator':
            pageTitle.textContent = 'Estimateur Rapide';
            content.innerHTML = renderEstimator();
            initEstimator();
            break;
        case 'projects':
            pageTitle.textContent = 'Mes Projets';
            content.innerHTML = renderProjects();
            break;
        case 'project-detail':
            pageTitle.textContent = 'Detail du Projet';
            content.innerHTML = renderProjectDetail(AppState.pageParams.id);
            break;
        case 'marketplace':
            pageTitle.textContent = 'Trouver un Artisan';
            content.innerHTML = renderMarketplace();
            initMarketplace();
            break;
        case 'craftsman-detail':
            pageTitle.textContent = 'Profil Artisan';
            content.innerHTML = renderCraftsmanDetail(AppState.pageParams.id);
            break;
        case 'messages':
            pageTitle.textContent = 'Messages';
            content.innerHTML = renderMessages();
            initMessages();
            break;
        case 'settings':
            pageTitle.textContent = 'Paramètres';
            content.innerHTML = renderSettings();
            break;
        default:
            content.innerHTML = '<div class="empty-state"><h3>Page non trouvée</h3><p>La page que vous cherchez n\'existe pas ou a été déplacée.</p><button class="btn btn-primary" onclick="navigateTo(\'dashboard\')">Retour au tableau de bord</button></div>';
    }
}

// ========================================
// Sidebar
// ========================================

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('open');
    AppState.sidebarOpen = sidebar.classList.contains('open');
}

function closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.remove('open');
    AppState.sidebarOpen = false;
}

function toggleMobileSearch() {
    const searchBar = document.getElementById('header-search');
    if (searchBar) {
        searchBar.classList.toggle('mobile-open');
        if (searchBar.classList.contains('mobile-open')) {
            const input = searchBar.querySelector('input');
            if (input) input.focus();
        }
    }
}

// ========================================
// Dashboard Page
// ========================================

function renderDashboard() {
    const activeProjects = AppData.projects.filter(p => p.status === 'in_progress').length;
    const totalEstimated = AppData.projects.reduce((sum, p) => sum + p.estimatedCost, 0);
    const completedProjects = AppData.projects.filter(p => p.status === 'completed').length;
    const unreadMessages = 2;

    return `
        <div class="animate-slide">
            <!-- Stats -->
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-card-header">
                        <div class="stat-icon blue"><i class="fas fa-folder-open" aria-hidden="true"></i></div>
                        <div class="stat-trend up"><i class="fas fa-arrow-up" aria-hidden="true"></i> +2</div>
                    </div>
                    <div class="stat-value">${activeProjects}</div>
                    <div class="stat-label">Projets en cours</div>
                </div>
                <div class="stat-card">
                    <div class="stat-card-header">
                        <div class="stat-icon green"><i class="fas fa-euro-sign" aria-hidden="true"></i></div>
                    </div>
                    <div class="stat-value">${formatCurrency(totalEstimated)}</div>
                    <div class="stat-label">Budget total estime</div>
                </div>
                <div class="stat-card">
                    <div class="stat-card-header">
                        <div class="stat-icon purple"><i class="fas fa-check-circle" aria-hidden="true"></i></div>
                    </div>
                    <div class="stat-value">${completedProjects}</div>
                    <div class="stat-label">Projets termines</div>
                </div>
                <div class="stat-card">
                    <div class="stat-card-header">
                        <div class="stat-icon orange"><i class="fas fa-envelope" aria-hidden="true"></i></div>
                        ${unreadMessages > 0 ? `<div class="stat-trend up">${unreadMessages} nouveaux</div>` : ''}
                    </div>
                    <div class="stat-value">${unreadMessages}</div>
                    <div class="stat-label">Messages non lus</div>
                </div>
            </div>

            <!-- CTA Devis IA -->
            <div class="card mb-4 cta-banner">
                <div class="card-body">
                    <div class="flex-between flex-wrap" style="gap: var(--spacing-6);">
                        <div>
                            <h3><i class="fas fa-brain" aria-hidden="true"></i> Devis Intelligent par IA</h3>
                            <p>Uploadez vos photos, décrivez votre problème et notre IA génère automatiquement un devis détaillé avec sous-étapes et suivi.</p>
                        </div>
                        <button class="btn btn-lg btn-cta-inverse" onclick="navigateTo('devis')">
                            <i class="fas fa-magic" aria-hidden="true"></i> Creer un devis
                        </button>
                    </div>
                </div>
            </div>

            <!-- Quick Actions -->
            <div class="card mb-4">
                <div class="card-header">
                    <h3 class="card-title">Actions rapides</h3>
                </div>
                <div class="card-body">
                    <div class="flex gap-2 flex-wrap">
                        <button class="btn btn-primary" onclick="navigateTo('devis')">
                            <i class="fas fa-file-invoice-dollar" aria-hidden="true"></i> Nouveau devis IA
                        </button>
                        <button class="btn btn-secondary" onclick="navigateTo('estimator')">
                            <i class="fas fa-calculator" aria-hidden="true"></i> Estimation rapide
                        </button>
                        <button class="btn btn-secondary" onclick="navigateTo('marketplace')">
                            <i class="fas fa-search" aria-hidden="true"></i> Trouver un artisan
                        </button>
                        <button class="btn btn-secondary" onclick="navigateTo('messages')">
                            <i class="fas fa-envelope" aria-hidden="true"></i> Voir les messages
                        </button>
                    </div>
                </div>
            </div>

            <!-- Projects Grid -->
            <div class="grid-2">
                <!-- Active Projects -->
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Projets actifs</h3>
                        <a href="#" onclick="navigateTo('projects'); return false;" class="btn btn-ghost btn-sm">Voir tout</a>
                    </div>
                    <div class="card-body p-0">
                        ${AppData.projects.filter(p => p.status !== 'completed').slice(0, 3).map(project => `
                            <div class="list-item" onclick="navigateTo('project-detail', {id: ${project.id}})">
                                <div class="flex-between mb-1">
                                    <div class="flex gap-1 items-center">
                                        <i class="fas ${getTypeIcon(project.type)} text-primary" aria-hidden="true"></i>
                                        <strong>${project.title}</strong>
                                    </div>
                                    <span class="tag ${getStatusLabel(project.status).class}">${getStatusLabel(project.status).text}</span>
                                </div>
                                <div class="flex-between list-item-meta">
                                    <span>${project.surface} m² - ${formatCurrency(project.estimatedCost)}</span>
                                    <span>${formatShortDate(project.createdAt)}</span>
                                </div>
                                ${project.progress > 0 ? `
                                    <div class="progress-bar progress-bar-thin mt-1">
                                        <div class="progress-fill" style="width: ${project.progress}%;"></div>
                                    </div>
                                ` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- Recent Craftsmen -->
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">Artisans recommandes</h3>
                        <a href="#" onclick="navigateTo('marketplace'); return false;" class="btn btn-ghost btn-sm">Voir tout</a>
                    </div>
                    <div class="card-body p-0">
                        ${AppData.craftsmen.slice(0, 3).map(craftsman => `
                            <div class="craftsman-list-item" onclick="navigateTo('craftsman-detail', {id: ${craftsman.id}})">
                                <div class="user-avatar">${craftsman.initials}</div>
                                <div class="flex-1">
                                    <div class="font-semibold">${craftsman.name}</div>
                                    <div class="list-item-meta">${craftsman.specialty}</div>
                                </div>
                                <div class="text-right">
                                    <div class="craftsman-rating"><i class="fas fa-star" aria-hidden="true"></i> ${craftsman.rating}</div>
                                    <div class="craftsman-reviews">${craftsman.reviews} avis</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        </div>
    `;
}

// ========================================
// Estimator Page
// ========================================

function renderEstimator() {
    return `
        <div class="animate-slide">
            <!-- Steps -->
            <div class="steps" id="estimator-steps">
                <div class="step active" data-step="1">
                    <div class="step-indicator">1</div>
                    <div class="step-label">Type de projet</div>
                </div>
                <div class="step" data-step="2">
                    <div class="step-indicator">2</div>
                    <div class="step-label">Details</div>
                </div>
                <div class="step" data-step="3">
                    <div class="step-indicator">3</div>
                    <div class="step-label">Travaux</div>
                </div>
                <div class="step" data-step="4">
                    <div class="step-indicator">4</div>
                    <div class="step-label">Resultat</div>
                </div>
            </div>

            <div class="grid-2">
                <!-- Form -->
                <div class="card">
                    <div class="card-body">
                        <!-- Step 1: Type -->
                        <div class="estimator-step" id="step-1">
                            <h3 class="mb-3">Quel type de renovation ?</h3>
                            <div class="selection-grid" id="type-selection">
                                <div class="selection-card" data-value="kitchen" onclick="selectType(this)">
                                    <i class="fas fa-utensils" aria-hidden="true"></i>
                                    <div class="title">Cuisine</div>
                                    <div class="subtitle">Rénovation complète</div>
                                </div>
                                <div class="selection-card" data-value="bathroom" onclick="selectType(this)">
                                    <i class="fas fa-bath" aria-hidden="true"></i>
                                    <div class="title">Salle de bain</div>
                                    <div class="subtitle">SDB & WC</div>
                                </div>
                                <div class="selection-card" data-value="living" onclick="selectType(this)">
                                    <i class="fas fa-couch" aria-hidden="true"></i>
                                    <div class="title">Salon</div>
                                    <div class="subtitle">Piece de vie</div>
                                </div>
                                <div class="selection-card" data-value="bedroom" onclick="selectType(this)">
                                    <i class="fas fa-bed" aria-hidden="true"></i>
                                    <div class="title">Chambre</div>
                                    <div class="subtitle">Espace nuit</div>
                                </div>
                                <div class="selection-card" data-value="full" onclick="selectType(this)">
                                    <i class="fas fa-home" aria-hidden="true"></i>
                                    <div class="title">Complet</div>
                                    <div class="subtitle">Tout l'appartement</div>
                                </div>
                            </div>
                        </div>

                        <!-- Step 2: Details -->
                        <div class="estimator-step hidden" id="step-2">
                            <h3 class="mb-3">Details du projet</h3>
                            <div class="form-group">
                                <label class="form-label">Surface en m² <span class="required">*</span></label>
                                <input type="number" class="form-control" id="est-surface" value="25" min="5" max="500" onchange="updateEstimate()">
                                <div class="form-hint">Surface totale a renover</div>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Code postal <span class="required">*</span></label>
                                <input type="text" class="form-control" id="est-postal" value="1234" placeholder="Ex: 1234" onchange="updateEstimate()">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Gamme de materiaux</label>
                                <div class="selection-grid" id="material-selection">
                                    <div class="selection-card" data-value="eco" onclick="selectMaterial(this)">
                                        <i class="fas fa-leaf" aria-hidden="true"></i>
                                        <div class="title">Eco</div>
                                    </div>
                                    <div class="selection-card selected" data-value="standard" onclick="selectMaterial(this)">
                                        <i class="fas fa-balance-scale" aria-hidden="true"></i>
                                        <div class="title">Standard</div>
                                    </div>
                                    <div class="selection-card" data-value="premium" onclick="selectMaterial(this)">
                                        <i class="fas fa-gem" aria-hidden="true"></i>
                                        <div class="title">Premium</div>
                                    </div>
                                    <div class="selection-card" data-value="luxury" onclick="selectMaterial(this)">
                                        <i class="fas fa-crown" aria-hidden="true"></i>
                                        <div class="title">Luxe</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Step 3: Works -->
                        <div class="estimator-step hidden" id="step-3">
                            <h3 class="mb-3">Travaux a inclure</h3>
                            <div class="selection-grid" id="works-selection">
                                <div class="selection-card selected" data-value="demolition" onclick="toggleWork(this)">
                                    <i class="fas fa-hammer" aria-hidden="true"></i>
                                    <div class="title">Demolition</div>
                                    <div class="subtitle">+25 EUR/m²</div>
                                </div>
                                <div class="selection-card selected" data-value="plumbing" onclick="toggleWork(this)">
                                    <i class="fas fa-faucet" aria-hidden="true"></i>
                                    <div class="title">Plomberie</div>
                                    <div class="subtitle">+55 EUR/m²</div>
                                </div>
                                <div class="selection-card selected" data-value="electrical" onclick="toggleWork(this)">
                                    <i class="fas fa-bolt" aria-hidden="true"></i>
                                    <div class="title">Electricite</div>
                                    <div class="subtitle">+45 EUR/m²</div>
                                </div>
                                <div class="selection-card" data-value="flooring" onclick="toggleWork(this)">
                                    <i class="fas fa-border-all" aria-hidden="true"></i>
                                    <div class="title">Sol</div>
                                    <div class="subtitle">+60 EUR/m²</div>
                                </div>
                                <div class="selection-card selected" data-value="painting" onclick="toggleWork(this)">
                                    <i class="fas fa-paint-roller" aria-hidden="true"></i>
                                    <div class="title">Peinture</div>
                                    <div class="subtitle">+25 EUR/m²</div>
                                </div>
                                <div class="selection-card" data-value="tiling" onclick="toggleWork(this)">
                                    <i class="fas fa-th" aria-hidden="true"></i>
                                    <div class="title">Carrelage</div>
                                    <div class="subtitle">+70 EUR/m²</div>
                                </div>
                            </div>
                        </div>

                        <!-- Step 4: Result -->
                        <div class="estimator-step hidden" id="step-4">
                            <div class="alert alert-success">
                                <i class="fas fa-check-circle" aria-hidden="true"></i>
                                <div class="alert-content">
                                    <div class="alert-title">Estimation terminee !</div>
                                    <div class="alert-message">Votre estimation a ete calculee avec un indice de confiance de 94%.</div>
                                </div>
                            </div>
                            <h3 class="mb-2">Prochaines étapes</h3>
                            <p class="text-muted mb-3">Vous pouvez maintenant creer un projet ou trouver un artisan pour realiser vos travaux.</p>
                            <div class="flex gap-2">
                                <button class="btn btn-primary" onclick="createProjectFromEstimate()">
                                    <i class="fas fa-folder-plus" aria-hidden="true"></i> Creer le projet
                                </button>
                                <button class="btn btn-secondary" onclick="navigateTo('marketplace')">
                                    <i class="fas fa-search" aria-hidden="true"></i> Trouver un artisan
                                </button>
                            </div>
                        </div>

                        <!-- Navigation -->
                        <div class="flex-between mt-4" id="step-navigation">
                            <button class="btn btn-secondary" id="btn-prev" onclick="prevStep()" disabled>
                                <i class="fas fa-arrow-left" aria-hidden="true"></i> Precedent
                            </button>
                            <button class="btn btn-primary" id="btn-next" onclick="nextStep()">
                                Suivant <i class="fas fa-arrow-right" aria-hidden="true"></i>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Result Panel -->
                <div class="card" id="estimate-panel">
                    <div class="card-header">
                        <h3 class="card-title"><i class="fas fa-brain text-primary" aria-hidden="true"></i> Estimation IA</h3>
                        <div id="ai-status" class="tag tag-primary"><i class="fas fa-circle animate-pulse" aria-hidden="true"></i> Calcul en cours</div>
                    </div>
                    <div class="card-body">
                        <div class="estimate-hero">
                            <div class="estimate-hero-label">Prix estime</div>
                            <div id="estimate-price" class="estimate-hero-price">-- EUR</div>
                            <div id="estimate-range" class="estimate-hero-range">Sélectionnez un type de projet</div>
                        </div>

                        <h4 class="mb-2 section-heading-sm">Repartition des couts</h4>
                        <div id="cost-breakdown">
                            <div class="empty-placeholder text-muted">
                                <i class="fas fa-calculator empty-placeholder-icon" aria-hidden="true"></i>
                                Complétez les étapes pour voir la répartition
                            </div>
                        </div>

                        <div class="mt-3" id="confidence-section" style="display: none;">
                            <div class="flex-between mb-1">
                                <span class="font-semibold text-sm">Indice de confiance</span>
                                <span id="confidence-value" class="font-bold text-success">94%</span>
                            </div>
                            <div class="progress-bar">
                                <div class="progress-fill success" id="confidence-bar" style="width: 94%;"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Estimator state
let estimatorData = {
    type: null,
    surface: 25,
    postal: '1234',
    material: 'standard',
    works: ['demolition', 'plumbing', 'electrical', 'painting']
};

function initEstimator() {
    AppState.estimateStep = 1;
    estimatorData = {
        type: null,
        surface: 25,
        postal: '1234',
        material: 'standard',
        works: ['demolition', 'plumbing', 'electrical', 'painting']
    };
}

function selectType(el) {
    document.querySelectorAll('#type-selection .selection-card').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
    estimatorData.type = el.dataset.value;
    updateEstimate();
}

function selectMaterial(el) {
    document.querySelectorAll('#material-selection .selection-card').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
    estimatorData.material = el.dataset.value;
    updateEstimate();
}

function toggleWork(el) {
    el.classList.toggle('selected');
    const value = el.dataset.value;
    if (el.classList.contains('selected')) {
        if (!estimatorData.works.includes(value)) estimatorData.works.push(value);
    } else {
        estimatorData.works = estimatorData.works.filter(w => w !== value);
    }
    updateEstimate();
}

function updateEstimate() {
    estimatorData.surface = parseInt(document.getElementById('est-surface')?.value) || 25;
    estimatorData.postal = document.getElementById('est-postal')?.value || '1234';

    if (!estimatorData.type) {
        document.getElementById('estimate-price').textContent = '-- EUR';
        document.getElementById('estimate-range').textContent = 'Sélectionnez un type de projet';
        return;
    }

    // Calculate
    const pricing = AppData.pricing;
    const baseRate = pricing.baseRates[estimatorData.type];
    const materialMult = pricing.materialMultipliers[estimatorData.material].value;

    let basePrice = ((baseRate.min + baseRate.max) / 2) * estimatorData.surface * materialMult;

    let worksPrice = 0;
    estimatorData.works.forEach(work => {
        if (pricing.workTypes[work]) {
            worksPrice += pricing.workTypes[work].perSqm * estimatorData.surface;
        }
    });

    const totalPrice = Math.round(basePrice + worksPrice);
    const minPrice = Math.round(totalPrice * 0.85);
    const maxPrice = Math.round(totalPrice * 1.15);

    // Update UI
    document.getElementById('estimate-price').textContent = formatCurrency(totalPrice);
    document.getElementById('estimate-range').textContent = `Entre ${formatCurrency(minPrice)} et ${formatCurrency(maxPrice)}`;
    document.getElementById('ai-status').innerHTML = '<i class="fas fa-check-circle" aria-hidden="true"></i> Calcule';
    document.getElementById('ai-status').className = 'tag tag-success';
    document.getElementById('confidence-section').style.display = 'block';

    // Breakdown
    const laborCost = Math.round(totalPrice * 0.35);
    const materialCost = Math.round(basePrice * 0.65);

    let breakdownHTML = `
        <div class="cost-breakdown-item">
            <span><i class="fas fa-tools cost-breakdown-icon" aria-hidden="true"></i> Main d'oeuvre</span>
            <strong>${formatCurrency(laborCost)}</strong>
        </div>
        <div class="cost-breakdown-item">
            <span><i class="fas fa-box cost-breakdown-icon" aria-hidden="true"></i> Materiaux</span>
            <strong>${formatCurrency(materialCost)}</strong>
        </div>
    `;

    estimatorData.works.forEach(work => {
        const workData = pricing.workTypes[work];
        if (workData) {
            const cost = workData.perSqm * estimatorData.surface;
            breakdownHTML += `
                <div class="cost-breakdown-item">
                    <span><i class="fas fa-wrench cost-breakdown-icon secondary" aria-hidden="true"></i> ${workData.label}</span>
                    <strong>${formatCurrency(cost)}</strong>
                </div>
            `;
        }
    });

    document.getElementById('cost-breakdown').innerHTML = breakdownHTML;

    // Store estimate
    AppState.currentEstimate = {
        type: estimatorData.type,
        typeName: pricing.baseRates[estimatorData.type].label,
        surface: estimatorData.surface,
        material: estimatorData.material,
        works: estimatorData.works,
        totalPrice,
        minPrice,
        maxPrice
    };
}

function nextStep() {
    if (AppState.estimateStep === 1 && !estimatorData.type) {
        alert('Veuillez selectionner un type de projet');
        return;
    }

    if (AppState.estimateStep < 4) {
        document.getElementById(`step-${AppState.estimateStep}`).classList.add('hidden');
        AppState.estimateStep++;
        document.getElementById(`step-${AppState.estimateStep}`).classList.remove('hidden');
        updateStepIndicators();
        updateEstimate();
    }

    if (AppState.estimateStep === 4) {
        document.getElementById('btn-next').classList.add('hidden');
    }
}

function prevStep() {
    if (AppState.estimateStep > 1) {
        document.getElementById(`step-${AppState.estimateStep}`).classList.add('hidden');
        AppState.estimateStep--;
        document.getElementById(`step-${AppState.estimateStep}`).classList.remove('hidden');
        updateStepIndicators();
        document.getElementById('btn-next').classList.remove('hidden');
    }
}

function updateStepIndicators() {
    document.querySelectorAll('#estimator-steps .step').forEach((step, index) => {
        step.classList.remove('active', 'completed');
        if (index + 1 < AppState.estimateStep) {
            step.classList.add('completed');
        } else if (index + 1 === AppState.estimateStep) {
            step.classList.add('active');
        }
    });

    document.getElementById('btn-prev').disabled = AppState.estimateStep === 1;
}

function createProjectFromEstimate() {
    if (!AppState.currentEstimate) return;

    const newProject = {
        id: AppData.projects.length + 1,
        title: `${AppState.currentEstimate.typeName} - ${AppState.currentEstimate.surface}m²`,
        type: AppState.currentEstimate.type,
        status: 'pending',
        surface: AppState.currentEstimate.surface,
        budget: AppState.currentEstimate.maxPrice,
        estimatedCost: AppState.currentEstimate.totalPrice,
        craftsman: null,
        createdAt: new Date().toISOString().split('T')[0],
        progress: 0,
        address: AppData.user.address
    };

    AppData.projects.unshift(newProject);
    navigateTo('project-detail', { id: newProject.id });
}

// ========================================
// Projects Page
// ========================================

function renderProjects() {
    return `
        <div class="animate-slide">
            <div class="flex-between mb-4">
                <div class="tabs" style="margin-bottom: 0; border-bottom: none;" role="tablist">
                    <div class="tab active" onclick="filterProjects('all', this)">Tous</div>
                    <div class="tab" onclick="filterProjects('in_progress', this)">En cours</div>
                    <div class="tab" onclick="filterProjects('pending', this)">En attente</div>
                    <div class="tab" onclick="filterProjects('completed', this)">Termines</div>
                </div>
                <button class="btn btn-primary" onclick="navigateTo('estimator')">
                    <i class="fas fa-plus" aria-hidden="true"></i> Nouveau projet
                </button>
            </div>

            <div class="card">
                <div class="table-container">
                    <table class="table" id="projects-table">
                        <thead>
                            <tr>
                                <th>Projet</th>
                                <th>Statut</th>
                                <th>Surface</th>
                                <th>Budget</th>
                                <th>Artisan</th>
                                <th>Progression</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            ${AppData.projects.map(project => {
                                const craftsman = project.craftsman ? getCraftsman(project.craftsman) : null;
                                const status = getStatusLabel(project.status);
                                return `
                                    <tr onclick="navigateTo('project-detail', {id: ${project.id}})" class="cursor-pointer">
                                        <td>
                                            <div class="flex gap-1 items-center">
                                                <i class="fas ${getTypeIcon(project.type)} text-primary" aria-hidden="true"></i>
                                                <div>
                                                    <div class="font-semibold">${project.title}</div>
                                                    <div class="text-muted text-xs">${formatDate(project.createdAt)}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td><span class="tag ${status.class}">${status.text}</span></td>
                                        <td>${project.surface} m²</td>
                                        <td>${formatCurrency(project.estimatedCost)}</td>
                                        <td>${craftsman ? craftsman.name : '<span class="text-muted">Non assigne</span>'}</td>
                                        <td style="width: 150px;">
                                            <div class="flex gap-1 items-center">
                                                <div class="progress-bar flex-1">
                                                    <div class="progress-fill" style="width: ${project.progress}%;"></div>
                                                </div>
                                                <span class="text-xs" style="width: 35px;">${project.progress}%</span>
                                            </div>
                                        </td>
                                        <td>
                                            <button class="btn btn-ghost btn-sm"><i class="fas fa-chevron-right" aria-hidden="true"></i></button>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

function filterProjects(status, tab) {
    document.querySelectorAll('.tabs .tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    const rows = document.querySelectorAll('#projects-table tbody tr');
    rows.forEach(row => {
        if (status === 'all') {
            row.style.display = '';
        } else {
            const projectStatus = row.querySelector('.tag').textContent;
            const statusMap = {
                'in_progress': 'En cours',
                'pending': 'En attente',
                'completed': 'Termine'
            };
            row.style.display = projectStatus === statusMap[status] ? '' : 'none';
        }
    });
}

// ========================================
// Project Detail Page
// ========================================

function renderProjectDetail(projectId) {
    const project = AppData.projects.find(p => p.id === projectId);
    if (!project) return '<div class="empty-state"><h3>Projet non trouve</h3></div>';

    const craftsman = project.craftsman ? getCraftsman(project.craftsman) : null;
    const status = getStatusLabel(project.status);

    return `
        <div class="animate-slide">
            <div class="flex-between mb-4">
                <button class="btn btn-ghost" onclick="navigateTo('projects')">
                    <i class="fas fa-arrow-left" aria-hidden="true"></i> Retour aux projets
                </button>
                <div class="flex gap-1">
                    <button class="btn btn-secondary"><i class="fas fa-edit" aria-hidden="true"></i> Modifier</button>
                    <button class="btn btn-danger"><i class="fas fa-trash" aria-hidden="true"></i> Supprimer</button>
                </div>
            </div>

            <div class="grid-2">
                <div>
                    <div class="card mb-3">
                        <div class="card-header">
                            <h3 class="card-title"><i class="fas ${getTypeIcon(project.type)} text-primary" aria-hidden="true"></i> ${project.title}</h3>
                            <span class="tag ${status.class}">${status.text}</span>
                        </div>
                        <div class="card-body">
                            <div class="grid-2" style="gap: var(--spacing-4);">
                                <div>
                                    <div class="text-muted text-xs">Surface</div>
                                    <div class="font-semibold">${project.surface} m²</div>
                                </div>
                                <div>
                                    <div class="text-muted text-xs">Budget estime</div>
                                    <div class="font-semibold">${formatCurrency(project.estimatedCost)}</div>
                                </div>
                                <div>
                                    <div class="text-muted text-xs">Date de creation</div>
                                    <div class="font-semibold">${formatDate(project.createdAt)}</div>
                                </div>
                                <div>
                                    <div class="text-muted text-xs">Adresse</div>
                                    <div class="font-semibold">${project.address}</div>
                                </div>
                            </div>

                            <div class="mt-3">
                                <div class="flex-between mb-1">
                                    <span class="text-muted">Progression</span>
                                    <span class="font-semibold">${project.progress}%</span>
                                </div>
                                <div class="progress-bar project-progress-bar">
                                    <div class="progress-fill" style="width: ${project.progress}%;"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    ${craftsman ? `
                        <div class="card">
                            <div class="card-header">
                                <h3 class="card-title">Artisan assigne</h3>
                                <button class="btn btn-ghost btn-sm" onclick="navigateTo('craftsman-detail', {id: ${craftsman.id}})">
                                    Voir profil <i class="fas fa-external-link-alt" aria-hidden="true"></i>
                                </button>
                            </div>
                            <div class="card-body">
                                <div class="flex gap-2 items-center">
                                    <div class="user-avatar user-avatar-lg">${craftsman.initials}</div>
                                    <div>
                                        <div class="font-semibold text-lg">${craftsman.name}</div>
                                        <div class="text-muted">${craftsman.specialty}</div>
                                        <div class="craftsman-rating" style="margin-top: var(--spacing-1);">
                                            <i class="fas fa-star" aria-hidden="true"></i> ${craftsman.rating} (${craftsman.reviews} avis)
                                        </div>
                                    </div>
                                </div>
                                <button class="btn btn-primary btn-block mt-3" onclick="openConversation(${craftsman.id}, ${project.id})">
                                    <i class="fas fa-envelope" aria-hidden="true"></i> Contacter
                                </button>
                            </div>
                        </div>
                    ` : `
                        <div class="card">
                            <div class="card-body">
                                <div class="empty-state" style="padding: 2rem;">
                                    <div class="empty-state-icon" style="width: 60px; height: 60px; font-size: 1.5rem;">
                                        <i class="fas fa-user-plus" aria-hidden="true"></i>
                                    </div>
                                    <h3 class="text-sm">Aucun artisan assigne</h3>
                                    <p class="text-sm">Trouvez un professionnel pour realiser vos travaux.</p>
                                    <button class="btn btn-primary" onclick="navigateTo('marketplace')">
                                        <i class="fas fa-search" aria-hidden="true"></i> Trouver un artisan
                                    </button>
                                </div>
                            </div>
                        </div>
                    `}
                </div>

                <div>
                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title">Timeline du projet</h3>
                        </div>
                        <div class="card-body">
                            <div class="timeline">
                                <div class="timeline-item">
                                    <div class="timeline-dot timeline-dot-success"></div>
                                    <div>
                                        <div class="font-semibold">Projet cree</div>
                                        <div class="text-muted text-sm">${formatDate(project.createdAt)}</div>
                                    </div>
                                </div>
                                ${craftsman ? `
                                    <div class="timeline-item">
                                        <div class="timeline-dot timeline-dot-success"></div>
                                        <div>
                                            <div class="font-semibold">Artisan assigne</div>
                                            <div class="text-muted text-sm">${craftsman.name}</div>
                                        </div>
                                    </div>
                                ` : ''}
                                ${project.status === 'in_progress' ? `
                                    <div class="timeline-item">
                                        <div class="timeline-dot timeline-dot-primary animate-pulse"></div>
                                        <div>
                                            <div class="font-semibold">Travaux en cours</div>
                                            <div class="text-muted text-sm">Progression: ${project.progress}%</div>
                                        </div>
                                    </div>
                                ` : ''}
                                ${project.status === 'completed' ? `
                                    <div class="timeline-item">
                                        <div class="timeline-dot timeline-dot-success"></div>
                                        <div>
                                            <div class="font-semibold">Projet termine</div>
                                            <div class="text-muted text-sm">Travaux realises avec succes</div>
                                        </div>
                                    </div>
                                ` : `
                                    <div class="timeline-item">
                                        <div class="timeline-dot timeline-dot-muted"></div>
                                        <div>
                                            <div class="text-muted">Projet termine</div>
                                            <div class="text-muted text-sm">A venir</div>
                                        </div>
                                    </div>
                                `}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// ========================================
// Marketplace Page
// ========================================

function renderMarketplace() {
    return `
        <div class="animate-slide">
            <div class="card mb-4">
                <div class="card-body">
                    <div class="flex gap-2 flex-wrap">
                        <div class="form-group" style="flex: 1; min-width: 200px; margin-bottom: 0;">
                            <input type="text" class="form-control" placeholder="Rechercher un artisan..." id="search-craftsmen" onkeyup="searchCraftsmen()">
                        </div>
                        <select class="form-control" style="width: auto;" id="filter-type" onchange="filterCraftsmenByType()">
                            <option value="all">Tous les metiers</option>
                            <option value="plumber">Plombiers</option>
                            <option value="electrician">Electriciens</option>
                            <option value="renovation">Renovation</option>
                            <option value="designer">Designers</option>
                            <option value="painter">Peintres</option>
                        </select>
                        <select class="form-control" style="width: auto;" id="filter-sort" onchange="sortCraftsmen()">
                            <option value="rating">Mieux notes</option>
                            <option value="reviews">Plus d'avis</option>
                            <option value="price-low">Prix croissant</option>
                            <option value="price-high">Prix decroissant</option>
                        </select>
                    </div>
                </div>
            </div>

            <div class="grid-3" id="craftsmen-grid">
                ${renderCraftsmenCards(AppData.craftsmen)}
            </div>
        </div>
    `;
}

function renderCraftsmenCards(craftsmen) {
    return craftsmen.map(c => `
        <div class="card craftsman-card" onclick="navigateTo('craftsman-detail', {id: ${c.id}})">
            <div class="card-body">
                <div class="craftsman-card-header">
                    <div class="user-avatar user-avatar-md">${c.initials}</div>
                    <div class="flex-1">
                        <div class="font-semibold">${c.name}</div>
                        <div class="text-muted text-sm">${c.specialty}</div>
                        <div class="craftsman-stars">
                            <i class="fas fa-star" aria-hidden="true"></i> ${c.rating} <span class="text-muted">(${c.reviews})</span>
                        </div>
                    </div>
                </div>
                <div class="flex gap-1 mb-3 flex-wrap">
                    ${c.verified ? '<span class="tag tag-success"><i class="fas fa-check-circle" aria-hidden="true"></i> Verifie</span>' : ''}
                    ${c.pro ? '<span class="tag tag-primary"><i class="fas fa-award" aria-hidden="true"></i> Pro</span>' : ''}
                    ${c.fast ? '<span class="tag tag-warning"><i class="fas fa-bolt" aria-hidden="true"></i> Rapide</span>' : ''}
                </div>
                <div class="grid-3 text-center craftsman-stats">
                    <div>
                        <div class="font-bold text-primary">${c.projects}</div>
                        <div class="text-muted text-xs">Projets</div>
                    </div>
                    <div>
                        <div class="font-bold text-primary">${c.experience} ans</div>
                        <div class="text-muted text-xs">Exp.</div>
                    </div>
                    <div>
                        <div class="font-bold text-primary">${c.hourlyRate} EUR</div>
                        <div class="text-muted text-xs">/heure</div>
                    </div>
                </div>
            </div>
            <div class="card-footer craftsman-card-footer">
                <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); navigateTo('craftsman-detail', {id: ${c.id}})">
                    Voir profil
                </button>
                <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); openContactModal(${c.id})">
                    Contacter
                </button>
            </div>
        </div>
    `).join('');
}

function initMarketplace() {
    AppState.filters.craftsmen = 'all';
}

function searchCraftsmen() {
    const query = document.getElementById('search-craftsmen').value.toLowerCase();
    const typeFilter = document.getElementById('filter-type').value;

    let filtered = AppData.craftsmen.filter(c => {
        const matchesSearch = c.name.toLowerCase().includes(query) ||
                             c.specialty.toLowerCase().includes(query);
        const matchesType = typeFilter === 'all' || c.type === typeFilter;
        return matchesSearch && matchesType;
    });

    document.getElementById('craftsmen-grid').innerHTML = renderCraftsmenCards(filtered);
}

function filterCraftsmenByType() {
    searchCraftsmen();
}

function sortCraftsmen() {
    const sortBy = document.getElementById('filter-sort').value;
    const typeFilter = document.getElementById('filter-type').value;
    const query = document.getElementById('search-craftsmen').value.toLowerCase();

    let filtered = AppData.craftsmen.filter(c => {
        const matchesSearch = c.name.toLowerCase().includes(query) ||
                             c.specialty.toLowerCase().includes(query);
        const matchesType = typeFilter === 'all' || c.type === typeFilter;
        return matchesSearch && matchesType;
    });

    switch (sortBy) {
        case 'rating':
            filtered.sort((a, b) => b.rating - a.rating);
            break;
        case 'reviews':
            filtered.sort((a, b) => b.reviews - a.reviews);
            break;
        case 'price-low':
            filtered.sort((a, b) => a.hourlyRate - b.hourlyRate);
            break;
        case 'price-high':
            filtered.sort((a, b) => b.hourlyRate - a.hourlyRate);
            break;
    }

    document.getElementById('craftsmen-grid').innerHTML = renderCraftsmenCards(filtered);
}

// ========================================
// Craftsman Detail Page
// ========================================

function renderCraftsmanDetail(craftsmanId) {
    const c = AppData.craftsmen.find(cr => cr.id === craftsmanId);
    if (!c) return '<div class="empty-state"><h3>Artisan non trouve</h3></div>';

    return `
        <div class="animate-slide">
            <button class="btn btn-ghost mb-4" onclick="navigateTo('marketplace')">
                <i class="fas fa-arrow-left" aria-hidden="true"></i> Retour a la liste
            </button>

            <div class="craftsman-detail-grid">
                <div>
                    <div class="card mb-3">
                        <div class="card-body">
                            <div class="flex gap-3 items-start">
                                <div class="user-avatar user-avatar-xl">${c.initials}</div>
                                <div class="flex-1">
                                    <div class="craftsman-detail-name">${c.name}</div>
                                    <div class="text-muted craftsman-detail-specialty">${c.specialty}</div>
                                    <div class="flex gap-2 mt-2 items-center">
                                        <div class="craftsman-detail-stars">
                                            ${'<i class="fas fa-star" aria-hidden="true"></i>'.repeat(Math.floor(c.rating))}
                                            ${c.rating % 1 >= 0.5 ? '<i class="fas fa-star-half-alt" aria-hidden="true"></i>' : ''}
                                        </div>
                                        <span class="font-semibold">${c.rating}</span>
                                        <span class="text-muted">(${c.reviews} avis)</span>
                                    </div>
                                    <div class="flex gap-1 mt-2">
                                        ${c.verified ? '<span class="tag tag-success"><i class="fas fa-check-circle" aria-hidden="true"></i> Verifie</span>' : ''}
                                        ${c.pro ? '<span class="tag tag-primary"><i class="fas fa-award" aria-hidden="true"></i> Pro</span>' : ''}
                                        ${c.fast ? '<span class="tag tag-warning"><i class="fas fa-bolt" aria-hidden="true"></i> Rapide</span>' : ''}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="card mb-3">
                        <div class="card-header">
                            <h3 class="card-title">A propos</h3>
                        </div>
                        <div class="card-body">
                            <p>${c.description}</p>
                            <h4 class="mt-3 mb-2 text-sm">Competences</h4>
                            <div class="flex gap-1 flex-wrap">
                                ${c.skills.map(skill => `<span class="tag tag-gray">${skill}</span>`).join('')}
                            </div>
                        </div>
                    </div>

                    <div class="card">
                        <div class="card-header">
                            <h3 class="card-title">Avis clients</h3>
                        </div>
                        <div class="card-body">
                            ${[
                                { name: 'Marc D.', rating: 5, text: 'Excellent travail, tres professionnel et ponctuel. Je recommande !', date: '15/01/2025' },
                                { name: 'Sophie L.', rating: 5, text: 'Travail soigne et prix respecte. Communication parfaite.', date: '08/01/2025' },
                                { name: 'Pierre M.', rating: 4, text: 'Bon travail dans l\'ensemble, quelques retards mais resultat impeccable.', date: '20/12/2024' }
                            ].map(review => `
                                <div class="review-item">
                                    <div class="flex-between mb-1">
                                        <div class="font-semibold">${review.name}</div>
                                        <div class="review-stars">
                                            ${'<i class="fas fa-star" aria-hidden="true"></i>'.repeat(review.rating)}
                                        </div>
                                    </div>
                                    <p class="text-muted review-text">${review.text}</p>
                                    <div class="text-muted review-date">${review.date}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>

                <div>
                    <div class="card sticky-sidebar">
                        <div class="card-body">
                            <div class="grid-2 text-center mb-4" style="gap: 1rem;">
                                <div class="stat-box">
                                    <div class="font-bold text-primary stat-box-value">${c.projects}</div>
                                    <div class="text-muted text-xs">Projets realises</div>
                                </div>
                                <div class="stat-box">
                                    <div class="font-bold text-primary stat-box-value">${c.experience} ans</div>
                                    <div class="text-muted text-xs">Experience</div>
                                </div>
                            </div>

                            <div class="rate-box">
                                <div class="flex-between">
                                    <span>Tarif horaire</span>
                                    <span class="font-bold text-primary rate-box-value">${c.hourlyRate} EUR/h</span>
                                </div>
                            </div>

                            <div class="mb-5">
                                <div class="flex gap-1 mb-2 items-center">
                                    <i class="fas fa-map-marker-alt text-muted" aria-hidden="true"></i>
                                    <span>${c.location}</span>
                                </div>
                                <div class="flex gap-1 mb-2 items-center">
                                    <i class="fas fa-clock text-muted" aria-hidden="true"></i>
                                    <span>Repond en ${c.responseTime}</span>
                                </div>
                                <div class="flex gap-1 items-center">
                                    <i class="fas fa-calendar-check text-muted" aria-hidden="true"></i>
                                    <span>${c.availability}</span>
                                </div>
                            </div>

                            <button class="btn btn-primary btn-block btn-lg" onclick="openContactModal(${c.id})">
                                <i class="fas fa-envelope" aria-hidden="true"></i> Contacter
                            </button>
                            <button class="btn btn-secondary btn-block mt-2" onclick="requestQuote(${c.id})">
                                <i class="fas fa-file-invoice" aria-hidden="true"></i> Demander un devis
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// ========================================
// Messages Page
// ========================================

function renderMessages() {
    return `
        <div class="animate-slide messages-layout">
            <!-- Conversations List -->
            <div class="card chat-container">
                <div class="card-header">
                    <h3 class="card-title">Conversations</h3>
                </div>
                <div class="flex-1" style="overflow-y: auto;">
                    ${AppData.messages.map(conv => {
                        const craftsman = getCraftsman(conv.craftsmanId);
                        const project = AppData.projects.find(p => p.id === conv.projectId);
                        const lastMessage = conv.messages[conv.messages.length - 1];
                        return `
                            <div class="conversation-item ${AppState.activeConversation === conv.id ? 'active' : ''}"
                                 onclick="selectConversation(${conv.id})">
                                <div class="flex gap-2 items-center">
                                    <div class="user-avatar user-avatar-sm">${craftsman.initials}</div>
                                    <div class="flex-1 min-w-0">
                                        <div class="flex-between">
                                            <div class="font-semibold">${craftsman.name}</div>
                                            <div class="text-muted text-xs">${lastMessage.time.split(' ')[1]}</div>
                                        </div>
                                        <div class="text-muted conversation-preview">
                                            ${project.title}
                                        </div>
                                        <div class="conversation-last-msg">
                                            ${lastMessage.text.substring(0, 40)}...
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>

            <!-- Chat Area -->
            <div class="card chat-container" id="chat-area">
                ${AppState.activeConversation ? renderChatArea(AppState.activeConversation) : `
                    <div class="card-body flex-center flex-1">
                        <div class="text-center text-muted">
                            <i class="fas fa-comments chat-empty-icon" aria-hidden="true"></i>
                            <p>Sélectionnez une conversation</p>
                        </div>
                    </div>
                `}
            </div>
        </div>
    `;
}

function renderChatArea(conversationId) {
    const conv = AppData.messages.find(m => m.id === conversationId);
    if (!conv) return '';

    const craftsman = getCraftsman(conv.craftsmanId);
    const project = AppData.projects.find(p => p.id === conv.projectId);

    return `
        <div class="card-header chat-header">
            <div class="flex gap-2 items-center">
                <div class="user-avatar">${craftsman.initials}</div>
                <div>
                    <div class="font-semibold">${craftsman.name}</div>
                    <div class="text-muted text-xs">${project.title}</div>
                </div>
            </div>
            <button class="btn btn-ghost btn-sm" onclick="navigateTo('craftsman-detail', {id: ${craftsman.id}})">
                Voir profil <i class="fas fa-external-link-alt" aria-hidden="true"></i>
            </button>
        </div>
        <div class="card-body chat-messages" id="messages-container">
            ${conv.messages.map(msg => `
                <div class="chat-bubble-wrap ${msg.sender === 'user' ? 'chat-bubble-wrap-sent' : 'chat-bubble-wrap-received'}">
                    <div class="chat-bubble ${msg.sender === 'user' ? 'chat-bubble-sent' : 'chat-bubble-received'}">
                        <div class="chat-bubble-text">${msg.text}</div>
                        <div class="chat-bubble-time">${msg.time.split(' ')[1]}</div>
                    </div>
                </div>
            `).join('')}
        </div>
        <div class="card-footer chat-footer">
            <div class="flex gap-2">
                <input type="text" class="form-control" placeholder="Ecrivez votre message..." id="message-input" onkeypress="if(event.key==='Enter') sendMessage(${conversationId})">
                <button class="btn btn-primary" onclick="sendMessage(${conversationId})">
                    <i class="fas fa-paper-plane" aria-hidden="true"></i>
                </button>
            </div>
        </div>
    `;
}

function initMessages() {
    if (AppData.messages.length > 0 && !AppState.activeConversation) {
        AppState.activeConversation = AppData.messages[0].id;
        renderPage();
    }
}

function selectConversation(id) {
    AppState.activeConversation = id;
    document.getElementById('chat-area').innerHTML = renderChatArea(id);

    // Update active state
    document.querySelectorAll('.conversation-item').forEach(item => {
        item.classList.remove('active');
        item.style.background = '';
    });
    event.currentTarget.classList.add('active');
    event.currentTarget.style.background = 'var(--primary-50)';

    // Scroll to bottom
    const container = document.getElementById('messages-container');
    container.scrollTop = container.scrollHeight;
}

function sendMessage(conversationId) {
    const input = document.getElementById('message-input');
    const text = input.value.trim();
    if (!text) return;

    const conv = AppData.messages.find(m => m.id === conversationId);
    conv.messages.push({
        sender: 'user',
        text: text,
        time: new Date().toISOString().replace('T', ' ').substring(0, 16)
    });

    input.value = '';
    document.getElementById('chat-area').innerHTML = renderChatArea(conversationId);

    const container = document.getElementById('messages-container');
    container.scrollTop = container.scrollHeight;
}

function openConversation(craftsmanId, projectId) {
    let conv = AppData.messages.find(m => m.craftsmanId === craftsmanId && m.projectId === projectId);

    if (!conv) {
        conv = {
            id: AppData.messages.length + 1,
            craftsmanId,
            projectId,
            messages: []
        };
        AppData.messages.push(conv);
    }

    AppState.activeConversation = conv.id;
    navigateTo('messages');
}

// ========================================
// Settings Page
// ========================================

function renderSettings() {
    const user = AppData.user;

    return `
        <div class="animate-slide">
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">Informations personnelles</h3>
                </div>
                <div class="card-body">
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Prénom</label>
                            <input type="text" class="form-control" value="${user.firstName}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Nom</label>
                            <input type="text" class="form-control" value="${user.lastName}">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Email</label>
                            <input type="email" class="form-control" value="${user.email}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Téléphone</label>
                            <input type="tel" class="form-control" value="${user.phone}">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Adresse</label>
                        <input type="text" class="form-control" value="${user.address}">
                    </div>
                </div>
                <div class="card-footer">
                    <button class="btn btn-primary">
                        <i class="fas fa-save" aria-hidden="true"></i> Enregistrer
                    </button>
                </div>
            </div>

            <div class="card mt-4">
                <div class="card-header">
                    <h3 class="card-title">Notifications</h3>
                </div>
                <div class="card-body">
                    <div class="form-check mb-3">
                        <input type="checkbox" id="notif-email" checked>
                        <label class="form-check-label" for="notif-email">
                            <strong>Notifications par email</strong>
                            <div class="text-muted text-sm">Recevez des mises à jour sur vos projets par email</div>
                        </label>
                    </div>
                    <div class="form-check mb-3">
                        <input type="checkbox" id="notif-sms">
                        <label class="form-check-label" for="notif-sms">
                            <strong>Notifications SMS</strong>
                            <div class="text-muted text-sm">Recevez des alertes importantes par SMS</div>
                        </label>
                    </div>
                    <div class="form-check">
                        <input type="checkbox" id="notif-marketing" checked>
                        <label class="form-check-label" for="notif-marketing">
                            <strong>Communications marketing</strong>
                            <div class="text-muted text-sm">Recevez nos offres et actualités</div>
                        </label>
                    </div>
                </div>
            </div>

            <div class="card mt-4">
                <div class="card-header">
                    <h3 class="card-title">Sécurité</h3>
                </div>
                <div class="card-body">
                    <button class="btn btn-secondary mb-3">
                        <i class="fas fa-key" aria-hidden="true"></i> Changer le mot de passe
                    </button>
                    <div class="alert alert-info">
                        <i class="fas fa-shield-alt" aria-hidden="true"></i>
                        <div class="alert-content">
                            <div class="alert-title">Authentification à deux facteurs</div>
                            <div class="alert-message">Renforcez la sécurité de votre compte en activant la 2FA.</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// ========================================
// Modals
// ========================================

function openContactModal(craftsmanId) {
    const craftsman = getCraftsman(craftsmanId);

    const modalHTML = `
        <div class="modal-overlay active" id="contact-modal" onclick="if(event.target === this) closeModal('contact-modal')">
            <div class="modal">
                <div class="modal-header">
                    <h3 class="modal-title">Contacter ${craftsman.name}</h3>
                    <button class="modal-close" onclick="closeModal('contact-modal')"><i class="fas fa-times" aria-hidden="true"></i></button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label class="form-label">Projet concerné <span class="required">*</span></label>
                        <select class="form-control">
                            <option value="">Sélectionnez un projet</option>
                            ${AppData.projects.filter(p => p.status !== 'completed').map(p => `
                                <option value="${p.id}">${p.title}</option>
                            `).join('')}
                            <option value="new">+ Nouveau projet</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Votre message <span class="required">*</span></label>
                        <textarea class="form-control" placeholder="Decrivez votre projet et vos besoins..."></textarea>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Budget approximatif</label>
                        <select class="form-control">
                            <option value="">Non specifie</option>
                            <option value="5000">Moins de 5 000 EUR</option>
                            <option value="10000">5 000 - 10 000 EUR</option>
                            <option value="20000">10 000 - 20 000 EUR</option>
                            <option value="50000">20 000 - 50 000 EUR</option>
                            <option value="50001">Plus de 50 000 EUR</option>
                        </select>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeModal('contact-modal')">Annuler</button>
                    <button class="btn btn-primary" onclick="sendContactRequest(${craftsmanId})">
                        <i class="fas fa-paper-plane" aria-hidden="true"></i> Envoyer
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.remove();
}

function sendContactRequest(craftsmanId) {
    // Simulate sending
    closeModal('contact-modal');
    showNotification('Message envoye !', 'Votre demande a ete transmise a l\'artisan.', 'success');
}

function requestQuote(craftsmanId) {
    openContactModal(craftsmanId);
}

function showNotification(title, message, type = 'info') {
    const iconMap = { success: 'check-circle', error: 'exclamation-circle', warning: 'exclamation-triangle', info: 'info-circle' };
    const notifHTML = `
        <div class="notification ${type}" role="alert">
            <i class="fas fa-${iconMap[type] || 'info-circle'} notification-icon ${type}" aria-hidden="true"></i>
            <div>
                <div class="font-semibold">${title}</div>
                <div class="text-muted notification-message">${message}</div>
            </div>
            <button class="notification-close" onclick="this.parentElement.remove()" aria-label="Fermer la notification">
                <i class="fas fa-times" aria-hidden="true"></i>
            </button>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', notifHTML);

    setTimeout(() => {
        const notif = document.querySelector('.notification');
        if (notif) notif.remove();
    }, 5000);
}

// ========================================
// Initialize App
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    renderPage();
});
