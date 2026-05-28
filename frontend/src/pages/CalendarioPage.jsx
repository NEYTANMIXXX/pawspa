// ============================================================
// PawSpa — Calendario semanal operativo (admin / recepcion)
// ============================================================
import React, { useEffect, useMemo, useState } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const DIA_NOMBRES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const HORA_INICIO = 8;
const HORA_FIN = 19;
const MINUTOS_POR_HORA = 60;
const GRID_HEIGHT = (HORA_FIN - HORA_INICIO) * 72;

const pad = (value) => String(value).padStart(2, '0');

const toLocalInputValue = (date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

const getWeekStart = (date) => {
  const result = new Date(date);
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result;
};

const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const formatDateShort = (date) => new Intl.DateTimeFormat('es-PE', {
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
}).format(date);

const formatTime = (value) => new Date(value).toLocaleTimeString('es-PE', {
  hour: '2-digit',
  minute: '2-digit',
});

const startOfDayISO = (date) => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result.toISOString();
};

const endOfDayISO = (date) => {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result.toISOString();
};

const normalizeAgendaItem = (item, tipo = 'slot') => ({
  ...item,
  tipo,
  start: item.start || item.fecha_inicio,
  end: item.end || item.fecha_fin,
  notas: item.notas || item.motivo || null,
});

const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const minutesFromStart = (value) => {
  const date = new Date(value);
  return (date.getHours() - HORA_INICIO) * 60 + date.getMinutes();
};

const calcularDuracionServicio = (servicio, tamanoMascota) => {
  let duracion = Number(servicio?.duracion_min || 0);

  switch (tamanoMascota) {
    case 'mediano':
      duracion = Math.ceil(duracion * 1.10);
      break;
    case 'grande':
      duracion = Math.ceil(duracion * 1.15);
      break;
    case 'gigante':
      duracion = Math.ceil(duracion * 1.30);
      break;
    default:
      break;
  }

  return duracion;
};

const GROOMER_COLORS = ['#60a5fa', '#34d399', '#f59e0b', '#f472b6', '#a78bfa', '#fb7185', '#22d3ee', '#f97316'];

const colorForGroomer = (groomerId, groomers) => {
  if (!groomerId) return '#94a3b8';
  const index = groomers.findIndex((g) => g.id === groomerId);
  return GROOMER_COLORS[(index >= 0 ? index : 0) % GROOMER_COLORS.length];
};

const groomerLabel = (groomerId, groomers) => {
  const groomer = groomers.find((item) => item.id === groomerId);
  if (!groomer) return 'Sin groomer';
  return `${groomer.usuarios?.nombre || ''} ${groomer.usuarios?.apellido || ''}`.trim();
};

