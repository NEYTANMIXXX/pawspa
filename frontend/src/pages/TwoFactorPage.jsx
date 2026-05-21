// ============================================================
// PawSpa — Verificación 2FA
// ============================================================
import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function TwoFactorPage() {
  const { completarLogin2fa } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [token, setToken] = useState(searchParams.get('token') || '');
  const [email] = useState(searchParams.get('email') || '');
  const [codigo, setCodigo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await completarLogin2fa(token, codigo);
      toast.success(`¡Bienvenido, ${data.usuario.nombre}! 🐾`);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo validar el 2FA.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <span className="auth-bg-paw">🐾</span>
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon">🔐</div>
          <div className="auth-logo-name">Segundo factor</div>
          <div className="auth-logo-sub">Ingresa tu código temporal</div>
        </div>

        {error && <div style={{ background:'rgba(224,108,117,0.12)',border:'1px solid var(--danger)',borderRadius:'var(--radius-sm)',padding:'12px 16px',marginBottom:'20px',color:'var(--danger)',fontSize:'0.88rem' }}>⚠️ {error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Token temporal</label>
            <input className="form-control" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Token recibido tras login" required />
          </div>
          <div className="form-group">
            <label className="form-label">Código 2FA</label>
            <input className="form-control" value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="123456" inputMode="numeric" maxLength={8} required />
          </div>
          <button className="btn btn-primary w-full" type="submit" disabled={loading}>
            {loading ? 'Verificando...' : '✅ Confirmar acceso'}
          </button>
        </form>

        {email && (
          <div style={{ marginTop: 16, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Cuenta: {email}
          </div>
        )}

        <div style={{ textAlign:'center', marginTop: 18 }}>
          <Link to="/login" style={{ color:'var(--brand-light)', textDecoration:'none' }}>← Volver al login</Link>
        </div>
      </div>
    </div>
  );
}
