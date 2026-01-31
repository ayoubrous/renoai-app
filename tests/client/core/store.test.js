/**
 * Tests — store.js (State Management)
 * Comportement : get/set état, pub/sub, persistance localStorage, actions métier
 */

import { jest } from '@jest/globals';

// Simuler process.env pour éviter le middleware de logging
globalThis.process = { env: { NODE_ENV: 'test' } };

// Simuler localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: jest.fn((key) => store[key] || null),
    setItem: jest.fn((key, value) => { store[key] = String(value); }),
    removeItem: jest.fn((key) => { delete store[key]; }),
    clear: jest.fn(() => { store = {}; }),
    _getStore: () => store,
  };
})();
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

// Simuler window.location
delete globalThis.location;
globalThis.location = { hostname: 'localhost', reload: jest.fn() };

// Simuler document.documentElement
document.documentElement.setAttribute = jest.fn();

// Import après les mocks
const { EventBus } = await import('../../../client/js/core/store.js');
const storeModule = await import('../../../client/js/core/store.js');
const store = storeModule.default;

beforeEach(() => {
  localStorageMock.clear();
  jest.clearAllMocks();
});

// ========================================
// EventBus
// ========================================

describe('EventBus', () => {
  let bus;
  beforeEach(() => { bus = new EventBus(); });

  test('on/emit : le callback reçoit les données', () => {
    const cb = jest.fn();
    bus.on('test', cb);
    bus.emit('test', { value: 42 });
    expect(cb).toHaveBeenCalledWith({ value: 42 });
  });

  test('on retourne une fonction de désabonnement', () => {
    const cb = jest.fn();
    const unsub = bus.on('test', cb);
    unsub();
    bus.emit('test', 'data');
    expect(cb).not.toHaveBeenCalled();
  });

  test('once : le callback n\'est appelé qu\'une seule fois', () => {
    const cb = jest.fn();
    bus.once('test', cb);
    bus.emit('test', 1);
    bus.emit('test', 2);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith(1);
  });

  test('off : supprime un listener spécifique', () => {
    const cb1 = jest.fn();
    const cb2 = jest.fn();
    bus.on('e', cb1);
    bus.on('e', cb2);
    bus.off('e', cb1);
    bus.emit('e');
    expect(cb1).not.toHaveBeenCalled();
    expect(cb2).toHaveBeenCalled();
  });

  test('clear : supprime tous les listeners d\'un événement', () => {
    const cb = jest.fn();
    bus.on('e', cb);
    bus.clear('e');
    bus.emit('e');
    expect(cb).not.toHaveBeenCalled();
  });

  test('clear sans argument : supprime tout', () => {
    const cb1 = jest.fn();
    const cb2 = jest.fn();
    bus.on('a', cb1);
    bus.on('b', cb2);
    bus.clear();
    bus.emit('a');
    bus.emit('b');
    expect(cb1).not.toHaveBeenCalled();
    expect(cb2).not.toHaveBeenCalled();
  });

  test('un listener qui lève une erreur ne bloque pas les autres', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const cb1 = jest.fn(() => { throw new Error('oops'); });
    const cb2 = jest.fn();
    bus.on('e', cb1);
    bus.on('e', cb2);
    bus.emit('e');
    expect(cb2).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

// ========================================
// Store — get/set
// ========================================

describe('Store get/set', () => {
  test('get retourne une valeur imbriquée par chemin', () => {
    expect(store.get('ui.theme')).toBeDefined();
  });

  test('get retourne undefined pour un chemin inexistant', () => {
    expect(store.get('does.not.exist')).toBeUndefined();
  });

  test('set met à jour l\'état et retourne la nouvelle valeur', () => {
    const result = store.set('ui.loading', true, { persist: false });
    expect(result).toBe(true);
    expect(store.get('ui.loading')).toBe(true);
    // Remettre
    store.set('ui.loading', false, { persist: false });
  });

  test('set crée des chemins intermédiaires si nécessaire', () => {
    store.set('custom.deep.path', 'value', { persist: false });
    expect(store.get('custom.deep.path')).toBe('value');
  });
});

// ========================================
// Store — subscriptions
// ========================================

describe('Store subscriptions', () => {
  test('subscribe est notifié sur changement du chemin exact', () => {
    const cb = jest.fn();
    const unsub = store.subscribe('projects.loading', cb);
    store.set('projects.loading', true, { persist: false });
    expect(cb).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'projects.loading', value: true })
    );
    store.set('projects.loading', false, { persist: false });
    unsub();
  });

  test('subscribeAll est notifié sur tout changement', () => {
    const cb = jest.fn();
    const unsub = store.subscribeAll(cb);
    store.set('ui.loading', true, { persist: false });
    expect(cb).toHaveBeenCalled();
    store.set('ui.loading', false, { persist: false });
    unsub();
  });

  test('le mode silent ne notifie pas', () => {
    const cb = jest.fn();
    const unsub = store.subscribe('ui.loading', cb);
    store.set('ui.loading', true, { silent: true, persist: false });
    expect(cb).not.toHaveBeenCalled();
    store.set('ui.loading', false, { persist: false });
    unsub();
  });
});

