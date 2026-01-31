/**
 * RenoAI - Service IA
 * Analyse d'images, estimation de coûts et génération de devis
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');

// ============================================
// CONFIGURATION IA PAR TYPE DE TRAVAIL
// ============================================

export const aiConfig = {
    demolition: {
        id: 'demolition',
        name: 'Démolition',
        color: '#ef4444',
        icon: 'hammer',
        laborRate: 45,
        materials: [
            { name: 'Sacs gravats', unit: 'piece', pricePerUnit: 3, defaultQty: 20 },
            { name: 'Location benne', unit: 'jour', pricePerUnit: 150, defaultQty: 2 },
            { name: 'Protection (bâches)', unit: 'piece', pricePerUnit: 15, defaultQty: 5 }
        ],
        hoursPerSqm: 0.5
    },
    plumbing: {
        id: 'plumbing',
        name: 'Plomberie',
        color: '#3b82f6',
        icon: 'water',
        laborRate: 65,
        materials: [
            { name: 'Tubes PER 16mm', unit: 'meter', pricePerUnit: 3.5, defaultQty: 15 },
            { name: 'Tubes PER 20mm', unit: 'meter', pricePerUnit: 4.5, defaultQty: 10 },
            { name: 'Raccords', unit: 'piece', pricePerUnit: 5, defaultQty: 20 },
            { name: 'Vannes', unit: 'piece', pricePerUnit: 25, defaultQty: 4 },
            { name: 'Joints', unit: 'box', pricePerUnit: 12, defaultQty: 2 }
        ],
        hoursPerSqm: 1.2
    },
    electrical: {
        id: 'electrical',
        name: 'Électricité',
        color: '#f59e0b',
        icon: 'bolt',
        laborRate: 70,
        materials: [
            { name: 'Câble 2.5mm²', unit: 'meter', pricePerUnit: 2.5, defaultQty: 50 },
            { name: 'Câble 1.5mm²', unit: 'meter', pricePerUnit: 1.8, defaultQty: 30 },
            { name: 'Prises', unit: 'piece', pricePerUnit: 18, defaultQty: 8 },
            { name: 'Interrupteurs', unit: 'piece', pricePerUnit: 15, defaultQty: 4 },
            { name: 'Spots LED', unit: 'piece', pricePerUnit: 25, defaultQty: 6 },
            { name: 'Tableau électrique', unit: 'piece', pricePerUnit: 250, defaultQty: 1 }
        ],
        hoursPerSqm: 0.8
    },
    tiling: {
        id: 'tiling',
        name: 'Carrelage',
        color: '#8b5cf6',
        icon: 'th',
        laborRate: 55,
        materials: [
            { name: 'Carrelage sol', unit: 'sqm', pricePerUnit: 45, defaultQty: 1 },
            { name: 'Carrelage mural', unit: 'sqm', pricePerUnit: 35, defaultQty: 1 },
            { name: 'Colle carrelage', unit: 'kg', pricePerUnit: 1.2, defaultQty: 5 },
            { name: 'Joint', unit: 'kg', pricePerUnit: 3, defaultQty: 2 },
            { name: 'Croisillons', unit: 'box', pricePerUnit: 8, defaultQty: 2 },
            { name: 'Primaire d\'accrochage', unit: 'liter', pricePerUnit: 15, defaultQty: 2 }
        ],
        hoursPerSqm: 1.5
    },
    painting: {
        id: 'painting',
        name: 'Peinture',
        color: '#10b981',
        icon: 'paint-brush',
        laborRate: 50,
        materials: [
            { name: 'Peinture acrylique', unit: 'liter', pricePerUnit: 35, defaultQty: 10 },
            { name: 'Sous-couche', unit: 'liter', pricePerUnit: 25, defaultQty: 5 },
            { name: 'Enduit de rebouchage', unit: 'kg', pricePerUnit: 8, defaultQty: 5 },
            { name: 'Bande à joint', unit: 'roll', pricePerUnit: 12, defaultQty: 2 },
            { name: 'Papier de verre', unit: 'box', pricePerUnit: 15, defaultQty: 2 }
        ],
        hoursPerSqm: 0.4
    },
    carpentry: {
        id: 'carpentry',
        name: 'Menuiserie',
        color: '#f97316',
        icon: 'tools',
        laborRate: 60,
        materials: [
            { name: 'Panneaux MDF', unit: 'sqm', pricePerUnit: 25, defaultQty: 5 },
            { name: 'Tasseaux', unit: 'meter', pricePerUnit: 3, defaultQty: 20 },
            { name: 'Quincaillerie', unit: 'box', pricePerUnit: 45, defaultQty: 1 },
            { name: 'Vernis/Lasure', unit: 'liter', pricePerUnit: 28, defaultQty: 2 },
            { name: 'Vis inox', unit: 'box', pricePerUnit: 15, defaultQty: 2 }
        ],
        hoursPerSqm: 0.8
    },
    insulation: {
        id: 'insulation',
        name: 'Isolation',
        color: '#06b6d4',
        icon: 'layer-group',
        laborRate: 48,
        materials: [
            { name: 'Laine de roche 100mm', unit: 'sqm', pricePerUnit: 18, defaultQty: 1 },
            { name: 'Pare-vapeur', unit: 'sqm', pricePerUnit: 5, defaultQty: 1 },
            { name: 'Rails métalliques', unit: 'meter', pricePerUnit: 4, defaultQty: 10 },
            { name: 'Montants', unit: 'piece', pricePerUnit: 6, defaultQty: 15 },
            { name: 'Plaques de plâtre', unit: 'sqm', pricePerUnit: 8, defaultQty: 1 }
        ],
        hoursPerSqm: 0.6
    },
    masonry: {
        id: 'masonry',
        name: 'Maçonnerie',
        color: '#78716c',
        icon: 'cubes',
        laborRate: 55,
        materials: [
            { name: 'Parpaings', unit: 'piece', pricePerUnit: 2.5, defaultQty: 50 },
            { name: 'Mortier', unit: 'bag', pricePerUnit: 8, defaultQty: 10 },
            { name: 'Ciment', unit: 'bag', pricePerUnit: 12, defaultQty: 5 },
            { name: 'Sable', unit: 'bag', pricePerUnit: 5, defaultQty: 10 }
        ],
        hoursPerSqm: 1.0
    },
    roofing: {
        id: 'roofing',
        name: 'Toiture',
        color: '#dc2626',
        icon: 'home',
        laborRate: 65,
        materials: [
            { name: 'Tuiles', unit: 'piece', pricePerUnit: 1.5, defaultQty: 15 },
            { name: 'Sous-toiture', unit: 'sqm', pricePerUnit: 8, defaultQty: 1 },
            { name: 'Liteaux', unit: 'meter', pricePerUnit: 2, defaultQty: 10 },
            { name: 'Faîtière', unit: 'meter', pricePerUnit: 25, defaultQty: 1 }
        ],
        hoursPerSqm: 0.8
    },
    flooring: {
        id: 'flooring',
        name: 'Revêtement de sol',
        color: '#a855f7',
        icon: 'border-all',
        laborRate: 50,
        materials: [
            { name: 'Parquet stratifié', unit: 'sqm', pricePerUnit: 25, defaultQty: 1 },
            { name: 'Sous-couche', unit: 'sqm', pricePerUnit: 3, defaultQty: 1 },
            { name: 'Plinthes', unit: 'meter', pricePerUnit: 8, defaultQty: 1 },
            { name: 'Barre de seuil', unit: 'piece', pricePerUnit: 15, defaultQty: 2 }
        ],
        hoursPerSqm: 0.3
    }
};

// ============================================
// TEMPLATES PAR TYPE DE PIÈCE
// ============================================

export const roomTemplates = {
    bathroom: {
        name: 'Salle de bain',
        typicalWorks: ['demolition', 'plumbing', 'electrical', 'tiling', 'painting'],
        avgSize: 8,
        complexity: 1.3
    },
    kitchen: {
        name: 'Cuisine',
        typicalWorks: ['demolition', 'plumbing', 'electrical', 'tiling', 'carpentry'],
        avgSize: 12,
        complexity: 1.4
    },
    bedroom: {
        name: 'Chambre',
        typicalWorks: ['electrical', 'painting', 'flooring', 'insulation'],
        avgSize: 14,
        complexity: 0.9
    },
    living_room: {
        name: 'Salon',
        typicalWorks: ['electrical', 'painting', 'flooring'],
        avgSize: 25,
        complexity: 1.0
    },
    office: {
        name: 'Bureau',
        typicalWorks: ['electrical', 'painting', 'flooring'],
        avgSize: 12,
        complexity: 0.9
    },
    garage: {
        name: 'Garage',
        typicalWorks: ['electrical', 'painting', 'insulation', 'flooring'],
        avgSize: 20,
        complexity: 0.8
    },
    exterior: {
        name: 'Extérieur',
        typicalWorks: ['masonry', 'painting', 'roofing'],
        avgSize: 30,
        complexity: 1.2
    },
    whole_house: {
        name: 'Maison complète',
        typicalWorks: ['demolition', 'plumbing', 'electrical', 'tiling', 'painting', 'carpentry', 'insulation', 'flooring'],
        avgSize: 100,
        complexity: 1.5
    },
    other: {
        name: 'Autre',
        typicalWorks: ['painting', 'electrical'],
        avgSize: 15,
        complexity: 1.0
    }
};

// Multiplicateurs de qualité
const qualityMultipliers = {
    economy: { materials: 0.7, labor: 0.9, name: 'Économique' },
    standard: { materials: 1.0, labor: 1.0, name: 'Standard' },
    premium: { materials: 1.5, labor: 1.2, name: 'Premium' },
    luxury: { materials: 2.5, labor: 1.5, name: 'Luxe' }
};

// ============================================
// FONCTIONS D'ANALYSE
// ============================================

/**
 * Analyser une photo
 */
