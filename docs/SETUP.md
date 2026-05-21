# PawSpa 🐾 — Guía Completa de Instalación y Ejecución

## Índice
1. [Arquitectura del sistema](#arquitectura)
2. [Requisitos previos](#requisitos)
3. [Configurar Supabase](#supabase)
4. [Ejecutar la base de datos](#database)
5. [Configurar el backend](#backend)
6. [Configurar el frontend](#frontend)
7. [Usuarios de prueba](#usuarios-demo)
8. [Ejemplos de API](#api-examples)
9. [Estructura de carpetas](#estructura)
10. [Para la defensa universitaria](#defensa)

---

## 1. Arquitectura del sistema {#arquitectura}

```
┌──────────────────────────────────────────────────────────┐
│                    FRONTEND (React.js)                    │
│  Puerto: 3000  │  Axios + Context API + React Router     │
└─────────────────────────┬────────────────────────────────┘
                          │ HTTP / JWT
┌─────────────────────────▼────────────────────────────────┐
│                   BACKEND (Express.js)                    │
│  Puerto: 4000  │  JWT Auth │ RBAC Middleware │ bcrypt    │
└─────────────────────────┬────────────────────────────────┘
                          │ Supabase JS SDK
┌─────────────────────────▼────────────────────────────────┐
│              SUPABASE (PostgreSQL + Auth)                 │
│  - Row Level Security (RLS)                              │
│  - Auth nativo (JWT)                                     │
│  - Triggers y funciones SQL                              │
│  - Storage para fotos                                    │
└──────────────────────────────────────────────────────────┘
```

**Flujo de autenticación:**
```
Cliente → Login → Backend valida con Supabase Auth
  → Si falta verificación de email, redirige a /verify-email
  → Si 2FA está activo, redirige a /two-factor
  → JWT generado con HS256 → Almacenado en localStorage
       → Cada request lleva Bearer token → Middleware verifica
       → RLS en Supabase filtra datos según rol
```

---

## 2. Requisitos previos {#requisitos}

| Herramienta | Versión mínima | Descarga |
|-------------|----------------|---------|
| Node.js     | 18.x LTS       | nodejs.org |
| npm         | 9.x            | (incluido con Node) |
| VS Code     | Última         | code.visualstudio.com |
| Git         | 2.x            | git-scm.com |

---

## 3. Configurar Supabase {#supabase}

### 3.1 Crear proyecto

1. Ir a [supabase.com](https://supabase.com) → **New Project**
2. Nombre: `pawspa`
3. Contraseña de BD: guárdalа en un lugar seguro
4. Región: la más cercana (ej: South America)
5. Esperar ~2 minutos a que inicie

### 3.2 Obtener credenciales

En Supabase Dashboard → **Settings → API**:

```
Project URL:          https://XXXXXXXXXXXX.supabase.co
anon/public key:      eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
service_role key:     eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
                      ⚠️ NUNCA exponer en frontend
```

### 3.3 Ejecutar SQL

En Supabase Dashboard → **SQL Editor** → **New query**:

Ejecutar en este orden:
1. Pegar contenido de `database/01_schema.sql` → Run
2. Pegar contenido de `database/02_rls_policies.sql` → Run
3. Pegar contenido de `database/03_seed.sql` → Run (opcional, datos demo)

### 3.4 Crear usuarios demo en Supabase Auth

En **Authentication → Users → Invite user** (o usar la API):

```bash
# Alternativa: usar el script de seed con Supabase Admin API
# Los usuarios demo se crean al ejecutar 03_seed.sql
# pero sus contraseñas deben configurarse en Auth > Users
```

**Usuarios a crear manualmente en Auth > Users > Add user:**
| Email | Contraseña |
|-------|------------|
| admin@pawspa.com | Admin1234! |
| recepcion@pawspa.com | Admin1234! |
| groomer1@pawspa.com | Admin1234! |
| groomer2@pawspa.com | Admin1234! |
| cliente1@pawspa.com | Admin1234! |
| cliente2@pawspa.com | Admin1234! |
| cliente3@pawspa.com | Admin1234! |

Luego actualizar `auth_id` en la tabla `usuarios`:
```sql
UPDATE usuarios SET auth_id = (
  SELECT id FROM auth.users WHERE email = 'admin@pawspa.com'
) WHERE email = 'admin@pawspa.com';
-- Repetir para cada usuario
```

---

## 4. Configurar el Backend {#backend}

```bash
# 1. Navegar al directorio backend
cd pawspa/backend

# 2. Instalar dependencias
npm install

# 3. Crear archivo de variables de entorno
cp .env.example .env
```

Editar `.env` con tus valores reales:
```env
SUPABASE_URL=https://TU_PROYECTO.supabase.co
SUPABASE_ANON_KEY=tu_anon_key
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
JWT_SECRET=mi_secreto_super_seguro_2024_pawspa
JWT_EXPIRES_IN=8h
PORT=4000
FRONTEND_URL=http://localhost:3000
BCRYPT_ROUNDS=12
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_MINUTES=15
SMTP_HOST=smtp.tu-proveedor.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=tu_correo@dominio.com
SMTP_PASS=tu_password_smtp
SMTP_FROM=PawSpa <tu_correo@dominio.com>
```

```bash
# 4. Ejecutar en modo desarrollo
npm run dev

# Output esperado:
# 🐾 PawSpa API corriendo en http://localhost:4000
```

---

## 5. Configurar el Frontend {#frontend}

```bash
# 1. Navegar al directorio frontend (nueva terminal)
cd pawspa/frontend

# 2. Instalar dependencias
npm install

# 3. Crear variables de entorno
cp .env.example .env
```

Editar `.env`:
```env
REACT_APP_API_URL=http://localhost:4000/api
REACT_APP_SUPABASE_URL=https://TU_PROYECTO.supabase.co
REACT_APP_SUPABASE_ANON_KEY=tu_anon_key
```

```bash
# 4. Iniciar el servidor de desarrollo
npm start

# Se abre automáticamente en http://localhost:3000
```

---

## 6. Usuarios de prueba {#usuarios-demo}

| Usuario | Email | Contraseña | Acceso |
|---------|-------|------------|--------|
| Admin | admin@pawspa.com | Admin1234! | Todo el sistema |
| Recepcionista | recepcion@pawspa.com | Admin1234! | Agenda, clientes, mascotas |
| Groomer 1 (Lucía) | groomer1@pawspa.com | Admin1234! | Agenda, fichas, checklist |
| Cliente 1 (Ana) | cliente1@pawspa.com | Admin1234! | Sus mascotas e historial |

---

## 7. Ejemplos de API {#api-examples}

### Login
```http
POST http://localhost:4000/api/auth/login
Content-Type: application/json

{
  "email": "admin@pawspa.com",
  "password": "Admin1234!"
}
```

**Respuesta exitosa:**
```json
{
  "token": "eyJhbGci...",
  "usuario": {
    "id": "a100...",
    "email": "admin@pawspa.com",
    "nombre": "Carlos",
    "apellido": "Administrador",
    "rol": "admin"
  }
}
```

**Si la cuenta aún no fue verificada:**
```json
{
  "error": "Debes verificar tu correo antes de iniciar sesión.",
  "requiereVerificacion": true
}
```

**Si el usuario tiene 2FA activo:**
```json
{
  "pendiente2fa": true,
  "tokenTemporal": "eyJhbGci...",
  "mensaje": "Verifica tu código de autenticación"
}
```

### Registro
```http
POST http://localhost:4000/api/auth/registro
Content-Type: application/json

{
  "nombre": "Ana",
  "apellido": "Torres",
  "email": "ana@email.com",
  "password": "Ana1234!",
  "telefono": "999-000-000"
}
```

### Verificar email
```http
POST http://localhost:4000/api/auth/email/verify
Content-Type: application/json

{
  "token": "eyJhbGci..."
}
```

### Completar 2FA
```http
POST http://localhost:4000/api/auth/2fa/verify-login
Content-Type: application/json

{
  "token": "eyJhbGci...",
  "codigo": "123456"
}
```

### Listar mascotas (requiere token)
```http
GET http://localhost:4000/api/mascotas
Authorization: Bearer eyJhbGci...
```

### Crear mascota
```http
POST http://localhost:4000/api/mascotas
Authorization: Bearer eyJhbGci...
Content-Type: application/json

{
  "nombre": "Milo",
  "especie": "perro",
  "raza": "Beagle",
  "sexo": "macho",
  "tamano": "mediano",
  "peso_kg": 12.5,
  "cliente_id": "c100..."
}
```

### Crear reserva
```http
POST http://localhost:4000/api/reservas
Authorization: Bearer eyJhbGci...
Content-Type: application/json

{
  "groomer_id": "g100...",
  "mascota_id": "m100...",
  "servicio_id": "s100...",
  "fecha_inicio": "2025-06-15T09:00:00",
  "precio_acordado": 80.00,
  "observaciones": "Primera visita"
}
```

### Dashboard de estadísticas
```http
GET http://localhost:4000/api/dashboard/stats
Authorization: Bearer eyJhbGci...
```

---

## 8. Estructura de carpetas {#estructura}

```
pawspa/
├── 📁 database/
│   ├── 01_schema.sql          ← Tablas, relaciones, triggers
│   ├── 02_rls_policies.sql    ← Seguridad Row Level Security
│   └── 03_seed.sql            ← Datos de prueba
│
├── 📁 backend/
│   ├── package.json
│   ├── .env.example
│   └── src/
│       ├── index.js            ← Servidor Express
│       ├── middleware/
│       │   └── auth.middleware.js   ← JWT + RBAC + Auditoría
│       ├── services/
│       │   └── supabase.js          ← Clientes Supabase
│       ├── controllers/
│       │   ├── auth.controller.js   ← Login, registro, logout
│       │   ├── mascotas.controller.js
│       │   └── reservas.controller.js
│       └── routes/
│           ├── auth.routes.js
│           ├── usuarios.routes.js
│           ├── clientes.routes.js
│           ├── mascotas.routes.js
│           ├── servicios.routes.js
│           ├── reservas.routes.js
│           ├── grooming.routes.js
│           ├── productos.routes.js
│           └── dashboard.routes.js
│
├── 📁 frontend/
│   ├── package.json
│   ├── .env.example
│   └── src/
│       ├── index.js
│       ├── App.jsx              ← Router principal
│       ├── context/
│       │   └── AuthContext.jsx  ← Estado global de auth
│       ├── utils/
│       │   └── api.js           ← Cliente Axios + interceptores
│       ├── styles/
│       │   └── global.css       ← Diseño completo
│       ├── components/
│       │   └── layout/
│       │       └── Layout.jsx   ← Sidebar + Navbar
│       └── pages/
│           ├── LoginPage.jsx
│           ├── RegisterPage.jsx
│           ├── DashboardPage.jsx    ← Adaptado por rol
│           ├── MascotasPage.jsx     ← CRUD completo
│           ├── ReservasPage.jsx     ← CRUD + estados
│           ├── GroomingPage.jsx     ← Fichas + checklist
│           └── UsuariosPage.jsx     ← Solo admin
│
└── 📁 docs/
    └── SETUP.md                 ← Este archivo
```

---

## 9. Para la defensa universitaria {#defensa}

### Puntos clave a explicar

**Modelo relacional:**
- 20 tablas relacionadas con FK, PK, UNIQUE, CHECK
- Tipos ENUM para estados controlados
- Triggers automáticos (updated_at, número de factura, validaciones)
- Índices estratégicos para performance

**Seguridad (capas):**
1. **Supabase Auth** → maneja contraseñas con bcrypt internamente
2. **JWT** → tokens firmados con HS256, expiración 8h
3. **Middleware RBAC** → verifica rol antes de cada endpoint
4. **Row Level Security** → Supabase filtra datos por usuario en BD
5. **Rate Limiting** → 10 intentos/15 min en login
6. **Bloqueo temporal** → 5 intentos fallidos = bloqueo 15 min

**Patrón de arquitectura:**
- **Frontend**: SPA React con Context API (no Redux para simplicidad)
- **Backend**: REST API en Express con arquitectura MVC
- **Base de datos**: PostgreSQL con lógica de negocio en triggers SQL

**Decisiones de diseño:**
- Soft delete en mascotas y usuarios (campo `activo`) para mantener integridad referencial
- Auditoría automática de todas las operaciones CRUD
- Dashboard diferenciado según rol (admin ve stats, groomer ve agenda, cliente ve sus mascotas)

### Comandos rápidos para la demo

```bash
# Terminal 1 — Backend
cd pawspa/backend && npm run dev

# Terminal 2 — Frontend
cd pawspa/frontend && npm start

# Verificar API
curl http://localhost:4000/health
```

### Test rápido de login
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@pawspa.com","password":"Admin1234!"}'
```
