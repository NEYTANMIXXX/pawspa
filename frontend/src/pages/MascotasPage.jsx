// ============================================================
// PawSpa — Gestión de Mascotas (CRUD completo)
// ============================================================
import React, { useEffect, useState, useCallback } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import MascotaHistorial from '../components/pets/MascotaHistorial';

const ESPECIES = ['perro','gato','conejo','ave','otro'];
const TAMANOS  = ['mini','pequeno','mediano','grande','gigante'];
const SEXOS    = ['macho','hembra'];

const especieEmoji = { perro:'🐶', gato:'🐱', conejo:'🐰', ave:'🐦', otro:'🐾' };

function ModalMascota({ mascota, clientes, onClose, onSaved }) {
  const { esCliente } = useAuth();
  const [form, setForm] = useState({
    nombre: '', especie: 'perro', raza: '', sexo: 'macho',
    tamano: 'mediano', peso_kg: '', color: '', alergias: '',
    condiciones_med: '', notas: '', cliente_id: '',
    ...(mascota || {}),
    peso_kg: mascota?.peso_kg || '',
  });
  const [loading, setLoading] = useState(false);

  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mascota) {
        await api.put(`/mascotas/${mascota.id}`, form);
        toast.success('Mascota actualizada ✅');
      } else {
        await api.post('/mascotas', form);
        toast.success('Mascota registrada 🐾');
      }
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al guardar.');
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{mascota ? '✏️ Editar mascota' : '🐾 Nueva mascota'}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {!esCliente && clientes && (
              <div className="form-group">
                <label className="form-label">Cliente</label>
                <select className="form-control" value={form.cliente_id} onChange={f('cliente_id')} required>
                  <option value="">— Seleccionar —</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.usuarios?.nombre} {c.usuarios?.apellido}</option>)}
                </select>
              </div>
            )}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div className="form-group">
                <label className="form-label">Nombre</label>
                <input className="form-control" value={form.nombre} onChange={f('nombre')} required />
              </div>
              <div className="form-group">
                <label className="form-label">Especie</label>
                <select className="form-control" value={form.especie} onChange={f('especie')}>
                  {ESPECIES.map(e=><option key={e} value={e}>{especieEmoji[e]} {e}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Raza</label>
                <input className="form-control" value={form.raza} onChange={f('raza')} placeholder="Ej: Poodle" />
              </div>
              <div className="form-group">
                <label className="form-label">Color</label>
                <input className="form-control" value={form.color} onChange={f('color')} placeholder="Ej: Blanco" />
              </div>
              <div className="form-group">
                <label className="form-label">Sexo</label>
                <select className="form-control" value={form.sexo} onChange={f('sexo')}>
                  {SEXOS.map(s=><option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Tamaño</label>
                <select className="form-control" value={form.tamano} onChange={f('tamano')}>
                  {TAMANOS.map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Peso (kg)</label>
                <input className="form-control" type="number" step="0.1" value={form.peso_kg} onChange={f('peso_kg')} placeholder="5.2" />
              </div>
              <div className="form-group">
                <label className="form-label">Fecha nac.</label>
                <input className="form-control" type="date" value={form.fecha_nacimiento||''} onChange={f('fecha_nacimiento')} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Alergias</label>
              <input className="form-control" value={form.alergias||''} onChange={f('alergias')} placeholder="Ninguna conocida" />
            </div>
            <div className="form-group">
              <label className="form-label">Condiciones médicas</label>
              <input className="form-control" value={form.condiciones_med||''} onChange={f('condiciones_med')} />
            </div>
            <div className="form-group">
              <label className="form-label">Notas</label>
              <textarea className="form-control" value={form.notas||''} onChange={f('notas')} rows={2} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading?'Guardando...':'Guardar'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function MascotasPage() {
  const { esStaff } = useAuth();
  const [mascotas, setMascotas]   = useState([]);
  const [clientes, setClientes]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [modal, setModal]         = useState(null); // null | 'nuevo' | mascota
  const [confirmDel, setConfirmDel] = useState(null);
  const [historialMascota, setHistorialMascota] = useState(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/mascotas', { params: { search: search || undefined } });
      setMascotas(data.data);
    } catch (e) { toast.error('Error al cargar mascotas'); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    if (esStaff) api.get('/clientes').then(r => setClientes(r.data.data)).catch(()=>{});
  }, [esStaff]);

  const eliminar = async (m) => {
    try {
      await api.delete(`/mascotas/${m.id}`);
      toast.success(`${m.nombre} desactivado`);
      cargar();
    } catch (e) { toast.error(e.response?.data?.error || 'Error'); }
    setConfirmDel(null);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">🐾 Mascotas</h1>
          <p className="page-subtitle">{mascotas.length} mascota(s) registrada(s)</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal('nuevo')}>+ Nueva mascota</button>
      </div>

      <div className="search-bar">
        <input className="form-control" placeholder="🔍 Buscar por nombre..." value={search}
          onChange={e => setSearch(e.target.value)} style={{ maxWidth: 320 }} />
        <button className="btn btn-secondary" onClick={cargar}>Actualizar</button>
      </div>

      {loading ? (
        <div className="flex-center" style={{height:200,fontSize:'2rem'}}>🐾</div>
      ) : !mascotas.length ? (
        <div className="empty-state"><div className="empty-state-icon">🐾</div>No se encontraron mascotas.</div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Mascota</th>
                {esStaff && <th>Dueño</th>}
                <th>Raza</th>
                <th>Tamaño</th>
                <th>Peso</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {mascotas.map(m => (
                <tr key={m.id}>
                  <td>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <span style={{fontSize:'1.5rem'}}>{especieEmoji[m.especie]}</span>
                      <div>
                        <div style={{fontWeight:600}}>{m.nombre}</div>
                        <div style={{fontSize:'0.75rem',color:'var(--text-muted)'}}>{m.sexo}</div>
                      </div>
                    </div>
                  </td>
                  {esStaff && <td style={{fontSize:'0.85rem'}}>{m.clientes?.usuarios?.nombre} {m.clientes?.usuarios?.apellido}</td>}
                  <td>{m.raza || '—'}</td>
                  <td><span className="badge badge-blue">{m.tamano}</span></td>
                  <td>{m.peso_kg ? `${m.peso_kg} kg` : '—'}</td>
                  <td><span className={`badge ${m.activo?'badge-green':'badge-gray'}`}>{m.activo?'Activo':'Inactivo'}</span></td>
                  <td>
                    <div style={{display:'flex',gap:8}}>
                      <button className="btn btn-secondary btn-sm" onClick={()=>setModal(m)}>✏️</button>
                      <button className="btn btn-info btn-sm" onClick={()=>setHistorialMascota(m)}>📜</button>
                      {esStaff && <button className="btn btn-danger btn-sm" onClick={()=>setConfirmDel(m)}>🗑️</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal crear/editar */}
      {modal && (
        <ModalMascota
          mascota={modal === 'nuevo' ? null : modal}
          clientes={clientes}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); cargar(); }}
        />
      )}

      {/* Modal historial */}
      {historialMascota && (
        <MascotaHistorial mascotaId={historialMascota.id} onClose={() => setHistorialMascota(null)} />
      )}

      {/* Confirm delete */}
      {confirmDel && (
        <div className="modal-overlay">
          <div className="modal" style={{maxWidth:360}}>
            <div className="modal-header"><span className="modal-title">⚠️ Confirmar</span></div>
            <div className="modal-body">
              ¿Desactivar a <strong>{confirmDel.nombre}</strong>? El registro se mantendrá en el historial.
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={()=>setConfirmDel(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={()=>eliminar(confirmDel)}>Desactivar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