export async function analyzePhoto(photo, options = {}) {
    // Simuler le délai d'analyse IA
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));

    const description = photo.description || '';
    const detectedWorkTypes = detectWorkTypesFromDescription(description, options.work_types);

    const annotations = generateAnnotations(detectedWorkTypes);

    return {
        photo_url: photo.url,
        description: photo.description,
        detected_work_types: detectedWorkTypes,
        annotations,
        confidence: 0.75 + Math.random() * 0.2,
        analyzed_at: new Date().toISOString()
    };
}

/**
 * Analyser plusieurs photos
 */
export async function analyzePhotos(photos, options = {}) {
    const results = [];

    for (const photo of photos) {
        const analysis = await analyzePhoto(photo, options);
        results.push(analysis);
    }

    return results;
}

/**
 * Détecter les types de travaux depuis une description
 */
export function detectWorkTypes(description, photos = []) {
    const keywords = {
        demolition: ['démolir', 'casser', 'enlever', 'retirer', 'détruire', 'ancien', 'vieux', 'abattre'],
        plumbing: ['plomberie', 'tuyau', 'robinet', 'douche', 'baignoire', 'wc', 'toilette', 'évier', 'fuite', 'eau', 'sanitaire'],
        electrical: ['électrique', 'prise', 'interrupteur', 'lumière', 'éclairage', 'câble', 'tableau', 'spot'],
        tiling: ['carrelage', 'faïence', 'sol', 'dalle', 'céramique', 'mosaïque'],
        painting: ['peinture', 'peindre', 'mur', 'plafond', 'couleur', 'rafraîchir', 'enduit'],
        carpentry: ['bois', 'menuiserie', 'porte', 'fenêtre', 'placard', 'meuble', 'étagère', 'dressing'],
        insulation: ['isolation', 'isoler', 'thermique', 'froid', 'chaleur', 'phonique', 'laine'],
        masonry: ['mur', 'cloison', 'parpaing', 'brique', 'béton', 'maçonnerie'],
        roofing: ['toit', 'toiture', 'tuile', 'gouttière', 'charpente'],
        flooring: ['parquet', 'sol', 'lino', 'vinyle', 'stratifié', 'moquette']
    };

    const descLower = (description || '').toLowerCase();
    const detected = [];

    for (const [workType, words] of Object.entries(keywords)) {
        if (words.some(word => descLower.includes(word))) {
            detected.push(workType);
        }
    }

    return detected;
}

