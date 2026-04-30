// ============================================================
// PawSpa — Contexto de Autenticación
// ============================================================
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);

  // Cargar usuario desde localStorage al iniciar
  useEffect(() => {
    const token   = localStorage.getItem('pawspa_token');
    const cached  = localStorage.getItem('pawspa_usuario');
    if (token && cached) {
      try { setUsuario(JSON.parse(cached)); } catch (_) {}
    }
    setCargando(false);
  }, []);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('pawspa_token',   data.token);
    localStorage.setItem('pawspa_usuario', JSON.stringify(data.usuario));
    setUsuario(data.usuario);
    return data.usuario;
  }, []);

  const registrar = useCallback(async (formData) => {
    const { data } = await api.post('/auth/registro', formData);
    localStorage.setItem('pawspa_token',   data.token);
    localStorage.setItem('pawspa_usuario', JSON.stringify(data.usuario));
    setUsuario(data.usuario);
    return data.usuario;
  }, []);

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout'); } catch (_) {}
    localStorage.removeItem('pawspa_token');
    localStorage.removeItem('pawspa_usuario');
    setUsuario(null);
    toast.success('Sesión cerrada correctamente.');
  }, []);

  const esAdmin     = usuario?.rol === 'admin';
  const esRecepcion = usuario?.rol === 'recepcion';
  const esGroomer   = usuario?.rol === 'groomer';
  const esCliente   = usuario?.rol === 'cliente';
  const esStaff     = ['admin', 'recepcion', 'groomer'].includes(usuario?.rol);

  return (
    <AuthContext.Provider value={{ usuario, cargando, login, registrar, logout, esAdmin, esRecepcion, esGroomer, esCliente, esStaff }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
};
