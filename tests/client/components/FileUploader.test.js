/**
 * Tests — FileUploader.js
 * Comportement : upload avec drag-drop, validation, progression, accessibilité
 */

import { jest } from '@jest/globals';
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';

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
globalThis.location = { hostname: 'localhost', reload: jest.fn() };
globalThis.process = { env: { NODE_ENV: 'test' } };
document.documentElement.setAttribute = jest.fn();

// Mock XMLHttpRequest
class MockXHR {
  constructor() {
    this.upload = { addEventListener: jest.fn() };
    this.addEventListener = jest.fn();
    this.open = jest.fn();
    this.send = jest.fn();
    this.setRequestHeader = jest.fn();
    this.abort = jest.fn();
    this.status = 200;
    this.responseText = '{"success":true}';
  }
}
globalThis.XMLHttpRequest = MockXHR;

// Mock FileReader
class MockFileReader {
  readAsDataURL() {
    setTimeout(() => {
      if (this.onload) this.onload({ target: { result: 'data:image/png;base64,fake' } });
    }, 0);
  }
}
globalThis.FileReader = MockFileReader;

// Mock errorHandler to avoid duplicate export issue in ESM
jest.unstable_mockModule('../../../client/js/core/errorHandler.js', () => ({
  default: {
    handle: jest.fn(),
    setupGlobalHandlers: jest.fn(),
    onError: jest.fn(),
  },
  ErrorTypes: {
    NETWORK: 'NETWORK_ERROR',
    API: 'API_ERROR',
    VALIDATION: 'VALIDATION_ERROR',
    AUTH: 'AUTH_ERROR',
    CLIENT: 'CLIENT_ERROR',
    UNKNOWN: 'UNKNOWN_ERROR',
  },
  RenoError: class RenoError extends Error {
    constructor(msg, type, details) {
      super(msg);
      this.type = type;
      this.details = details;
    }
  },
}));

// Import after mocks
await import('../../../client/js/core/store.js');
const { FileUploader } = await import('../../../client/js/components/FileUploader.js');

// Helper : créer un container DOM
function createContainer(id = 'test-uploader') {
  const el = document.createElement('div');
  el.id = id;
  document.body.appendChild(el);
  return el;
}

// Helper : créer un fichier mock
function createFile(name = 'photo.jpg', size = 1024, type = 'image/jpeg') {
  const content = new Uint8Array(size);
  return new File([content], name, { type });
}

afterEach(() => {
  document.body.innerHTML = '';
});

// ========================================
// Initialisation et rendu
// ========================================

describe('Initialisation', () => {
  test('lève une erreur si le container n\'existe pas', () => {
    expect(() => new FileUploader('nonexistent')).toThrow('Container #nonexistent non trouvé');
  });

  test('rend la zone d\'upload avec les attributs ARIA', () => {
    createContainer();
    new FileUploader('test-uploader', { autoUpload: false });

    const zone = document.querySelector('[role="button"]');
    expect(zone).not.toBeNull();
    expect(zone.getAttribute('aria-label')).toContain('Glissez des fichiers');
    expect(zone.getAttribute('tabindex')).toBe('0');
  });

  test('rend les instructions avec les formats acceptés', () => {
    createContainer();
    new FileUploader('test-uploader', { autoUpload: false });

    const instructions = document.getElementById('upload-instructions');
    expect(instructions.textContent).toContain('.jpg');
    expect(instructions.textContent).toContain('.pdf');
  });

  test('la liste de fichiers a un rôle "list"', () => {
    createContainer();
    new FileUploader('test-uploader', { autoUpload: false });

    const list = document.querySelector('[role="list"]');
    expect(list).not.toBeNull();
  });

  test('le champ input est caché (aria-hidden)', () => {
    createContainer();
    new FileUploader('test-uploader', { autoUpload: false });

    const input = document.querySelector('.upload-input');
    expect(input.getAttribute('aria-hidden')).toBe('true');
  });
});

// ========================================
// Validation de fichiers
// ========================================