function detectWorkTypesFromDescription(description, providedTypes = []) {
    if (providedTypes && providedTypes.length > 0) {
        return providedTypes;
    }
    return detectWorkTypes(description);
}

/**
 * Consolider les analyses de plusieurs photos
 */
export function consolidateAnalyses(photoAnalyses, options = {}) {
    const allWorkTypes = new Set();
    const allAnnotations = [];

    for (const analysis of photoAnalyses) {
        analysis.detected_work_types.forEach(wt => allWorkTypes.add(wt));
        allAnnotations.push(...(analysis.annotations?.zones || []));
    }

    const workTypes = Array.from(allWorkTypes);
    const roomType = options.room_type || 'other';
    const template = roomTemplates[roomType] || roomTemplates.other;
    const surface = options.surface_area || template.avgSize;

    // Calculer les estimations pour chaque type de travail
    const estimates = workTypes.map(workType => {
        const config = aiConfig[workType];
        if (!config) return null;

        const estimate = calculateEstimate({
            work_type: workType,
            room_type: roomType,
            surface_area: surface,
            quality_level: options.quality_level || 'standard'
        });

        return {
            work_type: workType,
            name: config.name,
            ...estimate
        };
    }).filter(Boolean);

    const totalEstimate = estimates.reduce((sum, e) => sum + e.total_cost, 0);

    return {
        work_types: workTypes,
        room_type: roomType,
        room_name: template.name,
        surface_area: surface,
        estimates,
        total_estimate: totalEstimate,
        confidence: 0.8
    };
}