function MoveSlotModal({ evento, groomers, onClose, onSaved }) {
  const [form, setForm] = useState({ fecha_inicio: '', groomer_id: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!evento) return;
    setForm({
      fecha_inicio: toLocalInputValue(new Date(evento.start)),
      groomer_id: evento.groomer_id || evento.groomers?.id || '',
    });
  }, [evento]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        fecha_inicio: new Date(form.fecha_inicio).toISOString(),
      };

      if (form.groomer_id) {
        payload.groomer_id = form.groomer_id;
      }

      await api.patch(`/reservas/${evento.id}/reprogramar`, payload);
      toast.success('Cita reprogramada ✅');
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.error || 'No se pudo mover la cita.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <span className="modal-title">🔁 Mover cita</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div style={{ marginBottom: 12, color: 'var(--text-muted)' }}>
              {evento.mascotas?.nombre || 'Mascota'} · {evento.servicios?.nombre || 'Servicio'}
            </div>

            <div className="form-group">
              <label className="form-label">Nueva fecha y hora</label>
              <input
                className="form-control"
                type="datetime-local"
                value={form.fecha_inicio}
                onChange={e => setForm(p => ({ ...p, fecha_inicio: e.target.value }))}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Groomer</label>
              <select
                className="form-control"
                value={form.groomer_id}
                onChange={e => setForm(p => ({ ...p, groomer_id: e.target.value }))}
              >
                <option value="">— Mantener el mismo —</option>
                {groomers.map(g => (
                  <option key={g.id} value={g.id}>
                    {g.usuarios?.nombre} {g.usuarios?.apellido}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Guardando...' : 'Mover cita'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CalendarEventBlock({ evento, groomers, onMove, onRelease }) {
  const esSlot = evento.tipo === 'slot';
  const start = new Date(evento.start);
  const durationMinutesBase = calcularDuracionServicio(evento.servicios, evento.mascotas?.tamano);
  const end = esSlot && durationMinutesBase > 0
    ? new Date(start.getTime() + durationMinutesBase * 60000)
    : new Date(evento.end);

  const startMinutes = Math.max(0, minutesFromStart(start));
  const durationMinutes = Math.max(30, Math.round((end.getTime() - start.getTime()) / 60000));
  const top = (startMinutes / MINUTOS_POR_HORA) * 72;
  const height = Math.max(44, (durationMinutes / MINUTOS_POR_HORA) * 72);

  const groomerId = evento.groomer_id || evento.groomers?.id || null;
  const color = colorForGroomer(groomerId, groomers);
  const nombreGroomer = groomerLabel(groomerId, groomers);

  const widthStyle = {
    minHeight: height,
  };

  return (
    <div
      style={{
        ...widthStyle,
        border: '1px solid var(--border)',
        borderLeft: `4px solid ${esSlot ? color : 'var(--warning)'}`,
        borderRadius: 10,
        padding: '8px 9px',
        background: esSlot ? `${color}22` : 'rgba(229,192,123,0.14)',
        boxShadow: '0 8px 18px rgba(0,0,0,0.10)',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, marginBottom: 4, alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.82rem', lineHeight: 1.2 }}>
            {esSlot ? evento.mascotas?.nombre || 'Cita' : 'Bloqueo'}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            {formatTime(evento.start)} - {formatTime(evento.end)}
          </div>
        </div>
        <span className={`badge ${esSlot ? 'badge-blue' : 'badge-yellow'}`} style={{ fontSize: '0.65rem', padding: '2px 6px' }}>
          {esSlot ? evento.estado : 'bloqueado'}
        </span>
      </div>

      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.35 }}>
        {esSlot && <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{evento.servicios?.nombre || '—'}</div>}
        {esSlot && <div>Groomer: <span style={{ color, fontWeight: 600 }}>{nombreGroomer}</span></div>}
        {esSlot && durationMinutesBase > 0 && <div>{durationMinutesBase} min</div>}
        {esSlot && evento.clientes?.usuarios && (
          <div>{evento.clientes.usuarios.nombre} {evento.clientes.usuarios.apellido}</div>
        )}
        {!esSlot && <div>Motivo: {evento.notas || 'Bloqueo manual'}</div>}
      </div>

      <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
        {esSlot && (
          <button className="btn btn-secondary btn-sm" onClick={() => onMove(evento)} style={{ padding: '4px 8px', fontSize: '0.72rem' }}>
            Mover
          </button>
        )}
        <button className="btn btn-danger btn-sm" onClick={() => onRelease(evento)} style={{ padding: '4px 8px', fontSize: '0.72rem' }}>
          Liberar
        </button>
      </div>
    </div>
  );
}

export default function CalendarioPage() {
  const { usuario } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [eventos, setEventos] = useState([]);
  const [groomers, setGroomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [eventToMove, setEventToMove] = useState(null);

  const weekStart = useMemo(() => getWeekStart(selectedDate), [selectedDate]);
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);
  const diasSemana = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart]);

  const cargarSemana = async () => {
    setLoading(true);
    try {
      const desde = startOfDayISO(weekStart);
      const hasta = endOfDayISO(weekEnd);

      const [agendaResp, bloqueosResp, groomersResp] = await Promise.all([
        api.get('/reservas/agenda', { params: { fecha_desde: desde, fecha_hasta: hasta } }),
        api.get('/reservas/bloqueos', { params: { fecha_desde: desde, fecha_hasta: hasta } }),
        api.get('/groomers'),
      ]);

      const agenda = (agendaResp.data.data || []).map(item => normalizeAgendaItem(item, item.tipo || 'slot'));
      const bloqueos = (bloqueosResp.data.data || []).map(item => normalizeAgendaItem({
        ...item,
        start: item.fecha_inicio,
        end: item.fecha_fin,
      }, 'bloqueo'));

      setEventos([...agenda, ...bloqueos].sort((a, b) => new Date(a.start) - new Date(b.start)));
      setGroomers(groomersResp.data.data || []);
    } catch (err) {
      toast.error(err.response?.data?.error || 'No se pudo cargar el calendario.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarSemana();
  }, [weekStart.toISOString(), weekEnd.toISOString()]);

  const eventosVisibles = useMemo(
    () => eventos.filter((evento) => !['cancelada', 'completada', 'no_show'].includes(evento.estado)),
    [eventos]
  );

  const eventosPorDia = useMemo(
    () => diasSemana.map(dia => eventosVisibles.filter(evento => sameDay(new Date(evento.start), dia))),
    [diasSemana, eventosVisibles]
  );

  const eventosPorDiaYGroomer = useMemo(() => {
    const groomerIds = groomers.map((g) => g.id);
    return eventosPorDia.map((eventosDia) => {
      const grouped = new Map();

      groomerIds.forEach((id) => grouped.set(id, []));
      grouped.set('sin_groomer', []);

      eventosDia.forEach((evento) => {
        const groomerId = evento.groomer_id || evento.groomers?.id || 'sin_groomer';
        if (!grouped.has(groomerId)) grouped.set(groomerId, []);
        grouped.get(groomerId).push(evento);
      });

      return Array.from(grouped.entries()).map(([groomerId, items]) => ({
        groomerId,
        items: items.sort((a, b) => new Date(a.start) - new Date(b.start)),
      })).filter((lane) => lane.items.length > 0);
    });
  }, [eventosPorDia, groomers]);

  const totalSlots = eventosVisibles.filter(e => e.tipo === 'slot').length;
  const totalBloqueos = eventos.filter(e => e.tipo === 'bloqueo').length;
  const semanaLabel = `${formatDateShort(weekStart)} - ${formatDateShort(weekEnd)}`;

  const refrescar = async () => {
    await cargarSemana();
  };

  const liberarEvento = async (evento) => {
    const confirmacion = window.confirm(
      evento.tipo === 'slot'
        ? '¿Quieres liberar este horario cancelando la cita?'
        : '¿Quieres liberar este bloqueo?'
    );

    if (!confirmacion) return;

    try {
      if (evento.tipo === 'slot') {
        await api.patch(`/reservas/${evento.id}/cancelar`, { motivo: 'Liberado desde calendario semanal' });
      } else {
        await api.delete(`/reservas/bloqueos/${evento.id}`);
      }

      toast.success('Horario liberado ✅');
      await refrescar();
    } catch (err) {
      toast.error(err.response?.data?.error || 'No se pudo liberar el horario.');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">🗓️ Calendario</h1>
          <p className="page-subtitle">Vista semanal operativa para reservas y bloqueos</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={() => setSelectedDate(addDays(selectedDate, -7))}>← Semana anterior</button>
          <button className="btn btn-secondary" onClick={() => setSelectedDate(new Date())}>Hoy</button>
          <button className="btn btn-secondary" onClick={() => setSelectedDate(addDays(selectedDate, 7))}>Semana siguiente →</button>
          <input
            className="form-control"
            type="date"
            value={selectedDate.toISOString().slice(0, 10)}
            onChange={e => setSelectedDate(new Date(`${e.target.value}T12:00:00`))}
            style={{ maxWidth: 180 }}
          />
        </div>
      </div>

      <div className="stats-grid" style={{ marginBottom: 18 }}>
        <div className="stat-card"><div className="stat-icon" style={{ background: 'rgba(97,175,239,0.15)' }}>📅</div><div><div className="stat-value">{totalSlots}</div><div className="stat-label">Citas</div></div></div>
        <div className="stat-card"><div className="stat-icon" style={{ background: 'rgba(229,192,123,0.15)' }}>⛔</div><div><div className="stat-value">{totalBloqueos}</div><div className="stat-label">Bloqueos</div></div></div>
        <div className="stat-card"><div className="stat-icon" style={{ background: 'rgba(92,219,149,0.15)' }}>👥</div><div><div className="stat-value">{groomers.length}</div><div className="stat-label">Groomers activos</div></div></div>
      </div>

      <div className="card" style={{ marginBottom: 18, padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontFamily: 'Sora,sans-serif' }}>Semana visible</h3>
              <div style={{ color: 'var(--text-muted)', marginTop: 4 }}>{semanaLabel}</div>
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {usuario?.rol === 'admin' ? 'Administrador' : 'Recepción'}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18, padding: 16 }}>
        <div style={{ fontFamily: 'Sora,sans-serif', fontWeight: 700, marginBottom: 10 }}>Groomers</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {groomers.map((groomer) => {
            const color = colorForGroomer(groomer.id, groomers);
            return (
              <div key={groomer.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 999, background: `${color}18` }}>
                <span style={{ width: 12, height: 12, borderRadius: 999, background: color, display: 'inline-block' }} />
                <span style={{ fontSize: '0.85rem' }}>{groomer.usuarios?.nombre} {groomer.usuarios?.apellido}</span>
              </div>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="flex-center" style={{ height: 220, fontSize: '2rem' }}>🗓️</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(240px, 1fr))', gap: 10, overflowX: 'auto', paddingBottom: 8 }}>
          {diasSemana.map((dia, index) => (
            <div key={dia.toISOString()} className="card" style={{ minHeight: 280, padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: 12, borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)', position: 'sticky', top: 0, zIndex: 3 }}>
                <div style={{ fontFamily: 'Sora,sans-serif', fontWeight: 700 }}>{DIA_NOMBRES[index]}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{formatDateShort(dia)}</div>
              </div>

              <div style={{ padding: 10 }}>
                {eventosPorDiaYGroomer[index].length ? (
                  <div style={{ display: 'grid', gap: 10, gridTemplateColumns: `repeat(${Math.min(eventosPorDiaYGroomer[index].length, 2)}, minmax(0, 1fr))` }}>
                    {eventosPorDiaYGroomer[index].map((lane) => (
                      <div key={`${dia.toISOString()}-${lane.groomerId}`} style={{ minWidth: 0 }}>
                        <div style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          marginBottom: 6,
                          color: lane.groomerId === 'sin_groomer' ? 'var(--text-muted)' : colorForGroomer(lane.groomerId, groomers),
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                        }}>
                          {lane.groomerId === 'sin_groomer' ? 'Sin groomer' : groomerLabel(lane.groomerId, groomers)}
                        </div>
                        <div style={{ display: 'grid', gap: 8 }}>
                          {lane.items.map(evento => (
                            <CalendarEventBlock
                              key={`${evento.tipo}-${evento.id}`}
                              evento={evento}
                              groomers={groomers}
                              onMove={setEventToMove}
                              onRelease={liberarEvento}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: 12, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    Sin eventos.
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {eventToMove && (
        <MoveSlotModal
          evento={eventToMove}
          groomers={groomers}
          onClose={() => setEventToMove(null)}
          onSaved={async () => {
            setEventToMove(null);
            await refrescar();
          }}
        />
      )}
    </div>
  );
}
