/**
 * RenoAI - Service de Génération PDF
 * Création de devis et factures professionnels
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
    outputDir: path.join(__dirname, '../../uploads/pdf'),
    logoPath: path.join(__dirname, '../../public/logo.png'),
    fonts: {
        normal: 'Helvetica',
        bold: 'Helvetica-Bold'
    },
    colors: {
        primary: '#2563eb',
        secondary: '#059669',
        text: '#0f172a',
        muted: '#64748b',
        border: '#e2e8f0',
        success: '#16a34a',
        warning: '#d97706'
    },
    company: {
        name: 'RenoAI',
        address: 'Luxembourg',
        phone: '+352 XX XX XX XX',
        email: 'contact@renoai.lu',
        website: 'www.renoai.lu',
        rcs: 'B-XXXXXX',
        tva: 'LU-XXXXXXXX'
    }
};

// ============================================
// PDF DOCUMENT BUILDER
// ============================================

class PDFDocumentBuilder {
    constructor() {
        this.content = [];
        this.styles = this.getDefaultStyles();
        this.defaultStyle = {
            font: CONFIG.fonts.normal,
            fontSize: 10,
            color: CONFIG.colors.text
        };
    }

    getDefaultStyles() {
        return {
            header: {
                fontSize: 24,
                bold: true,
                color: CONFIG.colors.primary,
                margin: [0, 0, 0, 10]
            },
            subheader: {
                fontSize: 14,
                bold: true,
                color: CONFIG.colors.text,
                margin: [0, 15, 0, 5]
            },
            sectionTitle: {
                fontSize: 12,
                bold: true,
                color: CONFIG.colors.primary,
                margin: [0, 20, 0, 10]
            },
            tableHeader: {
                bold: true,
                fontSize: 10,
                color: '#ffffff',
                fillColor: CONFIG.colors.primary,
                alignment: 'left'
            },
            tableCell: {
                fontSize: 9,
                color: CONFIG.colors.text
            },
            total: {
                fontSize: 12,
                bold: true,
                color: CONFIG.colors.text
            },
            footer: {
                fontSize: 8,
                color: CONFIG.colors.muted,
                alignment: 'center'
            }
        };
    }

    // ============================================
    // HELPERS
    // ============================================

    formatCurrency(amount) {
        return new Intl.NumberFormat('fr-LU', {
            style: 'currency',
            currency: 'EUR'
        }).format(amount);
    }

    formatDate(date) {
        return new Intl.DateTimeFormat('fr-LU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }).format(new Date(date));
    }

    formatNumber(num, decimals = 2) {
        return new Intl.NumberFormat('fr-LU', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        }).format(num);
    }

    // ============================================
    // BUILDERS
    // ============================================

    addHeader(title, subtitle = '') {
        this.content.push({
            columns: [
                {
                    width: '*',
                    stack: [
                        { text: CONFIG.company.name, style: 'header' },
                        { text: CONFIG.company.address, style: 'footer' },
                        { text: `Tél: ${CONFIG.company.phone}`, style: 'footer' },
                        { text: CONFIG.company.email, style: 'footer' }
                    ]
                },
                {
                    width: 'auto',
                    stack: [
                        { text: title, style: 'header', alignment: 'right' },
                        subtitle ? { text: subtitle, style: 'subheader', alignment: 'right' } : null
                    ].filter(Boolean)
                }
            ],
            margin: [0, 0, 0, 20]
        });

        // Ligne de séparation
        this.content.push({
            canvas: [{
                type: 'line',
                x1: 0, y1: 0,
                x2: 515, y2: 0,
                lineWidth: 2,
                lineColor: CONFIG.colors.primary
            }],
            margin: [0, 0, 0, 20]
        });
    }

    addClientInfo(client, project = null) {
        const columns = [
            {
                width: '50%',
                stack: [
                    { text: 'CLIENT', style: 'sectionTitle' },
                    { text: `${client.first_name} ${client.last_name}`, bold: true },
                    client.company ? { text: client.company } : null,
                    client.address ? { text: client.address } : null,
                    client.postal_code && client.city
                        ? { text: `${client.postal_code} ${client.city}` }
                        : null,
                    client.email ? { text: client.email, color: CONFIG.colors.muted } : null,
                    client.phone ? { text: client.phone, color: CONFIG.colors.muted } : null
                ].filter(Boolean)
            }
        ];

        if (project) {
            columns.push({
                width: '50%',
                stack: [
                    { text: 'PROJET', style: 'sectionTitle' },
                    { text: project.name, bold: true },
                    project.address ? { text: project.address } : null,
                    project.postal_code && project.city
                        ? { text: `${project.postal_code} ${project.city}` }
                        : null,
                    project.surface_m2
                        ? { text: `Surface: ${project.surface_m2} m²`, color: CONFIG.colors.muted }
                        : null
                ].filter(Boolean)
            });
        }

        this.content.push({
            columns,
            columnGap: 20,
            margin: [0, 0, 0, 20]
        });
    }

    addDevisInfo(devis) {
        const infoTable = {
            table: {
                widths: ['auto', '*', 'auto', '*'],
                body: [
                    [
                        { text: 'N° Devis:', bold: true },
                        { text: devis.devis_number || `DEV-${devis.id}` },
                        { text: 'Date:', bold: true },
                        { text: this.formatDate(devis.created_at) }
                    ],
                    [
                        { text: 'Validité:', bold: true },
                        { text: devis.valid_until ? this.formatDate(devis.valid_until) : '30 jours' },
                        { text: 'Statut:', bold: true },
                        { text: this.getStatusLabel(devis.status), color: this.getStatusColor(devis.status) }
                    ]
                ]
            },
            layout: 'noBorders',
            margin: [0, 0, 0, 20]
        };

        this.content.push(infoTable);
    }

    getStatusLabel(status) {
        const labels = {
            draft: 'Brouillon',
            sent: 'Envoyé',
            accepted: 'Accepté',
            rejected: 'Refusé',
            expired: 'Expiré',
            revised: 'Révisé'
        };
        return labels[status] || status;
    }

    getStatusColor(status) {
        const colors = {
            draft: CONFIG.colors.muted,
            sent: CONFIG.colors.primary,
            accepted: CONFIG.colors.success,
            rejected: '#dc2626',
            expired: CONFIG.colors.warning,
            revised: CONFIG.colors.primary
        };
        return colors[status] || CONFIG.colors.text;
    }

    addItemsTable(items) {
        const tableBody = [
            // En-tête
            [
                { text: 'Description', style: 'tableHeader' },
                { text: 'Qté', style: 'tableHeader', alignment: 'center' },
                { text: 'Unité', style: 'tableHeader', alignment: 'center' },
                { text: 'P.U. HT', style: 'tableHeader', alignment: 'right' },
                { text: 'Total HT', style: 'tableHeader', alignment: 'right' }
            ]
        ];

        // Lignes
        for (const item of items) {
            const total = (item.quantity || 1) * (item.unit_price || 0);
            tableBody.push([
                {
                    stack: [
                        { text: item.description || item.name, style: 'tableCell' },
                        item.details ? { text: item.details, fontSize: 8, color: CONFIG.colors.muted } : null
                    ].filter(Boolean)
                },
                { text: this.formatNumber(item.quantity || 1, 2), style: 'tableCell', alignment: 'center' },
                { text: item.unit || 'u', style: 'tableCell', alignment: 'center' },
                { text: this.formatCurrency(item.unit_price || 0), style: 'tableCell', alignment: 'right' },
                { text: this.formatCurrency(total), style: 'tableCell', alignment: 'right' }
            ]);
        }

        this.content.push({
            table: {
                headerRows: 1,
                widths: ['*', 50, 50, 80, 80],
                body: tableBody
            },
            layout: {
                hLineWidth: (i, node) => (i === 0 || i === 1 || i === node.table.body.length) ? 1 : 0.5,
                vLineWidth: () => 0,
                hLineColor: (i) => i === 1 ? CONFIG.colors.primary : CONFIG.colors.border,
                paddingLeft: () => 8,
                paddingRight: () => 8,
                paddingTop: () => 6,
                paddingBottom: () => 6
            },
            margin: [0, 0, 0, 20]
        });
    }

    addTotals(totals, options = {}) {
        const { showTVA = true, tvaRate = 17 } = options;

        const rows = [];

        // Sous-total HT
        rows.push([
            { text: 'Sous-total HT:', alignment: 'right', margin: [0, 0, 20, 0] },
            { text: this.formatCurrency(totals.subtotal), alignment: 'right', bold: true }
        ]);

        // Remise si applicable
        if (totals.discount && totals.discount > 0) {
            rows.push([
                { text: `Remise (${totals.discountPercent || 0}%):`, alignment: 'right', margin: [0, 0, 20, 0], color: CONFIG.colors.success },
                { text: `-${this.formatCurrency(totals.discount)}`, alignment: 'right', color: CONFIG.colors.success }
            ]);
        }

        // TVA
        if (showTVA) {
            rows.push([
                { text: `TVA (${tvaRate}%):`, alignment: 'right', margin: [0, 0, 20, 0] },
                { text: this.formatCurrency(totals.tva), alignment: 'right' }
            ]);
        }

        // Total TTC
        rows.push([
            { text: 'TOTAL TTC:', alignment: 'right', margin: [0, 0, 20, 0], style: 'total' },
            {
                text: this.formatCurrency(totals.total),
                alignment: 'right',
                style: 'total',
                fillColor: CONFIG.colors.primary,
                color: '#ffffff'
            }
        ]);

        this.content.push({
            columns: [
                { width: '*', text: '' },
                {
                    width: 'auto',
                    table: {
                        widths: ['auto', 100],
                        body: rows
                    },
                    layout: {
                        hLineWidth: () => 0,
                        vLineWidth: () => 0,
                        paddingTop: () => 4,
                        paddingBottom: () => 4
                    }
                }
            ],
            margin: [0, 0, 0, 30]
        });
    }

    addPaymentTerms(terms = {}) {
        const defaultTerms = {
            acompte: 30,
            intermediaire: 40,
            solde: 30,
            delaiPaiement: 30
        };

        const t = { ...defaultTerms, ...terms };

        this.content.push({
            stack: [
                { text: 'CONDITIONS DE PAIEMENT', style: 'sectionTitle' },
                {
                    ul: [
                        `Acompte à la commande: ${t.acompte}%`,
                        `Paiement intermédiaire (50% avancement): ${t.intermediaire}%`,
                        `Solde à la réception des travaux: ${t.solde}%`,
                        `Délai de paiement: ${t.delaiPaiement} jours`
                    ],
                    margin: [0, 0, 0, 10]
                }
            ],
            margin: [0, 0, 0, 20]
        });
    }

    addConditionsGenerales() {
        this.content.push({
            stack: [
                { text: 'CONDITIONS GÉNÉRALES', style: 'sectionTitle' },
                {
                    text: [
                        'Ce devis est valable 30 jours à compter de sa date d\'émission. ',
                        'Les prix sont exprimés en euros et s\'entendent hors taxes. ',
                        'La TVA luxembourgeoise en vigueur sera appliquée. ',
                        'Tout retard de paiement entraînera des pénalités de retard au taux légal en vigueur. ',
                        'Les travaux sont garantis conformément à la législation luxembourgeoise en vigueur.'
                    ],
                    fontSize: 8,
                    color: CONFIG.colors.muted,
                    alignment: 'justify'
                }
            ],
            margin: [0, 0, 0, 20]
        });
    }

    addSignatureBlock() {
        this.content.push({
            columns: [
                {
                    width: '45%',
                    stack: [
                        { text: 'Bon pour accord', bold: true, margin: [0, 0, 0, 5] },
                        { text: 'Date et signature du client:', fontSize: 9 },
                        {
                            canvas: [{
                                type: 'rect',
                                x: 0, y: 10,
                                w: 200, h: 60,
                                lineWidth: 1,
                                lineColor: CONFIG.colors.border
                            }]
                        }
                    ]
                },
                { width: '10%', text: '' },
                {
                    width: '45%',
                    stack: [
                        { text: 'Pour RenoAI', bold: true, margin: [0, 0, 0, 5] },
                        { text: 'Cachet et signature:', fontSize: 9 },
                        {
                            canvas: [{
                                type: 'rect',
                                x: 0, y: 10,
                                w: 200, h: 60,
                                lineWidth: 1,
                                lineColor: CONFIG.colors.border
                            }]
                        }
                    ]
                }
            ],
            margin: [0, 20, 0, 0]
        });
    }

    addFooter() {
        return (currentPage, pageCount) => ({
            columns: [
                {
                    text: `${CONFIG.company.name} - RCS: ${CONFIG.company.rcs} - TVA: ${CONFIG.company.tva}`,
                    style: 'footer',
                    alignment: 'left'
                },
                {
                    text: `Page ${currentPage} / ${pageCount}`,
                    style: 'footer',
                    alignment: 'right'
                }
            ],
            margin: [40, 10, 40, 0]
        });
    }

    // ============================================
    // BUILD DOCUMENT
    // ============================================

    build() {
        return {
            content: this.content,
            styles: this.styles,
            defaultStyle: this.defaultStyle,
            footer: this.addFooter(),
            pageSize: 'A4',
            pageMargins: [40, 40, 40, 60]
        };
    }
}

// ============================================
// PDF SERVICE CLASS
// ============================================

class PDFService {
    constructor() {
        this.ensureOutputDir();
    }

    ensureOutputDir() {
        if (!fs.existsSync(CONFIG.outputDir)) {
            fs.mkdirSync(CONFIG.outputDir, { recursive: true });
        }
    }

    /**
     * Générer un devis PDF
     */
    async generateDevis(devis, client, project = null, items = []) {
        const builder = new PDFDocumentBuilder();

        // En-tête
        builder.addHeader('DEVIS', devis.title || 'Travaux de rénovation');

        // Info devis
        builder.addDevisInfo(devis);

        // Info client et projet
        builder.addClientInfo(client, project);

        // Description des travaux
        if (devis.description) {
            builder.content.push({
                stack: [
                    { text: 'DESCRIPTION DES TRAVAUX', style: 'sectionTitle' },
                    { text: devis.description, margin: [0, 0, 0, 15] }
                ]
            });
        }

        // Tableau des prestations
        if (items.length > 0) {
            builder.content.push({ text: 'DÉTAIL DES PRESTATIONS', style: 'sectionTitle' });
            builder.addItemsTable(items);
        }

        // Totaux
        const totals = this.calculateTotals(items, devis);
        builder.addTotals(totals, {
            showTVA: true,
            tvaRate: devis.tva_rate || 17
        });

        // Conditions de paiement
        builder.addPaymentTerms(devis.payment_terms);

        // Conditions générales
        builder.addConditionsGenerales();

        // Zone de signature
        builder.addSignatureBlock();

        // Construire le document
        const docDefinition = builder.build();

        // Générer le PDF
        const filename = `devis_${devis.devis_number || devis.id}_${Date.now()}.pdf`;
        const filepath = path.join(CONFIG.outputDir, filename);

        // Note: En production, utiliser pdfmake ou similar
        // Pour l'instant, retourner les données du document
        return {
            success: true,
            filename,
            filepath,
            docDefinition,
            message: 'Document prêt pour génération (installer pdfmake pour la génération réelle)'
        };
    }

    /**
     * Générer une facture PDF
     */
    async generateFacture(facture, client, devis = null, items = []) {
        const builder = new PDFDocumentBuilder();

        // En-tête
        builder.addHeader('FACTURE', `N° ${facture.invoice_number}`);

        // Info facture
        builder.content.push({
            table: {
                widths: ['auto', '*', 'auto', '*'],
                body: [
                    [
                        { text: 'Date facture:', bold: true },
                        { text: builder.formatDate(facture.invoice_date) },
                        { text: 'Échéance:', bold: true },
                        { text: builder.formatDate(facture.due_date) }
                    ],
                    devis ? [
                        { text: 'Réf. devis:', bold: true },
                        { text: devis.devis_number || `DEV-${devis.id}` },
                        { text: '', colSpan: 2 },
                        {}
                    ] : [{}, {}, {}, {}]
                ].filter(row => row.some(cell => cell.text))
            },
            layout: 'noBorders',
            margin: [0, 0, 0, 20]
        });

        // Info client
        builder.addClientInfo(client);

        // Tableau des prestations
        if (items.length > 0) {
            builder.content.push({ text: 'PRESTATIONS', style: 'sectionTitle' });
            builder.addItemsTable(items);
        }

        // Totaux
        const totals = this.calculateTotals(items, facture);
        builder.addTotals(totals, {
            showTVA: true,
            tvaRate: facture.tva_rate || 17
        });

        // Informations de paiement
        builder.content.push({
            stack: [
                { text: 'INFORMATIONS DE PAIEMENT', style: 'sectionTitle' },
                {
                    table: {
                        widths: ['auto', '*'],
                        body: [
                            [{ text: 'IBAN:', bold: true }, 'LU00 0000 0000 0000 0000'],
                            [{ text: 'BIC:', bold: true }, 'XXXXXXXX'],
                            [{ text: 'Banque:', bold: true }, 'Banque XYZ Luxembourg'],
                            [{ text: 'Référence:', bold: true }, facture.invoice_number]
                        ]
                    },
                    layout: 'noBorders'
                }
            ],
            margin: [0, 0, 0, 20]
        });

        // Mentions légales
        builder.content.push({
            text: [
                'En cas de retard de paiement, des pénalités de retard au taux légal seront appliquées. ',
                'Conformément à la loi, une indemnité forfaitaire de 40€ pour frais de recouvrement ',
                'sera due en cas de retard de paiement.'
            ],
            fontSize: 8,
            color: CONFIG.colors.muted,
            margin: [0, 20, 0, 0]
        });

        const docDefinition = builder.build();

        const filename = `facture_${facture.invoice_number}_${Date.now()}.pdf`;
        const filepath = path.join(CONFIG.outputDir, filename);

        return {
            success: true,
            filename,
            filepath,
            docDefinition
        };
    }

    /**
     * Calculer les totaux
     */
    calculateTotals(items, options = {}) {
        const subtotal = items.reduce((sum, item) => {
            return sum + ((item.quantity || 1) * (item.unit_price || 0));
        }, 0);

        const discountPercent = options.discount_percent || 0;
        const discount = subtotal * (discountPercent / 100);
        const subtotalAfterDiscount = subtotal - discount;

        const tvaRate = options.tva_rate || 17;
        const tva = subtotalAfterDiscount * (tvaRate / 100);

        const total = subtotalAfterDiscount + tva;

        return {
            subtotal,
            discount,
            discountPercent,
            subtotalAfterDiscount,
            tva,
            tvaRate,
            total
        };
    }

    /**
     * Obtenir les taux de TVA Luxembourg
     */
    getTVARates() {
        return {
            standard: 17,      // Taux standard
            intermediaire: 14, // Taux intermédiaire
            reduit: 8,         // Taux réduit
            superReduit: 3     // Taux super réduit (logement > 2 ans)
        };
    }
}

// ============================================
// SINGLETON & EXPORT
// ============================================

const pdfService = new PDFService();

export { PDFService, PDFDocumentBuilder };
export default pdfService;
