/* ========================================
   RenoAI - Systeme de Devis Intelligent
   Avec retouche IA des images par etape
   ======================================== */

// ========================================
// Devis Data Store
// ========================================

// Helper: resolve CSS variable to actual color value
function getCSSVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// Helper: get annotation color (resolves CSS var at render time)
function getAnnotationColor(config) {
    if (config._cssVar) {
        return getCSSVar(config._cssVar) || config.color;
    }
    return config.color;
}

const DevisData = {
    currentDevis: null,

    devisList: [
        {
            id: 1,
            title: 'Renovation Salle de Bain',
            status: 'in_progress',
            createdAt: '2025-01-20',
            totalAmount: 8750,
            description: 'Fuite au niveau de la douche, carrelage abime, joints moisis',
            userPhotos: [
                { id: 1, url: 'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=400', caption: 'Fuite douche' },
                { id: 2, url: 'https://images.unsplash.com/photo-1620626011761-996317b8d101?w=400', caption: 'Carrelage abime' }
            ],
            subDevis: [
                {
                    id: 1,
                    title: 'Demolition et preparation',
                    status: 'completed',
                    order: 1,
                    description: 'Retrait de l\'ancien carrelage, demontage de la douche existante, preparation des surfaces',
                    duration: '2 jours',
                    materials: [
                        { name: 'Sacs gravats', quantity: 10, unit: 'pieces', unitPrice: 3, total: 30 },
                        { name: 'Bache protection', quantity: 20, unit: 'm2', unitPrice: 2, total: 40 }
                    ],
                    labor: { hours: 16, hourlyRate: 45, total: 720 },
                    totalAmount: 790,
                    // Images AI retouchees pour cette etape
                    aiImages: {
                        before: { url: 'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=400', caption: 'Etat actuel' },
                        annotated: { url: 'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=400', caption: 'Zones a demolir', annotations: [
                            { type: 'zone', color: '#ef4444', label: 'Carrelage a retirer', x: 20, y: 30, width: 60, height: 40 },
                            { type: 'arrow', color: '#f59e0b', label: 'Point de depart', x: 50, y: 20 }
                        ]},
                        after: { url: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400', caption: 'Resultat attendu' }
                    },
                    progressPhotos: [
                        { url: 'https://images.unsplash.com/photo-1581858726788-75bc0f6a952d?w=400', caption: 'Debut demolition', date: '2025-01-21' }
                    ],
                    completedAt: '2025-01-22'
                },
                {
                    id: 2,
                    title: 'Plomberie',
                    status: 'completed',
                    order: 2,
                    description: 'Remplacement des canalisations, installation nouvelle evacuation',
                    duration: '1.5 jours',
                    materials: [
                        { name: 'Tuyaux PVC', quantity: 6, unit: 'm', unitPrice: 15, total: 90 },
                        { name: 'Raccords', quantity: 8, unit: 'pieces', unitPrice: 12, total: 96 }
                    ],
                    labor: { hours: 12, hourlyRate: 55, total: 660 },
                    totalAmount: 846,
                    aiImages: {
                        before: { url: 'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=400', caption: 'Etat actuel' },
                        annotated: { url: 'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=400', caption: 'Travaux plomberie', annotations: [
                            { type: 'line', color: '#3b82f6', label: 'Nouvelle canalisation', x1: 30, y1: 60, x2: 70, y2: 60 },
                            { type: 'point', color: '#10b981', label: 'Evacuation', x: 50, y: 70 }
                        ]},
                        after: { url: 'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=400', caption: 'Installation terminee' }
                    },
                    progressPhotos: [],
                    completedAt: '2025-01-24'
                }
            ],
            finalPhotos: []
        }
    ],

    // Configuration des annotations IA par type de travaux
    aiAnnotationConfig: {
        demolition: {
            color: '#ef4444', _cssVar: '--color-error-light',
            icon: 'fa-hammer',
            overlayStyle: 'striped',
            label: 'Zone a demolir'
        },
        plumbing: {
            color: '#3b82f6', _cssVar: '--color-primary-light',
            icon: 'fa-faucet',
            overlayStyle: 'dashed',
            label: 'Travaux plomberie'
        },
        electrical: {
            color: '#f59e0b', _cssVar: '--color-warning-light',
            icon: 'fa-bolt',
            overlayStyle: 'dotted',
            label: 'Installation electrique'
        },
        tiling: {
            color: '#8b5cf6', _cssVar: '--color-accent-purple',
            icon: 'fa-th',
            overlayStyle: 'grid',
            label: 'Pose carrelage'
        },
        painting: {
            color: '#10b981', _cssVar: '--color-secondary-light',
            icon: 'fa-paint-roller',
            overlayStyle: 'solid',
            label: 'Surface a peindre'
        },
        waterproofing: {
            color: '#06b6d4', _cssVar: '--color-accent-cyan',
            icon: 'fa-tint',
            overlayStyle: 'wave',
            label: 'Zone etancheite'
        },
        finishing: {
            color: '#ec4899', _cssVar: '--color-accent-pink',
            icon: 'fa-check',
            overlayStyle: 'border',
            label: 'Finitions'
        },
        installation: {
            color: '#6366f1', _cssVar: '--color-primary',
            icon: 'fa-tools',
            overlayStyle: 'highlight',
            label: 'Installation'
        }
    },

    aiTemplates: {
        bathroom: {
            keywords: ['salle de bain', 'douche', 'baignoire', 'wc', 'toilette', 'lavabo', 'fuite', 'carrelage', 'joint'],
            subDevisTemplates: [
                { title: 'Demolition et preparation', duration: '1-2 jours', laborRate: 45, annotationType: 'demolition' },
                { title: 'Plomberie', duration: '1-2 jours', laborRate: 55, annotationType: 'plumbing' },
                { title: 'Etancheite', duration: '1-2 jours', laborRate: 50, annotationType: 'waterproofing' },
                { title: 'Carrelage', duration: '2-4 jours', laborRate: 50, annotationType: 'tiling' },
                { title: 'Joints et finitions', duration: '1 jour', laborRate: 45, annotationType: 'finishing' },
                { title: 'Installation sanitaires', duration: '1-2 jours', laborRate: 55, annotationType: 'installation' }
            ]
        },
        kitchen: {
            keywords: ['cuisine', 'evier', 'robinet', 'plan de travail', 'meuble', 'hotte'],
            subDevisTemplates: [
                { title: 'Demolition cuisine', duration: '1-2 jours', laborRate: 45, annotationType: 'demolition' },
                { title: 'Plomberie et evacuation', duration: '1 jour', laborRate: 55, annotationType: 'plumbing' },
                { title: 'Electricite', duration: '1-2 jours', laborRate: 50, annotationType: 'electrical' },
                { title: 'Pose meubles', duration: '2-3 jours', laborRate: 48, annotationType: 'installation' },
                { title: 'Plan de travail et credence', duration: '1-2 jours', laborRate: 52, annotationType: 'tiling' },
                { title: 'Finitions', duration: '1 jour', laborRate: 45, annotationType: 'finishing' }
            ]
        },
        painting: {
            keywords: ['peinture', 'mur', 'plafond', 'fissure', 'tache', 'papier peint'],
            subDevisTemplates: [
                { title: 'Protection et preparation', duration: '0.5-1 jour', laborRate: 40, annotationType: 'demolition' },
                { title: 'Rebouchage et enduit', duration: '1-2 jours', laborRate: 42, annotationType: 'finishing' },
                { title: 'Poncage et sous-couche', duration: '1 jour', laborRate: 40, annotationType: 'painting' },
                { title: 'Peinture finition', duration: '2-3 jours', laborRate: 42, annotationType: 'painting' }
            ]
        },
        general: {
            keywords: [],
            subDevisTemplates: [
                { title: 'Diagnostic', duration: '0.5 jour', laborRate: 50, annotationType: 'demolition' },
                { title: 'Preparation', duration: '1 jour', laborRate: 45, annotationType: 'demolition' },
                { title: 'Travaux principaux', duration: '2-5 jours', laborRate: 50, annotationType: 'installation' },
                { title: 'Finitions', duration: '1 jour', laborRate: 45, annotationType: 'finishing' }
            ]
        }
    },

    materialsCatalog: {
        demolition: [
            { name: 'Sacs gravats', unitPrice: 3, unit: 'pieces' },
            { name: 'Bache protection', unitPrice: 2, unit: 'm2' }
        ],
        plomberie: [
            { name: 'Tuyaux PVC', unitPrice: 15, unit: 'm' },
            { name: 'Raccords', unitPrice: 12, unit: 'pieces' },
            { name: 'Siphon', unitPrice: 35, unit: 'piece' }
        ],
        carrelage: [
            { name: 'Carrelage sol', unitPrice: 45, unit: 'm2' },
            { name: 'Carrelage mural', unitPrice: 38, unit: 'm2' },
            { name: 'Colle carrelage', unitPrice: 28, unit: 'sac' }
        ],
        peinture: [
            { name: 'Peinture acrylique', unitPrice: 45, unit: 'pot 10L' },
            { name: 'Sous-couche', unitPrice: 35, unit: 'pot 10L' }
        ]
    }
};

// ========================================
// Devis State
// ========================================

const DevisState = {
    step: 0,
    uploadedPhotos: [],
    description: '',
    title: '',
    selectedSubDevis: null,
    showImageEditor: false,
    currentEditingImage: null
};

// ========================================
// Render Devis Page
// ========================================

function renderDevisPage() {
    return `
        <div class="animate-slide">
            <div class="tabs mb-4">
                <div class="tab ${DevisState.step === 0 ? 'active' : ''}" onclick="showDevisList()">
                    <i class="fas fa-list" aria-hidden="true"></i> Mes Devis
                </div>
                <div class="tab ${DevisState.step >= 1 ? 'active' : ''}" onclick="startNewDevis()">
                    <i class="fas fa-plus" aria-hidden="true"></i> Nouveau Devis
                </div>
            </div>
            <div id="devis-content">
                ${DevisState.step === 0 ? renderDevisList() : renderDevisWizard()}
            </div>
        </div>
    `;
}

// ========================================
// Liste des Devis
// ========================================

function renderDevisList() {
    return `
        <div class="grid-2">
            ${DevisData.devisList.map(devis => {
                const completedSteps = devis.subDevis.filter(s => s.status === 'completed').length;
                const progress = Math.round((completedSteps / devis.subDevis.length) * 100);
                const status = getDevisStatusLabel(devis.status);

                return `
                    <div class="card cursor-pointer" onclick="openDevisDetail(${devis.id})">
                        <div class="card-body">
                            <div class="flex-between mb-2">
                                <h3 class="text-lg font-bold">${devis.title}</h3>
                                <span class="tag ${status.class}">${status.text}</span>
                            </div>
                            <p class="text-muted mb-3 text-sm">${devis.description}</p>
                            <div class="flex gap-1 mb-3">
                                ${devis.userPhotos.slice(0, 3).map(photo => `
                                    <div class="devis-thumb">
                                        <img src="${photo.url}" alt="${photo.caption}">
                                    </div>
                                `).join('')}
                            </div>
                            <div class="mb-3">
                                <div class="flex-between mb-1">
                                    <span class="text-muted text-sm">Progression</span>
                                    <span class="font-semibold">${completedSteps}/${devis.subDevis.length} etapes</span>
                                </div>
                                <div class="progress-bar">
                                    <div class="progress-fill" style="width: ${progress}%;"></div>
                                </div>
                            </div>
                            <div class="flex-between devis-card-footer">
                                <span class="text-muted">Total devis</span>
                                <span class="devis-price">${formatCurrency(devis.totalAmount)}</span>
                            </div>
                        </div>
                    </div>
                `;
            }).join('')}

            <div class="card card-dashed" onclick="startNewDevis()">
                <div class="card-body flex-center" style="min-height: 300px;">
                    <div class="text-center">
                        <div class="new-devis-icon">
                            <i class="fas fa-plus" aria-hidden="true"></i>
                        </div>
                        <h3 class="text-lg mb-2">Nouveau devis</h3>
                        <p class="text-muted text-sm">Uploadez vos photos et l'IA analysera automatiquement</p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function getDevisStatusLabel(status) {
    const labels = {
        draft: { text: 'Brouillon', class: 'tag-gray' },
        pending: { text: 'En attente', class: 'tag-warning' },
        in_progress: { text: 'En cours', class: 'tag-primary' },
        completed: { text: 'Termine', class: 'tag-success' }
    };
    return labels[status] || { text: status, class: 'tag-gray' };
}

// ========================================
// Wizard Nouveau Devis
// ========================================

function renderDevisWizard() {
    return `
        <div class="steps mb-4">
            <div class="step ${DevisState.step >= 1 ? 'active' : ''} ${DevisState.step > 1 ? 'completed' : ''}">
                <div class="step-indicator">${DevisState.step > 1 ? '<i class="fas fa-check" aria-hidden="true"></i>' : '1'}</div>
                <div class="step-label">Photos & Description</div>
            </div>
            <div class="step ${DevisState.step >= 2 ? 'active' : ''} ${DevisState.step > 2 ? 'completed' : ''}">
                <div class="step-indicator">${DevisState.step > 2 ? '<i class="fas fa-check" aria-hidden="true"></i>' : '2'}</div>
                <div class="step-label">Analyse IA</div>
            </div>
            <div class="step ${DevisState.step >= 3 ? 'active' : ''} ${DevisState.step > 3 ? 'completed' : ''}">
                <div class="step-indicator">${DevisState.step > 3 ? '<i class="fas fa-check" aria-hidden="true"></i>' : '3'}</div>
                <div class="step-label">Sous-devis & Images IA</div>
            </div>
            <div class="step ${DevisState.step >= 4 ? 'active' : ''}">
                <div class="step-indicator">4</div>
                <div class="step-label">Devis Final</div>
            </div>
        </div>
        <div id="wizard-step-content">
            ${renderWizardStep()}
        </div>
    `;
}

function renderWizardStep() {
    switch(DevisState.step) {
        case 1: return renderStep1Upload();
        case 2: return renderStep2Analysis();
        case 3: return renderStep3SubDevis();
        case 4: return renderStep4Final();
        default: return '';
    }
}

// ========================================
// Step 1: Upload Photos
// ========================================

function renderStep1Upload() {
    return `
        <div class="grid-2">
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title"><i class="fas fa-camera text-primary" aria-hidden="true"></i> Photos du probleme</h3>
                </div>
                <div class="card-body">
                    <div class="upload-zone" role="button" tabindex="0" aria-label="Zone de depot de photos" onclick="document.getElementById('photo-input').click()" onkeydown="if(event.key==='Enter')document.getElementById('photo-input').click()">
                        <input type="file" id="photo-input" multiple accept="image/*" class="hidden" onchange="handlePhotoUpload(event)" aria-label="Selectionner des photos">
                        <i class="fas fa-cloud-upload-alt upload-zone-icon" aria-hidden="true"></i>
                        <h4 class="mb-1">Glissez vos photos ici</h4>
                        <p class="text-muted">ou cliquez pour selectionner</p>
                        <p class="text-muted upload-zone-hint">L'IA va analyser ces images pour generer le devis</p>
                    </div>
                    <div id="uploaded-photos" class="mt-3 photo-grid-3">
                        ${renderUploadedPhotos()}
                    </div>
                </div>
            </div>

            <div class="card">
                <div class="card-header">
                    <h3 class="card-title"><i class="fas fa-edit text-primary" aria-hidden="true"></i> Description</h3>
                </div>
                <div class="card-body">
                    <div class="form-group">
                        <label class="form-label">Titre du projet <span class="required">*</span></label>
                        <input type="text" class="form-control" id="devis-title" placeholder="Ex: Renovation salle de bain" value="${DevisState.title || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Decrivez le probleme <span class="required">*</span></label>
                        <textarea class="form-control" id="devis-description" rows="5" placeholder="Decrivez ce qui ne va pas...">${DevisState.description || ''}</textarea>
                        <div class="form-hint">L'IA utilisera cette description pour annoter vos photos</div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Surface (m2)</label>
                            <input type="number" class="form-control" id="devis-surface" placeholder="Ex: 8" min="1">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Type de piece</label>
                            <select class="form-control" id="devis-room-type">
                                <option value="">Selectionnez...</option>
                                <option value="bathroom">Salle de bain</option>
                                <option value="kitchen">Cuisine</option>
                                <option value="living">Salon</option>
                                <option value="bedroom">Chambre</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="flex-between mt-4">
            <button class="btn btn-secondary" onclick="showDevisList()">
                <i class="fas fa-arrow-left" aria-hidden="true"></i> Retour
            </button>
            <button class="btn btn-primary btn-lg" onclick="startAIAnalysis()">
                <i class="fas fa-brain" aria-hidden="true"></i> Analyser avec l'IA
            </button>
        </div>
    `;
}

function renderUploadedPhotos() {
    return DevisState.uploadedPhotos.map((photo, index) => `
        <div class="photo-upload-thumb">
            <img src="${photo.url}" alt="${photo.caption || 'Photo ' + (index + 1)}">
            <button class="photo-upload-remove" onclick="removePhoto(${index}); event.stopPropagation();" aria-label="Supprimer la photo ${index + 1}">
                <i class="fas fa-times" aria-hidden="true"></i>
            </button>
            <div class="photo-upload-caption">
                <input type="text" placeholder="Legende..." value="${photo.caption || ''}" onchange="updatePhotoCaption(${index}, this.value)" aria-label="Legende de la photo ${index + 1}">
            </div>
        </div>
    `).join('');
}

function handlePhotoUpload(event) {
    const files = event.target.files;
    for (let file of files) {
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                DevisState.uploadedPhotos.push({
                    url: e.target.result,
                    caption: '',
                    file: file
                });
                document.getElementById('uploaded-photos').innerHTML = renderUploadedPhotos();
            };
            reader.readAsDataURL(file);
        }
    }
}

function removePhoto(index) {
    DevisState.uploadedPhotos.splice(index, 1);
    document.getElementById('uploaded-photos').innerHTML = renderUploadedPhotos();
}

function updatePhotoCaption(index, caption) {
    DevisState.uploadedPhotos[index].caption = caption;
}

// ========================================
// Step 2: AI Analysis
// ========================================

function startAIAnalysis() {
    const title = document.getElementById('devis-title').value.trim();
    const description = document.getElementById('devis-description').value.trim();

    if (!title || !description) {
        showNotification('Champs requis', 'Veuillez renseigner le titre et la description', 'error');
        return;
    }
    if (DevisState.uploadedPhotos.length === 0) {
        showNotification('Photos requises', 'Veuillez ajouter au moins une photo', 'error');
        return;
    }

    DevisState.title = title;
    DevisState.description = description;
    DevisState.surface = document.getElementById('devis-surface').value || 10;
    DevisState.roomType = document.getElementById('devis-room-type').value;

    DevisState.step = 2;
    document.getElementById('wizard-step-content').innerHTML = renderStep2Analysis();
    simulateAIAnalysis();
}

function renderStep2Analysis() {
    return `
        <div class="card">
            <div class="card-body" style="padding: var(--spacing-12); text-align: center;">
                <div id="analysis-animation">
                    <div class="analysis-spinner" aria-hidden="true">
                        <div class="analysis-spinner-ring"></div>
                        <i class="fas fa-brain analysis-spinner-icon" aria-hidden="true"></i>
                    </div>
                    <h2 class="mb-3">Analyse en cours...</h2>
                    <p class="text-muted">L'IA analyse vos photos et genere les annotations pour chaque etape</p>

                    <!-- Preview des photos en cours d'analyse -->
                    <div class="analysis-photos" aria-hidden="true">
                        ${DevisState.uploadedPhotos.slice(0, 3).map((photo, i) => `
                            <div class="analysis-photo-thumb">
                                <img src="${photo.url}" alt="Photo en cours d'analyse ${i + 1}" style="width: 100%; height: 100%; object-fit: cover;">
                                <div class="scan-line" style="animation-delay: ${i * 0.3}s;" aria-hidden="true"></div>
                                <div class="scan-border" aria-hidden="true"></div>
                            </div>
                        `).join('')}
                    </div>

                    <div style="max-width: 400px; margin: 0 auto;">
                        <div class="progress-bar" style="height: 8px; margin-bottom: 1rem;">
                            <div class="progress-fill" id="analysis-progress-bar" style="width: 0%; transition: width 0.5s;"></div>
                        </div>
                        <div id="analysis-status" class="text-muted">Detection des zones problematiques...</div>
                    </div>
                </div>
            </div>
        </div>

        <style>
            @keyframes scanLine {
                0% { top: 0; }
                50% { top: 100%; }
                100% { top: 0; }
            }
        </style>
    `;
}

function simulateAIAnalysis() {
    const steps = [
        { progress: 15, text: 'Detection des zones problematiques...' },
        { progress: 30, text: 'Analyse des materiaux existants...' },
        { progress: 45, text: 'Generation des annotations IA...' },
        { progress: 60, text: 'Creation des images retouchees...' },
        { progress: 75, text: 'Calcul des couts par etape...' },
        { progress: 90, text: 'Finalisation des sous-devis...' },
        { progress: 100, text: 'Termine !' }
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
        if (currentStep < steps.length) {
            document.getElementById('analysis-progress-bar').style.width = steps[currentStep].progress + '%';
            document.getElementById('analysis-status').textContent = steps[currentStep].text;
            currentStep++;
        } else {
            clearInterval(interval);
            setTimeout(generateAIDevis, 500);
        }
    }, 700);
}

function generateAIDevis() {
    const description = DevisState.description.toLowerCase();
    let templateType = 'general';

    for (const [type, data] of Object.entries(DevisData.aiTemplates)) {
        if (data.keywords.some(keyword => description.includes(keyword))) {
            templateType = type;
            break;
        }
    }

    const template = DevisData.aiTemplates[templateType];
    const surface = parseInt(DevisState.surface) || 10;

    // Generer les sous-devis avec images IA
    const subDevis = template.subDevisTemplates.map((t, index) => {
        const hours = (index + 1) * 4 + Math.floor(Math.random() * 8);
        const laborTotal = hours * t.laborRate;
        const annotationConfig = DevisData.aiAnnotationConfig[t.annotationType] || DevisData.aiAnnotationConfig.demolition;

        // Generer les images IA pour cette etape
        const aiImages = generateAIImagesForStep(t, index, annotationConfig);

        return {
            id: index + 1,
            title: t.title,
            status: 'pending',
            order: index + 1,
            description: `${t.title} - Surface: ${surface}m2`,
            duration: t.duration,
            annotationType: t.annotationType,
            materials: generateMaterialsForStep(t.annotationType, surface),
            labor: { hours, hourlyRate: t.laborRate, total: laborTotal },
            totalAmount: laborTotal + (surface * 30),
            aiImages: aiImages,
            progressPhotos: [],
            completedAt: null
        };
    });

    const newDevis = {
        id: DevisData.devisList.length + 1,
        title: DevisState.title,
        status: 'draft',
        createdAt: new Date().toISOString().split('T')[0],
        totalAmount: subDevis.reduce((sum, s) => sum + s.totalAmount, 0),
        description: DevisState.description,
        userPhotos: DevisState.uploadedPhotos.map((p, i) => ({
            id: i + 1,
            url: p.url,
            caption: p.caption || `Photo ${i + 1}`
        })),
        subDevis: subDevis,
        finalPhotos: []
    };

    DevisData.currentDevis = newDevis;
    DevisState.step = 3;
    document.getElementById('wizard-step-content').innerHTML = renderStep3SubDevis();
}

function generateAIImagesForStep(template, stepIndex, annotationConfig) {
    // Utiliser les photos uploadees par l'utilisateur
    const userPhoto = DevisState.uploadedPhotos[stepIndex % DevisState.uploadedPhotos.length];

    return {
        before: {
            url: userPhoto.url,
            caption: 'Etat actuel'
        },
        annotated: {
            url: userPhoto.url,
            caption: annotationConfig.label,
            annotations: generateAnnotationsForStep(template, annotationConfig),
            overlayColor: annotationConfig.color,
            overlayStyle: annotationConfig.overlayStyle,
            icon: annotationConfig.icon
        },
        after: {
            url: userPhoto.url,
            caption: 'Resultat apres travaux',
            isProjection: true
        }
    };
}

function generateAnnotationsForStep(template, config) {
    // Generer des annotations aleatoires mais coherentes
    const annotations = [];
    const numAnnotations = 2 + Math.floor(Math.random() * 3);

    for (let i = 0; i < numAnnotations; i++) {
        annotations.push({
            type: ['zone', 'arrow', 'point', 'line'][Math.floor(Math.random() * 4)],
            color: config.color,
            label: `Zone ${i + 1}`,
            x: 15 + Math.random() * 70,
            y: 15 + Math.random() * 70,
            width: 20 + Math.random() * 30,
            height: 15 + Math.random() * 25
        });
    }

    return annotations;
}

function generateMaterialsForStep(type, surface) {
    const catalogs = {
        demolition: DevisData.materialsCatalog.demolition,
        plumbing: DevisData.materialsCatalog.plomberie,
        tiling: DevisData.materialsCatalog.carrelage,
        painting: DevisData.materialsCatalog.peinture
    };

    const catalog = catalogs[type] || DevisData.materialsCatalog.demolition;
    return catalog.map(mat => ({
        name: mat.name,
        quantity: Math.ceil(surface * (0.5 + Math.random())),
        unit: mat.unit,
        unitPrice: mat.unitPrice,
        total: Math.ceil(surface * (0.5 + Math.random())) * mat.unitPrice
    }));
}

// ========================================
// Step 3: Sub-Devis with AI Images
// ========================================

function renderStep3SubDevis() {
    const devis = DevisData.currentDevis;

    return `
        <div class="sub-devis-layout">
            <!-- Liste des sous-devis -->
            <div class="card sub-devis-sidebar">
                <div class="card-header">
                    <h3 class="card-title">Etapes du devis</h3>
                </div>
                <div style="padding: 0;">
                    ${devis.subDevis.map((sub, index) => {
                        const isSelected = DevisState.selectedSubDevis === sub.id;
                        const config = DevisData.aiAnnotationConfig[sub.annotationType] || {};
                        return `
                            <div class="sub-devis-item ${isSelected ? 'selected' : ''}" onclick="selectSubDevis(${sub.id})"
                                <div class="flex gap-2" style="align-items: center; margin-bottom: 0.5rem;">
                                    <span class="sub-devis-number" style="background: ${config.color || 'var(--gray-400)'}">
                                        <i class="fas ${config.icon || 'fa-wrench'}" aria-hidden="true"></i>
                                    </span>
                                    <strong class="text-sm">${sub.title}</strong>
                                </div>
                                <div class="flex-between" style="font-size: 0.8rem; margin-left: 36px;">
                                    <span class="text-muted">${sub.duration}</span>
                                    <span class="font-semibold" style="color: ${config.color || 'var(--primary)'};">${formatCurrency(sub.totalAmount)}</span>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
                <div class="card-footer">
                    <div class="flex-between">
                        <span class="font-semibold">Total</span>
                        <span class="devis-price">${formatCurrency(devis.totalAmount)}</span>
                    </div>
                </div>
            </div>

            <!-- Detail avec images IA -->
            <div id="sub-devis-detail">
                ${DevisState.selectedSubDevis ? renderSubDevisDetail(devis.subDevis.find(s => s.id === DevisState.selectedSubDevis)) : renderSubDevisPlaceholder()}
            </div>
        </div>

        <div class="flex-between mt-4">
            <button class="btn btn-secondary" onclick="DevisState.step = 1; document.getElementById('wizard-step-content').innerHTML = renderWizardStep();">
                <i class="fas fa-arrow-left" aria-hidden="true"></i> Modifier
            </button>
            <button class="btn btn-primary btn-lg" onclick="goToFinalDevis()">
                Voir le devis final <i class="fas fa-arrow-right" aria-hidden="true"></i>
            </button>
        </div>
    `;
}

function renderSubDevisPlaceholder() {
    return `
        <div class="card">
            <div class="card-body flex-center" style="min-height: 500px;">
                <div class="empty-state">
                    <div class="empty-state-icon"><i class="fas fa-hand-pointer" aria-hidden="true"></i></div>
                    <h3>Selectionnez une etape</h3>
                    <p>Cliquez sur une etape pour voir les images IA et les details</p>
                </div>
            </div>
        </div>
    `;
}

function selectSubDevis(id) {
    DevisState.selectedSubDevis = id;
    const devis = DevisData.currentDevis;
    document.getElementById('sub-devis-detail').innerHTML = renderSubDevisDetail(devis.subDevis.find(s => s.id === id));

    // Update selection style
    document.querySelectorAll('.sub-devis-item').forEach(item => {
        item.style.background = '';
        item.style.borderLeft = '';
    });
    if (event && event.currentTarget) {
        event.currentTarget.style.background = 'var(--primary-50)';
        event.currentTarget.style.borderLeft = '3px solid var(--primary)';
    }
}

function renderSubDevisDetail(subDevis) {
    if (!subDevis) return '';

    const config = DevisData.aiAnnotationConfig[subDevis.annotationType] || {};
    const materialsTotal = subDevis.materials.reduce((sum, m) => sum + m.total, 0);

    return `
        <div class="card">
            <div class="card-header" style="background: linear-gradient(135deg, ${config.color}15, ${config.color}05);">
                <div class="flex gap-2" style="align-items: center;">
                    <span class="sub-devis-badge" style="background: ${config.color};" aria-hidden="true">
                        <i class="fas ${config.icon || 'fa-wrench'}" aria-hidden="true"></i>
                    </span>
                    <div>
                        <h3 class="card-title" style="margin: 0;">${subDevis.title}</h3>
                        <p class="text-muted list-item-meta" style="margin: 0;">${subDevis.description}</p>
                    </div>
                </div>
                <span class="devis-price" style="color: ${config.color};">${formatCurrency(subDevis.totalAmount)}</span>
            </div>
            <div class="card-body">

                <!-- IMAGES IA - Section principale -->
                <div class="mb-4">
                    <h4 class="section-heading">
                        <i class="fas fa-magic text-primary" aria-hidden="true"></i>
                        Images analysees par l'IA
                    </h4>

                    <div class="ai-images-grid">
                        <!-- Image AVANT -->
                        <div class="ai-image-card">
                            <div class="ai-image-card-header before">
                                <i class="fas fa-camera text-error" aria-hidden="true"></i>
                                AVANT - Etat actuel
                            </div>
                            <div class="ai-image-container">
                                <img src="${subDevis.aiImages.before.url}" alt="Etat actuel - ${subDevis.title}">
                            </div>
                        </div>

                        <!-- Image ANNOTEE par l'IA -->
                        <div class="ai-image-card" style="border-color: ${config.color};">
                            <div class="ai-image-card-header annotated" style="background: ${config.color};">
                                <i class="fas fa-robot" aria-hidden="true"></i>
                                ANALYSE IA - ${config.label || 'Travaux'}
                            </div>
                            <div class="ai-image-container">
                                <img src="${subDevis.aiImages.annotated.url}" alt="Analyse IA - ${config.label || 'Travaux'} - ${subDevis.title}">
                                ${renderAIAnnotations(subDevis.aiImages.annotated, config)}
                            </div>
                        </div>

                        <!-- Image APRES (projection) -->
                        <div class="ai-image-card" style="border-color: var(--color-success);">
                            <div class="ai-image-card-header after">
                                <i class="fas fa-check-circle" aria-hidden="true"></i>
                                APRES - Resultat attendu
                            </div>
                            <div class="ai-image-container">
                                <img src="${subDevis.aiImages.after.url}" alt="Resultat attendu - ${subDevis.title}" style="filter: brightness(1.1) saturate(1.2);">
                                <div class="projection-overlay" aria-hidden="true">
                                    <div class="projection-badge">
                                        <i class="fas fa-sparkles" aria-hidden="true"></i>
                                        Projection IA
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Legende des annotations -->
                    <div class="annotation-legend">
                        <div class="annotation-legend-item">
                            <span class="annotation-legend-swatch" style="background: ${config.color}; border-color: ${config.color};"></span>
                            <span>Zone d'intervention</span>
                        </div>
                        <div class="annotation-legend-item">
                            <i class="fas fa-map-marker-alt" style="color: ${config.color};" aria-hidden="true"></i>
                            <span>Point d'attention</span>
                        </div>
                        <div class="annotation-legend-item">
                            <i class="fas fa-arrows-alt-h" style="color: ${config.color};" aria-hidden="true"></i>
                            <span>Mesures</span>
                        </div>
                    </div>
                </div>

                <!-- Infos rapides -->
                <div class="grid-3 mb-4">
                    <div class="info-card">
                        <i class="fas fa-clock info-card-icon" style="color: ${config.color};" aria-hidden="true"></i>
                        <div class="font-semibold mt-1">${subDevis.duration}</div>
                        <div class="text-muted info-card-label">Duree</div>
                    </div>
                    <div class="info-card">
                        <i class="fas fa-hard-hat info-card-icon" style="color: ${config.color};" aria-hidden="true"></i>
                        <div class="font-semibold mt-1">${subDevis.labor.hours}h</div>
                        <div class="text-muted info-card-label">Main d'oeuvre</div>
                    </div>
                    <div class="info-card" style="background: ${config.color}15;">
                        <i class="fas fa-euro-sign info-card-icon" style="color: ${config.color};" aria-hidden="true"></i>
                        <div class="font-semibold mt-1" style="color: ${config.color};">${formatCurrency(subDevis.totalAmount)}</div>
                        <div class="text-muted info-card-label">Total etape</div>
                    </div>
                </div>

                <!-- Materiaux -->
                <div class="mb-4">
                    <div class="flex-between mb-2">
                        <h4 class="section-heading-sm"><i class="fas fa-box" style="color: ${config.color};" aria-hidden="true"></i> Materiaux</h4>
                        <button class="btn btn-ghost btn-sm" onclick="openAddMaterialModal(${subDevis.id})">
                            <i class="fas fa-plus" aria-hidden="true"></i> Ajouter
                        </button>
                    </div>
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Materiau</th>
                                <th>Qte</th>
                                <th>Prix unit.</th>
                                <th>Total</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            ${subDevis.materials.map((mat, idx) => `
                                <tr>
                                    <td>${mat.name}</td>
                                    <td>${mat.quantity} ${mat.unit}</td>
                                    <td>${formatCurrency(mat.unitPrice)}</td>
                                    <td class="font-semibold">${formatCurrency(mat.total)}</td>
                                    <td>
                                        <button class="btn btn-ghost btn-sm" onclick="removeMaterial(${subDevis.id}, ${idx})" style="color: var(--danger);">
                                            <i class="fas fa-trash" aria-hidden="true"></i>
                                        </button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot>
                            <tr class="table-footer-row">
                                <td colspan="3" class="font-semibold">Sous-total</td>
                                <td class="font-semibold">${formatCurrency(materialsTotal)}</td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                <!-- Main d'oeuvre -->
                <div class="mb-4">
                    <h4 class="section-heading-sm mb-3"><i class="fas fa-hard-hat" style="color: ${config.color};" aria-hidden="true"></i> Main d'oeuvre</h4>
                    <div class="info-card" style="text-align: left;">
                        <div class="flex-between mb-2">
                            <span>Heures</span>
                            <input type="number" class="form-control labor-input" value="${subDevis.labor.hours}" aria-label="Nombre d'heures" onchange="updateLaborHours(${subDevis.id}, this.value)">
                        </div>
                        <div class="flex-between mb-2">
                            <span>Taux horaire</span>
                            <div class="flex gap-1" style="align-items: center;">
                                <input type="number" class="form-control labor-input" value="${subDevis.labor.hourlyRate}" aria-label="Taux horaire" onchange="updateLaborRate(${subDevis.id}, this.value)">
                                <span>EUR/h</span>
                            </div>
                        </div>
                        <div class="flex-between" style="padding-top: var(--spacing-3); border-top: 1px solid var(--color-border);">
                            <span class="font-semibold">Total</span>
                            <span class="font-semibold" style="color: ${config.color};">${formatCurrency(subDevis.labor.total)}</span>
                        </div>
                    </div>
                </div>

                <!-- Photos d'avancement -->
                <div>
                    <div class="flex-between mb-2">
                        <h4 class="section-heading-sm"><i class="fas fa-images" style="color: ${config.color};" aria-hidden="true"></i> Photos d'avancement reelles</h4>
                        <button class="btn btn-ghost btn-sm" onclick="openAddProgressPhotoModal(${subDevis.id})">
                            <i class="fas fa-camera" aria-hidden="true"></i> Ajouter
                        </button>
                    </div>
                    ${subDevis.progressPhotos.length > 0 ? `
                        <div class="photo-grid-4">
                            ${subDevis.progressPhotos.map(photo => `
                                <div class="progress-photo-card">
                                    <img src="${photo.url}" alt="${photo.caption || 'Photo d\'avancement'}">
                                    <div class="progress-photo-caption">
                                        <div class="font-semibold">${photo.caption}</div>
                                        <div class="text-muted">${photo.date}</div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    ` : `
                        <div class="empty-upload-zone">
                            <i class="fas fa-camera" aria-hidden="true"></i>
                            <p class="text-muted">Les photos d'avancement seront ajoutees pendant les travaux</p>
                        </div>
                    `}
                </div>
            </div>
        </div>
    `;
}

function renderAIAnnotations(annotatedImage, config) {
    if (!annotatedImage.annotations) return '';

    return `
        <div style="position: absolute; inset: 0; pointer-events: none;" aria-hidden="true">
            <!-- Overlay general -->
            <div style="position: absolute; inset: 10%; background: ${config.color}; opacity: 0.15; border: 3px dashed ${config.color}; border-radius: var(--radius-lg);"></div>

            <!-- Annotations specifiques -->
            ${annotatedImage.annotations.map((ann, i) => {
                if (ann.type === 'zone') {
                    return `
                        <div style="position: absolute; left: ${ann.x}%; top: ${ann.y}%; width: ${ann.width}%; height: ${ann.height}%;
                                    background: ${ann.color}30; border: 2px solid ${ann.color}; border-radius: 4px;">
                            <span style="position: absolute; top: -20px; left: 0; background: ${ann.color}; color: white; padding: 2px 6px; border-radius: 3px; font-size: 0.7rem; white-space: nowrap;">
                                ${ann.label}
                            </span>
                        </div>
                    `;
                } else if (ann.type === 'point') {
                    return `
                        <div style="position: absolute; left: ${ann.x}%; top: ${ann.y}%; transform: translate(-50%, -50%);">
                            <div style="width: 24px; height: 24px; background: ${ann.color}; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 0.7rem; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">
                                ${i + 1}
                            </div>
                        </div>
                    `;
                } else if (ann.type === 'arrow') {
                    return `
                        <div style="position: absolute; left: ${ann.x}%; top: ${ann.y}%; transform: translate(-50%, -100%);">
                            <div style="display: flex; flex-direction: column; align-items: center;">
                                <span style="background: ${ann.color}; color: white; padding: 2px 8px; border-radius: 3px; font-size: 0.7rem; margin-bottom: 4px;">
                                    ${ann.label}
                                </span>
                                <i class="fas fa-arrow-down" style="color: ${ann.color}; font-size: 1.25rem;"></i>
                            </div>
                        </div>
                    `;
                }
                return '';
            }).join('')}

            <!-- Icone IA -->
            <div style="position: absolute; bottom: 8px; right: 8px; background: white; padding: 4px 8px; border-radius: var(--radius); box-shadow: var(--shadow); display: flex; align-items: center; gap: 4px;">
                <i class="fas fa-robot" style="color: ${config.color}; font-size: 0.8rem;"></i>
                <span style="font-size: 0.7rem; font-weight: 600; color: ${config.color};">IA</span>
            </div>
        </div>
    `;
}

// ========================================
// Step 4: Final Devis
// ========================================

function goToFinalDevis() {
    DevisState.step = 4;
    document.getElementById('wizard-step-content').innerHTML = renderStep4Final();
}

function renderStep4Final() {
    const devis = DevisData.currentDevis;
    const totalMaterials = devis.subDevis.reduce((sum, s) => sum + s.materials.reduce((msum, m) => msum + m.total, 0), 0);
    const totalLabor = devis.subDevis.reduce((sum, s) => sum + s.labor.total, 0);

    return `
        <div class="card mb-4">
            <div class="card-header" style="background: var(--gradient-primary); color: var(--color-text-inverse); padding: var(--spacing-8);">
                <div>
                    <h2 style="font-size: var(--font-size-2xl); margin-bottom: var(--spacing-1);">Devis Final</h2>
                    <p style="opacity: 0.9;">${devis.title}</p>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: var(--font-size-sm); opacity: 0.9;">Montant total TTC</div>
                    <div style="font-size: var(--font-size-4xl); font-weight: var(--font-weight-extrabold);">${formatCurrency(devis.totalAmount * 1.17)}</div>
                </div>
            </div>
            <div class="card-body">
                <!-- Resume chiffres -->
                <div class="grid-3 mb-4">
                    <div class="summary-stat">
                        <i class="fas fa-box" style="font-size: var(--font-size-2xl); color: var(--color-primary);" aria-hidden="true"></i>
                        <div class="summary-stat-value">${formatCurrency(totalMaterials)}</div>
                        <div class="text-muted">Materiaux</div>
                    </div>
                    <div class="summary-stat">
                        <i class="fas fa-hard-hat" style="font-size: var(--font-size-2xl); color: var(--color-primary);" aria-hidden="true"></i>
                        <div class="summary-stat-value">${formatCurrency(totalLabor)}</div>
                        <div class="text-muted">Main d'oeuvre</div>
                    </div>
                    <div class="summary-stat highlight">
                        <i class="fas fa-list-ol" style="font-size: var(--font-size-2xl); color: var(--color-primary);" aria-hidden="true"></i>
                        <div class="summary-stat-value text-primary">${devis.subDevis.length}</div>
                        <div class="text-muted">Etapes</div>
                    </div>
                </div>

                <!-- Photos initiales vs finales -->
                <div class="mb-4">
                    <h4 class="section-heading"><i class="fas fa-images text-primary" aria-hidden="true"></i> Comparaison Avant / Apres (Projection IA)</h4>
                    <div class="photo-grid-2">
                        <div>
                            <div class="comparison-header before">
                                <i class="fas fa-camera" aria-hidden="true"></i> AVANT - Photos client
                            </div>
                            <div class="comparison-photos">
                                ${devis.userPhotos.map(p => `
                                    <img src="${p.url}" alt="${p.caption || 'Photo avant travaux'}">
                                `).join('')}
                            </div>
                        </div>
                        <div>
                            <div class="comparison-header after">
                                <i class="fas fa-magic" aria-hidden="true"></i> APRES - Projection IA
                            </div>
                            <div class="comparison-photos">
                                ${devis.userPhotos.map(p => `
                                    <div style="position: relative;">
                                        <img src="${p.url}" alt="${p.caption || 'Projection apres travaux'}" style="filter: brightness(1.1) saturate(1.2);">
                                        <div class="projection-overlay" aria-hidden="true"></div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Detail par etape -->
                <h4 class="section-heading"><i class="fas fa-list text-primary" aria-hidden="true"></i> Detail par etape</h4>
                ${devis.subDevis.map((sub, index) => {
                    const config = DevisData.aiAnnotationConfig[sub.annotationType] || {};
                    return `
                        <div class="step-detail-card">
                            <div class="step-detail-header" style="background: ${config.color}10;">
                                <div class="flex gap-2" style="align-items: center;">
                                    <span class="step-icon-badge" style="background: ${config.color};" aria-hidden="true">
                                        <i class="fas ${config.icon || 'fa-wrench'}" aria-hidden="true"></i>
                                    </span>
                                    <div>
                                        <strong>${sub.title}</strong>
                                        <span class="text-muted" style="margin-left: var(--spacing-2);">(${sub.duration})</span>
                                    </div>
                                </div>
                                <span style="font-size: var(--font-size-lg); font-weight: var(--font-weight-bold); color: ${config.color};">${formatCurrency(sub.totalAmount)}</span>
                            </div>
                            <div class="step-detail-body">
                                <!-- Mini images IA -->
                                <div class="flex gap-2 mb-3">
                                    <div style="flex: 1; text-align: center;">
                                        <img src="${sub.aiImages.before.url}" alt="Avant - ${sub.title}" style="width: 100%; max-width: 120px; aspect-ratio: 4/3; object-fit: cover; border-radius: var(--radius-lg); border: 2px solid var(--color-border);">
                                        <div class="mini-image-label text-muted">Avant</div>
                                    </div>
                                    <div style="flex: 1; text-align: center;">
                                        <div style="position: relative; display: inline-block;">
                                            <img src="${sub.aiImages.annotated.url}" alt="Analyse IA - ${sub.title}" style="width: 100%; max-width: 120px; aspect-ratio: 4/3; object-fit: cover; border-radius: var(--radius-lg); border: 2px solid ${config.color};">
                                            <div style="position: absolute; inset: 0; background: ${config.color}20; border-radius: var(--radius-lg);" aria-hidden="true"></div>
                                        </div>
                                        <div class="mini-image-label" style="color: ${config.color};">Analyse IA</div>
                                    </div>
                                    <div style="flex: 1; text-align: center;">
                                        <img src="${sub.aiImages.after.url}" alt="Apres - ${sub.title}" style="width: 100%; max-width: 120px; aspect-ratio: 4/3; object-fit: cover; border-radius: var(--radius-lg); border: 2px solid var(--color-success); filter: brightness(1.1);">
                                        <div class="mini-image-label" style="color: var(--color-success);">Apres</div>
                                    </div>
                                </div>
                                <div class="grid-2" style="gap: 2rem; font-size: 0.9rem;">
                                    <div>
                                        <strong style="font-size: 0.8rem; color: var(--gray-500);">MATERIAUX</strong>
                                        ${sub.materials.slice(0, 3).map(m => `
                                            <div class="flex-between" style="padding: 0.25rem 0;">${m.name} <span>${formatCurrency(m.total)}</span></div>
                                        `).join('')}
                                    </div>
                                    <div>
                                        <strong style="font-size: 0.8rem; color: var(--gray-500);">MAIN D'OEUVRE</strong>
                                        <div class="flex-between" style="padding: 0.25rem 0;">${sub.labor.hours}h x ${sub.labor.hourlyRate} EUR/h <span>${formatCurrency(sub.labor.total)}</span></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}

                <!-- Total -->
                <div class="devis-total-box">
                    <div class="flex-between total-row">
                        <span>Total Materiaux</span>
                        <span>${formatCurrency(totalMaterials)}</span>
                    </div>
                    <div class="flex-between total-row">
                        <span>Total Main d'oeuvre</span>
                        <span>${formatCurrency(totalLabor)}</span>
                    </div>
                    <div class="flex-between total-separator">
                        <span>TVA (17%)</span>
                        <span>${formatCurrency(devis.totalAmount * 0.17)}</span>
                    </div>
                    <div class="flex-between total-final">
                        <span>TOTAL TTC</span>
                        <span>${formatCurrency(devis.totalAmount * 1.17)}</span>
                    </div>
                </div>
            </div>
        </div>

        <div class="flex-between">
            <button class="btn btn-secondary" onclick="DevisState.step = 3; DevisState.selectedSubDevis = null; document.getElementById('wizard-step-content').innerHTML = renderStep3SubDevis();">
                <i class="fas fa-arrow-left" aria-hidden="true"></i> Modifier
            </button>
            <div class="flex gap-2">
                <button class="btn btn-secondary" onclick="downloadDevisPDF()">
                    <i class="fas fa-file-pdf" aria-hidden="true"></i> PDF
                </button>
                <button class="btn btn-primary btn-lg" onclick="saveAndSendDevis()">
                    <i class="fas fa-paper-plane" aria-hidden="true"></i> Enregistrer
                </button>
            </div>
        </div>
    `;
}

// ========================================
// Helper Functions
// ========================================

function updateLaborHours(subDevisId, hours) {
    const subDevis = DevisData.currentDevis.subDevis.find(s => s.id === subDevisId);
    subDevis.labor.hours = parseInt(hours);
    subDevis.labor.total = subDevis.labor.hours * subDevis.labor.hourlyRate;
    recalculateTotals(subDevisId);
}

function updateLaborRate(subDevisId, rate) {
    const subDevis = DevisData.currentDevis.subDevis.find(s => s.id === subDevisId);
    subDevis.labor.hourlyRate = parseInt(rate);
    subDevis.labor.total = subDevis.labor.hours * subDevis.labor.hourlyRate;
    recalculateTotals(subDevisId);
}

function recalculateTotals(subDevisId) {
    const subDevis = DevisData.currentDevis.subDevis.find(s => s.id === subDevisId);
    const materialsTotal = subDevis.materials.reduce((sum, m) => sum + m.total, 0);
    subDevis.totalAmount = materialsTotal + subDevis.labor.total;
    DevisData.currentDevis.totalAmount = DevisData.currentDevis.subDevis.reduce((sum, s) => sum + s.totalAmount, 0);

    // Refresh UI
    selectSubDevis(subDevisId);
}

function removeMaterial(subDevisId, index) {
    const subDevis = DevisData.currentDevis.subDevis.find(s => s.id === subDevisId);
    subDevis.materials.splice(index, 1);
    recalculateTotals(subDevisId);
}

function showDevisList() {
    DevisState.step = 0;
    document.getElementById('devis-content').innerHTML = renderDevisList();
}

function startNewDevis() {
    DevisState.step = 1;
    DevisState.uploadedPhotos = [];
    DevisState.description = '';
    DevisState.title = '';
    DevisState.selectedSubDevis = null;
    DevisData.currentDevis = null;
    document.getElementById('devis-content').innerHTML = renderDevisWizard();
}

function openDevisDetail(devisId) {
    const devis = DevisData.devisList.find(d => d.id === devisId);
    if (devis) {
        DevisData.currentDevis = JSON.parse(JSON.stringify(devis));
        DevisState.step = 3;
        DevisState.selectedSubDevis = null;
        document.getElementById('devis-content').innerHTML = renderDevisWizard();
    }
}

function saveAndSendDevis() {
    DevisData.currentDevis.status = 'pending';
    if (!DevisData.devisList.find(d => d.id === DevisData.currentDevis.id)) {
        DevisData.devisList.push(DevisData.currentDevis);
    }
    showNotification('Devis enregistre !', 'Votre devis a ete sauvegarde.', 'success');
    DevisState.step = 0;
    document.getElementById('devis-content').innerHTML = renderDevisList();
}

function downloadDevisPDF() {
    showNotification('Telechargement', 'Le PDF sera genere...', 'info');
}

// Modals
function openAddMaterialModal(subDevisId) {
    const modalHTML = `
        <div class="modal-overlay active" id="material-modal" onclick="if(event.target === this) closeModal('material-modal')">
            <div class="modal">
                <div class="modal-header">
                    <h3 class="modal-title">Ajouter un materiau</h3>
                    <button class="modal-close" onclick="closeModal('material-modal')"><i class="fas fa-times" aria-hidden="true"></i></button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label class="form-label">Nom</label>
                        <input type="text" class="form-control" id="new-mat-name">
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label class="form-label">Quantite</label>
                            <input type="number" class="form-control" id="new-mat-qty" value="1">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Unite</label>
                            <select class="form-control" id="new-mat-unit">
                                <option value="pieces">pieces</option>
                                <option value="m2">m2</option>
                                <option value="m">m</option>
                                <option value="kg">kg</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Prix unitaire (EUR)</label>
                        <input type="number" class="form-control" id="new-mat-price" value="0">
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeModal('material-modal')">Annuler</button>
                    <button class="btn btn-primary" onclick="addMaterial(${subDevisId})">Ajouter</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function addMaterial(subDevisId) {
    const name = document.getElementById('new-mat-name').value.trim();
    const quantity = parseInt(document.getElementById('new-mat-qty').value);
    const unit = document.getElementById('new-mat-unit').value;
    const unitPrice = parseFloat(document.getElementById('new-mat-price').value);

    if (!name || !quantity || !unitPrice) {
        showNotification('Erreur', 'Remplissez tous les champs', 'error');
        return;
    }

    const subDevis = DevisData.currentDevis.subDevis.find(s => s.id === subDevisId);
    subDevis.materials.push({ name, quantity, unit, unitPrice, total: quantity * unitPrice });
    closeModal('material-modal');
    recalculateTotals(subDevisId);
}

function openAddProgressPhotoModal(subDevisId) {
    const modalHTML = `
        <div class="modal-overlay active" id="photo-modal" onclick="if(event.target === this) closeModal('photo-modal')">
            <div class="modal">
                <div class="modal-header">
                    <h3 class="modal-title">Ajouter photo d'avancement</h3>
                    <button class="modal-close" onclick="closeModal('photo-modal')"><i class="fas fa-times" aria-hidden="true"></i></button>
                </div>
                <div class="modal-body">
                    <div class="upload-zone" role="button" tabindex="0" aria-label="Selectionner une photo d'avancement" onclick="document.getElementById('progress-photo-input').click()" onkeydown="if(event.key==='Enter')document.getElementById('progress-photo-input').click()" style="padding: var(--spacing-8);">
                        <input type="file" id="progress-photo-input" accept="image/*" class="hidden" aria-label="Selectionner une photo" onchange="previewProgressPhoto(event)">
                        <div id="progress-photo-preview">
                            <i class="fas fa-camera" style="font-size: var(--font-size-3xl); color: var(--color-text-disabled);" aria-hidden="true"></i>
                            <p class="text-muted">Cliquez pour selectionner</p>
                        </div>
                    </div>
                    <div class="form-group mt-3">
                        <label class="form-label">Legende</label>
                        <input type="text" class="form-control" id="progress-photo-caption">
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeModal('photo-modal')">Annuler</button>
                    <button class="btn btn-primary" onclick="addProgressPhoto(${subDevisId})">Ajouter</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

let tempProgressPhotoUrl = null;

function previewProgressPhoto(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            tempProgressPhotoUrl = e.target.result;
            document.getElementById('progress-photo-preview').innerHTML = `
                <img src="${e.target.result}" alt="Apercu de la photo" style="max-width: 100%; max-height: 200px; border-radius: var(--radius-lg);">
            `;
        };
        reader.readAsDataURL(file);
    }
}

function addProgressPhoto(subDevisId) {
    if (!tempProgressPhotoUrl) {
        showNotification('Erreur', 'Selectionnez une photo', 'error');
        return;
    }

    const caption = document.getElementById('progress-photo-caption').value || 'Photo avancement';
    const subDevis = DevisData.currentDevis.subDevis.find(s => s.id === subDevisId);

    subDevis.progressPhotos.push({
        url: tempProgressPhotoUrl,
        caption: caption,
        date: new Date().toISOString().split('T')[0]
    });

    tempProgressPhotoUrl = null;
    closeModal('photo-modal');
    selectSubDevis(subDevisId);
}

function initDevisPage() {
    DevisState.step = 0;
    return renderDevisPage();
}
