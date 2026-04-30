// ============================================================
// PawSpa — Página de Registro
// ============================================================
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function RegisterPage() {
  const { registrar } = useAuth();
  const navigate = useNavigate();
  const [form, setForm]   = useState({ nombre: '', apellido: '', email: '', password: '', telefono: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError]    = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.');
    setLoading(true);
    try {
      await registrar(form);
      toast.success('¡Cuenta creada exitosamente! 🐾');
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al registrar.');
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
          <div className="auth-logo-sub">Crear cuenta</div>
        </div>
        {error && <div style={{ background:'rgba(224,108,117,0.12)',border:'1px solid var(--danger)',borderRadius:'var(--radius-sm)',padding:'12px 16px',marginBottom:'20px',color:'var(--danger)',fontSize:'0.88rem' }}>⚠️ {error}</div>}
        <form onSubmit={handleSubmit}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div className="form-group">
              <label className="form-label">Nombre</label>
              <input className="form-control" placeholder="Ana" value={form.nombre} onChange={e=>setForm(p=>({...p,nombre:e.target.value}))} required />
            </div>
            <div className="form-group">
              <label className="form-label">Apellido</label>
              <input className="form-control" placeholder="Torres" value={form.apellido} onChange={e=>setForm(p=>({...p,apellido:e.target.value}))} required />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-control" type="email" placeholder="ana@email.com" value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))} required />
          </div>
          <div className="form-group">
            <label className="form-label">Teléfono</label>
            <input className="form-control" placeholder="999-000-000" value={form.telefono} onChange={e=>setForm(p=>({...p,telefono:e.target.value}))} />
          </div>
          <div className="form-group">
            <label className="form-label">Contraseña (mín. 8 caracteres)</label>
            <input className="form-control" type="password" placeholder="••••••••" value={form.password} onChange={e=>setForm(p=>({...p,password:e.target.value}))} required />
          </div>
          <button className="btn btn-primary w-full" type="submit" disabled={loading}>{loading ? 'Creando...' : '✅ Crear cuenta'}</button>
        </form>
        <div className="auth-divider">¿Ya tienes cuenta?</div>
        <Link to="/login" className="btn btn-secondary w-full" style={{justifyContent:'center'}}>Iniciar Sesión</Link>
      </div>
    </div>
  );
}