describe('Validation de fichiers', () => {
  test('rejette un fichier trop volumineux', () => {
    createContainer();
    const uploader = new FileUploader('test-uploader', {
      autoUpload: false,
      maxFileSize: 1024, // 1KB
    });

    const errorCb = jest.fn();
    uploader.on('error', errorCb);

    // Simuler l'ajout d'un fichier trop gros
    const bigFile = createFile('big.jpg', 2048, 'image/jpeg');
    uploader.handleFiles([bigFile]);

    expect(errorCb).toHaveBeenCalled();
    expect(uploader.files.size).toBe(0);
  });

  test('rejette un type de fichier non autorisé', () => {
    createContainer();
    const uploader = new FileUploader('test-uploader', { autoUpload: false });

    const errorCb = jest.fn();
    uploader.on('error', errorCb);

    const exeFile = createFile('virus.exe', 100, 'application/x-msdownload');
    uploader.handleFiles([exeFile]);

    expect(errorCb).toHaveBeenCalled();
    expect(uploader.files.size).toBe(0);
  });

  test('accepte un fichier valide', () => {
    createContainer();
    const uploader = new FileUploader('test-uploader', { autoUpload: false });

    const addedCb = jest.fn();
    uploader.on('filesAdded', addedCb);

    const validFile = createFile('photo.jpg', 500, 'image/jpeg');
    uploader.handleFiles([validFile]);

    expect(addedCb).toHaveBeenCalled();
    expect(uploader.files.size).toBe(1);
  });

  test('respecte la limite maxFiles', () => {
    createContainer();
    const uploader = new FileUploader('test-uploader', {
      autoUpload: false,
      maxFiles: 2,
    });

    const files = [
      createFile('a.jpg', 100, 'image/jpeg'),
      createFile('b.jpg', 100, 'image/jpeg'),
      createFile('c.jpg', 100, 'image/jpeg'),
    ];
    uploader.handleFiles(files);

    expect(uploader.files.size).toBe(2);
  });
});

// ========================================
// Gestion des fichiers
// ========================================

describe('Gestion des fichiers', () => {
  test('removeFile supprime un fichier et met à jour le DOM', () => {
    createContainer();
    const uploader = new FileUploader('test-uploader', { autoUpload: false });

    const file = createFile('photo.jpg', 100, 'image/jpeg');
    uploader.handleFiles([file]);

    const fileId = Array.from(uploader.files.keys())[0];
    uploader.removeFile(fileId);

    expect(uploader.files.size).toBe(0);
  });

  test('clearAll supprime tous les fichiers', () => {
    createContainer();
    const uploader = new FileUploader('test-uploader', { autoUpload: false });

    uploader.handleFiles([
      createFile('a.jpg', 100, 'image/jpeg'),
      createFile('b.png', 100, 'image/png'),
    ]);

    uploader.clearAll();
    expect(uploader.files.size).toBe(0);
  });

  test('getFiles retourne tous les fichiers', () => {
    createContainer();
    const uploader = new FileUploader('test-uploader', { autoUpload: false });

    uploader.handleFiles([createFile('a.jpg', 100, 'image/jpeg')]);
    expect(uploader.getFiles()).toHaveLength(1);
  });

  test('getUploadedFiles ne retourne que les fichiers "success"', () => {
    createContainer();
    const uploader = new FileUploader('test-uploader', { autoUpload: false });

    uploader.handleFiles([createFile('a.jpg', 100, 'image/jpeg')]);
    // Le fichier est en "pending", pas encore uploadé
    expect(uploader.getUploadedFiles()).toHaveLength(0);
  });
});

// ========================================
// Event system
// ========================================

describe('Event system', () => {
  test('on/off : le callback est (dés)enregistré', () => {
    createContainer();
    const uploader = new FileUploader('test-uploader', { autoUpload: false });

    const cb = jest.fn();
    const unsub = uploader.on('filesAdded', cb);

    uploader.handleFiles([createFile('a.jpg', 100, 'image/jpeg')]);
    expect(cb).toHaveBeenCalledTimes(1);

    unsub();
    cb.mockClear();
    uploader.handleFiles([createFile('b.jpg', 100, 'image/jpeg')]);
    expect(cb).not.toHaveBeenCalled();
  });

  test('cleared est émis sur clearAll', () => {
    createContainer();
    const uploader = new FileUploader('test-uploader', { autoUpload: false });

    const cb = jest.fn();
    uploader.on('cleared', cb);
    uploader.clearAll();
    expect(cb).toHaveBeenCalled();
  });

  test('fileRemoved est émis sur removeFile', () => {
    createContainer();
    const uploader = new FileUploader('test-uploader', { autoUpload: false });
    uploader.handleFiles([createFile('a.jpg', 100, 'image/jpeg')]);

    const cb = jest.fn();
    uploader.on('fileRemoved', cb);

    const fileId = Array.from(uploader.files.keys())[0];
    uploader.removeFile(fileId);
    expect(cb).toHaveBeenCalledWith(expect.objectContaining({ file: expect.any(Object) }));
  });
});

