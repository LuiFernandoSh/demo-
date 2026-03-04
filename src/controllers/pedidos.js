// pedidos.js — Controlador de pedidos (Módulo de Logística)
import { Router } from 'express';
import db from '../../config/db.js';

const router = Router();

// Generador de folio
function generarFolio() {
    const now = new Date();
    const fecha = now.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(Math.random() * 9000) + 1000;
    return `P-${fecha}-${rand}`;
}

// Obtener pedidos
router.get('/', async (req, res) => {
    try {
        const { rol, id: userId } = req.query;

        let sql, params;
        if (rol === 'repartidor') {
            // Filtro para repartidor
            sql = `
        SELECT p.*, u.nombre as repartidor_nombre,
          GROUP_CONCAT(
            JSON_OBJECT(
              'id', dp.producto_id,
              'nombre', dp.producto_nombre,
              'cantidad', dp.cantidad,
              'precio', dp.precio_unitario,
              'subtotal', dp.subtotal
            )
          ) as productos_json
        FROM pedidos p
        LEFT JOIN usuarios u ON p.repartidor_id = u.id
        LEFT JOIN detalle_pedido dp ON p.id = dp.pedido_id
        WHERE p.estado IN ('pendiente','en_camino','entregado')
          AND (p.repartidor_id IS NULL OR p.repartidor_id = ?)
        GROUP BY p.id
        ORDER BY p.created_at DESC
      `;
            params = [userId || 0];
        } else {
            // Filtro para admin
            sql = `
        SELECT p.*, u.nombre as repartidor_nombre,
          GROUP_CONCAT(
            JSON_OBJECT(
              'id', dp.producto_id,
              'nombre', dp.producto_nombre,
              'cantidad', dp.cantidad,
              'precio', dp.precio_unitario,
              'subtotal', dp.subtotal
            )
          ) as productos_json
        FROM pedidos p
        LEFT JOIN usuarios u ON p.repartidor_id = u.id
        LEFT JOIN detalle_pedido dp ON p.id = dp.pedido_id
        GROUP BY p.id
        ORDER BY p.created_at DESC
      `;
            params = [];
        }

        const [rows] = await db.query(sql, params);

        // Parsear productos_json
        const pedidos = rows.map(row => ({
            ...row,
            productos: row.productos_json
                ? row.productos_json.split('},{').map(s => {
                    try { return JSON.parse(s.startsWith('{') ? s : '{' + s); }
                    catch { return null; }
                }).filter(Boolean)
                : []
        }));

        res.json({ success: true, data: pedidos });
    } catch (error) {
        console.error('Error al obtener pedidos:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Obtener catálogo de productos
router.get('/productos', async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT id, nombre, precio, stock, categoria FROM productos WHERE activo = TRUE AND stock > 0 ORDER BY nombre ASC'
        );
        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ─────────────────────────────────────────────────────────────
// POST /api/pedidos — Crear pedido (Admin)
// ─────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const {
            cliente_nombre, cliente_telefono, cliente_direccion,
            cliente_lat, cliente_lng, metodo_pago, notas,
            creado_por, productos // array de { producto_id, cantidad, precio_unitario }
        } = req.body;

        if (!cliente_nombre || !cliente_direccion || !productos?.length) {
            return res.status(400).json({ success: false, error: 'Faltan campos obligatorios' });
        }

        const folio = generarFolio();
        const total = productos.reduce((sum, p) => sum + (p.precio_unitario * p.cantidad), 0);

        // Validación de usuario credor
        let validCreadoPor = null;
        if (creado_por) {
            const [[userRow]] = await conn.query('SELECT id FROM usuarios WHERE id = ?', [creado_por]);
            if (userRow) validCreadoPor = userRow.id;
        }

        if (!validCreadoPor) {
            const [[anyUser]] = await conn.query('SELECT id FROM usuarios ORDER BY id ASC LIMIT 1');
            validCreadoPor = anyUser ? anyUser.id : null;
        }

        // Insertar pedido
        const [pedidoResult] = await conn.query(
            `INSERT INTO pedidos (folio, cliente_nombre, cliente_telefono, cliente_direccion,
        cliente_lat, cliente_lng, estado, metodo_pago, total, notas, creado_por)
       VALUES (?, ?, ?, ?, ?, ?, 'pendiente', ?, ?, ?, ?)`,
            [folio, cliente_nombre, cliente_telefono || null, cliente_direccion,
                cliente_lat || 19.0413, cliente_lng || -98.2062,
                metodo_pago || 'efectivo', total, notas || null, validCreadoPor]
        );

        const pedidoId = pedidoResult.insertId;

        // Insertar detalle de productos
        for (const prod of productos) {
            const subtotal = prod.precio_unitario * prod.cantidad;
            // Obtener nombre del producto
            const [[prodRow]] = await conn.query('SELECT nombre FROM productos WHERE id = ?', [prod.producto_id]);
            await conn.query(
                `INSERT INTO detalle_pedido (pedido_id, producto_id, producto_nombre, cantidad, precio_unitario, subtotal)
         VALUES (?, ?, ?, ?, ?, ?)`,
                [pedidoId, prod.producto_id, prodRow?.nombre || 'Producto', prod.cantidad, prod.precio_unitario, subtotal]
            );
        }

        await conn.commit();
        res.status(201).json({ success: true, data: { id: pedidoId, folio }, message: 'Pedido creado correctamente' });
    } catch (error) {
        await conn.rollback();
        console.error('Error al crear pedido:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        conn.release();
    }
});

// Actualizar estado de pedido
router.patch('/:id/estado', async (req, res) => {
    try {
        const { id } = req.params;
        const { estado, repartidor_id } = req.body;

        const estadosValidos = ['pendiente', 'en_camino', 'entregado', 'cancelado'];
        if (!estadosValidos.includes(estado)) {
            return res.status(400).json({ success: false, error: 'Estado inválido' });
        }

        let sql, params;
        if (estado === 'en_camino' && repartidor_id) {
            sql = 'UPDATE pedidos SET estado = ?, repartidor_id = ? WHERE id = ?';
            params = [estado, repartidor_id, id];
        } else {
            sql = 'UPDATE pedidos SET estado = ? WHERE id = ?';
            params = [estado, id];
        }

        const [result] = await db.query(sql, params);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, error: 'Pedido no encontrado' });
        }

        res.json({ success: true, message: `Estado actualizado a ${estado}` });
    } catch (error) {
        console.error('Error al actualizar estado:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Finalizar entrega de pedido y afectar inventario
router.post('/:id/entregar', async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const { id } = req.params;
        const { repartidor_id, metodo_pago } = req.body;

        // Validar estado del pedido
        const [[pedido]] = await conn.query('SELECT * FROM pedidos WHERE id = ?', [id]);
        if (!pedido) throw new Error('Pedido no encontrado');
        if (pedido.estado !== 'en_camino') throw new Error('El pedido no está en camino');

        // Consultar productos
        const [detalles] = await conn.query('SELECT * FROM detalle_pedido WHERE pedido_id = ?', [id]);
        if (!detalles.length) throw new Error('El pedido no tiene productos');

        // Validar id_repartidor
        let validRepartidor = repartidor_id || pedido.repartidor_id;
        if (validRepartidor) {
            const [[userRow]] = await conn.query('SELECT id FROM usuarios WHERE id = ?', [validRepartidor]);
            if (!userRow) validRepartidor = null;
        }
        if (!validRepartidor) {
            const [[anyUser]] = await conn.query('SELECT id FROM usuarios ORDER BY id ASC LIMIT 1');
            validRepartidor = anyUser ? anyUser.id : 1;
        }

        // Construir registro de venta
        const folio = 'V-' + pedido.folio.replace('P-', '');
        const [ventaResult] = await conn.query(
            `INSERT INTO ventas (folio, vendedor_id, total, subtotal, metodo_pago, estado, cliente_nombre, cliente_telefono, notas)
       VALUES (?, ?, ?, ?, ?, 'completada', ?, ?, ?)`,
            [folio, validRepartidor,
                pedido.total, pedido.total,
                metodo_pago || pedido.metodo_pago,
                pedido.cliente_nombre, pedido.cliente_telefono || null,
                'Entrega domicilio - Pedido ' + pedido.folio]
        );
        const ventaId = ventaResult.insertId;

        // Procesar partidas del pedido
        for (const detalle of detalles) {
            // Obtener stock actual
            const [[prod]] = await conn.query('SELECT stock FROM productos WHERE id = ?', [detalle.producto_id]);
            const stockAnterior = prod?.stock || 0;
            const stockNuevo = Math.max(0, stockAnterior - detalle.cantidad);

            // Insertar detalle de venta
            await conn.query(
                `INSERT INTO detalles_venta (venta_id, producto_id, producto_nombre, cantidad, precio_unitario, subtotal)
         VALUES (?, ?, ?, ?, ?, ?)`,
                [ventaId, detalle.producto_id, detalle.producto_nombre,
                    detalle.cantidad, detalle.precio_unitario, detalle.subtotal]
            );

            // Actualizar stock
            await conn.query('UPDATE productos SET stock = ? WHERE id = ?', [stockNuevo, detalle.producto_id]);

            // Registrar movimiento de inventario
            await conn.query(
                `INSERT INTO movimientos_inventario (producto_id, tipo_movimiento, cantidad, stock_anterior, stock_nuevo, referencia, usuario_id)
         VALUES (?, 'venta', ?, ?, ?, ?, ?)`,
                [detalle.producto_id, -detalle.cantidad, stockAnterior, stockNuevo,
                'PEDIDO-' + pedido.folio, validRepartidor]
            );
        }

        // 5. Actualizar estado del pedido a entregado
        await conn.query("UPDATE pedidos SET estado = 'entregado' WHERE id = ?", [id]);

        await conn.commit();
        res.json({
            success: true,
            message: 'Entrega confirmada correctamente',
            data: { venta_folio: folio, venta_id: ventaId }
        });
    } catch (error) {
        await conn.rollback();
        console.error('Error al confirmar entrega:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        conn.release();
    }
});

// DELETE /api/pedidos/:id — Cancelar/eliminar pedido (Admin)
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await db.query("UPDATE pedidos SET estado = 'cancelado' WHERE id = ? AND estado = 'pendiente'", [id]);
        res.json({ success: true, message: 'Pedido cancelado' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
