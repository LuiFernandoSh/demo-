// routes/database.js - Rutas para gestión de base de datos (solo admin)
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../../config/db.js';
import { authenticateToken, authorize } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Inicializar esquema de base de datos
router.post('/init-schema', async (req, res) => {
    try {
        // Verificar si ya existen tablas
        const [tables] = await db.query('SHOW TABLES');

        if (tables.length > 0) {
            return res.status(400).json({
                error: 'La base de datos ya tiene tablas. Use este endpoint solo para inicialización.',
                existingTables: tables.length
            });
        }

        // Leer el archivo SQL
        const schemaPath = path.join(__dirname, '..', '..', 'database_schema.sql');

        if (!fs.existsSync(schemaPath)) {
            return res.status(404).json({ error: 'Archivo database_schema.sql no encontrado' });
        }

        const sql = fs.readFileSync(schemaPath, 'utf8');

        // Ejecutar el script SQL
        console.log('📄 Ejecutando database_schema.sql...');
        await db.query(sql);

        // Verificar tablas creadas
        const [newTables] = await db.query('SHOW TABLES');

        res.json({
            message: 'Base de datos inicializada exitosamente',
            tablesCreated: newTables.length,
            tables: newTables.map(t => Object.values(t)[0])
        });

    } catch (error) {
        console.error('Error al inicializar esquema:', error);
        res.status(500).json({
            error: 'Error al inicializar base de datos',
            details: error.message
        });
    }
});

// Verificar estado de la BD
router.get('/status', async (req, res) => {
    try {
        const [tables] = await db.query('SHOW TABLES');

        res.json({
            initialized: tables.length > 0,
            tablesCount: tables.length,
            tables: tables.map(t => Object.values(t)[0])
        });
    } catch (error) {
        console.error('Error al verificar estado:', error);
        res.status(500).json({
            error: 'Error al verificar estado de la base de datos',
            details: error.message
        });
    }
});

// Todas las rutas siguientes requieren ser admin
router.use(authenticateToken);
router.use(authorize('admin'));

// Listar todas las tablas
router.get('/tables', async (req, res) => {
    try {
        const [tables] = await db.query('SHOW TABLES');
        // Object.values(t)[0] funciona sin importar el nombre de la BD
        const tableList = tables.map(t => Object.values(t)[0]);

        res.json({ tables: tableList });
    } catch (error) {
        console.error('Error al listar tablas:', error);
        res.status(500).json({ error: 'Error al listar tablas' });
    }
});

// Ver estructura de una tabla
router.get('/tables/:tableName/structure', async (req, res) => {
    try {
        const [structure] = await db.query(`DESCRIBE ${req.params.tableName}`);
        res.json({ structure });
    } catch (error) {
        console.error('Error al obtener estructura:', error);
        res.status(500).json({ error: 'Error al obtener estructura de la tabla' });
    }
});

// Ver datos de una tabla
router.get('/tables/:tableName/data', async (req, res) => {
    try {
        const { limit = 100, offset = 0 } = req.query;
        const [rows] = await db.query(
            `SELECT * FROM ${req.params.tableName} LIMIT ? OFFSET ?`,
            [parseInt(limit), parseInt(offset)]
        );

        const [countResult] = await db.query(
            `SELECT COUNT(*) as total FROM ${req.params.tableName}`
        );

        res.json({
            data: rows,
            total: countResult[0].total,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
    } catch (error) {
        console.error('Error al obtener datos:', error);
        res.status(500).json({ error: 'Error al obtener datos de la tabla' });
    }
});

// Ejecutar consulta dinámica
router.post('/query', async (req, res) => {
    try {
        const { query } = req.body;

        if (!query) {
            return res.status(400).json({ error: 'Query es requerida' });
        }

        // Prevenir queries peligrosas
        const dangerousKeywords = ['DROP', 'TRUNCATE', 'DELETE', 'UPDATE', 'INSERT', 'ALTER'];
        const upperQuery = query.toUpperCase();

        for (const keyword of dangerousKeywords) {
            if (upperQuery.includes(keyword)) {
                return res.status(403).json({
                    error: `Operación ${keyword} no permitida por seguridad. Solo se permiten consultas SELECT.`
                });
            }
        }

        const [results] = await db.query(query);
        res.json({ results });
    } catch (error) {
        console.error('Error al ejecutar query:', error);
        res.status(500).json({ error: error.message });
    }
});

// Estadísticas de la base de datos
router.get('/stats', async (req, res) => {
    try {
        const stats = {};

        // Total de usuarios
        const [usuarios] = await db.query('SELECT COUNT(*) as total FROM usuarios WHERE activo = true');
        stats.usuarios = usuarios[0].total;

        // Total de productos
        const [productos] = await db.query('SELECT COUNT(*) as total FROM productos WHERE activo = true');
        stats.productos = productos[0].total;

        // Total de ventas
        const [ventas] = await db.query('SELECT COUNT(*) as total, SUM(total) as ingresos FROM ventas WHERE estado = "completada"');
        stats.ventas = ventas[0].total;
        stats.ingresosTotales = ventas[0].ingresos || 0;

        // Tamaño de la base de datos (usa DATABASE() para obtener el nombre actual)
        const [size] = await db.query(
            `SELECT 
                table_schema AS 'database',
                SUM(data_length + index_length) / 1024 / 1024 AS 'size_mb'
             FROM information_schema.tables
             WHERE table_schema = DATABASE()
             GROUP BY table_schema`
        );
        stats.databaseSize = size[0]?.size_mb || 0;

        res.json({ stats });
    } catch (error) {
        console.error('Error al obtener estadísticas:', error);
        res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
});

export default router;
