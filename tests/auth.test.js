import request from 'supertest';
import { jest } from '@jest/globals';

jest.unstable_mockModule('../config/db.js', () => ({
    default: {
        query: jest.fn(),
        getConnection: jest.fn(),
        end: jest.fn()
    }
}));

const { default: app } = await import('../server.js');
const { default: db } = await import('../config/db.js');

describe('Authentication API', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('Debe devolver error 400 si faltan credenciales', async () => {
        const res = await request(app).post('/api/auth/login').send({});
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error', 'Email y contraseña son requeridos');
    });

    it('Debe devolver error 401 para credenciales incorrectas', async () => {
        // Mockear respuesta vacía (usuario no encontrado)
        db.query.mockResolvedValueOnce([[]]);

        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'no_existe@tienda.com', password: 'password123' });

        expect(res.status).toBe(401);
        expect(res.body).toHaveProperty('error', 'Credenciales incorrectas');
    });
});
