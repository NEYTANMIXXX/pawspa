// ============================================================
// PawSpa — Panel de Grooming (abrir/cerrar fichas + checklist)
// ============================================================
import React, { useEffect, useState, useCallback } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

function ModalAbrirFicha({ reservas, onClose, onSaved }) {
  const [form, setForm] = useState({ slot_id:'', observaciones_ini:'', estado_pelaje:'', incidentes:'', plantilla_id: '' });
  const [loading, setLoading] = useState(false);
  const [plantillas, setPlantillas] = useState([]);

  useEffect(() => {
    let mounted = true;
    api.get('/grooming/checklist-templates').then(r => { if (mounted) setPlantillas(r.data.data || []); }).catch(() => { if (mounted) setPlantillas([]); });
    return () => { mounted = false; };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { ...form };
      const resp = await api.post('/grooming/ficha', payload);
      const ficha = resp.data.data;
      // Si se seleccionó plantilla, poblar checklist
      if (form.plantilla_id) {
        const plantilla = plantillas.find(p => p.id === form.plantilla_id);
        if (plantilla && plantilla.items && plantilla.items.length) {
          await api.post(`/grooming/ficha/${ficha.id}/checklist`, {
            items: plantilla.items.map(desc => ({ descripcion: desc }))
          });
        }
      }
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
              <label className="form-label">Plantilla de checklist</label>
              <select className="form-control" value={form.plantilla_id} onChange={e => setForm(p=>({...p,plantilla_id:e.target.value}))}>
                <option value="">— Ninguna —</option>
                {plantillas.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Estado del pelaje</label>
              <select className="form-control" value={form.estado_pelaje} onChange={e => setForm(p=>({...p,estado_pelaje:e.target.value}))}>
                <option value="">— Seleccionar estado —</option>
                <option value="bueno">Bueno</option>
                <option value="regular">Regular</option>
                <option value="malo">Malo</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Incidentes iniciales</label>
              <textarea className="form-control" rows={2} value={form.incidentes}
                onChange={e => setForm(p=>({...p,incidentes:e.target.value}))}
                placeholder="Heridas, contracciones, agresividad, alergias..." />
            </div>

            <div className="form-group">
              <label className="form-label">Observaciones iniciales</label>
              <textarea className="form-control" rows={3} value={form.observaciones_ini}
                onChange={e => setForm(p=>({...p,observaciones_ini:e.target.value}))}
                placeholder="Notas generales sobre pelaje y comportamiento..." />
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
  const [fotos, setFotos] = useState(ficha.foto_servicio || []);
  const [uploading, setUploading] = useState(false);
  const [uploadTipo, setUploadTipo] = useState('antes');
  const [uploadDesc, setUploadDesc] = useState('');
  const [insumos, setInsumos] = useState([]);
  const [productos, setProductos] = useState([]);
  const [insumoForm, setInsumoForm] = useState({ producto_id:'', cantidad:'', tipo:'recibido', motivo:'' });
  const [loadingInsumos, setLoadingInsumos] = useState(false);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      api.get(`/grooming/ficha/${ficha.id}/insumos`).catch(() => ({ data: { data: [] } })),
      api.get('/productos').catch(() => ({ data: { data: [] } })),
    ]).then(([iResp, pResp]) => {
      if (!mounted) return;
      setInsumos(iResp.data?.data || []);
      setProductos(pResp.data?.data || []);
    });
    return () => { mounted = false; };
  }, [ficha.id]);

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

  const handleFile = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const fileData = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const resp = await api.post(`/grooming/ficha/${ficha.id}/fotos`, {
        file_base64: fileData,
        file_name: file.name,
        mime_type: file.type,
        tipo: uploadTipo,
        descripcion: uploadDesc,
      });
      setFotos(p => [...p, resp.data.data]);
      setUploadDesc('');
    } catch (e) {
      toast.error(e.message || 'Error al subir foto');
    } finally { setUploading(false); }
  };

  const eliminarFoto = async (fotoId) => {
    try {
      await api.delete(`/grooming/fotos/${fotoId}`);
      setFotos(p => p.filter(f => f.id !== fotoId));
    } catch (e) { toast.error('No se pudo eliminar la foto'); }
  };

  const registrarInsumo = async () => {
    try {
      setLoadingInsumos(true);
      const { data } = await api.post(`/grooming/ficha/${ficha.id}/insumos`, {
        producto_id: insumoForm.producto_id,
        cantidad: insumoForm.cantidad,
        tipo: insumoForm.tipo,
        motivo: insumoForm.motivo,
      });
      setInsumos(p => [data.data, ...p]);
      setInsumoForm({ producto_id:'', cantidad:'', tipo:'recibido', motivo:'' });
      toast.success('Insumo registrado ✅');
    } catch (e) {
      toast.error(e.response?.data?.error || 'No se pudo registrar el insumo');
    } finally {
      setLoadingInsumos(false);
    }
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

      {/* Fotos */}
      <div style={{ marginBottom:16 }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
          <strong style={{ fontSize:'0.85rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px' }}>Fotos</strong>
          {!ficha.cerrada && (
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <select className="form-control" value={uploadTipo} onChange={e => setUploadTipo(e.target.value)} style={{ maxWidth:120 }}>
                <option value="antes">Antes</option>
                <option value="durante">Durante</option>
                <option value="despues">Después</option>
              </select>
              <input className="form-control" placeholder="Descripción" value={uploadDesc} onChange={e=>setUploadDesc(e.target.value)} style={{ maxWidth:160 }} />
              <input type="file" accept="image/*" onChange={e => handleFile(e.target.files[0])} />
            </div>
          )}
        </div>

        <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
          {fotos.length === 0 && <div style={{ color:'var(--text-dim)', fontSize:'0.85rem' }}>Sin fotos aún.</div>}
          {fotos.map(p => (
            <div key={p.id} style={{ width:120, borderRadius:8, overflow:'hidden', position:'relative', border:'1px solid var(--border)' }}>
              <img src={p.url} alt={p.descripcion || ''} style={{ width:'100%', height:90, objectFit:'cover' }} />
              <div style={{ padding:6, fontSize:'0.75rem', color:'var(--text-muted)' }}>{p.tipo}</div>
              {!ficha.cerrada && (
                <button className="btn btn-danger btn-sm" style={{ position:'absolute', top:6, right:6 }} onClick={() => eliminarFoto(p.id)}>✕</button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Insumos */}
      <div style={{ marginBottom:16 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
          <strong style={{ fontSize:'0.85rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px' }}>Insumos</strong>
          <span style={{ fontSize:'0.78rem', color:'var(--text-muted)' }}>{insumos.length} movimiento(s)</span>
        </div>

        {!ficha.cerrada && (
          <div style={{ display:'grid', gridTemplateColumns:'1.5fr 0.7fr 0.8fr 1fr auto', gap:8, alignItems:'end', marginBottom:12 }}>
            <div className="form-group" style={{ marginBottom:0 }}>
              <label className="form-label">Producto</label>
              <select className="form-control" value={insumoForm.producto_id} onChange={e => setInsumoForm(p => ({ ...p, producto_id: e.target.value }))}>
                <option value="">— Seleccionar producto —</option>
                {productos.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} (stock {p.stock_actual} {p.unidad_medida || 'u'})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom:0 }}>
              <label className="form-label">Cantidad</label>
              <input className="form-control" type="number" min="1" value={insumoForm.cantidad} onChange={e => setInsumoForm(p => ({ ...p, cantidad: e.target.value }))} />
            </div>

            <div className="form-group" style={{ marginBottom:0 }}>
              <label className="form-label">Movimiento</label>
              <select className="form-control" value={insumoForm.tipo} onChange={e => setInsumoForm(p => ({ ...p, tipo: e.target.value }))}>
                <option value="recibido">Recibido</option>
                <option value="usado">Usado</option>
                <option value="devuelto">Devuelto</option>
                <option value="desperdiciado">Desperdiciado</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom:0 }}>
              <label className="form-label">Motivo / nota</label>
              <input className="form-control" value={insumoForm.motivo} onChange={e => setInsumoForm(p => ({ ...p, motivo: e.target.value }))} placeholder="Opcional" />
            </div>

            <button className="btn btn-secondary" onClick={registrarInsumo} disabled={loadingInsumos || !insumoForm.producto_id || !insumoForm.cantidad}>
              {loadingInsumos ? 'Guardando...' : 'Registrar'}
            </button>
          </div>
        )}

        {insumos.length === 0 ? (
          <div style={{ color:'var(--text-dim)', fontSize:'0.85rem' }}>Sin movimientos de insumos aún.</div>
        ) : (
          <div style={{ display:'grid', gap:8 }}>
            {insumos.map(m => (
              <div key={m.id} style={{ padding:'10px 12px', border:'1px solid var(--border)', borderRadius:10, background:'var(--bg-input)' }}>
                <div style={{ display:'flex', justifyContent:'space-between', gap:10 }}>
                  <div>
                    <strong>{m.producto?.nombre}</strong>
                    <div style={{ fontSize:'0.8rem', color:'var(--text-muted)' }}>
                      {m.tipo === 'entrada' && 'Recibido'}
                      {m.tipo === 'salida' && 'Usado'}
                      {m.tipo === 'devolucion' && 'Devuelto'}
                      {m.tipo === 'ajuste' && 'Desperdiciado'}
                      {' '}· Cantidad: {m.cantidad}
                    </div>
                  </div>
                  <div style={{ textAlign:'right', fontSize:'0.8rem', color:'var(--text-muted)' }}>
                    Stock: {m.stock_anterior} → {m.stock_nuevo}
                  </div>
                </div>
                {m.motivo && <div style={{ marginTop:6, fontSize:'0.8rem', color:'var(--text-muted)' }}>{m.motivo}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

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
  const [agenda, setAgenda] = useState([]);
  const [agendaLoading, setAgendaLoading] = useState(false);
  const [viewMode, setViewMode] = useState('day'); // 'day' or 'week'
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0,10));

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

  const cargarAgenda = useCallback(async () => {
    setAgendaLoading(true);
    try {
      const d = new Date(selectedDate + 'T00:00:00');
      let desde, hasta;
      if (viewMode === 'day') {
        desde = new Date(d.setHours(0,0,0,0)).toISOString();
        hasta = new Date(new Date(desde).setHours(23,59,59,999)).toISOString();
      } else {
        // week: start Monday
        const day = d.getDay();
        const diff = (day === 0 ? -6 : 1) - day; // move to Monday
        const monday = new Date(d);
        monday.setDate(d.getDate() + diff);
        monday.setHours(0,0,0,0);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23,59,59,999);
        desde = monday.toISOString();
        hasta = sunday.toISOString();
      }

      const { data } = await api.get('/grooming/agenda', { params: { desde, hasta } });
      setAgenda(data.data || []);
    } catch (e) {
      toast.error('No se pudo cargar la agenda');
      setAgenda([]);
    } finally { setAgendaLoading(false); }
  }, [selectedDate, viewMode]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { cargarAgenda(); }, [cargarAgenda]);
  useEffect(() => {
    api.post('/grooming/storage/fotos/ensure').catch(() => {
      // Si falla, la subida seguirá intentando y mostrará el error real.
    });
  }, []);

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
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <select className="form-control" value={filtroCerrada} onChange={e => setFiltroCerrada(e.target.value)} style={{ maxWidth:200 }}>
          <option value="false">En progreso</option>
          <option value="true">Completadas</option>
          <option value="all">Todas</option>
          </select>

          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <button className={`btn ${viewMode==='day'?'btn-primary':'btn-secondary'}`} onClick={() => setViewMode('day')}>Día</button>
            <button className={`btn ${viewMode==='week'?'btn-primary':'btn-secondary'}`} onClick={() => setViewMode('week')}>Semana</button>
            <input type="date" className="form-control" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} style={{ maxWidth:160 }} />
            <button className="btn btn-secondary" onClick={cargarAgenda} disabled={agendaLoading}>{agendaLoading ? 'Cargando...' : 'Actualizar agenda'}</button>
          </div>
        </div>
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
        <div style={{ display:'grid', gridTemplateColumns:'1fr 420px', gap:20 }}>
          <div>
            <h3 style={{ marginBottom:10 }}>Agenda ({viewMode === 'day' ? 'Día' : 'Semana'})</h3>
            {agendaLoading ? <div>Cargando agenda...</div> : (
              agenda.length === 0 ? <div className="empty-state"><div className="empty-state-icon">📭</div>No hay citas en este rango.</div> : (
                agenda.map(s => (
                  <div key={s.id} className="card" style={{ marginBottom:12 }}>
                    <div style={{ display:'flex', justifyContent:'space-between' }}>
                      <div>
                        <div style={{ fontWeight:600 }}>{s.mascotas?.nombre}</div>
                        <div style={{ fontSize:'0.85rem', color:'var(--text-muted)' }}>{s.servicios?.nombre}</div>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <div style={{ fontWeight:600 }}>{new Date(s.fecha_inicio).toLocaleDateString('es-PE')}</div>
                        <div style={{ fontSize:'0.85rem', color:'var(--text-muted)' }}>{new Date(s.fecha_inicio).toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'})}</div>
                      </div>
                    </div>
                    <div style={{ marginTop:8, fontSize:'0.85rem', color:'var(--text-muted)' }}>Cliente: {s.clientes?.usuarios?.nombre} {s.clientes?.usuarios?.apellido}</div>
                  </div>
                ))
              )
            )}
          </div>

          <div>
            <h3 style={{ marginBottom:10 }}>Fichas</h3>
            {fichas
              .filter(f => filtroCerrada === 'all' ? true : filtroCerrada === 'true' ? f.cerrada : !f.cerrada)
              .map(f => <FichaCard key={f.id} ficha={f} onRefresh={cargar} />)}
          </div>
        </div>
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
