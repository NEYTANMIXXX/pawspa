// ============================================================
// PawSpa — Dashboard (adaptado por rol)
// ============================================================
import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

const estadoBadge = (estado) => {
  const map = { pendiente:'badge-yellow', confirmada:'badge-blue', en_progreso:'badge-brand', completada:'badge-green', cancelada:'badge-red', no_show:'badge-gray' };
  return `badge ${map[estado] || 'badge-gray'}`;
};

export default function DashboardPage() {
  const { usuario, esAdmin, esRecepcion, esGroomer, esCliente } = useAuth();
  const [stats, setStats]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard/stats')
      .then(r => setStats(r.data.stats))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex-center" style={{height:200}}><span style={{fontSize:'2rem',animation:'pulse 1s infinite'}}>🐾</span></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">¡Hola, {usuario?.nombre}! 👋</h1>
          <p className="page-subtitle">Panel de control — {new Date().toLocaleDateString('es-PE', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}</p>
        </div>
      </div>

      {/* ── ADMIN ── */}
      {esAdmin && stats && (
        <>
          <div className="stats-grid">
            {[
              { icon:'👥', value: stats.usuarios,        label:'Usuarios activos',   color:'rgba(196,149,106,0.15)' },
              { icon:'🧑‍🤝‍🧑', value: stats.clientes,       label:'Clientes',          color:'rgba(97,175,239,0.15)' },
              { icon:'🐾', value: stats.mascotas,        label:'Mascotas',           color:'rgba(92,219,149,0.15)' },
              { icon:'📅', value: stats.reservasHoy,     label:'Citas hoy',          color:'rgba(229,192,123,0.15)' },
              { icon:'💰', value: `Bs./ ${stats.ingresosDelMes}`, label:'Ingresos del mes', color:'rgba(92,219,149,0.15)' },
            ].map((s, i) => (
              <div key={i} className="stat-card">
                <div className="stat-icon" style={{background:s.color}}>{s.icon}</div>
                <div>
                  <div className="stat-value">{s.value}</div>
                  <div className="stat-label">{s.label}</div>
                </div>
              </div>
            ))}
          </div>
          {stats.productosStockBajo?.length > 0 && (
            <div className="card">
              <h3 style={{fontFamily:'Sora,sans-serif',marginBottom:16,color:'var(--warning)'}}>⚠️ Productos con stock bajo</h3>
              <div className="table-wrapper">
                <table>
                  <thead><tr><th>Producto</th><th>Stock actual</th><th>Stock mínimo</th></tr></thead>
                  <tbody>
                    {stats.productosStockBajo.map(p => (
                      <tr key={p.id}><td>{p.nombre}</td>
                        <td><span className="badge badge-red">{p.stock_actual}</span></td>
                        <td>{p.stock_minimo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── RECEPCION ── */}
      {esRecepcion && stats && (
        <>
          <div className="stats-grid">
            <div className="stat-card"><div className="stat-icon" style={{background:'rgba(97,175,239,0.15)'}}>📅</div><div><div className="stat-value">{stats.reservasHoy?.length || 0}</div><div className="stat-label">Citas hoy</div></div></div>
            <div className="stat-card"><div className="stat-icon" style={{background:'rgba(229,192,123,0.15)'}}>⏳</div><div><div className="stat-value">{stats.totalPendientes || 0}</div><div className="stat-label">Pendientes</div></div></div>
            <div className="stat-card"><div className="stat-icon" style={{background:'rgba(92,219,149,0.15)'}}>🐾</div><div><div className="stat-value">{stats.totalMascotas || 0}</div><div className="stat-label">Mascotas registradas</div></div></div>
          </div>
          <div className="card">
            <h3 style={{fontFamily:'Sora,sans-serif',marginBottom:16}}>📅 Agenda de hoy</h3>
            {!stats.reservasHoy?.length ? <div className="empty-state"><div className="empty-state-icon">📭</div>No hay citas programadas para hoy.</div> : (
              <div className="table-wrapper">
                <table>
                  <thead><tr><th>Hora</th><th>Mascota</th><th>Cliente</th><th>Servicio</th><th>Estado</th></tr></thead>
                  <tbody>
                    {stats.reservasHoy.map(r => (
                      <tr key={r.id}>
                        <td>{new Date(r.fecha_inicio).toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'})}</td>
                        <td>{r.mascotas?.nombre || '—'}</td>
                        <td>{r.clientes?.usuarios?.nombre} {r.clientes?.usuarios?.apellido}</td>
                        <td>{r.servicios?.nombre}</td>
                        <td><span className={estadoBadge(r.estado)}>{r.estado}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── GROOMER ── */}
      {esGroomer && stats && (
        <>
          {stats.fichasAbiertas?.length > 0 && (
            <div className="card" style={{marginBottom:20,borderColor:'var(--warning)'}}>
              <h3 style={{fontFamily:'Sora,sans-serif',color:'var(--warning)',marginBottom:12}}>🔓 Fichas abiertas ({stats.fichasAbiertas.length})</h3>
              {stats.fichasAbiertas.map(f => (
                <div key={f.id} style={{padding:'10px',background:'rgba(229,192,123,0.05)',borderRadius:'var(--radius-sm)',marginBottom:8}}>
                  <strong>{f.mascotas?.nombre}</strong> — iniciada {new Date(f.slot_reserva?.fecha_inicio).toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'})}
                </div>
              ))}
            </div>
          )}
          <div className="card">
            <h3 style={{fontFamily:'Sora,sans-serif',marginBottom:16}}>📅 Mi agenda de hoy</h3>
            {!stats.agendaHoy?.length ? <div className="empty-state"><div className="empty-state-icon">✅</div>No tienes citas programadas hoy.</div> : (
              stats.agendaHoy.map(r => (
                <div key={r.id} style={{display:'flex',gap:16,padding:'14px',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',marginBottom:10}}>
                  <div style={{textAlign:'center',minWidth:60}}>
                    <div style={{fontFamily:'Sora,sans-serif',fontWeight:700,color:'var(--brand-light)'}}>{new Date(r.fecha_inicio).toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'})}</div>
                    <div style={{fontSize:'0.72rem',color:'var(--text-muted)'}}>{r.servicios?.duracion_min} min</div>
                  </div>
                  <div>
                    <div style={{fontWeight:600}}>{r.mascotas?.nombre} <span style={{color:'var(--text-muted)',fontSize:'0.82rem'}}>({r.mascotas?.raza})</span></div>
                    <div style={{fontSize:'0.85rem',color:'var(--text-muted)'}}>{r.servicios?.nombre}</div>
                  </div>
                  <div style={{marginLeft:'auto'}}><span className={estadoBadge(r.estado)}>{r.estado}</span></div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* ── CLIENTE ── */}
      {esCliente && stats && (
        <>
          <div className="stats-grid">
            <div className="stat-card"><div className="stat-icon" style={{background:'rgba(92,219,149,0.15)'}}>🐾</div><div><div className="stat-value">{stats.mascotas?.length || 0}</div><div className="stat-label">Mis mascotas</div></div></div>
            <div className="stat-card"><div className="stat-icon" style={{background:'rgba(196,149,106,0.15)'}}>⭐</div><div><div className="stat-value">{stats.puntosFidelidad || 0}</div><div className="stat-label">Puntos de fidelidad</div></div></div>
          </div>
          <div className="card" style={{marginBottom:20}}>
            <h3 style={{fontFamily:'Sora,sans-serif',marginBottom:16}}>🐾 Mis mascotas</h3>
            {!stats.mascotas?.length ? <div className="empty-state"><div className="empty-state-icon">🐾</div>No tienes mascotas registradas.</div> : (
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:12}}>
                {stats.mascotas.map(m => (
                  <div key={m.id} style={{background:'var(--bg-input)',borderRadius:'var(--radius-sm)',padding:'16px',textAlign:'center',border:'1px solid var(--border)'}}>
                    <div style={{fontSize:'2.5rem',marginBottom:8}}>{m.especie==='perro'?'🐶':m.especie==='gato'?'🐱':'🐾'}</div>
                    <div style={{fontWeight:600}}>{m.nombre}</div>
                    <div style={{fontSize:'0.78rem',color:'var(--text-muted)'}}>{m.raza || m.especie}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="card">
            <h3 style={{fontFamily:'Sora,sans-serif',marginBottom:16}}>📅 Últimas reservas</h3>
            {!stats.reservasRecientes?.length ? <div className="empty-state"><div className="empty-state-icon">📭</div>No tienes reservas recientes.</div> : (
              <div className="table-wrapper">
                <table>
                  <thead><tr><th>Fecha</th><th>Mascota</th><th>Servicio</th><th>Groomer</th><th>Estado</th></tr></thead>
                  <tbody>
                    {stats.reservasRecientes.map(r => (
                      <tr key={r.id}>
                        <td>{new Date(r.fecha_inicio).toLocaleDateString('es-PE')}</td>
                        <td>{r.mascotas?.nombre}</td>
                        <td>{r.servicios?.nombre}</td>
                        <td>{r.groomers?.usuarios?.nombre}</td>
                        <td><span className={estadoBadge(r.estado)}>{r.estado}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
