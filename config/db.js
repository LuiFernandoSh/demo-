// db.js - Configuración de conexión a MySQL
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Soporta variables DB_* (local) y MYSQL* (Railway las pone automático)
const DB_HOST = process.env.DB_HOST || process.env.MYSQLHOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || process.env.MYSQLPORT) || 3306;
const DB_USER = process.env.DB_USER || process.env.MYSQLUSER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || '';
const DB_NAME = process.env.DB_NAME || process.env.MYSQLDATABASE || 'tienda_manager';

// SSL para bases de datos cloud (Aiven, Railway, etc.)
const sslConfig = process.env.DB_SSL === 'true'
    ? { rejectUnauthorized: false }
    : false;

// Configuración del pool de conexiones
const pool = mysql.createPool({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    ssl: sslConfig,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
});



// Probar conexión
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('✅ Conectado a MySQL exitosamente');
        console.log(`📊 Base de datos: ${DB_NAME}`);
        connection.release();
        return true;
    } catch (error) {
        console.error('❌ Error al conectar con MySQL:', error.message);
        console.error('Verifica tus credenciales en el archivo .env');
        return false;
    }
}

// Ejecutar test al iniciar (excepto en tests)
if (process.env.NODE_ENV !== 'test') {
    testConnection();
}

export default pool;
