-- ============================================================
-- PawSpa — Datos de Prueba (Seed)
-- Archivo: 03_seed.sql
-- NOTA: Las contraseñas son manejadas por Supabase Auth.
--       Estos inserts asumen que auth_id viene de auth.users.
--       Ejecutar DESPUÉS de crear usuarios en Supabase Auth Dashboard.
-- ============================================================

-- ============================================================
-- USUARIOS DEMO (auth_id se actualiza post-registro en Supabase)
-- ============================================================

INSERT INTO usuarios (id, email, nombre, apellido, telefono, rol, activo, email_verificado, email_verificado_en) VALUES
    ('a1000000-0000-0000-0000-000000000001', 'admin@pawspa.com',      'Carlos',   'Administrador', '999-000-001', 'admin',     TRUE, TRUE, NOW()),
    ('a1000000-0000-0000-0000-000000000002', 'recepcion@pawspa.com',  'María',    'Recepción',     '999-000-002', 'recepcion', TRUE, TRUE, NOW()),
    ('a1000000-0000-0000-0000-000000000003', 'groomer1@pawspa.com',   'Lucía',    'García',        '999-000-003', 'groomer',   TRUE, TRUE, NOW()),
    ('a1000000-0000-0000-0000-000000000004', 'groomer2@pawspa.com',   'Pedro',    'Ramírez',       '999-000-004', 'groomer',   TRUE, TRUE, NOW()),
    ('a1000000-0000-0000-0000-000000000005', 'cliente1@pawspa.com',   'Ana',      'Torres',        '999-000-005', 'cliente',   TRUE, TRUE, NOW()),
    ('a1000000-0000-0000-0000-000000000006', 'cliente2@pawspa.com',   'Roberto',  'Mendoza',       '999-000-006', 'cliente',   TRUE, TRUE, NOW()),
    ('a1000000-0000-0000-0000-000000000007', 'cliente3@pawspa.com',   'Sofía',    'López',         '999-000-007', 'cliente',   TRUE, TRUE, NOW());

-- ============================================================
-- CLIENTES DEMO
-- ============================================================

INSERT INTO clientes (id, usuario_id, direccion, ciudad, puntos_fidelidad) VALUES
    ('c1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000005', 'Av. Los Olivos 123', 'Lima', 150),
    ('c1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000006', 'Jr. Las Flores 456', 'Lima', 80),
    ('c1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000007', 'Calle Las Rosas 789', 'Miraflores', 320);

-- ============================================================
-- GROOMERS DEMO
-- ============================================================

INSERT INTO groomers (id, usuario_id, especialidades, certificaciones, bio, calificacion_prom) VALUES
    ('g1000000-0000-0000-0000-000000000001',
     'a1000000-0000-0000-0000-000000000003',
     ARRAY['Corte de pelo', 'Baño y secado', 'Spa canino'],
     ARRAY['Certificado PetGroomer Perú 2022'],
     'Groomer profesional con 5 años de experiencia especializada en razas pequeñas.',
     4.90),
    ('g1000000-0000-0000-0000-000000000002',
     'a1000000-0000-0000-0000-000000000004',
     ARRAY['Grooming canino', 'Corte de raza', 'Tratamiento antipulgas'],
     ARRAY['Certificado Internacional Dog Grooming 2021'],
     'Experto en razas grandes y cortes de exhibición con más de 7 años en el oficio.',
     4.75);

-- ============================================================
-- MASCOTAS DEMO
-- ============================================================

INSERT INTO mascotas (id, cliente_id, nombre, especie, raza, fecha_nacimiento, sexo, tamano, peso_kg, color, alergias) VALUES
    ('m1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001',
     'Luna',    'perro', 'Poodle',     '2020-03-15', 'hembra', 'pequeno', 5.2,  'Blanco', 'Ninguna'),
    ('m1000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000001',
     'Simba',   'gato',  'Persa',      '2021-07-22', 'macho',  'mediano', 4.5,  'Naranja', NULL),
    ('m1000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000002',
     'Rocky',   'perro', 'Golden Retriever', '2019-11-10', 'macho', 'grande', 28.0, 'Dorado', NULL),
    ('m1000000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000003',
     'Bella',   'perro', 'Shih Tzu',   '2022-01-05', 'hembra', 'pequeno', 4.1,  'Tricolor', 'Polen'),
    ('m1000000-0000-0000-0000-000000000005', 'c1000000-0000-0000-0000-000000000003',
     'Max',     'perro', 'Labrador',   '2018-06-30', 'macho',  'grande', 32.0, 'Negro', NULL);

-- ============================================================
-- SERVICIOS DEMO
-- ============================================================