/**
 * Calculer une estimation de coût
 */
export function calculateEstimate(params) {
    const { work_type, room_type, surface_area, quality_level = 'standard', details = {} } = params;

    const config = aiConfig[work_type];
    if (!config) {
        return { error: 'Type de travail inconnu' };
    }

    const template = roomTemplates[room_type] || roomTemplates.other;
    const qualityMult = qualityMultipliers[quality_level] || qualityMultipliers.standard;
    const surface = surface_area || template.avgSize;

    // Calculer les matériaux
    const materials = config.materials.map(mat => {
        let quantity = mat.defaultQty;

        // Ajuster la quantité selon la surface
        if (['sqm', 'meter'].includes(mat.unit)) {
            quantity = Math.ceil(surface * (mat.unit === 'sqm' ? 1.1 : 0.5));
        } else {
            quantity = Math.ceil(mat.defaultQty * (surface / template.avgSize));
        }

        const unitPrice = Math.round(mat.pricePerUnit * qualityMult.materials * 100) / 100;
        const totalPrice = Math.round(quantity * unitPrice * 100) / 100;

        return {
            name: mat.name,
            quantity,
            unit: mat.unit,
            unit_price: unitPrice,
            total_price: totalPrice
        };
    });

    const materialsCost = materials.reduce((sum, m) => sum + m.total_price, 0);

    // Calculer la main d'œuvre
    const baseHours = surface * config.hoursPerSqm * template.complexity;
    const laborHours = Math.ceil(baseHours * qualityMult.labor);
    const laborRate = Math.round(config.laborRate * qualityMult.labor);
    const laborCost = laborHours * laborRate;

    const totalCost = Math.round((materialsCost + laborCost) * 100) / 100;

    return {
        work_type,
        work_name: config.name,
        room_type,
        room_name: template.name,
        surface_area: surface,
        quality_level,
        quality_name: qualityMult.name,
        materials,
        materials_cost: Math.round(materialsCost * 100) / 100,
        labor_hours: laborHours,
        labor_rate: laborRate,
        labor_cost: laborCost,
        total_cost: totalCost,
        estimated_days: Math.ceil(laborHours / 8)
    };
}

/**
 * Générer les recommandations
 */
