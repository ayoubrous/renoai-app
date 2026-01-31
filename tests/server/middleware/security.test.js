/**
 * Tests for Security Middleware
 * RenoAI - Security middleware test suite
 */

import { jest } from '@jest/globals';

// Import all security functions
import {
    corsOptions,
    generateCsrfToken,
    validateCsrfToken,
    csrfProtection,
    validateHeaders,
    sanitizeString,
    sanitizeObject,
    sanitizeInput,
    securityHeaders,
    detectAttacks
} from '../../../server/middleware/security.js';

// Test helpers
function mockReq(overrides = {}) {
    return {
        body: {},
        params: {},
        query: {},
        user: null,
        ip: '127.0.0.1',
        method: 'GET',
        originalUrl: '/api/test',
        path: '/api/test',
        headers: {},
        get: (h) => overrides.headers?.[h],
        sessionID: 'test-session',
        ...overrides
    };
}

function mockRes() {
    const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        setHeader: jest.fn(),
        set: jest.fn(),
        statusCode: 200
    };
    return res;
}

function mockNext() {
    return jest.fn();
}

describe('Security Middleware', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ============================================
    // CORS OPTIONS
    // ============================================
    describe('corsOptions', () => {
        test('should allow localhost:3000', (done) => {
            corsOptions.origin('http://localhost:3000', (error, allowed) => {
                expect(error).toBeNull();
                expect(allowed).toBe(true);
                done();
            });
        });

        test('should allow localhost:5000', (done) => {
            corsOptions.origin('http://localhost:5000', (error, allowed) => {
                expect(error).toBeNull();
                expect(allowed).toBe(true);
                done();
            });
        });

        test('should allow 127.0.0.1:3000', (done) => {
            corsOptions.origin('http://127.0.0.1:3000', (error, allowed) => {
                expect(error).toBeNull();
                expect(allowed).toBe(true);
                done();
            });
        });

        test('should allow 127.0.0.1:5000', (done) => {
            corsOptions.origin('http://127.0.0.1:5000', (error, allowed) => {
                expect(error).toBeNull();
                expect(allowed).toBe(true);
                done();
            });
        });

        test('should allow no origin (mobile apps, Postman)', (done) => {
            corsOptions.origin(undefined, (error, allowed) => {
                expect(error).toBeNull();
                expect(allowed).toBe(true);
                done();
            });
        });

        test('should block unknown origins', (done) => {
            corsOptions.origin('http://evil.com', (error, allowed) => {
                expect(error).toBeInstanceOf(Error);
                expect(error.message).toContain('Non autorisé par CORS');
                done();
            });
        });

        test('should have correct CORS configuration', () => {
            expect(corsOptions.methods).toContain('GET');
            expect(corsOptions.methods).toContain('POST');
            expect(corsOptions.allowedHeaders).toContain('X-CSRF-Token');
            expect(corsOptions.credentials).toBe(true);
        });
    });

    // ============================================
    // CSRF TOKEN GENERATION & VALIDATION
    // ============================================
    describe('CSRF Token Management', () => {
        test('should generate valid CSRF token', () => {
            const sessionId = 'test-session-123';
            const token = generateCsrfToken(sessionId);

            expect(token).toBeTruthy();
            expect(typeof token).toBe('string');
            expect(token.length).toBe(64); // 32 bytes hex = 64 chars
        });

        test('should validate correct CSRF token', () => {
            const sessionId = 'test-session-456';
            const token = generateCsrfToken(sessionId);
            const isValid = validateCsrfToken(token, sessionId);

            expect(isValid).toBe(true);
        });

        test('should reject invalid CSRF token', () => {
            const isValid = validateCsrfToken('invalid-token', 'session-id');
            expect(isValid).toBe(false);
        });

        test('should reject CSRF token with wrong session ID', () => {
            const token = generateCsrfToken('session-1');
            const isValid = validateCsrfToken(token, 'session-2');

            expect(isValid).toBe(false);
        });

        test('should reject expired CSRF token', () => {
            const sessionId = 'test-session-expired';
            const token = generateCsrfToken(sessionId);

            // Mock Date.now to simulate 2 hours passing (token expires in 1 hour)
            const originalNow = Date.now;
            Date.now = jest.fn(() => originalNow() + 2 * 60 * 60 * 1000);

            const isValid = validateCsrfToken(token, sessionId);
            expect(isValid).toBe(false);

            // Restore Date.now
            Date.now = originalNow;
        });
    });

    // ============================================
    // CSRF PROTECTION MIDDLEWARE
    // ============================================
    describe('csrfProtection middleware', () => {
        test('should allow GET requests without CSRF token', () => {
            const req = mockReq({ method: 'GET' });
            const res = mockRes();
            const next = mockNext();

            csrfProtection(req, res, next);

            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });

        test('should allow HEAD requests without CSRF token', () => {
            const req = mockReq({ method: 'HEAD' });
            const res = mockRes();
            const next = mockNext();

            csrfProtection(req, res, next);

            expect(next).toHaveBeenCalled();
        });

        test('should allow OPTIONS requests without CSRF token', () => {
            const req = mockReq({ method: 'OPTIONS' });
            const res = mockRes();
            const next = mockNext();

            csrfProtection(req, res, next);

            expect(next).toHaveBeenCalled();
        });

        test('should exempt /api/auth/login from CSRF protection', () => {
            const req = mockReq({ method: 'POST', path: '/api/auth/login' });
            const res = mockRes();
            const next = mockNext();

            csrfProtection(req, res, next);

            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });

        test('should exempt /api/auth/register from CSRF protection', () => {
            const req = mockReq({ method: 'POST', path: '/api/auth/register' });
            const res = mockRes();
            const next = mockNext();

            csrfProtection(req, res, next);

            expect(next).toHaveBeenCalled();
        });

        test('should reject POST request without CSRF token', () => {
            const req = mockReq({ method: 'POST', path: '/api/projects' });
            const res = mockRes();
            const next = mockNext();

            csrfProtection(req, res, next);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: 'Token CSRF invalide ou manquant',
                code: 'CSRF_INVALID'
            });
            expect(next).not.toHaveBeenCalled();
        });

        test('should accept valid CSRF token from header', () => {
            const sessionId = 'test-session';
            const token = generateCsrfToken(sessionId);
            const req = mockReq({
                method: 'POST',
                path: '/api/projects',
                headers: { 'x-csrf-token': token },
                sessionID: sessionId
            });
            const res = mockRes();
            const next = mockNext();

            csrfProtection(req, res, next);

            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });

        test('should accept valid CSRF token from body', () => {
            const sessionId = 'test-session';
            const token = generateCsrfToken(sessionId);
            const req = mockReq({
                method: 'POST',
                path: '/api/projects',
                body: { _csrf: token },
                sessionID: sessionId
            });
            const res = mockRes();
            const next = mockNext();

            csrfProtection(req, res, next);

            expect(next).toHaveBeenCalled();
        });

        test('should consume CSRF token after use', () => {
            const sessionId = 'test-session';
            const token = generateCsrfToken(sessionId);
            const req = mockReq({
                method: 'POST',
                path: '/api/projects',
                headers: { 'x-csrf-token': token },
                sessionID: sessionId
            });
            const res = mockRes();
            const next = mockNext();

            // First use should succeed
            csrfProtection(req, res, next);
            expect(next).toHaveBeenCalled();

            // Second use should fail (token consumed)
            const req2 = mockReq({
                method: 'POST',
                path: '/api/projects',
                headers: { 'x-csrf-token': token },
                sessionID: sessionId
            });
            const res2 = mockRes();
            const next2 = mockNext();

            csrfProtection(req2, res2, next2);
            expect(res2.status).toHaveBeenCalledWith(403);
            expect(next2).not.toHaveBeenCalled();
        });
    });

    // ============================================
    // VALIDATE HEADERS MIDDLEWARE
    // ============================================
    describe('validateHeaders middleware', () => {
        test('should allow GET requests without Content-Type', () => {
            const req = mockReq({ method: 'GET' });
            const res = mockRes();
            const next = mockNext();

            validateHeaders(req, res, next);

            expect(next).toHaveBeenCalled();
        });

        test('should allow POST with application/json Content-Type', () => {
            const req = mockReq({
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: { name: 'test' }
            });
            const res = mockRes();
            const next = mockNext();

            validateHeaders(req, res, next);

            expect(next).toHaveBeenCalled();
        });

        test('should allow POST with application/x-www-form-urlencoded', () => {
            const req = mockReq({
                method: 'POST',
                headers: { 'content-type': 'application/x-www-form-urlencoded' },
                body: { name: 'test' }
            });
            const res = mockRes();
            const next = mockNext();

            validateHeaders(req, res, next);

            expect(next).toHaveBeenCalled();
        });

        test('should reject POST with invalid Content-Type', () => {
            const req = mockReq({
                method: 'POST',
                headers: { 'content-type': 'text/plain' },
                body: { name: 'test' }
            });
            const res = mockRes();
            const next = mockNext();

            validateHeaders(req, res, next);

            expect(res.status).toHaveBeenCalledWith(415);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: 'Content-Type invalide',
                code: 'INVALID_CONTENT_TYPE'
            });
        });

        test('should allow multipart/form-data for upload paths', () => {
            const req = mockReq({
                method: 'POST',
                path: '/api/upload',
                headers: { 'content-type': 'multipart/form-data; boundary=----WebKitFormBoundary' }
            });
            const res = mockRes();
            const next = mockNext();

            validateHeaders(req, res, next);

            expect(next).toHaveBeenCalled();
        });

        test('should allow JSON for upload paths', () => {
            const req = mockReq({
                method: 'POST',
                path: '/api/upload',
                headers: { 'content-type': 'application/json' }
            });
            const res = mockRes();
            const next = mockNext();

            validateHeaders(req, res, next);

            expect(next).toHaveBeenCalled();
        });
    });

    // ============================================
    // SANITIZATION FUNCTIONS
    // ============================================
    describe('sanitizeString', () => {
        test('should escape HTML special characters', () => {
            const input = '<script>alert("XSS")</script>';
            const expected = '&lt;script&gt;alert(&quot;XSS&quot;)&lt;&#x2F;script&gt;';
            expect(sanitizeString(input)).toBe(expected);
        });

        test('should escape ampersands', () => {
            expect(sanitizeString('Tom & Jerry')).toBe('Tom &amp; Jerry');
        });

        test('should escape quotes', () => {
            expect(sanitizeString(`He said "Hello"`)).toBe('He said &quot;Hello&quot;');
            expect(sanitizeString(`It's working`)).toBe('It&#x27;s working');
        });

        test('should return non-strings unchanged', () => {
            expect(sanitizeString(123)).toBe(123);
            expect(sanitizeString(null)).toBe(null);
            expect(sanitizeString(undefined)).toBe(undefined);
        });
    });

    describe('sanitizeObject', () => {
        test('should sanitize string values in objects', () => {
            const input = { name: '<script>alert()</script>', age: 30 };
            const result = sanitizeObject(input);

            expect(result.name).toBe('&lt;script&gt;alert()&lt;&#x2F;script&gt;');
            expect(result.age).toBe(30);
        });

        test('should sanitize nested objects', () => {
            const input = {
                user: {
                    name: '<b>John</b>',
                    bio: 'Developer & Designer'
                }
            };
            const result = sanitizeObject(input);

            expect(result.user.name).toBe('&lt;b&gt;John&lt;&#x2F;b&gt;');
            expect(result.user.bio).toBe('Developer &amp; Designer');
        });

        test('should sanitize arrays', () => {
            const input = ['<script>', 'safe text', '<img>'];
            const result = sanitizeObject(input);

            expect(result[0]).toBe('&lt;script&gt;');
            expect(result[1]).toBe('safe text');
            expect(result[2]).toBe('&lt;img&gt;');
        });

        test('should sanitize object keys', () => {
            const input = { '<script>key': 'value' };
            const result = sanitizeObject(input);

            expect(result['&lt;script&gt;key']).toBe('value');
        });
    });

    describe('sanitizeInput middleware', () => {
        test('should sanitize request body', () => {
            const req = mockReq({
                body: { name: '<script>alert()</script>', age: 25 }
            });
            const res = mockRes();
            const next = mockNext();

            sanitizeInput(req, res, next);

            expect(req.body.name).toBe('&lt;script&gt;alert()&lt;&#x2F;script&gt;');
            expect(req.body.age).toBe(25);
            expect(next).toHaveBeenCalled();
        });

        test('should preserve password fields', () => {
            const req = mockReq({
                body: {
                    username: '<script>',
                    password: 'P@ssw0rd<>"',
                    currentPassword: 'old<pass>',
                    newPassword: 'new&pass'
                }
            });
            const res = mockRes();
            const next = mockNext();

            sanitizeInput(req, res, next);

            expect(req.body.username).toBe('&lt;script&gt;');
            expect(req.body.password).toBe('P@ssw0rd<>"');
            expect(req.body.currentPassword).toBe('old<pass>');
            expect(req.body.newPassword).toBe('new&pass');
        });

        test('should preserve html_content field', () => {
            const req = mockReq({
                body: {
                    title: '<b>Title</b>',
                    html_content: '<div><p>Content</p></div>'
                }
            });
            const res = mockRes();
            const next = mockNext();

            sanitizeInput(req, res, next);

            expect(req.body.title).toBe('&lt;b&gt;Title&lt;&#x2F;b&gt;');
            expect(req.body.html_content).toBe('<div><p>Content</p></div>');
        });

        test('should sanitize query parameters', () => {
            const req = mockReq({
                query: { search: '<script>', page: '1' }
            });
            const res = mockRes();
            const next = mockNext();

            sanitizeInput(req, res, next);

            expect(req.query.search).toBe('&lt;script&gt;');
            expect(req.query.page).toBe('1');
        });

        test('should sanitize route parameters', () => {
            const req = mockReq({
                params: { id: '<script>' }
            });
            const res = mockRes();
            const next = mockNext();

            sanitizeInput(req, res, next);

            expect(req.params.id).toBe('&lt;script&gt;');
        });
    });

    // ============================================
    // SECURITY HEADERS MIDDLEWARE
    // ============================================
    describe('securityHeaders middleware', () => {
        test('should set X-Request-ID header', () => {
            const req = mockReq();
            const res = mockRes();
            const next = mockNext();

            securityHeaders(req, res, next);

            expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', expect.any(String));
            expect(req.requestId).toBeTruthy();
        });

        test('should set X-Content-Type-Options to nosniff', () => {
            const req = mockReq();
            const res = mockRes();
            const next = mockNext();

            securityHeaders(req, res, next);

            expect(res.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
        });

        test('should set X-XSS-Protection', () => {
            const req = mockReq();
            const res = mockRes();
            const next = mockNext();

            securityHeaders(req, res, next);

            expect(res.setHeader).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block');
        });

        test('should set X-Frame-Options to DENY', () => {
            const req = mockReq();
            const res = mockRes();
            const next = mockNext();

            securityHeaders(req, res, next);

            expect(res.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
        });

        test('should set Referrer-Policy', () => {
            const req = mockReq();
            const res = mockRes();
            const next = mockNext();

            securityHeaders(req, res, next);

            expect(res.setHeader).toHaveBeenCalledWith('Referrer-Policy', 'strict-origin-when-cross-origin');
        });

        test('should set Permissions-Policy', () => {
            const req = mockReq();
            const res = mockRes();
            const next = mockNext();

            securityHeaders(req, res, next);

            expect(res.setHeader).toHaveBeenCalledWith('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
        });

        test('should call next', () => {
            const req = mockReq();
            const res = mockRes();
            const next = mockNext();

            securityHeaders(req, res, next);

            expect(next).toHaveBeenCalled();
        });
    });

    // ============================================
    // ATTACK DETECTION MIDDLEWARE
    // ============================================
    describe('detectAttacks middleware', () => {
        test('should allow normal requests', () => {
            const req = mockReq({
                originalUrl: '/api/projects',
                body: { name: 'My Project' }
            });
            const res = mockRes();
            const next = mockNext();

            detectAttacks(req, res, next);

            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });

        test('should detect path traversal in URL', () => {
            const req = mockReq({
                originalUrl: '/api/files?path=../../etc/passwd'
            });
            const res = mockRes();
            const next = mockNext();

            detectAttacks(req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                error: 'Requête invalide',
                code: 'INVALID_REQUEST'
            });
        });

        test('should detect XSS in body', () => {
            const req = mockReq({
                body: { comment: '<script>alert("XSS")</script>' }
            });
            const res = mockRes();
            const next = mockNext();

            detectAttacks(req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
        });

        test('should detect SQL injection attempts', () => {
            const req = mockReq({
                originalUrl: '/api/users?id=1 UNION SELECT * FROM users'
            });
            const res = mockRes();
            const next = mockNext();

            detectAttacks(req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
        });

        test('should detect command injection', () => {
            const req = mockReq({
                body: { cmd: 'test exec(malicious)' }
            });
            const res = mockRes();
            const next = mockNext();

            detectAttacks(req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
        });

        test('should detect template injection', () => {
            const req = mockReq({
                body: { template: '${process.env}' }
            });
            const res = mockRes();
            const next = mockNext();

            detectAttacks(req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
        });

        test('should detect javascript: protocol', () => {
            const req = mockReq({
                body: { link: 'javascript:alert(1)' }
            });
            const res = mockRes();
            const next = mockNext();

            detectAttacks(req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
        });

        test('should detect data: protocol', () => {
            const req = mockReq({
                body: { src: 'data:text/html,<script>alert(1)</script>' }
            });
            const res = mockRes();
            const next = mockNext();

            detectAttacks(req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
        });

        test('should block IP after threshold exceeded', () => {
            const ip = '192.168.1.100';

            // Simulate 10+ suspicious requests
            for (let i = 0; i < 11; i++) {
                const req = mockReq({
                    ip,
                    originalUrl: '/api/test?file=../../etc/passwd'
                });
                const res = mockRes();
                const next = mockNext();

                detectAttacks(req, res, next);

                if (i >= 10) {
                    // After 10th attempt, should block with 403
                    expect(res.status).toHaveBeenCalledWith(403);
                    expect(res.json).toHaveBeenCalledWith({
                        success: false,
                        error: 'Requête bloquée pour raisons de sécurité',
                        code: 'SECURITY_BLOCK'
                    });
                }
            }
        });
    });
});
