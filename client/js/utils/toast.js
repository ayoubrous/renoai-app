/**
 * RenoAI - Système de Notifications Toast
 * Notifications élégantes et non-intrusives
 */

class ToastManager {
    constructor() {
        this.container = null;
        this.toasts = [];
        this.defaultDuration = 4000;
        this.maxToasts = 5;
        this.init();
    }

    init() {
        // Créer le conteneur des toasts
        this.container = document.createElement('div');
        this.container.id = 'toast-container';
        this.container.className = 'toast-container';
        this.container.style.pointerEvents = 'none';
        document.body.appendChild(this.container);

        // Injecter les styles
        this.injectStyles();
    }

    injectStyles() {
        if (document.getElementById('toast-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'toast-styles';
        styles.textContent = `
            .reno-toast {
                display: flex;
                align-items: flex-start;
                gap: var(--spacing-3);
                padding: var(--spacing-4) var(--spacing-4) var(--spacing-4) var(--spacing-5);
                border-radius: var(--radius-xl);
                background: var(--color-surface);
                border: 1px solid var(--color-border);
                border-left: 4px solid var(--color-border-dark);
                box-shadow: var(--shadow-xl);
                pointer-events: auto;
                transform: translateX(120%);
                opacity: 0;
                transition: all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
                max-width: 100%;
                overflow: hidden;
            }

            .reno-toast.show {
                transform: translateX(0);
                opacity: 1;
            }

            .reno-toast.hide {
                transform: translateX(120%);
                opacity: 0;
            }

            .reno-toast-icon {
                flex-shrink: 0;
                width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: var(--radius-lg);
            }

            .reno-toast-content {
                flex: 1;
                min-width: 0;
            }

            .reno-toast-title {
                font-weight: 600;
                font-size: 14px;
                color: var(--color-text);
                margin-bottom: 4px;
            }

            .reno-toast-message {
                font-size: 13px;
                color: var(--color-text-muted);
                line-height: 1.4;
                word-wrap: break-word;
            }

            .reno-toast-close {
                flex-shrink: 0;
                width: 20px;
                height: 20px;
                border: none;
                background: transparent;
                cursor: pointer;
                padding: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                color: var(--color-text-disabled);
                transition: color 0.2s;
            }

            .reno-toast-close:hover {
                color: var(--color-text-secondary);
            }

            .reno-toast-progress {
                position: absolute;
                bottom: 0;
                left: 0;
                height: 3px;
                border-radius: 0 0 var(--radius-xl) var(--radius-xl);
                transition: width linear;
            }

            /* Types */
            .reno-toast.success { border-left-color: var(--color-success); }
            .reno-toast.success .reno-toast-icon { background: var(--color-success-bg); color: var(--color-success); }
            .reno-toast.success .reno-toast-progress { background: var(--color-success); }

            .reno-toast.error { border-left-color: var(--color-error); }
            .reno-toast.error .reno-toast-icon { background: var(--color-error-bg); color: var(--color-error); }
            .reno-toast.error .reno-toast-progress { background: var(--color-error); }

            .reno-toast.warning { border-left-color: var(--color-warning); }
            .reno-toast.warning .reno-toast-icon { background: var(--color-warning-bg); color: var(--color-warning); }
            .reno-toast.warning .reno-toast-progress { background: var(--color-warning); }

            .reno-toast.info { border-left-color: var(--color-info); }
            .reno-toast.info .reno-toast-icon { background: var(--color-info-bg); color: var(--color-info); }
            .reno-toast.info .reno-toast-progress { background: var(--color-info); }

            /* Responsive */
            @media (max-width: 480px) {
                #toast-container {
                    left: 12px;
                    right: 12px;
                    max-width: none;
                }
            }
        `;
        document.head.appendChild(styles);
    }

    getIcon(type) {
        const icons = {
            success: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M13.5 4.5L6.5 11.5L3 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
            error: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M12 4L4 12M4 4L12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
            warning: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 5V8M8 11H8.01M3.07 14H12.93C14.14 14 14.91 12.7 14.31 11.65L9.38 2.65C8.78 1.6 7.22 1.6 6.62 2.65L1.69 11.65C1.09 12.7 1.86 14 3.07 14Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
            info: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5"/><path d="M8 11V7M8 5H8.01" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`
        };
        return icons[type] || icons.info;
    }

    show(options = {}) {
        const {
            type = 'info',
            title = '',
            message = '',
            duration = this.defaultDuration,
            closable = true,
            showProgress = true,
            onClick = null
        } = typeof options === 'string' ? { message: options } : options;

        // Limiter le nombre de toasts
        while (this.toasts.length >= this.maxToasts) {
            this.remove(this.toasts[0]);
        }

        // Créer le toast
        const toast = document.createElement('div');
        toast.className = `reno-toast ${type}`;
        toast.style.position = 'relative';

        toast.innerHTML = `
            <div class="reno-toast-icon">${this.getIcon(type)}</div>
            <div class="reno-toast-content">
                ${title ? `<div class="reno-toast-title">${title}</div>` : ''}
                <div class="reno-toast-message">${message}</div>
            </div>
            ${closable ? `
                <button class="reno-toast-close" aria-label="Fermer">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M10.5 3.5L3.5 10.5M3.5 3.5L10.5 10.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                    </svg>
                </button>
            ` : ''}
            ${showProgress && duration > 0 ? `<div class="reno-toast-progress" style="width: 100%"></div>` : ''}
        `;

        // Click handler
        if (onClick) {
            toast.style.cursor = 'pointer';
            toast.addEventListener('click', (e) => {
                if (!e.target.closest('.reno-toast-close')) {
                    onClick();
                    this.remove(toast);
                }
            });
        }

        // Close button
        const closeBtn = toast.querySelector('.reno-toast-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.remove(toast));
        }

        // Ajouter au conteneur
        this.container.appendChild(toast);
        this.toasts.push(toast);

        // Animation d'entrée
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        // Progress bar animation
        if (showProgress && duration > 0) {
            const progress = toast.querySelector('.reno-toast-progress');
            if (progress) {
                progress.style.transitionDuration = `${duration}ms`;
                requestAnimationFrame(() => {
                    progress.style.width = '0%';
                });
            }
        }

        // Auto-remove
        if (duration > 0) {
            toast._timeout = setTimeout(() => this.remove(toast), duration);
        }

        // Pause on hover
        toast.addEventListener('mouseenter', () => {
            if (toast._timeout) {
                clearTimeout(toast._timeout);
                const progress = toast.querySelector('.reno-toast-progress');
                if (progress) {
                    progress.style.transitionDuration = '0s';
                }
            }
        });

        toast.addEventListener('mouseleave', () => {
            if (duration > 0) {
                const progress = toast.querySelector('.reno-toast-progress');
                const remaining = progress ? parseFloat(progress.style.width) / 100 * duration : duration / 2;
                if (progress) {
                    progress.style.transitionDuration = `${remaining}ms`;
                    progress.style.width = '0%';
                }
                toast._timeout = setTimeout(() => this.remove(toast), remaining);
            }
        });

        return toast;
    }

    remove(toast) {
        if (!toast || !this.container.contains(toast)) return;

        if (toast._timeout) {
            clearTimeout(toast._timeout);
        }

        toast.classList.remove('show');
        toast.classList.add('hide');

        setTimeout(() => {
            if (this.container.contains(toast)) {
                this.container.removeChild(toast);
            }
            this.toasts = this.toasts.filter(t => t !== toast);
        }, 400);
    }

    removeAll() {
        [...this.toasts].forEach(toast => this.remove(toast));
    }

    // Raccourcis
    success(message, options = {}) {
        return this.show({ ...options, type: 'success', message });
    }

    error(message, options = {}) {
        return this.show({ ...options, type: 'error', message, duration: 6000 });
    }

    warning(message, options = {}) {
        return this.show({ ...options, type: 'warning', message });
    }

    info(message, options = {}) {
        return this.show({ ...options, type: 'info', message });
    }

    // Promise-based toast
    promise(promise, messages = {}) {
        const {
            loading = 'Chargement...',
            success = 'Succès !',
            error = 'Erreur'
        } = messages;

        const toast = this.show({
            type: 'info',
            message: loading,
            duration: 0,
            closable: false,
            showProgress: false
        });

        promise
            .then((result) => {
                this.remove(toast);
                this.success(typeof success === 'function' ? success(result) : success);
            })
            .catch((err) => {
                this.remove(toast);
                this.error(typeof error === 'function' ? error(err) : (err.message || error));
            });

        return promise;
    }
}

// Instance singleton
const toast = new ToastManager();

// Export global
window.RenoToast = toast;

export default toast;
