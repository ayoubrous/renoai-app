import { jest } from '@jest/globals';

const mockExistsSync = jest.fn(() => true);
const mockMkdirSync = jest.fn();
const mockWriteFileSync = jest.fn();

jest.unstable_mockModule('fs', () => ({
  default: {
    existsSync: mockExistsSync,
    mkdirSync: mockMkdirSync,
    writeFileSync: mockWriteFileSync
  },
  existsSync: mockExistsSync,
  mkdirSync: mockMkdirSync,
  writeFileSync: mockWriteFileSync
}));

const { PDFDocumentBuilder, PDFService } = await import('../../../server/services/pdfService.js');
const pdfServiceDefault = (await import('../../../server/services/pdfService.js')).default;

describe('pdfService', () => {
  // ---- PDFDocumentBuilder ----
  describe('PDFDocumentBuilder', () => {
    let builder;

    beforeEach(() => {
      builder = new PDFDocumentBuilder();
    });

    it('should initialize content array and styles', () => {
      expect(builder.content).toEqual([]);
      expect(builder.styles).toBeDefined();
      expect(builder.defaultStyle).toBeDefined();
    });

    it('should format currency in EUR', () => {
      const formatted = builder.formatCurrency(1500);
      expect(formatted).toContain('1');
      expect(formatted).toContain('500');
      expect(formatted).toMatch(/€/);
    });

    it('should format date in fr-LU locale', () => {
      const formatted = builder.formatDate('2025-06-15');
      // fr-LU date: dd/MM/yyyy
      expect(formatted).toMatch(/15/);
      expect(formatted).toMatch(/06/);
      expect(formatted).toMatch(/2025/);
    });

    it('should format number with specified decimals', () => {
      const formatted = builder.formatNumber(1234.5, 2);
      expect(formatted).toContain('1');
      expect(formatted).toContain('234');
    });

    it('should add header content with company info', () => {
      builder.addHeader('DEVIS', 'Subtitle');
      expect(builder.content.length).toBeGreaterThan(0);
      const header = builder.content[0];
      expect(header.columns).toBeDefined();
    });

    it('should add client info', () => {
      builder.addClientInfo({ first_name: 'Jean', last_name: 'Dupont', email: 'jean@test.lu' });
      expect(builder.content.length).toBe(1);
      const section = builder.content[0];
      expect(section.columns).toBeDefined();
    });

    it('should add client info with project if provided', () => {
      builder.addClientInfo(
        { first_name: 'Jean', last_name: 'Dupont' },
        { name: 'Projet Test', address: '1 rue Test' }
      );
      const section = builder.content[0];
      expect(section.columns).toHaveLength(2);
    });

    it('should return styles object with expected keys via getDefaultStyles', () => {
      const styles = builder.getDefaultStyles();
      expect(styles).toHaveProperty('header');
      expect(styles).toHaveProperty('subheader');
      expect(styles).toHaveProperty('sectionTitle');
      expect(styles).toHaveProperty('tableHeader');
      expect(styles).toHaveProperty('tableCell');
      expect(styles).toHaveProperty('total');
      expect(styles).toHaveProperty('footer');
    });

    it('should build and return document definition object', () => {
      builder.addHeader('TEST');
      const doc = builder.build();
      expect(doc).toHaveProperty('content');
      expect(doc).toHaveProperty('styles');
      expect(doc).toHaveProperty('defaultStyle');
      expect(doc).toHaveProperty('footer');
      expect(doc).toHaveProperty('pageSize', 'A4');
      expect(doc).toHaveProperty('pageMargins');
    });

    it('should add totals section', () => {
      builder.addTotals({ subtotal: 1000, tva: 170, total: 1170 });
      expect(builder.content.length).toBe(1);
    });

    it('should add footer function', () => {
      const footerFn = builder.addFooter();
      expect(typeof footerFn).toBe('function');
      const result = footerFn(1, 3);
      expect(result.columns).toBeDefined();
    });
  });

  // ---- PDFService / generateDevis ----
  describe('PDFService', () => {
    it('should be a singleton instance', () => {
      expect(pdfServiceDefault).toBeDefined();
      expect(typeof pdfServiceDefault.generateDevis).toBe('function');
    });

    it('should generate devis PDF with doc definition', async () => {
      const devis = { id: 1, title: 'Test Devis', status: 'draft', created_at: '2025-01-01' };
      const client = { first_name: 'Jean', last_name: 'Dupont' };
      const items = [
        { description: 'Peinture', quantity: 10, unit: 'm²', unit_price: 25 }
      ];

      const result = await pdfServiceDefault.generateDevis(devis, client, null, items);
      expect(result.success).toBe(true);
      expect(result.filename).toBeDefined();
      expect(result.docDefinition).toBeDefined();
      expect(result.docDefinition.content.length).toBeGreaterThan(0);
    });

    it('should generate devis PDF with project info', async () => {
      const devis = { id: 2, title: 'Devis Projet', status: 'sent', created_at: '2025-02-01' };
      const client = { first_name: 'Marie', last_name: 'Martin' };
      const project = { name: 'Rénovation', address: '5 rue Exemple' };
      const items = [];

      const result = await pdfServiceDefault.generateDevis(devis, client, project, items);
      expect(result.success).toBe(true);
    });

    it('should generate facture PDF', async () => {
      const facture = { invoice_number: 'FAC-001', invoice_date: '2025-03-01', due_date: '2025-04-01' };
      const client = { first_name: 'Luc', last_name: 'Bernard' };
      const items = [{ description: 'Service', quantity: 1, unit_price: 500 }];

      const result = await pdfServiceDefault.generateFacture(facture, client, null, items);
      expect(result.success).toBe(true);
      expect(result.docDefinition).toBeDefined();
    });

    it('should calculate totals correctly', () => {
      const items = [
        { quantity: 2, unit_price: 100 },
        { quantity: 3, unit_price: 50 }
      ];
      const totals = pdfServiceDefault.calculateTotals(items, { tva_rate: 17 });
      expect(totals.subtotal).toBe(350);
      expect(totals.tva).toBeCloseTo(59.5);
      expect(totals.total).toBeCloseTo(409.5);
    });
  });
});
