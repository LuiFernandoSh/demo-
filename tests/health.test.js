import request from 'supertest';
import { jest } from '@jest/globals';

// 1. Mockear la base de datos usando ESM mockModule ANTES de los imports dinámicos
jest.unstable_mockModule('../config/db.js', () => ({
    default: {
        query: jest.fn(),
        getConnection: jest.fn(),
        end: jest.fn()
    }
}));

// 2. Importar de manera dinámica (requerido para ESM mocks en Jest)
const { default: app } = await import('../server.js');
const { default: db } = await import('../config/db.js');

describe('Health API Endpoints', () => {
    it('Debe responder 200 OK y estado "UP" en el endpoint de health', async () => {
        const response = await request(app).get('/api/health');
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('status', 'ok');
        expect(response.body).toHaveProperty('timestamp');
    });

    it('Debe devolver 404 para una ruta inexistente', async () => {
        const response = await request(app).get('/api/ruta-falsa-404-xyz');
        expect(response.status).toBe(404);
        expect(response.body).toHaveProperty('error', 'Endpoint no encontrado');
    });
});