export function generateRecommendations(analysis) {
    const recommendations = [];

    if (analysis.work_types.includes('electrical') && analysis.work_types.includes('plumbing')) {
        recommendations.push({
            type: 'order',
            title: 'Ordre des travaux',
            description: 'Commencer par l\'électricité avant la plomberie pour faciliter le passage des gaines.'
        });
    }

    if (analysis.work_types.includes('demolition')) {
        recommendations.push({
            type: 'safety',
            title: 'Sécurité démolition',
            description: 'Prévoir des équipements de protection et vérifier l\'absence d\'amiante.'
        });
    }

    if (analysis.work_types.includes('painting') && analysis.work_types.length > 2) {
        recommendations.push({
            type: 'order',
            title: 'Peinture en dernier',
            description: 'La peinture doit être réalisée après tous les autres travaux de gros œuvre.'
        });
    }

    recommendations.push({
        type: 'budget',
        title: 'Marge de sécurité',
        description: 'Prévoir une marge de 10-15% pour les imprévus.'
    });

    return recommendations;
}

/**
 * Générer des annotations pour l'image
 */
function generateAnnotations(workTypes) {
    const zones = [];
    const points = [];

    workTypes.forEach((workType, index) => {
        const config = aiConfig[workType];
        if (!config) return;

        // Générer des zones aléatoires
        zones.push({
            id: uuidv4(),
            x: 10 + (index * 20) % 60,
            y: 10 + Math.random() * 50,
            width: 20 + Math.random() * 20,
            height: 20 + Math.random() * 20,
            color: config.color,
            label: config.name,
            work_type: workType
        });

        // Générer des points d'annotation
        for (let i = 0; i < 2; i++) {
            points.push({
                id: uuidv4(),
                x: 5 + Math.random() * 90,
                y: 5 + Math.random() * 90,
                color: config.color,
                label: `${config.name} - Point ${i + 1}`,
                work_type: workType
            });
        }
    });

    return { zones, points };
}

/**
 * Générer un devis complet
 */
export async function generateFullDevis(params) {
    const { analysis, photos, room_type, work_types, quality_level = 'standard', surface_area } = params;

    const template = roomTemplates[room_type] || roomTemplates.other;
    const surface = surface_area || template.avgSize;
    const workTypesToUse = work_types || analysis?.work_types || template.typicalWorks;

    const subDevis = [];
    let totalMaterials = 0;
    let totalLabor = 0;

    for (let i = 0; i < workTypesToUse.length; i++) {
        const workType = workTypesToUse[i];
        const estimate = calculateEstimate({
            work_type: workType,
            room_type,
            surface_area: surface,
            quality_level
        });

        if (estimate.error) continue;

        subDevis.push({
            work_type: workType,
            title: estimate.work_name,
            description: generateWorkDescription(workType, room_type),
            materials: estimate.materials,
            materials_cost: estimate.materials_cost,
            labor_hours: estimate.labor_hours,
            labor_rate: estimate.labor_rate,
            labor_cost: estimate.labor_cost,
            total_cost: estimate.total_cost,
            priority: i + 1
        });

        totalMaterials += estimate.materials_cost;
        totalLabor += estimate.labor_cost;
    }

    return {
        room_type,
        room_name: template.name,
        surface_area: surface,
        quality_level,
        quality_name: qualityMultipliers[quality_level]?.name || 'Standard',
        sub_devis: subDevis,
        materials_total: Math.round(totalMaterials * 100) / 100,
        labor_total: Math.round(totalLabor * 100) / 100,
        total_amount: Math.round((totalMaterials + totalLabor) * 100) / 100,
        generated_at: new Date().toISOString()
    };
}

/**
 * Générer les sous-devis depuis une analyse
 */
export async function generateSubDevisFromAnalysis(analysis, devis) {
    const workTypes = analysis.detected_work_types || analysis.work_types || [];
    const roomType = devis.room_type || 'other';
    const surface = devis.surface_area || roomTemplates[roomType]?.avgSize || 15;

    const subDevisList = [];

    for (const workType of workTypes) {
        const estimate = calculateEstimate({
            work_type: workType,
            room_type: roomType,
            surface_area: surface,
            quality_level: 'standard'
        });

        if (estimate.error) continue;

        subDevisList.push({
            work_type: workType,
            title: estimate.work_name,
            description: generateWorkDescription(workType, roomType),
            materials: estimate.materials,
            materials_cost: estimate.materials_cost,
            labor_hours: estimate.labor_hours,
            labor_rate: estimate.labor_rate,
            labor_cost: estimate.labor_cost,
            total_cost: estimate.total_cost
        });
    }

    return subDevisList;
}

