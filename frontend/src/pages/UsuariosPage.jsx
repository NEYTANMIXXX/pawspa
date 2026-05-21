// ============================================================
// PawSpa — Gestión de Usuarios (solo Admin)
// ============================================================
import React, { useEffect, useState, useCallback } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';

const ROLES = ['admin','recepcion','groomer','cliente'];
const rolColor = { admin:'role-admin', recepcion:'role-recepcion', groomer:'role-groomer', cliente:'role-cliente' };

function ModalUsuario({ usuario, onClose, onSaved }) {
  const [form, setForm] = useState({
    nombre: '', apellido: '', email: '', password: undefined, telefono: '', rol: 'cliente',
    ...(usuario ? { ...usuario, password: '' } : {}),
  });
  const [loading, setLoading] = useState(false);
  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (usuario) {
        const { password, email, ...datos } = form;
        await api.put(`/usuarios/${usuario.id}`, datos);
        toast.success('Usuario actualizado ✅');
      } else {
        await api.post('/usuarios', form);
        toast.success('Usuario creado ✅ Se enviaron las instrucciones al correo del usuario.');
      }
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error.');
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{usuario ? '✏️ Editar usuario' : '👤 Nuevo usuario'}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div className="form-group">
                <label className="form-label">Nombre</label>
                <input className="form-control" value={form.nombre} onChange={f('nombre')} required />
              </div>
              <div className="form-group">
                <label className="form-label">Apellido</label>
                <input className="form-control" value={form.apellido} onChange={f('apellido')} required />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-control" type="email" value={form.email} onChange={f('email')} required disabled={!!usuario} />
            </div>
             


             
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div className="form-group">
                <label className="form-label">Teléfono</label>
                <input className="form-control" value={form.telefono||''} onChange={f('telefono')} />
              </div>
              <div className="form-group">
                <label className="form-label">Rol</label>
                <select className="form-control" value={form.rol} onChange={f('rol')} disabled={!!usuario}>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filtroRol, setFiltroRol] = useState('');
  const [search, setSearch]     = useState('');
  const [modal, setModal]       = useState(null);
  const [confirmDesact, setConfirmDesact] = useState(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/usuarios', { params: { rol: filtroRol || undefined, search: search || undefined } });
      setUsuarios(data.data);
    } catch (e) { toast.error('Error al cargar usuarios'); }
    finally { setLoading(false); }
  }, [filtroRol, search]);

  useEffect(() => { cargar(); }, [cargar]);

  const desactivar = async (u) => {
    try {
      await api.patch(`/usuarios/${u.id}/desactivar`);
      toast.success(`${u.nombre} desactivado`);
      cargar();
    } catch (e) { toast.error('Error'); }
    setConfirmDesact(null);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">👥 Usuarios</h1>
          <p className="page-subtitle">{usuarios.length} usuario(s)</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal('nuevo')}>+ Nuevo usuario</button>
      </div>

      <div className="search-bar">
        <input className="form-control" placeholder="🔍 Nombre o email..." value={search}
          onChange={e => setSearch(e.target.value)} style={{ maxWidth:280 }} />
        <select className="form-control" value={filtroRol} onChange={e => setFiltroRol(e.target.value)} style={{ maxWidth:160 }}>
          <option value="">Todos los roles</option>
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <button className="btn btn-secondary" onClick={cargar}>Actualizar</button>
      </div>

      {loading ? (
        <div className="flex-center" style={{ height:200, fontSize:'2rem' }}>👥</div>
      ) : !usuarios.length ? (
        <div className="empty-state"><div className="empty-state-icon">👤</div>No se encontraron usuarios.</div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr><th>Usuario</th><th>Email</th><th>Teléfono</th><th>Rol</th><th>Último login</th><th>Estado</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              {usuarios.map(u => (
                <tr key={u.id}>
                  <td style={{ fontWeight:600 }}>{u.nombre} {u.apellido}</td>
                  <td style={{ fontSize:'0.85rem', color:'var(--text-muted)' }}>{u.email}</td>
                  <td style={{ fontSize:'0.85rem' }}>{u.telefono || '—'}</td>
                  <td><span className={`badge ${rolColor[u.rol]}`}>{u.rol}</span></td>
                  <td style={{ fontSize:'0.8rem', color:'var(--text-muted)' }}>
                    {u.ultimo_login ? new Date(u.ultimo_login).toLocaleString('es-PE') : 'Nunca'}
                  </td>
                  <td><span className={`badge ${u.activo?'badge-green':'badge-gray'}`}>{u.activo?'Activo':'Inactivo'}</span></td>
                  <td>
                    <div style={{ display:'flex', gap:8 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => setModal(u)}>✏️</button>
                      {u.activo && <button className="btn btn-danger btn-sm" onClick={() => setConfirmDesact(u)}>🚫</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && <ModalUsuario usuario={modal==='nuevo'?null:modal} onClose={()=>setModal(null)} onSaved={()=>{setModal(null);cargar();}} />}
      {confirmDesact && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth:360 }}>
            <div className="modal-header"><span className="modal-title">⚠️ Confirmar</span></div>
            <div className="modal-body">¿Desactivar la cuenta de <strong>{confirmDesact.nombre} {confirmDesact.apellido}</strong>?</div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={()=>setConfirmDesact(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={()=>desactivar(confirmDesact)}>Desactivar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
