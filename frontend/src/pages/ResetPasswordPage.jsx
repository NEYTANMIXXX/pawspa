import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../utils/api';

export default function ResetPasswordPage() {

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');

  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {

    e.preventDefault();

    if (password.length < 8) {

      toast.error(
        'La contraseña debe tener mínimo 8 caracteres.'
      );

      return;
    }

    if (password !== confirmar) {

      toast.error(
        'Las contraseñas no coinciden.'
      );

      return;
    }

    if (!token) {
      toast.error(
        'El enlace de recuperación no contiene un token válido.'
      );

      return;
    }

    setLoading(true);

    try {

      const { data } = await api.post('/auth/reset-password', {
        token,
        password
      });

      toast.success(
        data.mensaje || 'Contraseña actualizada correctamente.'
      );

      setTimeout(() => {
        navigate('/login');
      }, 2000);

    } catch (err) {

      toast.error(
        err.message || 'Error al actualizar contraseña.'
      );

    } finally {

      setLoading(false);

    }
  };

  return (

    <div className="auth-page">

      <span className="auth-bg-paw">🐾</span>

      <div className="auth-card">

        <div className="auth-logo">

          <div className="auth-logo-icon">
            🔑
          </div>

          <div className="auth-logo-name">
            Nueva Contraseña
          </div>

          <div className="auth-logo-sub">
            Ingresa tu nueva contraseña
          </div>

          <div style={{ marginTop: 12, fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            Usa el enlace que recibiste por correo para completar el cambio.
          </div>

        </div>

        <form onSubmit={handleSubmit}>

          <div className="form-group">

            <label className="form-label">
              Nueva contraseña
            </label>

            <input
              className="form-control"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

          </div>

          <div className="form-group">

            <label className="form-label">
              Confirmar contraseña
            </label>

            <input
              className="form-control"
              type="password"
              placeholder="••••••••"
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
              required
            />

          </div>

          <button
            className="btn btn-primary w-full"
            type="submit"
            disabled={loading}
            style={{ marginTop: 10 }}
          >

            {
              loading
                ? 'Actualizando...'
                : '🔒 Cambiar contraseña'
            }

          </button>

        </form>

      </div>

    </div>
  );
}