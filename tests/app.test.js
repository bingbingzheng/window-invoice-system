const request = require('supertest');
const app = require('../server');

describe('API Health Checks', () => {
    test('GET /api/server-info should return server information', async () => {
        const response = await request(app).get('/api/server-info');
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('port');
        expect(response.body).toHaveProperty('addresses');
        expect(response.body).toHaveProperty('accessUrls');
    });
});

describe('Static Files', () => {
    test('GET / should return HTML', async () => {
        const response = await request(app).get('/');
        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toMatch(/html/);
    });
});

describe('Authentication API', () => {
    test('GET /api/auth/check should work', async () => {
        const response = await request(app).get('/api/auth/check');
        // Should return 401 if not logged in, or 200 if logged in
        expect([200, 401]).toContain(response.status);
    });

    test('POST /api/auth/login with invalid credentials should fail', async () => {
        const response = await request(app)
            .post('/api/auth/login')
            .send({ username: 'invalid', password: 'invalid' });
        expect(response.status).toBe(401);
    });
});

describe('Customers API (requires auth)', () => {
    test('GET /api/customers without auth should return 401', async () => {
        const response = await request(app).get('/api/customers');
        expect(response.status).toBe(401);
    });
});

describe('Factories API (requires auth)', () => {
    test('GET /api/factories without auth should return 401', async () => {
        const response = await request(app).get('/api/factories');
        expect(response.status).toBe(401);
    });
});

describe('Orders API (requires auth)', () => {
    test('GET /api/orders without auth should return 401', async () => {
        const response = await request(app).get('/api/orders');
        expect(response.status).toBe(401);
    });
});

describe('Standard Products API', () => {
    test('GET /api/standard-products should return array', async () => {
        const response = await request(app).get('/api/standard-products');
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
    });
});

describe('Product Templates API', () => {
    test('GET /api/product-templates should return array', async () => {
        const response = await request(app).get('/api/product-templates');
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
    });
});
