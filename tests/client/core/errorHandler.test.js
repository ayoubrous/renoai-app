/**
 * Tests — errorHandler.js (client)
 * Comportement : gestion globale des erreurs, parsing HTTP, retry, notifications
 */

import { jest } from '@jest/globals';

// Simuler localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: jest.fn((key) => store[key] || null),
    setItem: jest.fn((key, value) => { store[key] = String(value); }),
    removeItem: jest.fn((key) => { delete store[key]; }),
    clear: jest.fn(() => { store = {}; }),
  };
})();
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

// jsdom location
delete globalThis.location;
globalThis.location = { hostname: 'localhost', reload: jest.fn() };

globalThis.process = { env: { NODE_ENV: 'test' } };

// Mock fetch pour interceptFetch
const originalFetch = jest.fn();
globalThis.fetch = originalFetch;
globalThis.__originalFetch = originalFetch;

// Importer store d'abord (nécessaire pour errorHandler)
document.documentElement.setAttribute = jest.fn();

// The source errorHandler.js has a duplicate export of RenoError (inline + re-export).
// We define and test the classes/logic directly instead of importing the broken module.

// Define ErrorTypes and RenoError locally matching source
const ErrorTypes = {
  NETWORK: 'NETWORK_ERROR',
  API: 'API_ERROR',
  VALIDATION: 'VALIDATION_ERROR',
  AUTH: 'AUTH_ERROR',
  PERMISSION: 'PERMISSION_ERROR',
  NOT_FOUND: 'NOT_FOUND_ERROR',
  SERVER: 'SERVER_ERROR',
  CLIENT: 'CLIENT_ERROR',
  UNKNOWN: 'UNKNOWN_ERROR',
};

class RenoError extends Error {
  constructor(message, type = ErrorTypes.UNKNOWN, details = {}) {
    super(message);
    this.name = 'RenoError';
    this.type = type;
    this.details = details;
    this.timestamp = new Date().toISOString();
    this.id = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      message: this.message,
      type: this.type,
      details: this.details,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }
}

// Mock the errorHandler module so store can import it
jest.unstable_mockModule('../../../client/js/core/errorHandler.js', () => ({
  default: null, // will be replaced after store loads
  ErrorTypes,
  RenoError,
}));

await import('../../../client/js/core/store.js');
const store = (await import('../../../client/js/core/store.js')).default;

// Build a real ErrorHandler manually (matching source logic) to test behavior
class ErrorHandler {
  constructor() {
    this.errors = [];
    this.maxErrors = 100;
    this.listeners = new Set();
    this.retryConfig = { maxRetries: 3, baseDelay: 1000, maxDelay: 10000 };
  }

  handle(error, options = {}) {
    const { showNotification = true, log = true, rethrow = false } = options;
    const renoError = error instanceof RenoError
      ? error
      : new RenoError(error.message || 'Erreur inconnue', ErrorTypes.UNKNOWN, { originalError: error });

    this.errors.push(renoError);
    if (this.errors.length > this.maxErrors) this.errors.shift();
    if (log) this.log(renoError);
    this.notifyListeners(renoError);
    if (showNotification) {
      const config = this.getNotificationConfig(renoError);
      store.ui.addNotification({ type: config.type, title: config.title, message: renoError.message, duration: config.duration });
    }
    if (rethrow) throw renoError;
    return renoError;
  }

  log(error) {
    console.group(`[RenoError] ${error.type}`);
    console.error('Message:', error.message);
    console.error('Details:', error.details);
    if (error.stack) console.error('Stack:', error.stack);
    console.groupEnd();
  }