// ========================================
// Utilitaires
// ========================================

describe('Utilitaires', () => {
  test('formatSize formate correctement les tailles', () => {
    createContainer();
    const uploader = new FileUploader('test-uploader', { autoUpload: false });

    expect(uploader.formatSize(0)).toBe('0 B');
    expect(uploader.formatSize(1024)).toBe('1 KB');
    expect(uploader.formatSize(1048576)).toBe('1 MB');
    expect(uploader.formatSize(1073741824)).toBe('1 GB');
  });

  test('truncateName tronque les noms longs', () => {
    createContainer();
    const uploader = new FileUploader('test-uploader', { autoUpload: false });

    expect(uploader.truncateName('short.jpg')).toBe('short.jpg');
    expect(uploader.truncateName('this-is-a-very-long-filename-that-should-be-truncated.jpg').length).toBeLessThanOrEqual(34);
  });

  test('getFileIcon retourne la bonne icône', () => {
    createContainer();
    const uploader = new FileUploader('test-uploader', { autoUpload: false });

    expect(uploader.getFileIcon('image/jpeg')).toBe('fa-image');
    expect(uploader.getFileIcon('application/pdf')).toBe('fa-file-pdf');
    expect(uploader.getFileIcon('application/octet-stream')).toBe('fa-file');
  });

  test('getStatusText retourne le texte pour chaque statut', () => {
    createContainer();
    const uploader = new FileUploader('test-uploader', { autoUpload: false });

    expect(uploader.getStatusText('pending')).toBe('En attente');
    expect(uploader.getStatusText('uploading')).toBe('Upload en cours...');
    expect(uploader.getStatusText('success')).toBe('Uploadé');
    expect(uploader.getStatusText('error')).toBe('Erreur');
  });
});

// ========================================
// Accessibilité
// ========================================

describe('Accessibilité', () => {
  test('le bouton d\'upload de fichiers a role="button"', () => {
    createContainer();
    new FileUploader('test-uploader', { autoUpload: false });

    const button = document.querySelector('[role="button"]');
    expect(button).not.toBeNull();
  });

  test('la zone de progression a les attributs ARIA progressbar', () => {
    createContainer();
    new FileUploader('test-uploader', { autoUpload: false });

    const progress = document.querySelector('[role="progressbar"]');
    expect(progress).not.toBeNull();
    expect(progress.getAttribute('aria-valuemin')).toBe('0');
    expect(progress.getAttribute('aria-valuemax')).toBe('100');
  });

  test('chaque fichier a un bouton de suppression avec aria-label', () => {
    createContainer();
    const uploader = new FileUploader('test-uploader', { autoUpload: false });

    uploader.handleFiles([createFile('test.jpg', 100, 'image/jpeg')]);

    const removeBtn = document.querySelector('.file-remove');
    expect(removeBtn).not.toBeNull();
    expect(removeBtn.getAttribute('aria-label')).toContain('Supprimer');
  });

  test('la liste de fichiers a un aria-label mis à jour avec le nombre', () => {
    createContainer();
    const uploader = new FileUploader('test-uploader', { autoUpload: false });

    uploader.handleFiles([createFile('a.jpg', 100, 'image/jpeg')]);

    const list = document.querySelector('[role="list"]');
    expect(list.getAttribute('aria-label')).toContain('1 fichier');
  });
});

// ========================================
// Destroy
// ========================================

describe('destroy', () => {
  test('nettoie le DOM et les listeners', () => {
    const container = createContainer();
    const uploader = new FileUploader('test-uploader', { autoUpload: false });

    uploader.handleFiles([createFile('a.jpg', 100, 'image/jpeg')]);
    uploader.destroy();

    expect(container.innerHTML).toBe('');
    expect(uploader.files.size).toBe(0);
  });
});
