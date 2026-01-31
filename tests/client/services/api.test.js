/**
 * Tests — api.js (APIClient)
 * Comportement : requêtes HTTP, gestion des tokens, retry 401, upload
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
delete globalThis.location;
globalThis.location = { hostname: 'localhost' };

// Mock fetch
const mockFetch = jest.fn();
globalThis.fetch = mockFetch;

// Mock CustomEvent et dispatchEvent
globalThis.CustomEvent = class CustomEvent extends Event {
  constructor(type, options) {
    super(type);
    this.detail = options?.detail;
  }
};
globalThis.dispatchEvent = jest.fn();

// Import
const apiModule = await import('../../../client/js/services/api.js');
const api = apiModule.default;

// Helper pour simuler des réponses fetch
function mockResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    clone: function () { return this; },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  localStorageMock.clear();
  api.accessToken = null;
  api.refreshToken = null;
  api.refreshPromise = null;
});

// ========================================
// getHeaders
// ========================================

describe('getHeaders', () => {
  test('inclut Content-Type par défaut', () => {
    const headers = api.getHeaders(false);
    expect(headers['Content-Type']).toBe('application/json');
  });

  test('inclut Authorization si un token est défini', () => {
    api.accessToken = 'my-token';
    const headers = api.getHeaders(true);
    expect(headers['Authorization']).toBe('Bearer my-token');
  });

  test('n\'inclut pas Authorization si includeAuth est false', () => {
    api.accessToken = 'my-token';
    const headers = api.getHeaders(false);
    expect(headers['Authorization']).toBeUndefined();
  });

  test('ne met pas Content-Type si null', () => {
    const headers = api.getHeaders(false, null);
    expect(headers['Content-Type']).toBeUndefined();
  });
});

// ========================================
// setTokens / clearTokens
// ========================================

describe('setTokens / clearTokens', () => {
  test('setTokens stocke dans localStorage', () => {
    api.setTokens('access', 'refresh');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('accessToken', 'access');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('refreshToken', 'refresh');
    expect(api.accessToken).toBe('access');
  });

  test('setTokens avec null supprime de localStorage', () => {
    api.setTokens(null, null);
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('accessToken');
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('refreshToken');
  });

  test('clearTokens supprime tout et notifie', () => {
    const listener = jest.fn();
    api.onAuthChange(listener);
    api.setTokens('a', 'b');
    api.clearTokens();

    expect(api.accessToken).toBeNull();
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('accessToken');
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('user');
    expect(listener).toHaveBeenCalledWith(false, null);
  });
});

// ========================================
// onAuthChange
// ========================================

describe('onAuthChange', () => {
  test('ajoute un listener et retourne une fonction de désabonnement', () => {
    const cb = jest.fn();
    const unsub = api.onAuthChange(cb);
    api.notifyAuthChange(true, { id: '1' });
    expect(cb).toHaveBeenCalledWith(true, { id: '1' });

    unsub();
    cb.mockClear();
    api.notifyAuthChange(false);
    expect(cb).not.toHaveBeenCalled();
  });
});

// ========================================
// request — happy path
// ========================================

describe('request — happy path', () => {
  test('GET envoie une requête avec les bons headers', async () => {
    mockFetch.mockResolvedValue(mockResponse({ data: 'ok' }));
    const result = await api.get('/test');
    expect(result).toEqual({ data: 'ok' });
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:5000/api/test',
      expect.objectContaining({ method: 'GET', credentials: 'include' })
    );
  });

  test('POST envoie le body en JSON', async () => {
    mockFetch.mockResolvedValue(mockResponse({ success: true }));
    await api.post('/users', { name: 'test' });
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:5000/api/users',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'test' }),
      })
    );
  });

  test('PUT, PATCH, DELETE utilisent la bonne méthode', async () => {
    mockFetch.mockResolvedValue(mockResponse({ ok: true }));

    await api.put('/a', { x: 1 });
    expect(mockFetch).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ method: 'PUT' }));

    await api.patch('/b', { x: 2 });
    expect(mockFetch).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ method: 'PATCH' }));

    await api.delete('/c');
    expect(mockFetch).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ method: 'DELETE' }));
  });
});

// ========================================
// request — error handling
// ========================================

describe('request — error handling', () => {
  test('lève une erreur avec message serveur si response non-ok', async () => {
    mockFetch.mockResolvedValue(mockResponse(
      { error: { message: 'Not found', code: 'NOT_FOUND' } },
      404
    ));
    await expect(api.get('/missing')).rejects.toThrow('Not found');
  });

  test('transforme TypeError "Failed to fetch" en message lisible', async () => {
    mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(api.get('/offline')).rejects.toThrow('Impossible de contacter le serveur');
  });
});

// ========================================
// request — 401 retry avec refresh token
// ========================================

describe('request — 401 retry', () => {
  test('retry automatique après un 401 si refresh token disponible', async () => {
    api.refreshToken = 'valid-refresh';

    // Premier appel → 401
    mockFetch
      .mockResolvedValueOnce(mockResponse({}, 401))
      // Refresh call → success
      .mockResolvedValueOnce(mockResponse({
        data: { access_token: 'new-access', refresh_token: 'new-refresh' },
      }))
      // Retry original → success
      .mockResolvedValueOnce(mockResponse({ data: 'success' }));

    const result = await api.get('/protected');
    expect(result).toEqual({ data: 'success' });
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  test('dispatch auth:logout si le refresh échoue', async () => {
    api.refreshToken = 'expired-refresh';
    mockFetch
      .mockResolvedValueOnce(mockResponse({}, 401))
      .mockResolvedValueOnce(mockResponse({}, 401)); // refresh fail

    await expect(api.get('/protected')).rejects.toThrow();
    expect(globalThis.dispatchEvent).toHaveBeenCalled();
  });
});

// ========================================
// refreshAccessToken — deduplication
// ========================================

describe('refreshAccessToken — deduplication', () => {
  test('les appels concurrents partagent la même promesse', async () => {
    api.refreshToken = 'r-token';
    // Use a delayed response to ensure both calls happen before resolution
    let resolveRefresh;
    mockFetch.mockReturnValue(new Promise((r) => {
      resolveRefresh = () => r(mockResponse({
        data: { access_token: 'new', refresh_token: 'new-r' },
      }));
    }));

    const p1 = api.refreshAccessToken();
    const p2 = api.refreshAccessToken();
    // Both should reference the same deduplication promise
    expect(api.refreshPromise).not.toBeNull();

    resolveRefresh();
    await Promise.all([p1, p2]);
    // Only one fetch call for the refresh
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  test('lève une erreur si pas de refresh token', async () => {
    api.refreshToken = null;
    await expect(api.refreshAccessToken()).rejects.toThrow('No refresh token');
  });
});

// ========================================
// upload
// ========================================

describe('upload', () => {
  test('envoie les fichiers dans un FormData', async () => {
    mockFetch.mockResolvedValue(mockResponse({ success: true }));

    const file = new File(['content'], 'photo.jpg', { type: 'image/jpeg' });
    await api.upload('/upload', [file], { project_id: '1' });

    const call = mockFetch.mock.calls[0];
    expect(call[1].method).toBe('POST');
    // Le body doit être un FormData
    expect(call[1].body).toBeInstanceOf(FormData);
  });

  test('envoie un fichier unique si pas un tableau', async () => {
    mockFetch.mockResolvedValue(mockResponse({ success: true }));
    const file = new File(['x'], 'doc.pdf', { type: 'application/pdf' });
    await api.upload('/upload', file);

    const body = mockFetch.mock.calls[0][1].body;
    expect(body).toBeInstanceOf(FormData);
  });
});
