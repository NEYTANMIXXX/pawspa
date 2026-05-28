// ============================================================
// PawSpa — Gestión de Reservas
// ============================================================
import React, { useEffect, useState, useCallback } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { QRCodeSVG } from 'qrcode.react';

const estadoBadge = (e) => {
  const m = { pendiente:'badge-yellow', confirmada:'badge-blue', en_progreso:'badge-brand', completada:'badge-green', cancelada:'badge-red', no_show:'badge-gray' };
  return `badge ${m[e]||'badge-gray'}`;
};

function ModalReserva({ clientes, mascotas, servicios, groomers, onClose, onSaved }) {
  const { esCliente, usuario } = useAuth();
  const [form, setForm] = useState({ cliente_id:'', mascota_id:'', groomer_id:'', servicio_id:'', fecha_inicio:'', precio_acordado:'', observaciones:'' });
  const [mascotasFiltradas, setMascotasFiltradas] = useState([]);
  const [groomersFiltrados, setGroomersFiltrados] = useState(groomers);
  const [cargandoGroomers, setCargandoGroomers] = useState(false);
  const [mensajeGroomers, setMensajeGroomers] = useState('');
  const [duracionEstimada, setDuracionEstimada] = useState(null);
  const [loading, setLoading] = useState(false);
  const [metodoPago, setMetodoPago] = useState('');
  const [registrandoPago, setRegistrandoPago] = useState(false);

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  useEffect(() => {
    if (form.cliente_id) setMascotasFiltradas(mascotas.filter(m => m.cliente_id === form.cliente_id));
    else setMascotasFiltradas(mascotas);
  }, [form.cliente_id, mascotas]);

  useEffect(() => {
    let cancelado = false;

    const cargarGroomers = async () => {
      if (!form.fecha_inicio || !form.servicio_id || !form.mascota_id) {
        setCargandoGroomers(false);
        setGroomersFiltrados(groomers);
        setMensajeGroomers('');
        setDuracionEstimada(null);
        return;
      }

      setCargandoGroomers(true);
      try {
        const { data } = await api.get('/disponibilidad', {
          params: {
            fecha_inicio: new Date(form.fecha_inicio).toISOString(),
            servicio_id: form.servicio_id,
            mascota_id: form.mascota_id,
          },
        });

        if (cancelado) return;

        const groomersConEstado = data.data || [];
        setGroomersFiltrados(groomersConEstado);
        // Calcular duración estimada usando fecha_fin devuelta por el endpoint
        if (data && data.fecha_fin) {
          try {
            const inicio = new Date(form.fecha_inicio);
            const fin = new Date(data.fecha_fin);
            if (!Number.isNaN(inicio.getTime()) && !Number.isNaN(fin.getTime()) && fin > inicio) {
              const mins = Math.round((fin.getTime() - inicio.getTime()) / 60000);
              setDuracionEstimada(mins);
            } else {
              setDuracionEstimada(null);
            }
          } catch (e) {
            setDuracionEstimada(null);
          }
        } else {
          setDuracionEstimada(null);
        }
        setMensajeGroomers(groomersConEstado.some(g => g.disponible)
          ? ''
          : 'No hay groomers disponibles para ese horario. Puedes ver cuáles están ocupados.'
        );

        setForm(prev => (
          prev.groomer_id && !groomersConEstado.some(g => g.id === prev.groomer_id && g.disponible)
            ? { ...prev, groomer_id: '' }
            : prev
        ));
      } catch (err) {
        if (cancelado) return;
        setGroomersFiltrados(groomers.map(g => ({ ...g, disponible: false, motivo_disponibilidad: 'No se pudo calcular la disponibilidad.' })));
        setMensajeGroomers(err.response?.data?.error || 'No se pudo calcular la disponibilidad.');
        setDuracionEstimada(null);
      } finally {
        if (!cancelado) setCargandoGroomers(false);
      }
    };

    cargarGroomers();

    return () => {
      cancelado = true;
    };
  }, [form.fecha_inicio, form.servicio_id, form.mascota_id, groomers]);

  const servicioSeleccionado = servicios.find(s => s.id === form.servicio_id);
  const montoPago = Number(form.precio_acordado || servicioSeleccionado?.precio_base || 0);
  const mostrarPagoCliente = esCliente;
  const puedeElegirPago = esCliente && Boolean(form.servicio_id);

  useEffect(() => {
    if (!puedeElegirPago) setMetodoPago('');
  }, [puedeElegirPago]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        ...form,
        fecha_inicio: new Date(form.fecha_inicio).toISOString(),
      };

      const { data } = await api.post('/reservas', payload);
      let pagoFallido = false;

      if (puedeElegirPago && metodoPago) {
        setRegistrandoPago(true);
        try {
          await api.post('/reservas/pagos', {
            slot_id: data.data.id,
            monto: montoPago,
            tipo_pago: metodoPago,
            notas: metodoPago === 'qr'
              ? 'Pago registrado al agendar cita desde el flujo de cliente.'
              : 'Pago en efectivo registrado al agendar cita desde el flujo de cliente.'
          });
        } catch (pagoError) {
          pagoFallido = true;
          toast.error(pagoError.response?.data?.error || 'La reserva se creó, pero no se pudo registrar el pago automáticamente.');
        } finally {
          setRegistrandoPago(false);
        }
      }

      toast.success(pagoFallido ? 'Reserva creada. Revisa el pago.' : 'Reserva creada ✅');
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al crear reserva.');
    } finally {
      setLoading(false);
    }
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
                {servicios.map(s => <option key={s.id} value={s.id}>{s.nombre} ({s.duracion_min} min — Bs. {s.precio_base})</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Groomer</label>
              <select className="form-control" value={form.groomer_id} onChange={f('groomer_id')} required disabled={cargandoGroomers || !form.fecha_inicio || !form.servicio_id || !form.mascota_id}>
                <option value="">
                  {cargandoGroomers
                    ? '— Calculando disponibilidad —'
                    : '— Selecciona fecha, servicio y mascota —'}
                </option>
                {groomersFiltrados.map(g => (
                  <option key={g.id} value={g.id} disabled={g.disponible === false}>
                    {g.usuarios?.nombre} {g.usuarios?.apellido}
                    {g.disponible === false ? ` — ${g.motivo_disponibilidad || 'No disponible'}` : ' — Disponible'}
                  </option>
                ))}
              </select>
              {mensajeGroomers && (
                <div style={{ marginTop: 8, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  {mensajeGroomers}
                </div>
              )}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div className="form-group">
                <label className="form-label">Fecha y hora</label>
                <input className="form-control" type="datetime-local" value={form.fecha_inicio} onChange={f('fecha_inicio')} required />
                {duracionEstimada !== null && (
                  <div style={{ marginTop: 8, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                    Duración estimada: <strong>{duracionEstimada} min</strong>
                  </div>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Precio acordado (Bs.)</label>
                <input className="form-control" type="number" step="0.01" value={form.precio_acordado} onChange={f('precio_acordado')} placeholder="0.00" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Observaciones</label>
              <textarea className="form-control" value={form.observaciones} onChange={f('observaciones')} rows={2} placeholder="Indicaciones especiales..." />
            </div>
            {mostrarPagoCliente && (
              <div className="form-group" style={{ marginTop: 8, padding: 16, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--bg-secondary)' }}>
                <label className="form-label" style={{ marginBottom: 10 }}>Método de pago</label>
                {!puedeElegirPago && (
                  <div style={{ padding: 14, borderLeft: '4px solid var(--primary)', background: 'rgba(59,130,246,0.08)', borderRadius: 8 }}>
                    <strong>Primero selecciona un servicio</strong>
                    <p style={{ margin: '6px 0 0', lineHeight: 1.5 }}>
                      Cuando elijas el servicio, se activará la opción para pagar por QR o en efectivo.
                    </p>
                  </div>
                )}
                {puedeElegirPago && (
                  <>
                    <p style={{ marginTop: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                      Elige cómo deseas pagar tu cita. Si seleccionas QR, verás el código para escanear; si eliges efectivo, te mostraremos un mensaje formal para completar el pago en tienda.
                    </p>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                      <button type="button" className="btn" onClick={() => setMetodoPago('efectivo')} style={{ padding: 16, border: `1px solid ${metodoPago === 'efectivo' ? 'var(--primary)' : 'var(--border)'}`, background: metodoPago === 'efectivo' ? 'rgba(59,130,246,0.08)' : 'var(--card-bg)', textAlign: 'left' }}>
                        <div style={{ fontSize: '1.4rem', marginBottom: 6, color: '#fff' }}>💵 Efectivo</div>
                        <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.85)' }}>En la tienda nos paga de forma presencial.</div>
                      </button>
                      <button type="button" className="btn" onClick={() => setMetodoPago('qr')} style={{ padding: 16, border: `1px solid ${metodoPago === 'qr' ? 'var(--primary)' : 'var(--border)'}`, background: metodoPago === 'qr' ? 'rgba(59,130,246,0.08)' : 'var(--card-bg)', textAlign: 'left' }}>
                        <div style={{ fontSize: '1.4rem', marginBottom: 6, color: '#fff' }}>📱 QR</div>
                        <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.85)' }}>Te mostramos el código para escanear y pagar.</div>
                      </button>
                    </div>
                    <div style={{ marginTop: 14 }}>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 6 }}>
                        Monto estimado: <strong style={{ color: 'var(--text-primary)' }}>Bs. {montoPago.toFixed(2)}</strong>
                      </div>
                      {metodoPago === 'efectivo' && (
                        <div style={{ padding: 14, borderLeft: '4px solid var(--primary)', background: 'rgba(59,130,246,0.08)', borderRadius: 8 }}>
                          <strong>Pago en tienda</strong>
                          <p style={{ margin: '6px 0 0', lineHeight: 1.5 }}>Tu cita quedará registrada y podrás completar el pago en caja al llegar al local.</p>
                        </div>
                      )}
                      {metodoPago === 'qr' && (
                        <div style={{ padding: 14, borderLeft: '4px solid var(--success)', background: 'rgba(34,197,94,0.08)', borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                          <strong>Pago por QR</strong>
                          <div style={{ background: '#fff', padding: 10, borderRadius: 10 }}>
                            <QRCodeSVG value={`PAWSPA|${form.cliente_id || usuario?.id || 'cliente'}|${form.servicio_id}|${montoPago.toFixed(2)}|${form.fecha_inicio || 'sin-fecha'}`} size={180} level="H" />
                          </div>
                          <p style={{ margin: 0, lineHeight: 1.5, textAlign: 'center' }}>Escanea este código para continuar con el pago. Tu cita se registrará al confirmar la reserva.</p>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={loading || registrandoPago || (mostrarPagoCliente && !metodoPago)}>
              {loading ? (registrandoPago ? 'Registrando pago...' : 'Guardando...') : 'Crear reserva'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
function ModalCancelar({ reserva, onClose, onSaved, onReprogram }) {
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
    } finally {
      setLoading(false);
    }
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
            <button type="button" className="btn btn-secondary" onClick={() => { onClose(); onReprogram && onReprogram(reserva); }}>Reprogramar</button>
            <button type="submit" className="btn btn-danger" disabled={loading}>{loading ? 'Cancelando...' : 'Confirmar cancelación'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ModalReprogramar({ reserva, servicios, mascotas, groomers, onClose, onSaved }) {
  const { usuario } = useAuth();
  const [form, setForm] = useState({ fecha_inicio: '', groomer_id: reserva?.groomer_id || '' });
  const [groomersFiltrados, setGroomersFiltrados] = useState(groomers || []);
  const [cargandoGroomers, setCargandoGroomers] = useState(false);
  const [mensajeGroomers, setMensajeGroomers] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!reserva) return;
    const toInput = (iso) => {
      const d = new Date(iso);
      const tz = d.getTimezoneOffset();
      const local = new Date(d.getTime() - tz * 60000);
      return local.toISOString().slice(0,16);
    };
    setForm({ fecha_inicio: toInput(reserva.fecha_inicio), groomer_id: reserva.groomer_id || '' });
  }, [reserva]);

  useEffect(() => {
    let cancelado = false;
    const cargarGroomers = async () => {
      if (!form.fecha_inicio) {
        setGroomersFiltrados(groomers);
        setMensajeGroomers('');
        return;
      }

      setCargandoGroomers(true);
      try {
        const servicioId = reserva.servicio_id;
        const mascotaId = reserva.mascota_id;
        const { data } = await api.get('/disponibilidad', {
          params: {
            fecha_inicio: new Date(form.fecha_inicio).toISOString(),
            servicio_id: servicioId,
            mascota_id: mascotaId,
          }
        });

        if (cancelado) return;

        const groomersConEstado = data.data || [];
        setGroomersFiltrados(groomersConEstado);
        setMensajeGroomers(groomersConEstado.some(g => g.disponible)
          ? ''
          : 'No hay groomers disponibles para ese horario. Puedes ver cuáles están ocupados.'
        );

        setForm(prev => (
          prev.groomer_id && !groomersConEstado.some(g => g.id === prev.groomer_id && g.disponible)
            ? { ...prev, groomer_id: '' }
            : prev
        ));
      } catch (err) {
        if (cancelado) return;
        setGroomersFiltrados((groomers || []).map(g => ({ ...g, disponible: false, motivo_disponibilidad: 'No se pudo calcular la disponibilidad.' })));
        setMensajeGroomers(err.response?.data?.error || 'No se pudo calcular la disponibilidad.');
      } finally {
        if (!cancelado) setCargandoGroomers(false);
      }
    };

    cargarGroomers();
    return () => { cancelado = true; };
  }, [form.fecha_inicio, reserva, groomers]);

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { fecha_inicio: new Date(form.fecha_inicio).toISOString() };
      if (form.groomer_id) payload.groomer_id = form.groomer_id;

      await api.patch(`/reservas/${reserva.id}/reprogramar`, payload);
      toast.success('Reserva reprogramada ✅');
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al reprogramar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">🔁 Reprogramar cita</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div style={{ marginBottom: 12 }}>
              <div><strong>Mascota:</strong> {reserva.mascotas?.nombre}</div>
              <div><strong>Servicio:</strong> {reserva.servicios?.nombre}</div>
            </div>

            <div className="form-group">
              <label className="form-label">Fecha y hora</label>
              <input className="form-control" type="datetime-local" value={form.fecha_inicio} onChange={f('fecha_inicio')} required />
            </div>

            <div className="form-group">
              <label className="form-label">Groomer</label>
              <select className="form-control" value={form.groomer_id} onChange={f('groomer_id')} required disabled={cargandoGroomers || !form.fecha_inicio}>
                <option value="">{cargandoGroomers ? '— Calculando disponibilidad —' : '— Selecciona groomer —'}</option>
                {groomersFiltrados.map(g => (
                  <option key={g.id} value={g.id} disabled={g.disponible === false}>
                    {g.usuarios?.nombre} {g.usuarios?.apellido}{g.disponible === false ? ` — ${g.motivo_disponibilidad || 'No disponible'}` : ' — Disponible'}
                  </option>
                ))}
              </select>
              {mensajeGroomers && <div style={{ marginTop: 8, color: 'var(--text-muted)', fontSize: '0.85rem' }}>{mensajeGroomers}</div>}
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Volver</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Guardando...' : 'Reprogramar'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ModalPagoCliente({ reserva, onClose, onSaved }) {
  const [metodoPago, setMetodoPago] = useState('');
  const [loading, setLoading] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [discountAmount, setDiscountAmount] = useState(0);

  const monto = Number(reserva.precio_acordado || 0);
  const codigoQR = `PAWSPA|${reserva.id}|${monto.toFixed(2)}|${metodoPago || 'qr'}`;

  const registrarPago = async () => {
    if (!metodoPago) {
      toast.error('Selecciona un método de pago.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        slot_id: reserva.id,
        monto: monto - (Number(discountAmount) || 0),
        tipo_pago: metodoPago,
        notas: metodoPago === 'qr'
          ? 'Pago posterior por QR registrado por el cliente.'
          : 'Pago posterior en efectivo registrado por el cliente.'
      };

      if (appliedPromo && discountAmount > 0) {
        payload.promocion_codigo = appliedPromo.codigo || appliedPromo.id;
        payload.descuento = discountAmount;
      }

      await api.post('/reservas/pagos', payload);

      toast.success('Pago registrado ✅');
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.error || 'No se pudo registrar el pago.');
    } finally {
      setLoading(false);
    }
  };

  const aplicarCoupon = async () => {
    if (!couponCode) return;
    setApplyingCoupon(true);
    try {
      const { data } = await api.post('/descuentos/apply', { codigo: couponCode.trim(), cliente_id: reserva.cliente_id || null, total: monto, items: [] });
      setAppliedPromo(data.promocion || null);
      setDiscountAmount(data.descuento || 0);
      toast.success('Descuento aplicado ✅');
    } catch (err) {
      setAppliedPromo(null);
      setDiscountAmount(0);
      toast.error(err.response?.data?.error || 'No se pudo aplicar el descuento.');
    } finally {
      setApplyingCoupon(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <span className="modal-title">💳 Pagar cita</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <p style={{ color: 'var(--text-muted)', marginTop: 0 }}>
            Puedes cambiar de opinión y pagar ahora tu cita agendada.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <button
              type="button"
              className="btn"
              onClick={() => setMetodoPago('efectivo')}
              style={{
                padding: 16,
                border: `1px solid ${metodoPago === 'efectivo' ? 'var(--primary)' : 'var(--border)'}`,
                background: metodoPago === 'efectivo' ? 'rgba(59,130,246,0.08)' : 'var(--card-bg)',
                textAlign: 'left'
              }}
            >
              <div style={{ fontSize: '1.4rem', marginBottom: 6, color: '#fff' }}>💵 Efectivo</div>
              <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.85)' }}>Pago presencial en tienda.</div>
            </button>

            <button
              type="button"
              className="btn"
              onClick={() => setMetodoPago('qr')}
              style={{
                padding: 16,
                border: `1px solid ${metodoPago === 'qr' ? 'var(--primary)' : 'var(--border)'}`,
                background: metodoPago === 'qr' ? 'rgba(59,130,246,0.08)' : 'var(--card-bg)',
                textAlign: 'left'
              }}
            >
              <div style={{ fontSize: '1.4rem', marginBottom: 6, color: '#fff' }}>📱 QR</div>
              <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.85)' }}>Escanea y paga en línea.</div>
            </button>
          </div>

            <div style={{ marginBottom: 14, color: 'var(--text-muted)' }}>
            Monto: <strong style={{ color: 'var(--text-primary)' }}>Bs. {monto.toFixed(2)}</strong>
          </div>

            <div style={{ marginBottom: 12 }}>
              <label className="form-label">Código de descuento (opcional)</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="form-control" placeholder="Ingrese código" value={couponCode} onChange={e => setCouponCode(e.target.value)} />
                <button className="btn btn-secondary" onClick={aplicarCoupon} disabled={applyingCoupon || !couponCode}>
                  {applyingCoupon ? 'Aplicando...' : 'Aplicar'}
                </button>
              </div>
              {appliedPromo && (
                <div style={{ marginTop: 8, color: 'var(--success)', fontSize: '0.9rem' }}>
                  Aplicado: {appliedPromo.nombre} — Descuento Bs. {Number(discountAmount).toFixed(2)}
                </div>
              )}
            </div>

          {metodoPago === 'efectivo' && (
            <div style={{ padding: 14, borderLeft: '4px solid var(--primary)', background: 'rgba(59,130,246,0.08)', borderRadius: 8 }}>
              <strong>Pago en tienda</strong>
              <p style={{ margin: '6px 0 0', lineHeight: 1.5 }}>
                Tu pago quedará registrado y podrás completarlo en caja cuando llegues al local.
              </p>
            </div>
          )}

          {metodoPago === 'qr' && (
            <div style={{ padding: 14, borderLeft: '4px solid var(--success)', background: 'rgba(34,197,94,0.08)', borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <strong>Pago por QR</strong>
              <div style={{ background: '#fff', padding: 10, borderRadius: 10 }}>
                <QRCodeSVG value={codigoQR} size={180} level="H" />
              </div>
              <p style={{ margin: 0, lineHeight: 1.5, textAlign: 'center' }}>
                Escanea el código para registrar el pago de esta cita.
              </p>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn btn-primary" onClick={registrarPago} disabled={loading || !metodoPago}>
            {loading ? 'Registrando...' : 'Confirmar pago'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ReservasPage() {
  const { esStaff, esAdmin, esRecepcion, esCliente } = useAuth();
  const [reservas, setReservas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [mascotas, setMascotas] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [groomers, setGroomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [modal, setModal] = useState(false);
  const [cancelModal, setCancelModal] = useState(null);
  const [payModal, setPayModal] = useState(null);
  const [reprogramModal, setReprogramModal] = useState(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filtroEstado) params.estado = filtroEstado;
      const { data } = await api.get('/reservas', { params });
      setReservas(data.data);
    } catch (e) {
      toast.error('Error al cargar reservas');
    } finally {
      setLoading(false);
    }
  }, [filtroEstado]);

  useEffect(() => {
    cargar();
  }, [cargar]);

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
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error');
    }
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

      <div
        className="card"
        style={{
          marginBottom: 20,
          padding: 20
        }}
      >
        <h3 style={{ marginBottom: 10 }}>
          🕒 Horarios de Atención
        </h3>

        <p style={{ color: 'var(--text-muted)' }}>
          Atendemos de <strong>Lunes a Sábado</strong>
          {' '}de{' '}
          <strong>09:00 AM</strong>
          {' '}a{' '}
          <strong>06:00 PM</strong>.
        </p>

        <p
          style={{
            marginTop: 10,
            fontSize: '0.9rem',
            color: 'var(--text-muted)'
          }}
        >
          La disponibilidad puede variar según las reservas ya registradas.
        </p>
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
                  <td>{r.precio_acordado ? `Bs. ${parseFloat(r.precio_acordado).toFixed(2)}` : '—'}</td>
                  <td><span className={estadoBadge(r.estado)}>{r.estado}</span></td>
                  <td>
                    <div style={{ display:'flex', gap:6 }}>
                      {esCliente && r.estado !== 'cancelada' && r.estado !== 'completada' && r.precio_acordado && (
                        <button className="btn btn-success btn-sm" onClick={() => setPayModal(r)}>
                          💳 Pagar
                        </button>
                      )}
                      {(esAdmin || esRecepcion) && r.estado !== 'cancelada' && r.estado !== 'completada' && (
                        <select className="form-control" style={{ padding:'4px 8px', fontSize:'0.75rem', width:'auto' }} value={r.estado} onChange={e => cambiarEstado(r.id, e.target.value)}>
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
          clientes={clientes}
          mascotas={mascotas}
          servicios={servicios}
          groomers={groomers}
          onClose={() => setModal(false)}
          onSaved={() => { setModal(false); cargar(); }}
        />
      )}

      {cancelModal && (
        <ModalCancelar
          reserva={cancelModal}
          onClose={() => setCancelModal(null)}
          onReprogram={(r) => { setCancelModal(null); setReprogramModal(r); }}
          onSaved={() => { setCancelModal(null); cargar(); }}
        />
      )}

      {reprogramModal && (
        <ModalReprogramar
          reserva={reprogramModal}
          servicios={servicios}
          mascotas={mascotas}
          groomers={groomers}
          onClose={() => setReprogramModal(null)}
          onSaved={() => { setReprogramModal(null); cargar(); }}
        />
      )}

      {payModal && (
        <ModalPagoCliente
          reserva={payModal}
          onClose={() => setPayModal(null)}
          onSaved={() => { setPayModal(null); cargar(); }}
        />
      )}
    </div>
  );
}
