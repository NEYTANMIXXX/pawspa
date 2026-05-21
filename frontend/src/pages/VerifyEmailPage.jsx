// ============================================================
// PawSpa — Verificación de Email
// ============================================================
import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function VerifyEmailPage() {
  const { verificarEmail, reenviarVerificacion } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [token, setToken] = useState(searchParams.get('token') || '');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const autoToken = searchParams.get('token');
    if (autoToken) {
      setToken(autoToken);
      void (async () => {
        try {
          const data = await verificarEmail(autoToken);
          setMessage(data.mensaje || 'Correo verificado');
          toast.success('Correo verificado correctamente.');
          navigate('/login');
        } catch (err) {
          setError(err.response?.data?.error || 'No se pudo verificar el correo.');
        }
      })();
    }
  }, [navigate, searchParams, verificarEmail]);

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    setVerifying(true);
    try {
      const data = await verificarEmail(token);
      setMessage(data.mensaje || 'Correo verificado');
      toast.success('Correo verificado correctamente.');
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo verificar el correo.');
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    if (!email) {
      setError('Ingresa el correo para reenviar la verificación.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const data = await reenviarVerificacion(email);
      toast.success(data.mensaje || 'Se envió un nuevo token.');
      if (data.token) setToken(data.token);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo reenviar la verificación.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <span className="auth-bg-paw">🐾</span>
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon">✉️</div>
          <div className="auth-logo-name">Verificar Email</div>
          <div className="auth-logo-sub">Activa tu cuenta en 15 minutos</div>
        </div>

        {error && <div style={{ background:'rgba(224,108,117,0.12)',border:'1px solid var(--danger)',borderRadius:'var(--radius-sm)',padding:'12px 16px',marginBottom:'20px',color:'var(--danger)',fontSize:'0.88rem' }}>⚠️ {error}</div>}
        {message && <div style={{ background:'rgba(92,219,149,0.12)',border:'1px solid var(--success)',borderRadius:'var(--radius-sm)',padding:'12px 16px',marginBottom:'20px',color:'var(--success)',fontSize:'0.88rem' }}>✅ {message}</div>}

        <form onSubmit={handleVerify}>
          <div className="form-group">
            <label className="form-label">Token de verificación</label>
            <input className="form-control" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Pega aquí el token del enlace" required />
          </div>
          <button className="btn btn-primary w-full" type="submit" disabled={verifying}>
            {verifying ? 'Verificando...' : '✅ Verificar correo'}
          </button>
        </form>

        <div className="form-group" style={{ marginTop: 18 }}>
          <label className="form-label">Correo</label>
          <input className="form-control" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" />
        </div>
        <button className="btn btn-secondary w-full" type="button" onClick={handleResend} disabled={loading}>
          {loading ? 'Reenviando...' : 'Reenviar token'}
        </button>

        <div style={{ textAlign:'center', marginTop: 18 }}>
          <Link to="/login" style={{ color:'var(--brand-light)', textDecoration:'none' }}>← Volver al login</Link>
        </div>
      </div>
    </div>
  );
}