INSERT INTO servicios (id, nombre, descripcion, duracion_min, precio_base, aplica_tamano,
                        precio_mini, precio_pequeno, precio_mediano, precio_grande, precio_gigante, categoria) VALUES
    ('s1000000-0000-0000-0000-000000000001', 'Baño rápido', 'Baño rápido con shampoo estándar + secado básico', 30,
     25.00, TRUE, 20.00, 25.00, 35.00, 45.00, 60.00, 'Higiene'),
    ('s1000000-0000-0000-0000-000000000002', 'Baño completo', 'Baño completo con shampoo premium + secado profesional', 60,
     40.00, TRUE, 35.00, 40.00, 55.00, 70.00, 90.00, 'Higiene'),
    ('s1000000-0000-0000-0000-000000000003', 'Corte y peinado', 'Corte estético según raza y preferencia del dueño', 90,
     50.00, TRUE, 45.00, 50.00, 65.00, 80.00, 110.00, 'Estética'),
    ('s1000000-0000-0000-0000-000000000004', 'Servicio completo', 'Servicio completo de grooming: baño + corte + secado + peinado', 120,
     80.00, TRUE, 70.00, 80.00, 100.00, 130.00, 170.00, 'Paquete');


-- ============================================================
-- DISPONIBILIDAD DE GROOMERS (Lun-Sab 9am-6pm)
-- ============================================================

INSERT INTO groomer_disponibilidad (groomer_id, dia_semana, hora_inicio, hora_fin) VALUES
    -- Lucía: Lun(1) a Vie(5)
    ('g1000000-0000-0000-0000-000000000001', 1, '09:00', '18:00'),
    ('g1000000-0000-0000-0000-000000000001', 2, '09:00', '18:00'),
    ('g1000000-0000-0000-0000-000000000001', 3, '09:00', '18:00'),
    ('g1000000-0000-0000-0000-000000000001', 4, '09:00', '18:00'),
    ('g1000000-0000-0000-0000-000000000001', 5, '09:00', '18:00'),
    -- Pedro: Lun(1) a Sab(6)
    ('g1000000-0000-0000-0000-000000000002', 1, '10:00', '19:00'),
    ('g1000000-0000-0000-0000-000000000002', 2, '10:00', '19:00'),
    ('g1000000-0000-0000-0000-000000000002', 3, '10:00', '19:00'),
    ('g1000000-0000-0000-0000-000000000002', 4, '10:00', '19:00'),
    ('g1000000-0000-0000-0000-000000000002', 5, '10:00', '19:00'),
    ('g1000000-0000-0000-0000-000000000002', 6, '09:00', '14:00');

-- ============================================================
-- RESERVAS DEMO
-- ============================================================

INSERT INTO slot_reserva (id, groomer_id, mascota_id, cliente_id, servicio_id, fecha_inicio, fecha_fin, estado, precio_acordado) VALUES
    ('r1000000-0000-0000-0000-000000000001',
     'g1000000-0000-0000-0000-000000000001', 'm1000000-0000-0000-0000-000000000001',
     'c1000000-0000-0000-0000-000000000001', 's1000000-0000-0000-0000-000000000003',
     NOW() + INTERVAL '1 day' + INTERVAL '9 hours',
     NOW() + INTERVAL '1 day' + INTERVAL '11 hours',
     'confirmada', 80.00),
    ('r1000000-0000-0000-0000-000000000002',
     'g1000000-0000-0000-0000-000000000002', 'm1000000-0000-0000-0000-000000000003',
     'c1000000-0000-0000-0000-000000000002', 's1000000-0000-0000-0000-000000000002',
     NOW() + INTERVAL '2 days' + INTERVAL '10 hours',
     NOW() + INTERVAL '2 days' + INTERVAL '11 hours' + INTERVAL '30 minutes',
     'pendiente', 80.00),
    ('r1000000-0000-0000-0000-000000000003',
     'g1000000-0000-0000-0000-000000000001', 'm1000000-0000-0000-0000-000000000004',
     'c1000000-0000-0000-0000-000000000003', 's1000000-0000-0000-0000-000000000001',
     NOW() - INTERVAL '3 days' + INTERVAL '9 hours',
     NOW() - INTERVAL '3 days' + INTERVAL '10 hours',
     'completada', 40.00);

-- ============================================================
-- FICHA GROOMING DEMO (para la cita completada)
-- ============================================================

INSERT INTO ficha_grooming (id, slot_id, groomer_id, mascota_id, hora_inicio, hora_fin,
                             observaciones_ini, observaciones_fin, estado_pelaje, checklist_completo, cerrada) VALUES
    ('f1000000-0000-0000-0000-000000000001',
     'r1000000-0000-0000-0000-000000000003',
     'g1000000-0000-0000-0000-000000000001',
     'm1000000-0000-0000-0000-000000000004',
     NOW() - INTERVAL '3 days' + INTERVAL '9 hours',
     NOW() - INTERVAL '3 days' + INTERVAL '10 hours',
     'Mascota tranquila, pelo con algunos nudos en las patas.',
     'Servicio completado sin inconvenientes. Bella quedó perfecta.',
     'Bueno, sin parásitos visibles.',
     TRUE, TRUE);

