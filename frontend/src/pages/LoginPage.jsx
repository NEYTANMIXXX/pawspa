// ============================================================
// PawSpa — Página de Login
// ============================================================
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import Turnstile from 'react-turnstile';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate  = useNavigate();
  const [form, setForm]   = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError]    = useState('');
  const [captchaToken, setCaptchaToken] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!captchaToken) {
      setError(
        'Debes completar el CAPTCHA.'
      );
      return;
    }
    setLoading(true);
    try {
      const resultado = await login(form.email, form.password, captchaToken);
      if (resultado?.pendiente2fa) {
        toast('Ingresa tu código 2FA para continuar.');
        const params = new URLSearchParams();
        params.set('token', resultado.tokenTemporal);
        params.set('email', form.email);
        navigate(`/two-factor?${params.toString()}`);
        return;
      }
      toast.success(`¡Bienvenido, ${resultado.usuario.nombre}! 🐾`);
      navigate('/dashboard');
    } catch (err) {
      if (err.response?.data?.requiereVerificacion) {
        const params = new URLSearchParams();
        params.set('email', form.email);
        navigate(`/verify-email?${params.toString()}`);
      }
      setError(err.response?.data?.error || 'Error al iniciar sesión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <span className="auth-bg-paw">🐾</span>
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon">🐾</div>
          <div className="auth-logo-name">PawSpa</div>
          <div className="auth-logo-sub">Sistema de Gestión</div>
        </div>

        {error && (
          <div style={{ background: 'rgba(224,108,117,0.12)', border: '1px solid var(--danger)', borderRadius: 'var(--radius-sm)', padding: '12px 16px', marginBottom: '20px', color: 'var(--danger)', fontSize: '0.88rem' }}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-control" type="email" placeholder="tu@email.com" value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required />
          </div>
          <div className="form-group">
            <label className="form-label">Contraseña</label>
            <input className="form-control" type="password" placeholder="••••••••" value={form.password}
              onChange={e => setForm(p => ({ ...p, password: e.target.value }))} required />
          </div>
          <div style={{ marginTop: 20, marginBottom: 10 }}>
            <Turnstile
              sitekey={process.env.REACT_APP_TURNSTILE_SITE_KEY}
              onVerify={(token) => {
                setCaptchaToken(token);
              }}
            />
          </div>
          <button className="btn btn-primary w-full" type="submit" disabled={loading} style={{ marginTop: 8 }}>
            {loading ? 'Ingresando...' : '🔑 Iniciar Sesión'}
          </button>
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Link
              to="/forgot-password"
              style={{
                color: 'var(--brand-light)',
                fontSize: '0.9rem',
                textDecoration: 'none'
              }}
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
        </form>

        <div className="auth-divider">¿No tienes cuenta?</div>
        <Link to="/registro" className="btn btn-secondary w-full" style={{ justifyContent: 'center' }}>
          Crear cuenta de cliente
        </Link>

        {/* Demo credentials */}
        <div style={{ marginTop: 24, padding: '12px', background: 'rgba(196,149,106,0.06)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>Usuarios demo</div>
          {[
            { rol: 'Admin',       email: 'admin@pawspa.com',      pw: 'Admin1234!' },
            { rol: 'Recepción',   email: 'recepcion@pawspa.com',  pw: 'Admin1234!' },
            { rol: 'Groomer',     email: 'groomer1@pawspa.com',   pw: 'Admin1234!' },
            { rol: 'Cliente',     email: 'cliente1@pawspa.com',   pw: 'Admin1234!' },
          ].map(u => (
            <button key={u.rol} onClick={() => setForm({ email: u.email, password: u.pw })}
              style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.78rem', padding: '3px 0', cursor: 'pointer' }}>
              <span style={{ color: 'var(--brand-light)', fontWeight: 600 }}>{u.rol}:</span> {u.email}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
