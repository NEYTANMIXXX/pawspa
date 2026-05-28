**Reportes Administrador — Integración frontend**

- **Ruta frontend**: `/reports` (protegida; solo `roles: ['admin']`).
- **API**: `GET /api/dashboard/reports` — requiere token Bearer válido en `Authorization`.
- **Respuesta**: JSON con claves principales:
  - `ventas_totales`: { totalIngresos, ingresosServicios, ingresosTienda }
  - `ranking`: { productos: [...], servicios: [...] }
  - `ocupacion_global`: { minutosReservados, capacidadMinutos, porcentaje }
  - `auditoria_insumos`: [ { producto_id, entregado, usado, descontado }, ... ]
  - `nps`: número o `null`

- **Frontend**: la página `frontend/src/pages/AdminReportsPage.jsx` ya consume el endpoint y muestra una vista inicial.
- **Notas**: El endpoint está protegido; use el token JWT obtenido tras login de un usuario con rol `admin`.