/**
 * Générer une description de travail
 */
function generateWorkDescription(workType, roomType) {
    const descriptions = {
        demolition: `Démolition et évacuation des éléments existants`,
        plumbing: `Installation et raccordement de la plomberie, pose des équipements sanitaires`,
        electrical: `Mise aux normes électriques, pose des prises, interrupteurs et points lumineux`,
        tiling: `Préparation des supports, pose du carrelage sol et mur avec finitions joints`,
        painting: `Préparation des surfaces, application sous-couche et peinture finition`,
        carpentry: `Travaux de menuiserie, ajustements et pose des éléments bois`,
        insulation: `Pose de l'isolation thermique et phonique avec finitions`,
        masonry: `Travaux de maçonnerie, construction ou modification de cloisons`,
        roofing: `Travaux de couverture et étanchéité`,
        flooring: `Pose du revêtement de sol et finitions`
    };

    return descriptions[workType] || `Travaux de ${aiConfig[workType]?.name || workType}`;
}

/**
 * Suggérer des matériaux
 */
export function suggestMaterials(params) {
    const { work_type, room_type, quality_level = 'standard', surface_area, budget } = params;

    const config = aiConfig[work_type];
    if (!config) return [];

    const qualityMult = qualityMultipliers[quality_level] || qualityMultipliers.standard;
    const template = roomTemplates[room_type] || roomTemplates.other;
    const surface = surface_area || template.avgSize;

    return config.materials.map(mat => {
        let quantity = mat.defaultQty;
        if (['sqm', 'meter'].includes(mat.unit)) {
            quantity = Math.ceil(surface * (mat.unit === 'sqm' ? 1.1 : 0.5));
        }

        return {
            name: mat.name,
            quantity,
            unit: mat.unit,
            unit_price: Math.round(mat.pricePerUnit * qualityMult.materials * 100) / 100,
            total_price: Math.round(quantity * mat.pricePerUnit * qualityMult.materials * 100) / 100,
            alternatives: generateAlternatives(mat, quality_level)
        };
    });
}

function generateAlternatives(material, currentQuality) {
    const alternatives = [];
    const qualities = ['economy', 'standard', 'premium'];

    for (const quality of qualities) {
        if (quality !== currentQuality) {
            const mult = qualityMultipliers[quality];
            alternatives.push({
                quality_level: quality,
                quality_name: mult.name,
                unit_price: Math.round(material.pricePerUnit * mult.materials * 100) / 100
            });
        }
    }

    return alternatives;
}

/**
 * Optimiser un devis
 */
export function optimizeDevis(devisData, goal = 'cost') {
    const optimizations = [];

    if (goal === 'cost') {
        optimizations.push({
            type: 'quality',
            title: 'Passer en qualité économique',
            description: 'Utiliser des matériaux économiques peut réduire le coût de 20-30%',
            estimated_savings: '20-30%'
        });

        optimizations.push({
            type: 'timing',
            title: 'Regrouper les travaux',
            description: 'Faire tous les travaux en même temps réduit les frais de déplacement',
            estimated_savings: '5-10%'
        });
    }

    if (goal === 'time') {
        optimizations.push({
            type: 'parallel',
            title: 'Travaux en parallèle',
            description: 'Certains travaux peuvent être réalisés simultanément',
            estimated_time_saved: '20-30%'
        });
    }

    return optimizations;
}

/**
 * Chat avec l'assistant IA
 */
