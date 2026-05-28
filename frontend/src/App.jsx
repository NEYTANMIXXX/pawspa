// ============================================================
// PawSpa — App principal con rutas
// ============================================================
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';

import LoginPage       from './pages/LoginPage';
import RegisterPage    from './pages/RegisterPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import TwoFactorPage   from './pages/TwoFactorPage';
import TwoFactorSetupPage from './pages/TwoFactorSetupPage';
import DashboardPage   from './pages/DashboardPage';
import AdminReportsPage from './pages/AdminReportsPage';
import CalendarioPage  from './pages/CalendarioPage';
import MascotasPage    from './pages/MascotasPage';
import TiendaPage      from './pages/TiendaPage';
import CierreCajaPage  from './pages/CierreCajaPage';
import ReservasPage    from './pages/ReservasPage';
import PagosPage       from './pages/PagosPage';
import UsuariosPage    from './pages/UsuariosPage';
import DescuentosPage  from './pages/DescuentosPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import GroomingPage    from './pages/GroomingPage';
import Layout          from './components/layout/Layout';
import ChangePasswordPage from './pages/ChangePasswordPage';

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
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/two-factor" element={<TwoFactorPage />} />
      <Route path="/forgot-password" element={usuario ? <Navigate to="/dashboard" /> : <ForgotPasswordPage />}/>
      <Route path="/reset-password"element={<ResetPasswordPage />}/>
      <Route path="/" element={<RutaProtegida><Layout /></RutaProtegida>}>
        <Route index element={<Navigate to="/dashboard" />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="reports" element={<RutaProtegida roles={['admin']}><AdminReportsPage /></RutaProtegida>} />
        <Route path="calendario" element={<RutaProtegida roles={['admin','recepcion']}><CalendarioPage /></RutaProtegida>} />
        <Route path="mascotas"  element={<MascotasPage />} />
        <Route path="tienda"    element={<TiendaPage />} />
        <Route path="reservas"  element={<ReservasPage />} />
        <Route path="pagos"     element={<RutaProtegida roles={['admin','recepcion']}><PagosPage /></RutaProtegida>} />
        <Route path="descuentos" element={<RutaProtegida roles={['admin','recepcion']}><DescuentosPage /></RutaProtegida>} />
        <Route path="grooming"  element={<RutaProtegida roles={['admin','groomer','recepcion']}><GroomingPage /></RutaProtegida>} />
        <Route path="usuarios"  element={<RutaProtegida roles={['admin']}><UsuariosPage /></RutaProtegida>} />
        <Route path="caja"      element={<RutaProtegida roles={['admin','recepcion']}><CierreCajaPage /></RutaProtegida>} />
        <Route path="two-factor-setup" element={<RutaProtegida roles={['admin']}><TwoFactorSetupPage /></RutaProtegida>} />
        <Route path="change-password" element={<ChangePasswordPage />}/>
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
