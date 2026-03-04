

USE tienda_manager;



CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    rol ENUM('admin', 'vendedor', 'repartidor') NOT NULL DEFAULT 'vendedor',
    activo BOOLEAN DEFAULT TRUE,
    telefono VARCHAR(20),
    avatar_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL,
    INDEX idx_email (email),
    INDEX idx_rol (rol),
    INDEX idx_activo (activo)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS productos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    codigo_barras VARCHAR(50) UNIQUE,
    nombre VARCHAR(200) NOT NULL,
    descripcion TEXT,
    categoria VARCHAR(100),
    precio DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    costo DECIMAL(10, 2) DEFAULT 0.00,
    stock INT NOT NULL DEFAULT 0,
    stock_minimo INT DEFAULT 5,
    unidad VARCHAR(20) DEFAULT 'pcs',
    proveedor VARCHAR(150),
    imagen_url VARCHAR(255),
    activo BOOLEAN DEFAULT TRUE,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_nombre (nombre),
    INDEX idx_codigo_barras (codigo_barras),
    INDEX idx_categoria (categoria),
    INDEX idx_activo (activo),
    INDEX idx_stock (stock),
    FOREIGN KEY (created_by) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ventas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    folio VARCHAR(20) UNIQUE NOT NULL,
    vendedor_id INT NOT NULL,
    fecha_venta TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    impuestos DECIMAL(10, 2) DEFAULT 0.00,
    descuento DECIMAL(10, 2) DEFAULT 0.00,
    metodo_pago ENUM('efectivo', 'tarjeta', 'transferencia', 'mixto') DEFAULT 'efectivo',
    estado ENUM('completada', 'cancelada', 'pendiente') DEFAULT 'completada',
    cliente_nombre VARCHAR(150),
    cliente_telefono VARCHAR(20),
    notas TEXT,
    INDEX idx_folio (folio),
    INDEX idx_vendedor (vendedor_id),
    INDEX idx_fecha (fecha_venta),
    INDEX idx_estado (estado),
    INDEX idx_metodo_pago (metodo_pago),
    FOREIGN KEY (vendedor_id) REFERENCES usuarios(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS detalles_venta (
    id INT AUTO_INCREMENT PRIMARY KEY,
    venta_id INT NOT NULL,
    producto_id INT NOT NULL,
    producto_nombre VARCHAR(200) NOT NULL,
    cantidad INT NOT NULL DEFAULT 1,
    precio_unitario DECIMAL(10, 2) NOT NULL,
    subtotal DECIMAL(10, 2) NOT NULL,
    descuento DECIMAL(10, 2) DEFAULT 0.00,
    INDEX idx_venta (venta_id),
    INDEX idx_producto (producto_id),
    FOREIGN KEY (venta_id) REFERENCES ventas(id) ON DELETE CASCADE,
    FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS movimientos_inventario (
    id INT AUTO_INCREMENT PRIMARY KEY,
    producto_id INT NOT NULL,
    tipo_movimiento ENUM('entrada', 'salida', 'ajuste', 'venta', 'devolucion') NOT NULL,
    cantidad INT NOT NULL,
    stock_anterior INT NOT NULL,
    stock_nuevo INT NOT NULL,
    referencia VARCHAR(100),
    usuario_id INT,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notas TEXT,
    INDEX idx_producto (producto_id),
    INDEX idx_tipo (tipo_movimiento),
    INDEX idx_fecha (fecha),
    FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sesiones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    token VARCHAR(255) UNIQUE NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_token (token),
    INDEX idx_usuario (usuario_id),
    INDEX idx_expires (expires_at),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;



CREATE TABLE IF NOT EXISTS pedidos (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    folio           VARCHAR(20) UNIQUE NOT NULL,
    cliente_nombre  VARCHAR(150) NOT NULL,
    cliente_telefono VARCHAR(20),
    cliente_direccion TEXT NOT NULL,
    cliente_lat     DECIMAL(10,7) NOT NULL DEFAULT 19.0413000,
    cliente_lng     DECIMAL(10,7) NOT NULL DEFAULT -98.2062000,
    estado          ENUM('pendiente','en_camino','entregado','cancelado') DEFAULT 'pendiente',
    metodo_pago     ENUM('efectivo','tarjeta','transferencia') DEFAULT 'efectivo',
    total           DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    notas           TEXT,
    repartidor_id   INT,
    creado_por      INT NOT NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_estado      (estado),
    INDEX idx_repartidor  (repartidor_id),
    INDEX idx_creado_por  (creado_por),
    INDEX idx_fecha       (created_at),
    FOREIGN KEY (repartidor_id) REFERENCES usuarios(id) ON DELETE SET NULL,
    FOREIGN KEY (creado_por)    REFERENCES usuarios(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS detalle_pedido (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    pedido_id       INT NOT NULL,
    producto_id     INT NOT NULL,
    producto_nombre VARCHAR(200) NOT NULL,
    cantidad        INT NOT NULL DEFAULT 1,
    precio_unitario DECIMAL(10,2) NOT NULL,
    subtotal        DECIMAL(10,2) NOT NULL,
    INDEX idx_pedido   (pedido_id),
    INDEX idx_producto (producto_id),
    FOREIGN KEY (pedido_id)   REFERENCES pedidos(id)   ON DELETE CASCADE,
    FOREIGN KEY (producto_id) REFERENCES productos(id)  ON DELETE RESTRICT
) ENGINE=InnoDB;



CREATE VIEW productos_bajo_stock AS
SELECT p.id, p.nombre, p.codigo_barras, p.categoria, p.stock, p.stock_minimo, p.precio
FROM productos p
WHERE p.stock <= p.stock_minimo AND p.activo = TRUE;

CREATE VIEW ventas_diarias AS
SELECT DATE(v.fecha_venta) as fecha, COUNT(*) as total_ventas,
       SUM(v.total) as total_ingresos, AVG(v.total) as ticket_promedio, u.nombre as vendedor
FROM ventas v JOIN usuarios u ON v.vendedor_id = u.id
WHERE v.estado = 'completada'
GROUP BY DATE(v.fecha_venta), v.vendedor_id, u.nombre;

CREATE VIEW top_productos_vendidos AS
SELECT p.id, p.nombre, p.categoria, SUM(dv.cantidad) as total_vendido,
       SUM(dv.subtotal) as ingresos_generados
FROM productos p JOIN detalles_venta dv ON p.id = dv.producto_id
JOIN ventas v ON dv.venta_id = v.id
WHERE v.estado = 'completada'
GROUP BY p.id, p.nombre, p.categoria
ORDER BY total_vendido DESC;



INSERT INTO usuarios (nombre, email, password_hash, rol, telefono, activo) VALUES
('Administrador', 'admin@tienda.com', '$2a$10$YQ7qZ4k6rYvKJ7VlXZNY0eXKJZV8rH5jNjYQZ9XvLqKHXwZqYJ7.G', 'admin', '555-0001', TRUE),
('Juan Vendedor', 'vendedor@tienda.com', '$2a$10$3iYqZ5kJ7VvKJ8WmXZNY1eXKJZV8rH6jNjYQZ9XvLqKHXwZqYJ8.H', 'vendedor', '555-0002', TRUE);

INSERT IGNORE INTO usuarios (nombre, email, password_hash, rol, activo, telefono) VALUES
('Repartidor Demo', 'repartidor@tienda.com', '$2a$10$demo_hash_repartidor', 'repartidor', TRUE, '555-0003');

SET @admin_id = LAST_INSERT_ID();

INSERT INTO productos (codigo_barras, nombre, descripcion, categoria, precio, costo, stock, stock_minimo, unidad, proveedor, activo, created_by) VALUES
('7501234567890', 'Coca-Cola 600ml', 'Refresco de cola 600ml', 'Bebidas', 15.00, 10.00, 100, 20, 'pza', 'Coca-Cola FEMSA', TRUE, @admin_id),
('7501234567891', 'Sabritas Original 45g', 'Papas fritas sabor original', 'Botanas', 12.00, 8.00, 80, 15, 'pza', 'PepsiCo', TRUE, @admin_id),
('7501234567892', 'Bimbo Blanco Grande', 'Pan de caja blanco grande', 'Panadería', 35.00, 25.00, 50, 10, 'pza', 'Grupo Bimbo', TRUE, @admin_id),
('7501234567893', 'Leche Lala 1L', 'Leche entera 1 litro', 'Lácteos', 22.00, 18.00, 60, 12, 'pza', 'Grupo Lala', TRUE, @admin_id),
('7501234567894', 'Huevo San Juan 12pz', 'Huevo blanco 12 piezas', 'Abarrotes', 45.00, 35.00, 40, 8, 'pza', 'Bachoco', TRUE, @admin_id),
('7501234567895', 'Tortillas 1kg', 'Tortillas de maíz', 'Tortillería', 20.00, 15.00, 30, 5, 'kg', 'La Tortillería', TRUE, @admin_id),
('7501234567896', 'Agua Ciel 1.5L', 'Agua purificada', 'Bebidas', 10.00, 7.00, 120, 25, 'pza', 'Coca-Cola', TRUE, @admin_id),
('7501234567897', 'Jabón Roma', 'Jabón de tocador', 'Higiene', 8.00, 5.00, 90, 15, 'pza', 'Henkel', TRUE, @admin_id),
('7501234567898', 'Galletas Marías', 'Galletas marías 340g', 'Galletas', 18.00, 12.00, 70, 10, 'pza', 'Gamesa', TRUE, @admin_id),
('7501234567899', 'Aceite 123 900ml', 'Aceite vegetal', 'Abarrotes', 35.00, 28.00, 45, 8, 'pza', 'Patrona', TRUE, @admin_id);
