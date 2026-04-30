// ============================================================
// PawSpa — Panel de Grooming (abrir/cerrar fichas + checklist)
// ============================================================
import React, { useEffect, useState, useCallback } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

function ModalAbrirFicha({ reservas, onClose, onSaved }) {
  const [form, setForm] = useState({ slot_id:'', observaciones_ini:'' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/grooming/ficha', form);
      toast.success('Ficha abierta ✅');
      onSaved();
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">✂️ Abrir Ficha de Grooming</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Reserva / Slot</label>
              <select className="form-control" value={form.slot_id} onChange={e => setForm(p=>({...p,slot_id:e.target.value}))} required>
                <option value="">— Seleccionar cita —</option>
                {reservas.filter(r => r.estado === 'confirmada' || r.estado === 'pendiente').map(r => (
                  <option key={r.id} value={r.id}>
                    {r.mascotas?.nombre} — {new Date(r.fecha_inicio).toLocaleString('es-PE')} — {r.servicios?.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Observaciones iniciales</label>
              <textarea className="form-control" rows={3} value={form.observaciones_ini}
                onChange={e => setForm(p=>({...p,observaciones_ini:e.target.value}))}
                placeholder="Estado del pelaje, comportamiento, observaciones previas..." />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-accent" disabled={loading}>{loading ? 'Abriendo...' : '✅ Abrir ficha'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FichaCard({ ficha, onRefresh }) {
  const [checklist, setChecklist]       = useState(ficha.checklist_item || []);
  const [nuevoItem, setNuevoItem]       = useState('');
  const [cerrandoModal, setCerrandoModal] = useState(false);
  const [obsFinModal, setObsFinModal]   = useState({ observaciones_fin:'', recomendaciones:'' });
  const [loading, setLoading]           = useState(false);

  const agregarItem = async () => {
    if (!nuevoItem.trim()) return;
    try {
      const { data } = await api.post(`/grooming/ficha/${ficha.id}/checklist`, {
        items: [{ descripcion: nuevoItem }]
      });
      setChecklist(p => [...p, ...data.data]);
      setNuevoItem('');
    } catch (e) { toast.error('Error al agregar ítem'); }
  };

  const toggleItem = async (item) => {
    try {
      const { data } = await api.patch(`/grooming/checklist/${item.id}`, { completado: !item.completado });
      setChecklist(p => p.map(i => i.id === item.id ? data.data : i));
    } catch (e) { toast.error('Error'); }
  };

  const cerrarFicha = async () => {
    const pendientes = checklist.filter(i => !i.completado).length;
    if (pendientes > 0) return toast.error(`Faltan ${pendientes} ítem(s) del checklist por completar.`);
    setLoading(true);
    try {
      await api.patch(`/grooming/ficha/${ficha.id}/cerrar`, obsFinModal);
      toast.success('Ficha cerrada exitosamente ✅');
      setCerrandoModal(false);
      onRefresh();
    } catch (err) { toast.error(err.response?.data?.error || 'Error al cerrar ficha'); }
    finally { setLoading(false); }
  };

  const completados = checklist.filter(i => i.completado).length;

  return (
    <div className="card" style={{ marginBottom:20, borderLeft:`4px solid ${ficha.cerrada ? 'var(--accent)' : 'var(--brand)'}` }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:'1.5rem' }}>🐾</span>
            <div>
              <h3 style={{ fontFamily:'Sora,sans-serif', fontSize:'1.05rem' }}>{ficha.mascotas?.nombre}</h3>
              <div style={{ fontSize:'0.78rem', color:'var(--text-muted)' }}>{ficha.mascotas?.raza} · {ficha.mascotas?.especie}</div>
            </div>
          </div>
          <div style={{ marginTop:8, fontSize:'0.82rem', color:'var(--text-muted)' }}>
            Inicio: {ficha.hora_inicio ? new Date(ficha.hora_inicio).toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'}) : '—'}
          </div>
        </div>
        <span className={`badge ${ficha.cerrada ? 'badge-green' : 'badge-brand'}`}>{ficha.cerrada ? '✅ Cerrada' : '🔓 En progreso'}</span>
      </div>

      {ficha.observaciones_ini && (
        <div style={{ background:'var(--bg-input)', borderRadius:'var(--radius-sm)', padding:'10px 14px', marginBottom:16, fontSize:'0.85rem', color:'var(--text-muted)' }}>
          📋 <em>{ficha.observaciones_ini}</em>
        </div>
      )}

      {/* Checklist */}
      <div style={{ marginBottom:16 }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
          <strong style={{ fontSize:'0.85rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px' }}>
            Checklist
          </strong>
          <span style={{ fontSize:'0.8rem', color: completados === checklist.length && checklist.length > 0 ? 'var(--accent)' : 'var(--text-muted)' }}>
            {completados}/{checklist.length} completados
          </span>
        </div>

        {checklist.length === 0 && <p style={{ color:'var(--text-dim)', fontSize:'0.85rem' }}>Sin ítems aún.</p>}
        {checklist.map(item => (
          <div key={item.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
            <input type="checkbox" checked={item.completado} onChange={() => !ficha.cerrada && toggleItem(item)}
              style={{ width:16, height:16, cursor: ficha.cerrada ? 'default':'pointer' }} disabled={ficha.cerrada} />
            <span style={{ fontSize:'0.88rem', textDecoration: item.completado ? 'line-through' : 'none', color: item.completado ? 'var(--text-muted)' : 'var(--text-primary)' }}>
              {item.descripcion}
            </span>
          </div>
        ))}

        {!ficha.cerrada && (
          <div style={{ display:'flex', gap:8, marginTop:12 }}>
            <input className="form-control" placeholder="Agregar ítem al checklist..." value={nuevoItem}
              onChange={e => setNuevoItem(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), agregarItem())} />
            <button className="btn btn-secondary btn-sm" onClick={agregarItem}>+ Agregar</button>
          </div>
        )}
      </div>

      {/* Botón cerrar */}
      {!ficha.cerrada && (
        <button className="btn btn-accent" onClick={() => setCerrandoModal(true)} style={{ width:'100%' }}>
          🔒 Cerrar ficha de grooming
        </button>
      )}

      {/* Modal cierre */}
      {cerrandoModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth:460 }}>
            <div className="modal-header">
              <span className="modal-title">🔒 Cerrar ficha — {ficha.mascotas?.nombre}</span>
              <button className="modal-close" onClick={() => setCerrandoModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Observaciones finales</label>
                <textarea className="form-control" rows={3} placeholder="Resultado del servicio, estado final..."
                  value={obsFinModal.observaciones_fin}
                  onChange={e => setObsFinModal(p=>({...p,observaciones_fin:e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Recomendaciones para el cliente</label>
                <textarea className="form-control" rows={2} placeholder="Próximo corte, cuidados especiales..."
                  value={obsFinModal.recomendaciones}
                  onChange={e => setObsFinModal(p=>({...p,recomendaciones:e.target.value}))} />
              </div>
              {checklist.filter(i => !i.completado).length > 0 && (
                <div style={{ background:'rgba(224,108,117,0.1)', border:'1px solid var(--danger)', borderRadius:'var(--radius-sm)', padding:'10px 14px', color:'var(--danger)', fontSize:'0.85rem' }}>
                  ⚠️ Tienes {checklist.filter(i=>!i.completado).length} ítem(s) pendiente(s). Completa el checklist antes de cerrar.
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setCerrandoModal(false)}>Cancelar</button>
              <button className="btn btn-accent" onClick={cerrarFicha} disabled={loading}>
                {loading ? 'Cerrando...' : '✅ Confirmar cierre'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function GroomingPage() {
  const { esGroomer, esAdmin, esRecepcion } = useAuth();
  const [fichas, setFichas]     = useState([]);
  const [reservas, setReservas] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState(false);
  const [filtroCerrada, setFiltroCerrada] = useState('false');

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [fResp, rResp] = await Promise.all([
        api.get('/grooming/fichas').catch(() => ({ data: { data: [] } })),
        api.get('/reservas', { params: { estado: 'confirmada' } }),
      ]);
      // Fallback: obtener fichas directamente si el endpoint existe
      setFichas(fResp.data?.data || []);
      setReservas(rResp.data.data);
    } catch (e) { toast.error('Error al cargar'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">✂️ Panel Grooming</h1>
          <p className="page-subtitle">Fichas de servicio activas e historial</p>
        </div>
        <button className="btn btn-accent" onClick={() => setModal(true)}>+ Abrir nueva ficha</button>
      </div>

      <div className="search-bar">
        <select className="form-control" value={filtroCerrada} onChange={e => setFiltroCerrada(e.target.value)} style={{ maxWidth:200 }}>
          <option value="false">En progreso</option>
          <option value="true">Completadas</option>
          <option value="all">Todas</option>
        </select>
      </div>

      {loading ? (
        <div className="flex-center" style={{ height:200, fontSize:'2rem' }}>✂️</div>
      ) : fichas.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">✂️</div>
          <p>No hay fichas de grooming.</p>
          <button className="btn btn-accent" style={{ marginTop:16 }} onClick={() => setModal(true)}>
            Abrir primera ficha
          </button>
        </div>
      ) : (
        fichas
          .filter(f => filtroCerrada === 'all' ? true : filtroCerrada === 'true' ? f.cerrada : !f.cerrada)
          .map(f => <FichaCard key={f.id} ficha={f} onRefresh={cargar} />)
      )}

      {modal && (
        <ModalAbrirFicha
          reservas={reservas}
          onClose={() => setModal(false)}
          onSaved={() => { setModal(false); cargar(); }}
        />
      )}
    </div>
  );
}