// ========================================
// Store — middleware
// ========================================

describe('Store middleware', () => {
  test('un middleware peut transformer la valeur', () => {
    const middleware = jest.fn((path, newValue) => {
      if (path === 'ui.theme' && newValue === 'invalid') return 'light';
      return newValue;
    });
    store.use(middleware);
    store.set('ui.theme', 'invalid', { persist: false });
    expect(store.get('ui.theme')).toBe('light');
  });
});

// ========================================
// Store — history
// ========================================

describe('Store history', () => {
  test('les changements sont enregistrés dans l\'historique', () => {
    const initialLength = store.history.length;
    store.set('projects.loading', true, { persist: false });
    expect(store.history.length).toBe(initialLength + 1);
    const last = store.history[store.history.length - 1];
    expect(last.path).toBe('projects.loading');
    store.set('projects.loading', false, { persist: false });
  });
});

// ========================================
// Store — actions auth
// ========================================

describe('Store auth actions', () => {
  test('login met à jour l\'état auth', () => {
    store.auth.login({ id: '1', email: 'a@b.lu' }, 'token-123', 'refresh-456');
    expect(store.get('auth.isAuthenticated')).toBe(true);
    expect(store.get('auth.user').email).toBe('a@b.lu');
    expect(store.get('auth.token')).toBe('token-123');
  });

  test('logout nettoie l\'état auth et les données', () => {
    store.auth.login({ id: '1' }, 't', 'r');
    store.set('projects.items', [{ id: 1 }], { persist: false });
    store.auth.logout();

    expect(store.get('auth.isAuthenticated')).toBe(false);
    expect(store.get('auth.user')).toBeNull();
    expect(store.get('projects.items')).toEqual([]);
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('renoai_auth');
  });

  test('updateUser fusionne les mises à jour dans l\'utilisateur existant', () => {
    store.auth.login({ id: '1', email: 'a@b.lu', name: 'old' }, 't', 'r');
    store.auth.updateUser({ name: 'new' });
    expect(store.get('auth.user').name).toBe('new');
    expect(store.get('auth.user').email).toBe('a@b.lu');
  });
});

// ========================================
// Store — actions UI
// ========================================

describe('Store UI actions', () => {
  test('navigate change la page et émet un événement', () => {
    const cb = jest.fn();
    const unsub = store.onNavigate(cb);
    store.ui.navigate('settings');
    expect(store.get('ui.currentPage')).toBe('settings');
    expect(cb).toHaveBeenCalledWith({ page: 'settings' });
    unsub();
  });

  test('toggleSidebar inverse l\'état', () => {
    const before = store.get('ui.sidebarOpen');
    store.ui.toggleSidebar();
    expect(store.get('ui.sidebarOpen')).toBe(!before);
    store.ui.toggleSidebar(); // remettre
  });

  test('setTheme met à jour le thème et le DOM', () => {
    store.ui.setTheme('dark');
    expect(store.get('ui.theme')).toBe('dark');
    expect(document.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'dark');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('renoai_theme', 'dark');
    store.ui.setTheme('light'); // remettre
  });

  test('addNotification ajoute avec un ID unique', () => {
    const id = store.ui.addNotification({ type: 'info', message: 'Test' });
    const notifications = store.get('ui.notifications');
    expect(notifications.some((n) => n.id === id)).toBe(true);
    store.ui.removeNotification(id);
  });

  test('removeNotification supprime par ID', () => {
    const id = store.ui.addNotification({ type: 'info', message: 'del', duration: 0 });
    store.ui.removeNotification(id);
    const notifications = store.get('ui.notifications');
    expect(notifications.some((n) => n.id === id)).toBe(false);
  });
});

// ========================================
// Store — actions projects
// ========================================

describe('Store projects actions', () => {
  test('addItem ajoute en début de liste', () => {
    store.projects.setItems([{ id: 'old' }]);
    store.projects.addItem({ id: 'new' });
    const items = store.get('projects.items');
    expect(items[0].id).toBe('new');
  });

  test('updateItem modifie un projet existant', () => {
    store.projects.setItems([{ id: '1', name: 'before' }]);
    store.projects.updateItem('1', { name: 'after' });
    const items = store.get('projects.items');
    expect(items[0].name).toBe('after');
  });

  test('removeItem supprime par ID', () => {
    store.projects.setItems([{ id: '1' }, { id: '2' }]);
    store.projects.removeItem('1');
    expect(store.get('projects.items')).toHaveLength(1);
    expect(store.get('projects.items')[0].id).toBe('2');
  });
});

// ========================================
// Store — persistance
// ========================================

describe('Store persistance', () => {
  test('persistState sauvegarde dans localStorage', () => {
    store.set('auth.user', { id: 'persist-test' });
    // persistState est appelé automatiquement pour les chemins auth.*
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'renoai_state',
      expect.any(String)
    );
  });

  test('getState retourne une copie profonde', () => {
    const state1 = store.getState();
    const state2 = store.getState();
    expect(state1).toEqual(state2);
    expect(state1).not.toBe(state2); // objets différents
  });
});
