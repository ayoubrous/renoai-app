/**
 * Tests — aiService.js
 * Comportement : estimation de coûts, détection de travaux, génération de devis
 */

import { jest } from '@jest/globals';

// Mock uuid avant l'import du module
jest.unstable_mockModule('uuid', () => ({
  v4: () => 'mock-uuid-1234',
}));

// Mock fs et path (non utilisés dans les fonctions testées mais importés)
jest.unstable_mockModule('fs', () => ({ default: {} }));
jest.unstable_mockModule('path', () => ({
  default: { dirname: () => '/mock', join: (...args) => args.join('/') },
  dirname: () => '/mock',
  join: (...args) => args.join('/'),
}));
jest.unstable_mockModule('url', () => ({
  fileURLToPath: () => '/mock/aiService.js',
}));

const {
  calculateEstimate,
  detectWorkTypes,
  consolidateAnalyses,
  generateRecommendations,
  generateFullDevis,
  suggestMaterials,
  compareDevis,
  optimizeDevis,
  generateChatResponse,
  getPricingReference,
  getMaterialsCatalog,
  aiConfig,
  roomTemplates,
} = await import('../../../server/services/aiService.js');

// ========================================
// calculateEstimate
// ========================================

describe('calculateEstimate', () => {
  test('retourne une estimation valide pour un type de travail connu', () => {
    const result = calculateEstimate({
      work_type: 'painting',
      room_type: 'bedroom',
      surface_area: 14,
      quality_level: 'standard',
    });

    expect(result).toHaveProperty('work_type', 'painting');
    expect(result).toHaveProperty('materials');
    expect(result).toHaveProperty('materials_cost');
    expect(result).toHaveProperty('labor_hours');
    expect(result).toHaveProperty('labor_cost');
    expect(result).toHaveProperty('total_cost');
    expect(result.total_cost).toBe(result.materials_cost + result.labor_cost);
    expect(result.materials.length).toBeGreaterThan(0);
  });

  test('retourne une erreur pour un type de travail inconnu', () => {
    const result = calculateEstimate({
      work_type: 'unknown_type',
      room_type: 'bedroom',
    });
    expect(result).toEqual({ error: 'Type de travail inconnu' });
  });

  test('utilise la surface par défaut du template de pièce si non fournie', () => {
    const result = calculateEstimate({
      work_type: 'electrical',
      room_type: 'bathroom',
    });
    // bathroom avgSize = 8
    expect(result.surface_area).toBe(8);
  });

  test.each(['economy', 'standard', 'premium', 'luxury'])(
    'applique le multiplicateur de qualité "%s"',
    (quality) => {
      const result = calculateEstimate({
        work_type: 'plumbing',
        room_type: 'kitchen',
        surface_area: 10,
        quality_level: quality,
      });
      expect(result.quality_level).toBe(quality);
      expect(result.total_cost).toBeGreaterThan(0);
    }
  );

  test('les coûts sont arrondis au centime', () => {
    const result = calculateEstimate({
      work_type: 'tiling',
      room_type: 'bathroom',
      surface_area: 8,
    });
    // Vérifier que materials_cost a au plus 2 décimales
    expect(Number(result.materials_cost.toFixed(2))).toBe(result.materials_cost);
    expect(Number(result.total_cost.toFixed(2))).toBe(result.total_cost);
  });

  test('calcule les jours estimés à partir des heures de travail', () => {
    const result = calculateEstimate({
      work_type: 'demolition',
      room_type: 'living_room',
      surface_area: 25,
    });
    expect(result.estimated_days).toBe(Math.ceil(result.labor_hours / 8));
  });

  test.each(Object.keys(aiConfig))('fonctionne pour chaque type de travail : %s', (workType) => {
    const result = calculateEstimate({
      work_type: workType,
      room_type: 'other',
      surface_area: 15,
    });
    expect(result.total_cost).toBeGreaterThan(0);
    expect(result.materials.length).toBeGreaterThan(0);
  });
});

// ========================================
// detectWorkTypes
// ========================================

describe('detectWorkTypes', () => {
  test('détecte la plomberie depuis une description', () => {
    const result = detectWorkTypes('Je dois refaire la douche et les tuyaux');
    expect(result).toContain('plumbing');
  });

  test('détecte plusieurs types de travaux', () => {
    const result = detectWorkTypes('Refaire la peinture et poser du carrelage dans la cuisine');
    expect(result).toContain('painting');
    expect(result).toContain('tiling');
  });

  test('retourne un tableau vide pour une description sans mots-clés', () => {
    const result = detectWorkTypes('Bonjour, je cherche des informations');
    expect(result).toEqual([]);
  });

  test('gère une description null ou vide', () => {
    expect(detectWorkTypes(null)).toEqual([]);
    expect(detectWorkTypes('')).toEqual([]);
    expect(detectWorkTypes(undefined)).toEqual([]);
  });
});

// ========================================
// consolidateAnalyses
// ========================================

describe('consolidateAnalyses', () => {
  test('combine les types de travaux de plusieurs analyses (dédupliqués)', () => {
    const analyses = [
      { detected_work_types: ['painting', 'electrical'], annotations: { zones: [] } },
      { detected_work_types: ['painting', 'plumbing'], annotations: { zones: [] } },
    ];
    const result = consolidateAnalyses(analyses, { room_type: 'bathroom', surface_area: 10 });

    expect(result.work_types).toContain('painting');
    expect(result.work_types).toContain('electrical');
    expect(result.work_types).toContain('plumbing');
    // painting ne doit apparaître qu'une fois
    expect(result.work_types.filter((w) => w === 'painting')).toHaveLength(1);
    expect(result.total_estimate).toBeGreaterThan(0);
  });

  test('utilise la surface par défaut du template si non fournie', () => {
    const analyses = [{ detected_work_types: ['painting'], annotations: { zones: [] } }];
    const result = consolidateAnalyses(analyses, { room_type: 'bathroom' });
    expect(result.surface_area).toBe(8); // bathroom avgSize
  });
});

