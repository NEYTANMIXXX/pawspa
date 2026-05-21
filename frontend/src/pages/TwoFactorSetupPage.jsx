// ============================================================
// PawSpa — Setup 2FA para Admin
// ============================================================
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function TwoFactorSetupPage() {
  const { setup2fa, verify2fa } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [backupCodes, setBackupCodes] = useState([]);
  const [token, setToken] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const data = await setup2fa();
        setQrCode(data.qrCode);
        setSecret(data.secret);
        setBackupCodes(data.codigosRespaldo || []);
      } catch (err) {
        setError(err.response?.data?.error || 'No se pudo generar el 2FA.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [setup2fa]);

  const handleVerify = async (e) => {
    e.preventDefault();
    setVerifying(true);
    setError('');
    try {
      const data = await verify2fa(token);
      toast.success(data.mensaje || '2FA activado.');
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo activar el 2FA.');
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return <div className="loading-screen"><div className="paw-spinner">🐾</div></div>;
  }

  return (
    <div className="card" style={{ maxWidth: 760, margin: '0 auto' }}>
      <h1 className="page-title" style={{ marginBottom: 12 }}>2FA para Administrador</h1>
      <p className="page-subtitle">Escanea el QR con tu app autenticadora y luego confirma el código de 6 dígitos.</p>

      {error && <div style={{ background:'rgba(224,108,117,0.12)',border:'1px solid var(--danger)',borderRadius:'var(--radius-sm)',padding:'12px 16px',margin:'16px 0',color:'var(--danger)',fontSize:'0.88rem' }}>⚠️ {error}</div>}

      {qrCode && (
        <div style={{ display:'grid', gridTemplateColumns:'220px 1fr', gap: 20, alignItems: 'start' }}>
          <div style={{ background:'white', padding: 12, borderRadius: 12, width: 220 }}>
            <img src={qrCode} alt="QR 2FA" style={{ width: '100%', display: 'block' }} />
          </div>
          <div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Secret manual</div>
              <code style={{ wordBreak: 'break-all' }}>{secret}</code>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Códigos de respaldo</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
                {backupCodes.map((code) => (
                  <div key={code} style={{ background:'var(--bg-input)', padding:'8px 10px', border:'1px solid var(--border)', borderRadius: 8, fontSize: '0.85rem' }}>{code}</div>
                ))}
              </div>
            </div>
            <form onSubmit={handleVerify}>
              <div className="form-group">
                <label className="form-label">Código TOTP</label>
                <input className="form-control" value={token} onChange={(e) => setToken(e.target.value)} placeholder="123456" inputMode="numeric" maxLength={6} required />
              </div>
              <button className="btn btn-primary" type="submit" disabled={verifying}>
                {verifying ? 'Activando...' : 'Activar 2FA'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