export async function generateChatResponse(message, context = {}) {
    // Simulation simple de réponse
    const lowerMessage = message.toLowerCase();

    let response = "Je suis votre assistant RenoAI. Comment puis-je vous aider avec votre projet de rénovation ?";
    const suggestions = [];

    if (lowerMessage.includes('budget') || lowerMessage.includes('coût') || lowerMessage.includes('prix')) {
        response = "Pour estimer un budget précis, j'aurais besoin de connaître le type de pièce et les travaux envisagés. Vous pouvez créer un devis IA pour obtenir une estimation détaillée.";
        suggestions.push('Créer un devis', 'Voir les tarifs');
    } else if (lowerMessage.includes('délai') || lowerMessage.includes('temps') || lowerMessage.includes('durée')) {
        response = "La durée des travaux dépend de leur nature et de la surface. En général, comptez 1-2 semaines pour une salle de bain, 2-3 semaines pour une cuisine.";
        suggestions.push('Estimer les délais', 'Planifier les travaux');
    } else if (lowerMessage.includes('artisan') || lowerMessage.includes('professionnel')) {
        response = "Vous pouvez consulter notre marketplace d'artisans vérifiés pour trouver des professionnels qualifiés près de chez vous.";
        suggestions.push('Voir les artisans', 'Demander des devis');
    }

    return { message: response, suggestions };
}

/**
 * Obtenir les tarifs de référence
 */
export function getPricingReference(workType, roomType) {
    const pricing = {};

    if (workType && aiConfig[workType]) {
        pricing[workType] = {
            name: aiConfig[workType].name,
            labor_rate: aiConfig[workType].laborRate,
            materials: aiConfig[workType].materials
        };
    } else {
        for (const [type, config] of Object.entries(aiConfig)) {
            pricing[type] = {
                name: config.name,
                labor_rate: config.laborRate,
                materials_count: config.materials.length
            };
        }
    }

    return pricing;
}

/**
 * Obtenir le catalogue de matériaux
 */
export function getMaterialsCatalog(params = {}) {
    const { work_type, quality_level, search } = params;
    const catalog = [];

    for (const [type, config] of Object.entries(aiConfig)) {
        if (work_type && type !== work_type) continue;

        for (const mat of config.materials) {
            if (search && !mat.name.toLowerCase().includes(search.toLowerCase())) continue;

            catalog.push({
                work_type: type,
                work_name: config.name,
                name: mat.name,
                unit: mat.unit,
                price_economy: Math.round(mat.pricePerUnit * 0.7 * 100) / 100,
                price_standard: mat.pricePerUnit,
                price_premium: Math.round(mat.pricePerUnit * 1.5 * 100) / 100,
                price_luxury: Math.round(mat.pricePerUnit * 2.5 * 100) / 100
            });
        }
    }

    return catalog;
}

/**
 * Comparer des devis
 */
export function compareDevis(devisList) {
    if (devisList.length < 2) return { error: 'Au moins 2 devis requis' };

    const comparison = {
        devis: devisList.map(d => ({
            id: d.id,
            title: d.title,
            total_amount: d.total_amount,
            materials_total: d.materials_total,
            labor_total: d.labor_total,
            sub_devis_count: d.sub_devis?.length || 0
        })),
        cheapest: null,
        most_expensive: null,
        average: 0,
        price_difference: 0
    };

    const amounts = devisList.map(d => d.total_amount || 0);
    comparison.cheapest = devisList.find(d => d.total_amount === Math.min(...amounts))?.id;
    comparison.most_expensive = devisList.find(d => d.total_amount === Math.max(...amounts))?.id;
    comparison.average = Math.round(amounts.reduce((a, b) => a + b, 0) / amounts.length);
    comparison.price_difference = Math.max(...amounts) - Math.min(...amounts);

    return comparison;
}

/**
 * Annoter une image
 */
export async function annotateImage(imageUrl, params = {}) {
    const { work_types = [], annotations = {} } = params;

    // En production, cela utiliserait Sharp pour créer l'overlay
    // Pour l'instant, retourner l'URL originale avec les annotations en JSON
    return {
        original_url: imageUrl,
        annotated_url: imageUrl, // En production: URL de l'image annotée
        annotations: annotations.zones || generateAnnotations(work_types).zones,
        work_types
    };
}

export default {
    aiConfig,
    roomTemplates,
    analyzePhoto,
    analyzePhotos,
    detectWorkTypes,
    consolidateAnalyses,
    calculateEstimate,
    generateRecommendations,
    generateFullDevis,
    generateSubDevisFromAnalysis,
    suggestMaterials,
    optimizeDevis,
    generateChatResponse,
    getPricingReference,
    getMaterialsCatalog,
    compareDevis,
    annotateImage
};