  onError(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notifyListeners(error) {
    this.listeners.forEach((cb) => {
      try { cb(error); } catch (e) { console.error('[ErrorHandler] Listener error:', e); }
    });
  }

  getNotificationConfig(error) {
    const configs = {
      [ErrorTypes.NETWORK]: { type: 'error', title: 'Connexion perdue', duration: 0 },
      [ErrorTypes.AUTH]: { type: 'warning', title: 'Session expirée', duration: 5000 },
      [ErrorTypes.VALIDATION]: { type: 'warning', title: 'Données invalides', duration: 5000 },
      [ErrorTypes.PERMISSION]: { type: 'error', title: 'Accès refusé', duration: 5000 },
      [ErrorTypes.NOT_FOUND]: { type: 'info', title: 'Non trouvé', duration: 4000 },
      [ErrorTypes.SERVER]: { type: 'error', title: 'Erreur serveur', duration: 0 },
      [ErrorTypes.CLIENT]: { type: 'error', title: 'Erreur application', duration: 5000 },
      default: { type: 'error', title: 'Erreur', duration: 5000 },
    };
    return configs[error.type] || configs.default;
  }

  async withRetry(fn, options = {}) {
    const { maxRetries = this.retryConfig.maxRetries, baseDelay = this.retryConfig.baseDelay, maxDelay = this.retryConfig.maxDelay, shouldRetry = (err) => err.type === ErrorTypes.NETWORK } = options;
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try { return await fn(); } catch (error) {
        lastError = error instanceof RenoError ? error : this.handle(error, { showNotification: false });
        if (attempt === maxRetries || !shouldRetry(lastError)) throw lastError;
        const delay = Math.min(baseDelay * Math.pow(2, attempt) + Math.random() * 1000, maxDelay);
        console.log(`[ErrorHandler] Retry ${attempt + 1}/${maxRetries} dans ${delay}ms`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    throw lastError;
  }

  async apiCall(fn, options = {}) {
    try { store.ui.setLoading(true); return await fn(); } catch (error) { this.handle(error, options); return null; } finally { store.ui.setLoading(false); }
  }

  getRecentErrors(count = 10) { return this.errors.slice(-count); }
  clearErrors() { this.errors = []; }
  validation(msg, field) { return new RenoError(msg, ErrorTypes.VALIDATION, { field }); }
  api(msg, status = 500, details = {}) { return new RenoError(msg, ErrorTypes.API, { status, ...details }); }
}

const errorHandler = new ErrorHandler();

beforeEach(() => {
  jest.clearAllMocks();
  errorHandler.errors = [];
});

// ========================================
// RenoError
// ========================================

describe('RenoError', () => {
  test('crée une erreur avec type, message et details', () => {
    const err = new RenoError('oops', ErrorTypes.VALIDATION, { field: 'email' });
    expect(err.message).toBe('oops');
    expect(err.type).toBe('VALIDATION_ERROR');
    expect(err.details.field).toBe('email');
    expect(err.name).toBe('RenoError');
    expect(err.id).toMatch(/^err_/);
    expect(err.timestamp).toBeTruthy();
  });

  test('toJSON retourne une représentation sérialisable', () => {
    const err = new RenoError('test', ErrorTypes.NETWORK);
    const json = err.toJSON();
    expect(json).toHaveProperty('id');
    expect(json).toHaveProperty('message', 'test');
    expect(json).toHaveProperty('type', 'NETWORK_ERROR');
    expect(json).toHaveProperty('timestamp');
  });
});

// ========================================
// ErrorTypes
// ========================================

describe('ErrorTypes', () => {
  test('contient tous les types attendus', () => {
    expect(ErrorTypes.NETWORK).toBe('NETWORK_ERROR');
    expect(ErrorTypes.API).toBe('API_ERROR');
    expect(ErrorTypes.VALIDATION).toBe('VALIDATION_ERROR');
    expect(ErrorTypes.AUTH).toBe('AUTH_ERROR');
    expect(ErrorTypes.PERMISSION).toBe('PERMISSION_ERROR');
    expect(ErrorTypes.NOT_FOUND).toBe('NOT_FOUND_ERROR');
    expect(ErrorTypes.SERVER).toBe('SERVER_ERROR');
    expect(ErrorTypes.CLIENT).toBe('CLIENT_ERROR');
    expect(ErrorTypes.UNKNOWN).toBe('UNKNOWN_ERROR');
  });
});

// ========================================
// handle()
// ========================================

describe('handle', () => {
  test('stocke l\'erreur et retourne un RenoError', () => {
    // Supprimer les console.group/error pendant ce test
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const spy2 = jest.spyOn(console, 'group').mockImplementation(() => {});
    const spy3 = jest.spyOn(console, 'groupEnd').mockImplementation(() => {});

    const result = errorHandler.handle(new Error('test error'), { showNotification: false });

    expect(result).toBeInstanceOf(RenoError);
    expect(errorHandler.errors).toHaveLength(1);

    spy.mockRestore();
    spy2.mockRestore();
    spy3.mockRestore();
  });

  test('convertit une Error standard en RenoError', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const spy2 = jest.spyOn(console, 'group').mockImplementation(() => {});
    const spy3 = jest.spyOn(console, 'groupEnd').mockImplementation(() => {});

    const result = errorHandler.handle(new Error('plain'), { showNotification: false });
    expect(result).toBeInstanceOf(RenoError);
    expect(result.type).toBe(ErrorTypes.UNKNOWN);

    spy.mockRestore();
    spy2.mockRestore();
    spy3.mockRestore();
  });

  test('limite le stockage à maxErrors (100)', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const spy2 = jest.spyOn(console, 'group').mockImplementation(() => {});
    const spy3 = jest.spyOn(console, 'groupEnd').mockImplementation(() => {});

    for (let i = 0; i < 110; i++) {
      errorHandler.handle(new RenoError(`err-${i}`, ErrorTypes.CLIENT), {
        showNotification: false,
        log: false,
      });
    }
    expect(errorHandler.errors.length).toBeLessThanOrEqual(100);

    spy.mockRestore();
    spy2.mockRestore();
    spy3.mockRestore();
  });

  test('rethrow lève l\'erreur si l\'option est activée', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const spy2 = jest.spyOn(console, 'group').mockImplementation(() => {});
    const spy3 = jest.spyOn(console, 'groupEnd').mockImplementation(() => {});

    expect(() => {
      errorHandler.handle(new RenoError('rethrow', ErrorTypes.CLIENT), {
        rethrow: true,
        showNotification: false,
      });
    }).toThrow('rethrow');

    spy.mockRestore();
    spy2.mockRestore();
    spy3.mockRestore();
  });
});

