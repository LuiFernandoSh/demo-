import 'dotenv/config'; // Cargar variables de entorno PRIMERO
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import authRoutes from './src/auth/auth.js';
import productosRoutes from './src/controllers/productos.js';
import ventasRoutes from './src/controllers/ventas.js';
import reportesRoutes from './src/controllers/reportes.js';
import databaseRoutes from './src/controllers/database.js';
import lotesRoutes from './src/controllers/lotes.js';
import pedidosRoutes from './src/controllers/pedidos.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, 'public')));

// Logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/productos', productosRoutes);
app.use('/api/ventas', ventasRoutes);
app.use('/api/reportes', reportesRoutes);
app.use('/api/database', databaseRoutes);
app.use('/api/lotes', lotesRoutes);
app.use('/api/pedidos', pedidosRoutes);

// Ruta de prueba
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Backend API funcionando correctamente',
        timestamp: new Date().toISOString()
    });
});

// Manejo de SPA (Frontend)
app.get('*', (req, res, next) => {
    // Si es una ruta de API, continuar al manejo de errores 404
    if (req.path.startsWith('/api')) {
        return next();
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Manejo de errores 404 de API
app.use((req, res) => {
    res.status(404).json({
        error: 'Endpoint no encontrado',
        path: req.path
    });
});

// Manejo de errores globales
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        error: 'Error interno del servidor',
        message: err.message
    });
});

// Iniciar servidor solo si no estamos en entorno de testing
if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
        console.log('=================================');
        console.log('🚀 Servidor Backend Iniciado');
        console.log(`📡 Puerto: ${PORT}`);
        console.log(`🌐 URL: http://localhost:${PORT}`);
        console.log(`🏥 Health Check: http://localhost:${PORT}/api/health`);
        console.log('=================================');
    });
}

// Exportar app para pruebas unitarias con Jest
export default app;
