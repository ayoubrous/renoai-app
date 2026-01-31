/**
 * Tests — validators.js
 * Comportement : validation des entrées utilisateur via express-validator
 *
 * Stratégie : on teste les chaînes de validation en simulant req/res/next
 * avec express-validator's validationResult
 */

import { jest } from '@jest/globals';
import { validationResult } from 'express-validator';

import {
  validate,
  registerValidation,
  loginValidation,
  changePasswordValidation,
  createProjectValidation,
  paginationRules,
} from '../../../server/middleware/validators.js';

// Helper pour exécuter une chaîne de validation Express
async function runValidation(validationChain, body = {}, params = {}, queryObj = {}) {
  const req = {
    body,
    params,
    query: queryObj,
    headers: {},
  };
  let statusCalled = false;
  const res = {
    status: jest.fn(function (code) { statusCalled = true; return this; }),
    json: jest.fn(function () { return this; }),
  };

  for (const middleware of validationChain) {
    // validate() may call res.status().json() OR next() — we need to handle both
    await new Promise((resolve) => {
      const origStatus = res.status;
      res.status = jest.fn(function (code) {
        origStatus.call(this, code);
        // Resolve when response is sent (validate called res.status)
        resolve();
        return this;
      });

      middleware(req, res, () => {
        // next() was called
        resolve();
      });
    });

    if (res.status.mock.calls.length > 0 && res.status.mock.calls.some(c => c[0] === 400)) break;
  }

  return { req, res };
}

// ========================================
// validate middleware
// ========================================

describe('validate', () => {
  test('passe au suivant si pas d\'erreurs', async () => {
    const { res } = await runValidation(
      loginValidation,
      { email: 'test@example.com', password: 'Secret1!' }
    );
    // Si pas d'erreur, res.json n'est PAS appelé par validate
    // (validate appelle next() au lieu de res.json)
    // On vérifie que la chaîne ne retourne pas d'erreur 400
    expect(res.status).not.toHaveBeenCalledWith(400);
  });

  test('retourne 400 avec les erreurs formatées', async () => {
    const { res } = await runValidation(loginValidation, { email: '', password: '' });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        code: 'VALIDATION_ERROR',
      })
    );
  });
});

// ========================================
// registerValidation
// ========================================

describe('registerValidation', () => {
  const validBody = {
    first_name: 'Jean',
    last_name: 'Dupont',
    email: 'jean@example.lu',
    password: 'Passw0rd!',
  };

  test('accepte un body valide', async () => {
    const { res } = await runValidation(registerValidation, validBody);
    expect(res.status).not.toHaveBeenCalledWith(400);
  });

  test('rejette un email invalide', async () => {
    const { res } = await runValidation(registerValidation, {
      ...validBody,
      email: 'not-an-email',
    });
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('rejette un mot de passe trop court', async () => {
    const { res } = await runValidation(registerValidation, {
      ...validBody,
      password: 'Ab1!',
    });
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('rejette un mot de passe sans majuscule', async () => {
    const { res } = await runValidation(registerValidation, {
      ...validBody,
      password: 'password1!',
    });
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('rejette un mot de passe sans chiffre', async () => {
    const { res } = await runValidation(registerValidation, {
      ...validBody,
      password: 'Password!',
    });
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('rejette un mot de passe sans caractère spécial', async () => {
    const { res } = await runValidation(registerValidation, {
      ...validBody,
      password: 'Password1',
    });
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('rejette un prénom trop court', async () => {
    const { res } = await runValidation(registerValidation, {
      ...validBody,
      first_name: 'J',
    });
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('accepte un numéro de téléphone luxembourgeois', async () => {
    const { res } = await runValidation(registerValidation, {
      ...validBody,
      phone: '+352 621 123 456',
    });
    expect(res.status).not.toHaveBeenCalledWith(400);
  });
});

// ========================================
// loginValidation
// ========================================

describe('loginValidation', () => {
  test('accepte email + password non vides', async () => {
    const { res } = await runValidation(loginValidation, {
      email: 'a@b.com',
      password: 'anything',
    });
    expect(res.status).not.toHaveBeenCalledWith(400);
  });

  test('rejette un email vide', async () => {
    const { res } = await runValidation(loginValidation, { email: '', password: 'ok' });
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('rejette un password vide', async () => {
    const { res } = await runValidation(loginValidation, { email: 'a@b.com', password: '' });
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

// ========================================
// changePasswordValidation
// ========================================

describe('changePasswordValidation', () => {
  test('accepte des mots de passe valides correspondants', async () => {
    const { res } = await runValidation(changePasswordValidation, {
      currentPassword: 'OldPass1',
      newPassword: 'NewPass1A',
      confirmPassword: 'NewPass1A',
    });
    expect(res.status).not.toHaveBeenCalledWith(400);
  });

  test('rejette si confirmPassword ne correspond pas', async () => {
    const { res } = await runValidation(changePasswordValidation, {
      currentPassword: 'OldPass1',
      newPassword: 'NewPass1A',
      confirmPassword: 'Different1A',
    });
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

// ========================================
// createProjectValidation
// ========================================

describe('createProjectValidation', () => {
  test('accepte un projet valide', async () => {
    const { res } = await runValidation(createProjectValidation, {
      name: 'Mon projet',
      project_type: 'renovation_complete',
    });
    expect(res.status).not.toHaveBeenCalledWith(400);
  });

  test('rejette un nom trop court', async () => {
    const { res } = await runValidation(createProjectValidation, {
      name: 'AB',
      project_type: 'renovation_complete',
    });
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('rejette un type de projet invalide', async () => {
    const { res } = await runValidation(createProjectValidation, {
      name: 'Mon projet',
      project_type: 'invalid_type',
    });
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('accepte un code postal luxembourgeois valide', async () => {
    const { res } = await runValidation(createProjectValidation, {
      name: 'Mon projet',
      project_type: 'renovation_complete',
      postal_code: 'L-1234',
    });
    expect(res.status).not.toHaveBeenCalledWith(400);
  });

  test('rejette un code postal invalide', async () => {
    const { res } = await runValidation(createProjectValidation, {
      name: 'Mon projet',
      project_type: 'renovation_complete',
      postal_code: '75000',
    });
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