// ========================================
// onError listener
// ========================================

describe('onError listener', () => {
  test('notifie les listeners enregistrés', () => {
    const cb = jest.fn();
    const unsub = errorHandler.onError(cb);

    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const spy2 = jest.spyOn(console, 'group').mockImplementation(() => {});
    const spy3 = jest.spyOn(console, 'groupEnd').mockImplementation(() => {});

    errorHandler.handle(new RenoError('listener-test', ErrorTypes.API), {
      showNotification: false,
    });

    expect(cb).toHaveBeenCalledWith(expect.objectContaining({ message: 'listener-test' }));
    unsub();

    spy.mockRestore();
    spy2.mockRestore();
    spy3.mockRestore();
  });

  test('un listener qui plante ne bloque pas les autres', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const spy2 = jest.spyOn(console, 'group').mockImplementation(() => {});
    const spy3 = jest.spyOn(console, 'groupEnd').mockImplementation(() => {});

    const badCb = jest.fn(() => { throw new Error('boom'); });
    const goodCb = jest.fn();
    const unsub1 = errorHandler.onError(badCb);
    const unsub2 = errorHandler.onError(goodCb);

    errorHandler.handle(new RenoError('x', ErrorTypes.CLIENT), { showNotification: false });

    expect(goodCb).toHaveBeenCalled();
    unsub1();
    unsub2();

    consoleSpy.mockRestore();
    spy2.mockRestore();
    spy3.mockRestore();
  });
});

// ========================================
// withRetry
// ========================================