// ========================================
// generateRecommendations
// ========================================

describe('generateRecommendations', () => {
  test('recommande l\'ordre électricité/plomberie si les deux sont présents', () => {
    const recs = generateRecommendations({ work_types: ['electrical', 'plumbing'] });
    expect(recs.some((r) => r.type === 'order')).toBe(true);
  });

  test('recommande la sécurité pour la démolition', () => {
    const recs = generateRecommendations({ work_types: ['demolition'] });
    expect(recs.some((r) => r.type === 'safety')).toBe(true);
  });

  test('inclut toujours une recommandation budget', () => {
    const recs = generateRecommendations({ work_types: [] });
    expect(recs.some((r) => r.type === 'budget')).toBe(true);
  });
});

// ========================================
// generateFullDevis
// ========================================

describe('generateFullDevis', () => {
  test('génère un devis complet avec sous-devis', async () => {
    const result = await generateFullDevis({
      room_type: 'bathroom',
      work_types: ['plumbing', 'tiling'],
      quality_level: 'standard',
      surface_area: 8,
    });

    expect(result.sub_devis).toHaveLength(2);
    expect(result.total_amount).toBe(result.materials_total + result.labor_total);
    expect(result.room_name).toBe('Salle de bain');
    expect(result).toHaveProperty('generated_at');
  });

  test('ignore les types de travaux inconnus', async () => {
    const result = await generateFullDevis({
      room_type: 'bathroom',
      work_types: ['plumbing', 'unknown_type'],
      surface_area: 8,
    });
    expect(result.sub_devis).toHaveLength(1);
  });
});

// ========================================
// suggestMaterials
// ========================================

describe('suggestMaterials', () => {
  test('retourne les matériaux avec alternatives de qualité', () => {
    const materials = suggestMaterials({
      work_type: 'painting',
      room_type: 'bedroom',
      quality_level: 'standard',
    });
    expect(materials.length).toBeGreaterThan(0);
    expect(materials[0]).toHaveProperty('alternatives');
    // Les alternatives ne contiennent pas le niveau actuel
    expect(materials[0].alternatives.every((a) => a.quality_level !== 'standard')).toBe(true);
  });

  test('retourne un tableau vide pour un type inconnu', () => {
    expect(suggestMaterials({ work_type: 'unknown' })).toEqual([]);
  });
});

// ========================================
// compareDevis
// ========================================

describe('compareDevis', () => {
  test('compare 2 devis et identifie le moins cher', () => {
    const result = compareDevis([
      { id: 'a', title: 'A', total_amount: 1000, materials_total: 500, labor_total: 500 },
      { id: 'b', title: 'B', total_amount: 2000, materials_total: 1000, labor_total: 1000 },
    ]);
    expect(result.cheapest).toBe('a');
    expect(result.most_expensive).toBe('b');
    expect(result.price_difference).toBe(1000);
  });

  test('retourne une erreur si moins de 2 devis', () => {
    const result = compareDevis([{ id: 'a', total_amount: 1000 }]);
    expect(result).toEqual({ error: 'Au moins 2 devis requis' });
  });
});

// ========================================
// optimizeDevis
// ========================================

describe('optimizeDevis', () => {
  test('retourne des optimisations de coût par défaut', () => {
    const opts = optimizeDevis({}, 'cost');
    expect(opts.length).toBeGreaterThan(0);
    expect(opts.some((o) => o.type === 'quality')).toBe(true);
  });

  test('retourne des optimisations de temps', () => {
    const opts = optimizeDevis({}, 'time');
    expect(opts.some((o) => o.type === 'parallel')).toBe(true);
  });
});

// ========================================
// generateChatResponse
// ========================================

describe('generateChatResponse', () => {
  test('répond aux questions de budget avec des suggestions', async () => {
    const result = await generateChatResponse('Quel est le coût estimé ?');
    expect(result.message).toBeTruthy();
    expect(result.suggestions.length).toBeGreaterThan(0);
  });

  test('retourne une réponse par défaut pour un message générique', async () => {
    const result = await generateChatResponse('hello');
    expect(result.message).toBeTruthy();
  });
});

// ========================================
// getPricingReference
// ========================================

describe('getPricingReference', () => {
  test('retourne le tarif pour un type spécifique', () => {
    const pricing = getPricingReference('plumbing');
    expect(pricing.plumbing).toHaveProperty('labor_rate', 65);
    expect(pricing.plumbing).toHaveProperty('materials');
  });

  test('retourne tous les tarifs si aucun type spécifié', () => {
    const pricing = getPricingReference();
    expect(Object.keys(pricing).length).toBe(Object.keys(aiConfig).length);
  });
});

// ========================================
// getMaterialsCatalog
// ========================================

describe('getMaterialsCatalog', () => {
  test('retourne tout le catalogue sans filtre', () => {
    const catalog = getMaterialsCatalog();
    expect(catalog.length).toBeGreaterThan(0);
    expect(catalog[0]).toHaveProperty('price_economy');
    expect(catalog[0]).toHaveProperty('price_standard');
  });

  test('filtre par type de travail', () => {
    const catalog = getMaterialsCatalog({ work_type: 'painting' });
    expect(catalog.every((m) => m.work_type === 'painting')).toBe(true);
  });

  test('filtre par recherche textuelle', () => {
    const catalog = getMaterialsCatalog({ search: 'peinture' });
    expect(catalog.length).toBeGreaterThan(0);
    expect(catalog.every((m) => m.name.toLowerCase().includes('peinture'))).toBe(true);
  });
});
