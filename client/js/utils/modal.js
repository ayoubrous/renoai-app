/**
 * RenoAI - Système de Modales
 * Modales modernes et accessibles
 */

class ModalManager {
    constructor() {
        this.modals = [];
        this.overlay = null;
        this.init();
    }

    init() {
        // Créer l'overlay
        this.overlay = document.createElement('div');
        this.overlay.id = 'modal-overlay';
        this.overlay.className = 'reno-modal-overlay';
        this.overlay.addEventListener('click', () => this.closeLast());
        document.body.appendChild(this.overlay);

        // Fermer avec Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modals.length > 0) {
                const lastModal = this.modals[this.modals.length - 1];
                if (lastModal._options.closable !== false) {
                    this.close(lastModal);
                }
            }
        });

        this.injectStyles();
    }

    injectStyles() {
        if (document.getElementById('modal-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'modal-styles';
        styles.textContent = `
            .reno-modal {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%) scale(0.9);
                background: var(--color-surface);
                border: 1px solid var(--color-border);
                border-radius: var(--radius-2xl);
                box-shadow: var(--shadow-2xl);
                z-index: var(--z-modal);
                max-width: 90vw;
                max-height: 90vh;
                display: flex;
                flex-direction: column;
                opacity: 0;
                visibility: hidden;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            }

            .reno-modal.show {
                opacity: 1;
                visibility: visible;
                transform: translate(-50%, -50%) scale(1);
            }

            .reno-modal-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: var(--spacing-5) var(--spacing-6);
                border-bottom: 1px solid var(--color-border);
            }

            .reno-modal-title {
                font-size: 18px;
                font-weight: 600;
                color: var(--color-text);
                margin: 0;
            }

            .reno-modal-close {
                width: 36px;
                height: 36px;
                border: none;
                background: var(--color-surface-hover);
                border-radius: var(--radius-xl);
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                color: var(--color-text-muted);
                transition: all 0.2s;
            }

            .reno-modal-close:hover {
                background: var(--color-border);
                color: var(--color-text-secondary);
            }

            .reno-modal-body {
                padding: var(--spacing-6);
                overflow-y: auto;
                flex: 1;
            }

            .reno-modal-footer {
                display: flex;
                justify-content: flex-end;
                gap: var(--spacing-3);
                padding: var(--spacing-4) var(--spacing-6);
                border-top: 1px solid var(--color-border);
                background: var(--color-surface-elevated);
                border-radius: 0 0 var(--radius-2xl) var(--radius-2xl);
            }

            .reno-modal-btn {
                padding: 10px 20px;
                border-radius: var(--radius-xl);
                font-weight: 500;
                font-size: 14px;
                cursor: pointer;
                transition: all 0.2s;
                border: none;
            }

            .reno-modal-btn-primary {
                background: var(--gradient-primary);
                color: var(--color-text-inverse);
            }

            .reno-modal-btn-primary:hover {
                transform: translateY(-1px);
                box-shadow: var(--shadow-primary);
            }

            .reno-modal-btn-secondary {
                background: var(--color-surface);
                color: var(--color-text-secondary);
                border: 1px solid var(--color-border-dark);
            }

            .reno-modal-btn-secondary:hover {
                background: var(--color-surface-hover);
            }

            .reno-modal-btn-danger {
                background: var(--color-error);
                color: var(--color-text-inverse);
            }

            .reno-modal-btn-danger:hover {
                background: var(--color-error-dark);
            }

            /* Sizes */
            .reno-modal.small { width: 400px; }
            .reno-modal.medium { width: 560px; }
            .reno-modal.large { width: 720px; }
            .reno-modal.xlarge { width: 900px; }
            .reno-modal.full { width: calc(100vw - 40px); height: calc(100vh - 40px); }

            /* Responsive */
            @media (max-width: 640px) {
                .reno-modal {
                    width: calc(100vw - 24px) !important;
                    max-height: calc(100vh - 24px);
                    border-radius: var(--radius-xl);
                }

                .reno-modal-header { padding: var(--spacing-4); }
                .reno-modal-body { padding: var(--spacing-4); }
                .reno-modal-footer {
                    padding: var(--spacing-3) var(--spacing-4);
                    flex-direction: column;
                }
                .reno-modal-btn { width: 100%; }
            }
        `;
        document.head.appendChild(styles);
    }

    open(options = {}) {
        const {
            title = '',
            content = '',
            size = 'medium',
            closable = true,
            buttons = [],
            onOpen = null,
            onClose = null,
            className = ''
        } = options;

        // Créer la modale
        const modal = document.createElement('div');
        modal.className = `reno-modal ${size} ${className}`;
        modal._options = options;

        // Header
        let headerHTML = '';
        if (title || closable) {
            headerHTML = `
                <div class="reno-modal-header">
                    ${title ? `<h3 class="reno-modal-title">${title}</h3>` : '<div></div>'}
                    ${closable ? `
                        <button class="reno-modal-close" aria-label="Fermer">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                            </svg>
                        </button>
                    ` : ''}
                </div>
            `;
        }

        // Footer avec boutons
        let footerHTML = '';
        if (buttons.length > 0) {
            const buttonsHTML = buttons.map(btn => {
                const btnClass = btn.primary ? 'reno-modal-btn-primary' :
                    btn.danger ? 'reno-modal-btn-danger' : 'reno-modal-btn-secondary';
                return `<button class="reno-modal-btn ${btnClass}" data-action="${btn.action || ''}">${btn.label}</button>`;
            }).join('');
            footerHTML = `<div class="reno-modal-footer">${buttonsHTML}</div>`;
        }

        modal.innerHTML = `
            ${headerHTML}
            <div class="reno-modal-body">${typeof content === 'string' ? content : ''}</div>
            ${footerHTML}
        `;

        // Si content est un élément DOM
        if (content instanceof HTMLElement) {
            modal.querySelector('.reno-modal-body').appendChild(content);
        }

        // Event listeners
        const closeBtn = modal.querySelector('.reno-modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.close(modal));
        }

        // Boutons footer
        modal.querySelectorAll('.reno-modal-footer .reno-modal-btn').forEach((btn, index) => {
            btn.addEventListener('click', () => {
                const buttonConfig = buttons[index];
                if (buttonConfig.onClick) {
                    const result = buttonConfig.onClick(modal);
                    if (result !== false && buttonConfig.close !== false) {
                        this.close(modal);
                    }
                } else if (buttonConfig.close !== false) {
                    this.close(modal);
                }
            });
        });

        // Ajouter au DOM
        document.body.appendChild(modal);
        this.modals.push(modal);

        // Afficher l'overlay
        this.overlay.style.opacity = '1';
        this.overlay.style.visibility = 'visible';

        // Animation d'entrée
        requestAnimationFrame(() => {
            modal.classList.add('show');
        });

        // Bloquer le scroll
        document.body.style.overflow = 'hidden';

        // Callback
        if (onOpen) onOpen(modal);

        // Focus trap
        this.trapFocus(modal);

        return modal;
    }

    close(modal) {
        if (!modal) return;

        const options = modal._options || {};

        // Callback avant fermeture
        if (options.onClose) {
            const result = options.onClose(modal);
            if (result === false) return;
        }

        // Animation de sortie
        modal.classList.remove('show');

        setTimeout(() => {
            if (document.body.contains(modal)) {
                document.body.removeChild(modal);
            }
            this.modals = this.modals.filter(m => m !== modal);

            // Masquer l'overlay si plus de modales
            if (this.modals.length === 0) {
                this.overlay.style.opacity = '0';
                this.overlay.style.visibility = 'hidden';
                document.body.style.overflow = '';
            }
        }, 300);
    }

    closeLast() {
        if (this.modals.length > 0) {
            const lastModal = this.modals[this.modals.length - 1];
            if (lastModal._options.closable !== false) {
                this.close(lastModal);
            }
        }
    }

    closeAll() {
        [...this.modals].forEach(modal => this.close(modal));
    }

    trapFocus(modal) {
        const focusableElements = modal.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (firstElement) firstElement.focus();

        modal.addEventListener('keydown', (e) => {
            if (e.key !== 'Tab') return;

            if (e.shiftKey) {
                if (document.activeElement === firstElement) {
                    lastElement.focus();
                    e.preventDefault();
                }
            } else {
                if (document.activeElement === lastElement) {
                    firstElement.focus();
                    e.preventDefault();
                }
            }
        });
    }

    // Modales prédéfinies
    alert(message, options = {}) {
        return new Promise(resolve => {
            this.open({
                title: options.title || 'Information',
                content: `<p style="color: var(--color-text-secondary); line-height: 1.6;">${message}</p>`,
                size: 'small',
                buttons: [
                    { label: options.buttonText || 'OK', primary: true, onClick: () => resolve(true) }
                ],
                onClose: () => resolve(false),
                ...options
            });
        });
    }

    confirm(message, options = {}) {
        return new Promise(resolve => {
            this.open({
                title: options.title || 'Confirmation',
                content: `<p style="color: var(--color-text-secondary); line-height: 1.6;">${message}</p>`,
                size: 'small',
                buttons: [
                    { label: options.cancelText || 'Annuler', onClick: () => resolve(false) },
                    {
                        label: options.confirmText || 'Confirmer',
                        primary: !options.danger,
                        danger: options.danger,
                        onClick: () => resolve(true)
                    }
                ],
                onClose: () => resolve(false),
                ...options
            });
        });
    }

    prompt(message, options = {}) {
        return new Promise(resolve => {
            const inputId = `modal-input-${Date.now()}`;
            const content = `
                <p style="color: var(--color-text-secondary); line-height: 1.6; margin-bottom: 16px;">${message}</p>
                <input
                    type="${options.type || 'text'}"
                    id="${inputId}"
                    value="${options.defaultValue || ''}"
                    placeholder="${options.placeholder || ''}"
                    style="width: 100%; padding: 12px 16px; border: 1px solid var(--color-border-dark); border-radius: var(--radius-xl); font-size: 14px; outline: none; transition: border-color 0.2s; background: var(--color-surface); color: var(--color-text);"
                    onfocus="this.style.borderColor='var(--color-primary)'"
                    onblur="this.style.borderColor='var(--color-border-dark)'"
                >
            `;

            const modal = this.open({
                title: options.title || 'Saisie',
                content,
                size: 'small',
                buttons: [
                    { label: options.cancelText || 'Annuler', onClick: () => resolve(null) },
                    {
                        label: options.confirmText || 'Valider',
                        primary: true,
                        onClick: () => {
                            const input = document.getElementById(inputId);
                            resolve(input.value);
                        }
                    }
                ],
                onClose: () => resolve(null),
                onOpen: () => {
                    setTimeout(() => {
                        const input = document.getElementById(inputId);
                        if (input) input.focus();
                    }, 100);
                },
                ...options
            });

            // Submit on Enter
            const input = document.getElementById(inputId);
            if (input) {
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        resolve(input.value);
                        this.close(modal);
                    }
                });
            }
        });
    }
}

// Instance singleton
const modal = new ModalManager();

// Export global
window.RenoModal = modal;

export default modal;