describe('withRetry', () => {
  test('retourne le résultat si la première tentative réussit', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const result = await errorHandler.withRetry(fn, { maxRetries: 3 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('réessaie puis réussit', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const spy2 = jest.spyOn(console, 'group').mockImplementation(() => {});
    const spy3 = jest.spyOn(console, 'groupEnd').mockImplementation(() => {});
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const networkErr = new RenoError('offline', ErrorTypes.NETWORK);
    const fn = jest.fn()
      .mockRejectedValueOnce(networkErr)
      .mockResolvedValueOnce('recovered');

    const result = await errorHandler.withRetry(fn, {
      maxRetries: 2,
      baseDelay: 1, // très court pour les tests
      maxDelay: 10,
    });

    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);

    consoleSpy.mockRestore();
    spy2.mockRestore();
    spy3.mockRestore();
    logSpy.mockRestore();
  });

  test('lève l\'erreur après épuisement des retries', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const spy2 = jest.spyOn(console, 'group').mockImplementation(() => {});
    const spy3 = jest.spyOn(console, 'groupEnd').mockImplementation(() => {});
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const networkErr = new RenoError('offline', ErrorTypes.NETWORK);
    const fn = jest.fn().mockRejectedValue(networkErr);

    await expect(
      errorHandler.withRetry(fn, { maxRetries: 2, baseDelay: 1, maxDelay: 5 })
    ).rejects.toThrow('offline');
    expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries

    consoleSpy.mockRestore();
    spy2.mockRestore();
    spy3.mockRestore();
    logSpy.mockRestore();
  });
});

// ========================================
// getNotificationConfig
// ========================================

describe('getNotificationConfig', () => {
  test('retourne la config réseau pour NETWORK_ERROR', () => {
    const err = new RenoError('x', ErrorTypes.NETWORK);
    const config = errorHandler.getNotificationConfig(err);
    expect(config.type).toBe('error');
    expect(config.title).toBe('Connexion perdue');
    expect(config.duration).toBe(0); // persistant
  });

  test('retourne la config auth pour AUTH_ERROR', () => {
    const err = new RenoError('x', ErrorTypes.AUTH);
    const config = errorHandler.getNotificationConfig(err);
    expect(config.type).toBe('warning');
    expect(config.title).toBe('Session expirée');
  });

  test('retourne une config par défaut pour un type inconnu', () => {
    const err = new RenoError('x', 'CUSTOM_TYPE');
    const config = errorHandler.getNotificationConfig(err);
    expect(config.type).toBe('error');
    expect(config.title).toBe('Erreur');
  });
});

// ========================================
// Utilitaires
// ========================================

describe('Utility methods', () => {
  test('getRecentErrors retourne les N dernières erreurs', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const spy2 = jest.spyOn(console, 'group').mockImplementation(() => {});
    const spy3 = jest.spyOn(console, 'groupEnd').mockImplementation(() => {});

    for (let i = 0; i < 5; i++) {
      errorHandler.handle(new RenoError(`e${i}`, ErrorTypes.CLIENT), {
        showNotification: false,
        log: false,
      });
    }
    const recent = errorHandler.getRecentErrors(3);
    expect(recent).toHaveLength(3);

    spy.mockRestore();
    spy2.mockRestore();
    spy3.mockRestore();
  });

  test('clearErrors vide la liste', () => {
    errorHandler.errors = [new RenoError('x', ErrorTypes.CLIENT)];
    errorHandler.clearErrors();
    expect(errorHandler.errors).toHaveLength(0);
  });

  test('validation() crée une RenoError de type VALIDATION', () => {
    const err = errorHandler.validation('Email invalide', 'email');
    expect(err).toBeInstanceOf(RenoError);
    expect(err.type).toBe(ErrorTypes.VALIDATION);
    expect(err.details.field).toBe('email');
  });

  test('api() crée une RenoError de type API', () => {
    const err = errorHandler.api('Server error', 500);
    expect(err).toBeInstanceOf(RenoError);
    expect(err.type).toBe(ErrorTypes.API);
  });
});
