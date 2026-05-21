// ============================================================
// PawSpa — Layout principal (Sidebar + Navbar)
// ============================================================
import React from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const NAV_ITEMS = [
  { to: '/dashboard', icon: '📊', label: 'Dashboard',   roles: ['admin','recepcion','groomer','cliente'] },
  { to: '/mascotas',  icon: '🐾', label: 'Mascotas',    roles: ['admin','recepcion','groomer','cliente'] },
  { to: '/reservas',  icon: '📅', label: 'Reservas',    roles: ['admin','recepcion','groomer','cliente'] },
  { to: '/pagos',     icon: '💳', label: 'Pagos',       roles: ['admin','recepcion'] },
  { to: '/grooming',  icon: '✂️', label: 'Grooming',    roles: ['admin','recepcion','groomer'] },
  { to: '/usuarios',  icon: '👥', label: 'Usuarios',    roles: ['admin'] },
  { to: '/two-factor-setup', icon: '🔐', label: '2FA Admin', roles: ['admin'] },
];

const rolLabel = { admin: 'Administrador', recepcion: 'Recepcionista', groomer: 'Groomer', cliente: 'Cliente' };

export default function Layout() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const iniciales = usuario ? `${usuario.nombre[0]}${usuario.apellido[0]}`.toUpperCase() : '?';
  const items = NAV_ITEMS.filter(i => i.roles.includes(usuario?.rol));

  const titleMap = {
    '/dashboard': 'Dashboard',
    '/mascotas':  'Gestión de Mascotas',
    '/reservas':  'Reservas & Citas',
    '/pagos':     'Registro de Pagos',
    '/grooming':  'Panel Grooming',
    '/usuarios':  'Gestión de Usuarios',
    '/two-factor-setup': '2FA de Administrador',
  };

  return (
    <div className="layout">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <span className="sidebar-logo-icon">🐾</span>
          <div>
            <div className="sidebar-logo-text">PawSpa</div>
            <div className="sidebar-logo-sub">Spa & Tienda</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-section-label">Menú principal</div>
          {items.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            >
              <span className="sidebar-link-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-user">
          <div className="sidebar-avatar">{iniciales}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="sidebar-user-name">{usuario?.nombre} {usuario?.apellido}</div>
            <div className="sidebar-user-role">{rolLabel[usuario?.rol]}</div>
          </div>
        </div>
      </aside>

      {/* ── Navbar ── */}
      <header className="navbar">
        <h1 className="navbar-title">{titleMap[location.pathname] || 'PawSpa'}</h1>
        <div className="navbar-right">
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => navigate('/change-password')}
            style={{ marginRight: 10 }}
          >
            🔑 Cambiar contraseña
          </button>

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              logout();
              navigate('/login');
            }}
          >
            🚪 Cerrar sesión
          </button>
        </div>
      </header>

      {/* ── Contenido ── */}
      <main className="main-content">
        <div className="page-body">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
