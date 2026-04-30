// ============================================================
// PawSpa — Gestión de Reservas
// ============================================================
import React, { useEffect, useState, useCallback } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const estadoBadge = (e) => {
  const m = { pendiente:'badge-yellow', confirmada:'badge-blue', en_progreso:'badge-brand', completada:'badge-green', cancelada:'badge-red', no_show:'badge-gray' };
  return `badge ${m[e]||'badge-gray'}`;
};

function ModalReserva({ clientes, mascotas, servicios, groomers, onClose, onSaved }) {
  const { esCliente, usuario } = useAuth();
  const [form, setForm] = useState({ cliente_id:'', mascota_id:'', groomer_id:'', servicio_id:'', fecha_inicio:'', precio_acordado:'', observaciones:'' });
  const [mascotasFiltradas, setMascotasFiltradas] = useState([]);
  const [loading, setLoading] = useState(false);

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  useEffect(() => {
    if (form.cliente_id) setMascotasFiltradas(mascotas.filter(m => m.cliente_id === form.cliente_id));
    else setMascotasFiltradas(mascotas);
  }, [form.cliente_id, mascotas]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/reservas', form);
      toast.success('Reserva creada ✅');
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al crear reserva.');
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">📅 Nueva Reserva</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {!esCliente && (
              <div className="form-group">
                <label className="form-label">Cliente</label>
                <select className="form-control" value={form.cliente_id} onChange={f('cliente_id')} required>
                  <option value="">— Seleccionar cliente —</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.usuarios?.nombre} {c.usuarios?.apellido}</option>)}
                </select>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Mascota</label>
              <select className="form-control" value={form.mascota_id} onChange={f('mascota_id')} required>
                <option value="">— Seleccionar mascota —</option>
                {mascotasFiltradas.map(m => <option key={m.id} value={m.id}>{m.nombre} ({m.especie})</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Servicio</label>
              <select className="form-control" value={form.servicio_id} onChange={f('servicio_id')} required>
                <option value="">— Seleccionar servicio —</option>
                {servicios.map(s => <option key={s.id} value={s.id}>{s.nombre} ({s.duracion_min} min — S/ {s.precio_base})</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Groomer</label>
              <select className="form-control" value={form.groomer_id} onChange={f('groomer_id')} required>
                <option value="">— Seleccionar groomer —</option>
                {groomers.map(g => <option key={g.id} value={g.id}>{g.usuarios?.nombre} {g.usuarios?.apellido}</option>)}
              </select>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div className="form-group">
                <label className="form-label">Fecha y hora</label>
                <input className="form-control" type="datetime-local" value={form.fecha_inicio} onChange={f('fecha_inicio')} required />
              </div>
              <div className="form-group">
                <label className="form-label">Precio acordado (S/)</label>
                <input className="form-control" type="number" step="0.01" value={form.precio_acordado} onChange={f('precio_acordado')} placeholder="0.00" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Observaciones</label>
              <textarea className="form-control" value={form.observaciones} onChange={f('observaciones')} rows={2} placeholder="Indicaciones especiales..." />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Guardando...' : 'Crear reserva'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ModalCancelar({ reserva, onClose, onSaved }) {
  const [motivo, setMotivo] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.patch(`/reservas/${reserva.id}/cancelar`, { motivo });
      toast.success('Reserva cancelada.');
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error.');
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 400 }}>
        <div className="modal-header">
          <span className="modal-title">❌ Cancelar reserva</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <p style={{ color:'var(--text-muted)', marginBottom:16 }}>
              ¿Cancelar la cita de <strong style={{color:'var(--text-primary)'}}>{reserva.mascotas?.nombre}</strong> el {new Date(reserva.fecha_inicio).toLocaleString('es-PE')}?
            </p>
            <div className="form-group">
              <label className="form-label">Motivo de cancelación</label>
              <textarea className="form-control" value={motivo} onChange={e => setMotivo(e.target.value)} rows={3} placeholder="Indica el motivo..." required />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Volver</button>
            <button type="submit" className="btn btn-danger" disabled={loading}>{loading ? 'Cancelando...' : 'Confirmar cancelación'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ReservasPage() {
  const { esStaff, esAdmin, esRecepcion } = useAuth();
  const [reservas, setReservas]   = useState([]);
  const [clientes, setClientes]   = useState([]);
  const [mascotas, setMascotas]   = useState([]);
  const [servicios, setServicios] = useState([]);
  const [groomers, setGroomers]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [modal, setModal]         = useState(false);
  const [cancelModal, setCancelModal] = useState(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filtroEstado) params.estado = filtroEstado;
      const { data } = await api.get('/reservas', { params });
      setReservas(data.data);
    } catch (e) { toast.error('Error al cargar reservas'); }
    finally { setLoading(false); }
  }, [filtroEstado]);

  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    Promise.all([
      esStaff ? api.get('/clientes') : Promise.resolve({ data: { data: [] } }),
      api.get('/mascotas'),
      api.get('/servicios'),
      api.get('/groomers').catch(() => ({ data: { data: [] } })),
    ]).then(([c, m, s, g]) => {
      setClientes(c.data.data);
      setMascotas(m.data.data);
      setServicios(s.data.data);
      setGroomers(g.data?.data || []);
    }).catch(console.error);
  }, [esStaff]);

  const cambiarEstado = async (id, estado) => {
    try {
      await api.patch(`/reservas/${id}/estado`, { estado });
      toast.success('Estado actualizado ✅');
      cargar();
    } catch (e) { toast.error(e.response?.data?.error || 'Error'); }
  };

  const ESTADOS = ['pendiente','confirmada','en_progreso','completada','no_show'];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">📅 Reservas</h1>
          <p className="page-subtitle">{reservas.length} reserva(s) encontrada(s)</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal(true)}>+ Nueva reserva</button>
      </div>

      <div className="search-bar">
        <select className="form-control" value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} style={{ maxWidth: 200 }}>
          <option value="">Todos los estados</option>
          {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
          <option value="cancelada">cancelada</option>
        </select>
        <button className="btn btn-secondary" onClick={cargar}>Actualizar</button>
      </div>

      {loading ? (
        <div className="flex-center" style={{ height:200, fontSize:'2rem' }}>📅</div>
      ) : !reservas.length ? (
        <div className="empty-state"><div className="empty-state-icon">📭</div>No se encontraron reservas.</div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Fecha / Hora</th>
                <th>Mascota</th>
                {esStaff && <th>Cliente</th>}
                <th>Servicio</th>
                <th>Groomer</th>
                <th>Precio</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {reservas.map(r => (
                <tr key={r.id}>
                  <td>
                    <div style={{ fontWeight:600 }}>{new Date(r.fecha_inicio).toLocaleDateString('es-PE')}</div>
                    <div style={{ fontSize:'0.78rem', color:'var(--text-muted)' }}>{new Date(r.fecha_inicio).toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'})}</div>
                  </td>
                  <td>{r.mascotas?.nombre || '—'}</td>
                  {esStaff && <td style={{ fontSize:'0.85rem' }}>{r.clientes?.usuarios?.nombre} {r.clientes?.usuarios?.apellido}</td>}
                  <td style={{ fontSize:'0.85rem' }}>{r.servicios?.nombre}</td>
                  <td style={{ fontSize:'0.85rem' }}>{r.groomers?.usuarios?.nombre}</td>
                  <td>{r.precio_acordado ? `S/ ${parseFloat(r.precio_acordado).toFixed(2)}` : '—'}</td>
                  <td><span className={estadoBadge(r.estado)}>{r.estado}</span></td>
                  <td>
                    <div style={{ display:'flex', gap:6 }}>
                      {(esAdmin || esRecepcion) && r.estado !== 'cancelada' && r.estado !== 'completada' && (
                        <select className="form-control" style={{ padding:'4px 8px', fontSize:'0.75rem', width:'auto' }}
                          value={r.estado} onChange={e => cambiarEstado(r.id, e.target.value)}>
                          {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      )}
                      {r.estado !== 'cancelada' && r.estado !== 'completada' && (
                        <button className="btn btn-danger btn-sm" onClick={() => setCancelModal(r)}>✕</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <ModalReserva
          clientes={clientes} mascotas={mascotas} servicios={servicios} groomers={groomers}
          onClose={() => setModal(false)}
          onSaved={() => { setModal(false); cargar(); }}
        />
      )}
      {cancelModal && (
        <ModalCancelar
          reserva={cancelModal}
          onClose={() => setCancelModal(null)}
          onSaved={() => { setCancelModal(null); cargar(); }}
        />
      )}
    </div>
  );
}
