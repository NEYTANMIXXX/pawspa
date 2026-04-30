// ============================================================
// PawSpa — App principal con rutas
// ============================================================
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';

import LoginPage       from './pages/LoginPage';
import RegisterPage    from './pages/RegisterPage';
import DashboardPage   from './pages/DashboardPage';
import MascotasPage    from './pages/MascotasPage';
import ReservasPage    from './pages/ReservasPage';
import UsuariosPage    from './pages/UsuariosPage';
import GroomingPage    from './pages/GroomingPage';
import Layout          from './components/layout/Layout';

// Ruta protegida genérica
const RutaProtegida = ({ children, roles }) => {
  const { usuario, cargando } = useAuth();
  if (cargando) return <div className="loading-screen"><div className="paw-spinner">🐾</div></div>;
  if (!usuario) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(usuario.rol)) return <Navigate to="/dashboard" replace />;
  return children;
};

const AppRoutes = () => {
  const { usuario } = useAuth();
  return (
    <Routes>
      <Route path="/login"    element={usuario ? <Navigate to="/dashboard" /> : <LoginPage />} />
      <Route path="/registro" element={usuario ? <Navigate to="/dashboard" /> : <RegisterPage />} />
      <Route path="/" element={<RutaProtegida><Layout /></RutaProtegida>}>
        <Route index element={<Navigate to="/dashboard" />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="mascotas"  element={<MascotasPage />} />
        <Route path="reservas"  element={<ReservasPage />} />
        <Route path="grooming"  element={<RutaProtegida roles={['admin','groomer','recepcion']}><GroomingPage /></RutaProtegida>} />
        <Route path="usuarios"  element={<RutaProtegida roles={['admin']}><UsuariosPage /></RutaProtegida>} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" />} />
    </Routes>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={{ duration: 4000, style: { background: '#1e1e2e', color: '#cdd6f4', border: '1px solid #313244' } }} />
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
