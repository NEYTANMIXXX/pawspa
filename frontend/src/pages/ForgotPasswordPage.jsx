import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import toast from 'react-hot-toast';

export default function ForgotPasswordPage() {

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    setLoading(true);

    try {

      const { data } = await api.post('/auth/forgot-password', {
        email
      });

      toast.success(data.mensaje);

    } catch (err) {

      toast.error(
        err.response?.data?.error ||
        'Error al enviar el correo.'
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
            🔒
          </div>

          <div className="auth-logo-name">
            Recuperar Contraseña
          </div>

          <div className="auth-logo-sub">
            Ingresa tu correo electrónico
          </div>

        </div>

        <form onSubmit={handleSubmit}>

          <div className="form-group">

            <label className="form-label">
              Email
            </label>

            <input
              className="form-control"
              type="email"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
                ? 'Enviando...'
                : '📩 Enviar enlace de recuperación'
            }
          </button>

        </form>

        <div
          style={{
            textAlign: 'center',
            marginTop: 20
          }}
        >

          <Link
            to="/login"
            style={{
              color: 'var(--brand-light)',
              textDecoration: 'none'
            }}
          >
            ← Volver al login
          </Link>

        </div>

      </div>

    </div>
  );
}