INSERT INTO checklist_item (ficha_id, descripcion, completado, orden) VALUES
    ('f1000000-0000-0000-0000-000000000001', 'Inspección inicial de pelaje y piel', TRUE, 1),
    ('f1000000-0000-0000-0000-000000000001', 'Baño con shampoo neutro', TRUE, 2),
    ('f1000000-0000-0000-0000-000000000001', 'Secado con secadora profesional', TRUE, 3),
    ('f1000000-0000-0000-0000-000000000001', 'Cepillado y desanudado', TRUE, 4),
    ('f1000000-0000-0000-0000-000000000001', 'Revisión final y perfume', TRUE, 5);

-- ============================================================
-- CATEGORÍAS DE TIENDA
-- ============================================================

INSERT INTO categoria (id, nombre, descripcion) VALUES
    ('cat00000-0000-0000-0000-000000000001', 'Alimentos', 'Alimentos secos y húmedos para mascotas'),
    ('cat00000-0000-0000-0000-000000000002', 'Higiene', 'Shampoos, cepillos y accesorios de baño'),
    ('cat00000-0000-0000-0000-000000000003', 'Juguetes', 'Juguetes y entretenimiento'),
    ('cat00000-0000-0000-0000-000000000004', 'Accesorios', 'Correas, collares y ropa'),
    ('cat00000-0000-0000-0000-000000000005', 'Salud', 'Vitaminas, antiparasitarios y cuidado médico');

-- ============================================================
-- PRODUCTOS DEMO
-- ============================================================

INSERT INTO producto (id, categoria_id, nombre, descripcion, marca, precio_compra, precio_venta, stock_actual, stock_minimo, unidad_medida) VALUES
    ('p1000000-0000-0000-0000-000000000001', 'cat00000-0000-0000-0000-000000000001',
     'Royal Canin Adult 3kg', 'Alimento balanceado para perros adultos', 'Royal Canin', 55.00, 89.90, 25, 5, 'bolsa'),
    ('p1000000-0000-0000-0000-000000000002', 'cat00000-0000-0000-0000-000000000001',
     'Whiskas Atún 85g', 'Alimento húmedo para gatos adultos', 'Whiskas', 2.50, 4.90, 100, 20, 'lata'),
    ('p1000000-0000-0000-0000-000000000003', 'cat00000-0000-0000-0000-000000000002',
     'Shampoo Neutro 500ml', 'Shampoo hipoalergénico para perros y gatos', 'PetClean', 12.00, 24.90, 40, 10, 'frasco'),
    ('p1000000-0000-0000-0000-000000000004', 'cat00000-0000-0000-0000-000000000003',
     'Pelota Kong Clásica', 'Juguete resistente de caucho natural', 'Kong', 18.00, 35.00, 15, 5, 'unidad'),
    ('p1000000-0000-0000-0000-000000000005', 'cat00000-0000-0000-0000-000000000004',
     'Collar Ajustable con nombre', 'Collar de nylon con placa personalizable', 'PawsUp', 8.00, 18.90, 30, 8, 'unidad'),
    ('p1000000-0000-0000-0000-000000000006', 'cat00000-0000-0000-0000-000000000005',
     'Nexgard Antipulgas (3 tabletas)', 'Antiparasitario oral para perros 4-10kg', 'Merial', 45.00, 79.90, 20, 5, 'caja');

-- ============================================================
-- PAGO DEMO
-- ============================================================

INSERT INTO pago_factura (cliente_id, slot_id, subtotal, total, tipo_pago, estado, fecha_pago) VALUES
    ('c1000000-0000-0000-0000-000000000003',
     'r1000000-0000-0000-0000-000000000003',
    40.00, 40.00, 'efectivo', 'verificado', NOW() - INTERVAL '3 days' + INTERVAL '10 hours');

-- ============================================================
-- NOTIFICACIONES DEMO
-- ============================================================

INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje) VALUES
    ('a1000000-0000-0000-0000-000000000005', 'cita',    'Cita confirmada', 'Tu cita para Luna ha sido confirmada para mañana a las 9:00 AM.'),
    ('a1000000-0000-0000-0000-000000000006', 'cita',    'Cita pendiente',  'Tienes una cita pendiente de confirmación para Rocky.'),
    ('a1000000-0000-0000-0000-000000000001', 'sistema', 'Stock bajo',      'El producto Royal Canin Adult 3kg está próximo al stock mínimo.');
