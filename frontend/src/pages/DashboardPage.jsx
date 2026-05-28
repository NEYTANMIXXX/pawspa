// ============================================================
// PawSpa — Dashboard (adaptado por rol)
// ============================================================
import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import toast from 'react-hot-toast';

const estadoBadge = (estado) => {
  const map = { pendiente:'badge-yellow', confirmada:'badge-blue', en_progreso:'badge-brand', completada:'badge-green', cancelada:'badge-red', no_show:'badge-gray' };
  return `badge ${map[estado] || 'badge-gray'}`;
};

export default function DashboardPage() {
  const { usuario, esAdmin, esRecepcion, esGroomer, esCliente } = useAuth();
  const [stats, setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [openAlert, setOpenAlert] = useState(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  useEffect(() => {
    let mounted = true;
    const cargar = async () => {
      try {
        const r = await api.get('/dashboard/stats');
        if (!mounted) return;
        setStats(r.data.stats);
      } catch (e) {
        console.error(e);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    cargar();
    const id = setInterval(cargar, 30000); // refrescar cada 30s para captar nuevas promociones
    return () => { mounted = false; clearInterval(id); };
  }, []);

  const descargarReportePdf = async () => {
    try {
      setDownloadingPdf(true);
      const res = await api.get('/dashboard/report-dueno/pdf', { responseType: 'arraybuffer' });
      const bytes = new Uint8Array(res.data || []);
      if (!bytes.length) {
        throw new Error('El PDF llegó vacío.');
      }
      const header = String.fromCharCode(...bytes.slice(0, 5));
      if (header !== '%PDF-') {
        throw new Error('La respuesta no es un PDF válido.');
      }
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = `reporte-mascota-${usuario?.nombre || 'pawspa'}.pdf`;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      window.setTimeout(() => window.URL.revokeObjectURL(url), 60000);
      toast.success('PDF descargado ✅');
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'No se pudo descargar el PDF');
    } finally {
      setDownloadingPdf(false);
    }
  };

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
              { icon:'💰', value: `Bs. ${stats.ingresosDelMes}`, label:'Ingresos del mes', color:'rgba(92,219,149,0.15)' },
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
          <div className="card" style={{marginTop:16}}>
            <h3 style={{fontFamily:'Sora,sans-serif',marginBottom:12}}>📣 Alertas</h3>
            <div style={{display:'grid',gap:8}}>
              {[
                { key: 'prodBajo', title: 'Bajo stock de productos', count: stats.productosStockBajo?.length || 0, badge: stats.productosStockBajo?.length ? 'badge-red' : 'badge-green' },
                { key: 'insumosBajo', title: 'Bajo stock de insumos técnicos', count: stats.insumosStockBajo?.length || 0, badge: stats.insumosStockBajo?.length ? 'badge-red' : 'badge-green' },
                { key: 'altoConsumo', title: 'Alto consumo', count: ((stats.altoConsumo?.productos?.length || 0) + (stats.altoConsumo?.groomers?.length || 0)), badge: (stats.altoConsumo?.productos?.length || stats.altoConsumo?.groomers?.length) ? 'badge-yellow' : 'badge-green' },
                { key: 'reabastecer', title: 'Reabastecimiento', count: stats.recomendacionesReabastecimiento?.length || 0, badge: stats.recomendacionesReabastecimiento?.length ? 'badge-blue' : 'badge-green' }
              ].map(item => (
                <div key={item.key} style={{border:'1px solid var(--border)',borderRadius:6,overflow:'hidden'}}>
                  <div
                    onClick={() => setOpenAlert(openAlert === item.key ? null : item.key)}
                    style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:10,cursor:'pointer',background: openAlert===item.key ? 'rgba(0,0,0,0.02)' : 'transparent'}}
                  >
                    <div>
                      <strong>{item.title}</strong>
                      <div style={{fontSize:'0.85rem',color:'var(--text-muted)'}}>
                        {item.count ? `${item.count} elemento(s)` : 'Sin novedad'}
                      </div>
                    </div>
                    <div><span className={`badge ${item.badge}`}>{item.count ? (item.key==='reabastecer' ? 'Acción' : item.key==='altoConsumo' ? 'Atención' : 'Revisar') : 'Sin novedad'}</span></div>
                  </div>
                  {openAlert === item.key && (
                    <div style={{padding:10,borderTop:'1px solid var(--border)',background:'var(--bg-secondary)'}}>
                      {item.key === 'prodBajo' && (
                        <div className="table-wrapper"><table><thead><tr><th>Producto</th><th>Stock actual</th><th>Stock mínimo</th></tr></thead><tbody>
                          {stats.productosStockBajo?.map(p => (
                            <tr key={p.id}><td>{p.nombre}</td><td><span className="badge badge-red">{p.stock_actual}</span></td><td>{p.stock_minimo}</td></tr>
                          ))}
                        </tbody></table></div>
                      )}
                      {item.key === 'insumosBajo' && (
                        <div className="table-wrapper"><table><thead><tr><th>Insumo</th><th>Stock actual</th><th>Stock mínimo</th></tr></thead><tbody>
                          {stats.insumosStockBajo?.map(p => (
                            <tr key={p.id}><td>{p.nombre}</td><td><span className="badge badge-red">{p.stock_actual}</span></td><td>{p.stock_minimo}</td></tr>
                          ))}
                        </tbody></table></div>
                      )}
                      {item.key === 'altoConsumo' && (
                        <div>
                          {stats.altoConsumo?.productos?.length > 0 && (
                            <div style={{marginBottom:8}}>
                              <div style={{fontWeight:700}}>Productos con mayor consumo (30d)</div>
                              <div className="table-wrapper"><table><thead><tr><th>Producto</th><th>Consumo 30d</th><th>Stock actual</th></tr></thead><tbody>
                                {stats.altoConsumo.products?.length ? stats.altoConsumo.products.map(p=> (
                                  <tr key={p.id}><td>{p.nombre}</td><td>{p.consumo_30d}</td><td>{p.stock_actual}</td></tr>
                                )) : stats.altoConsumo?.productos?.map(p=> (
                                  <tr key={p.id}><td>{p.nombre}</td><td>{p.consumo_30d}</td><td>{p.stock_actual}</td></tr>
                                ))}
                              </tbody></table></div>
                            </div>
                          )}
                          {stats.altoConsumo?.groomers?.length > 0 && (
                            <div>
                              <div style={{fontWeight:700}}>Groomers con mayor consumo (30d)</div>
                              <div className="table-wrapper"><table><thead><tr><th>Groomer</th><th>Consumo 30d</th></tr></thead><tbody>
                                {stats.altoConsumo.groomers.map(g => (
                                  <tr key={g.groomer_id}><td>{g.nombre}</td><td>{g.consumo_30d}</td></tr>
                                ))}
                              </tbody></table></div>
                            </div>
                          )}
                        </div>
                      )}
                      {item.key === 'reabastecer' && (
                        <div className="table-wrapper"><table><thead><tr><th>Producto</th><th>Stock actual</th><th>Stock mínimo</th><th>Sugerido</th></tr></thead><tbody>
                          {stats.recomendacionesReabastecimiento?.map(r => (
                            <tr key={r.id}><td>{r.nombre}</td><td>{r.stock_actual}</td><td>{r.stock_minimo}</td><td>{r.sugerido_cantidad}</td></tr>
                          ))}
                        </tbody></table></div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
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
          <div className="card" style={{marginTop:16}}>
            <h3 style={{fontFamily:'Sora,sans-serif',marginBottom:12}}>📣 Alertas</h3>
            <div style={{display:'grid',gap:8}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:10,border:'1px solid var(--border)',borderRadius:6}}>
                <div><strong>Bajo stock de insumos técnicos</strong><div style={{fontSize:'0.85rem',color:'var(--text-muted)'}}>{stats.insumosStockBajo?.length ? `${stats.insumosStockBajo.length} insumo(s) en riesgo` : 'Sin novedad'}</div></div>
                <div>{stats.insumosStockBajo?.length ? <span className="badge badge-red">Revisar</span> : <span className="badge badge-green">Sin novedad</span>}</div>
              </div>

              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:10,border:'1px solid var(--border)',borderRadius:6}}>
                <div><strong>Reabastecimiento</strong><div style={{fontSize:'0.85rem',color:'var(--text-muted)'}}>{stats.recomendacionesReabastecimiento?.length ? `${stats.recomendacionesReabastecimiento.length} recomendación(es)` : 'Sin novedad'}</div></div>
                <div>{stats.recomendacionesReabastecimiento?.length ? <span className="badge badge-blue">Acción</span> : <span className="badge badge-green">Sin novedad</span>}</div>
              </div>
            </div>
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
            {!stats.agendaHoy?.length ? (
              <div className="empty-state"><div className="empty-state-icon">✅</div>No tienes citas programadas hoy.</div>
            ) : (
              stats.agendaHoy.map(r => {
                const inicio = new Date(r.fecha_inicio);
                const fin = r.fecha_fin ? new Date(r.fecha_fin) : null;
                const duracionMin = fin ? Math.round((fin.getTime() - inicio.getTime()) / 60000) : r.servicios?.duracion_min;

                return (
                  <div key={r.id} style={{display:'flex',gap:16,padding:'14px',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',marginBottom:10}}>
                    <div style={{textAlign:'center',minWidth:60}}>
                      <div style={{fontFamily:'Sora,sans-serif',fontWeight:700,color:'var(--brand-light)'}}>{inicio.toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'})}</div>
                      <div style={{fontSize:'0.72rem',color:'var(--text-muted)'}}>{duracionMin} min</div>
                    </div>
                    <div>
                      <div style={{fontWeight:600}}>{r.mascotas?.nombre} <span style={{color:'var(--text-muted)',fontSize:'0.82rem'}}>({r.mascotas?.raza})</span></div>
                      <div style={{fontSize:'0.85rem',color:'var(--text-muted)'}}>{r.servicios?.nombre}</div>
                    </div>
                    <div style={{marginLeft:'auto'}}><span className={estadoBadge(r.estado)}>{r.estado}</span></div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* ── CLIENTE ── */}
      {esCliente && stats && (
        <>
          {stats.reporteDueno && (
            <div className="card" style={{ marginBottom: 20, padding: 16, border: '1px solid rgba(196,149,106,0.18)', background: 'linear-gradient(180deg, rgba(26,24,38,0.98), rgba(33,30,48,0.98))', boxShadow: '0 18px 40px rgba(0,0,0,0.18)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div>
                  <h3 style={{ margin: 0, fontFamily: 'Sora,sans-serif' }}>📋 Reporte de tu mascota</h3>
                  <p style={{ margin: '6px 0 0', color: 'var(--text-muted)' }}>Historial clínico y estético, galería de evolución y beneficios acumulados.</p>
                </div>
                <button className="btn btn-primary" onClick={descargarReportePdf} disabled={downloadingPdf}>
                  {downloadingPdf ? 'Generando PDF...' : 'Descargar PDF'}
                </button>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ padding: '8px 12px', borderRadius: 999, background: 'rgba(97,175,239,0.10)', border: '1px solid rgba(97,175,239,0.18)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Servicios completados</div>
                    <div style={{ fontWeight: 800 }}>{stats.reporteDueno.resumen?.servicios_completados || 0}</div>
                  </div>
                  <div style={{ padding: '8px 12px', borderRadius: 999, background: 'rgba(196,149,106,0.10)', border: '1px solid rgba(196,149,106,0.18)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Puntos</div>
                    <div style={{ fontWeight: 800 }}>{stats.reporteDueno.estado_puntos_promociones?.puntos_fidelidad || 0}</div>
                  </div>
                  <div style={{ padding: '8px 12px', borderRadius: 999, background: 'rgba(92,219,149,0.10)', border: '1px solid rgba(92,219,149,0.18)' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Nivel</div>
                    <div style={{ fontWeight: 800 }}>{stats.reporteDueno.estado_puntos_promociones?.nivel || 'Cliente'}</div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 0.9fr', gap: 16, marginTop: 18 }}>
                <div className="card" style={{ margin: 0, padding: 14, background: 'linear-gradient(180deg, rgba(26,24,38,0.96), rgba(33,30,48,0.96))', borderColor: 'rgba(61,56,96,0.9)' }}>
                  <h4 style={{ margin: '0 0 10px 0', fontFamily: 'Sora,sans-serif' }}>Historial clínico y estético</h4>
                  {!stats.reporteDueno.historial_clinico_estetico?.length ? (
                    <div className="empty-state" style={{ minHeight: 160 }}>Aún no hay servicios completados para mostrar.</div>
                  ) : (
                    <div style={{ display: 'grid', gap: 10, maxHeight: 360, overflow: 'auto', paddingRight: 4 }}>
                      {stats.reporteDueno.historial_clinico_estetico.map((item) => (
                        <div key={item.id} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12, background: 'rgba(33,30,48,0.92)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                            <div>
                              <div style={{ fontWeight: 700 }}>{item.servicios?.nombre || 'Servicio'}</div>
                              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                {item.mascotas?.nombre || 'Mascota'} · {new Date(item.fecha_inicio).toLocaleDateString('es-PE')}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                              <div>{item.groomers?.usuarios ? `${item.groomers.usuarios.nombre} ${item.groomers.usuarios.apellido}`.trim() : 'Groomer'}</div>
                              <div style={{ fontWeight: 700 }}>{item.precio_acordado ? `Bs. ${item.precio_acordado}` : '—'}</div>
                            </div>
                          </div>

                          {item.ficha_grooming?.observaciones_fin && (
                            <div style={{ marginTop: 10 }}>
                              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 4 }}>Resultado</div>
                              <div style={{ color: 'var(--text-muted)' }}>{item.ficha_grooming.observaciones_fin}</div>
                            </div>
                          )}

                          {item.ficha_grooming?.recomendaciones && (
                            <div style={{ marginTop: 10 }}>
                              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: 4 }}>Recomendaciones del groomer</div>
                              <div style={{ color: 'var(--text-muted)' }}>{item.ficha_grooming.recomendaciones}</div>
                            </div>
                          )}

                          {!!item.fotos_servicio?.length && (
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                              {item.fotos_servicio.slice(0, 3).map((foto) => (
                                <div key={foto.id} style={{ width: 74, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
                                  <img src={foto.url} alt={foto.descripcion || foto.tipo || 'Foto del servicio'} style={{ width: '100%', height: 56, objectFit: 'cover', display: 'block' }} />
                                  <div style={{ padding: '4px 6px', fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{foto.tipo || 'foto'}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="card" style={{ margin: 0, padding: 14, background: 'linear-gradient(180deg, rgba(26,24,38,0.96), rgba(33,30,48,0.96))', borderColor: 'rgba(61,56,96,0.9)' }}>
                  <h4 style={{ margin: '0 0 10px 0', fontFamily: 'Sora,sans-serif' }}>Galería de evolución</h4>
                  {!stats.reporteDueno.galeria_evolucion?.length ? (
                    <div className="empty-state" style={{ minHeight: 160 }}>No hay fotos antes/después registradas todavía.</div>
                  ) : (
                    <div style={{ display: 'grid', gap: 12, maxHeight: 360, overflow: 'auto', paddingRight: 4 }}>
                      {stats.reporteDueno.galeria_evolucion.map((item) => (
                        <div key={item.id} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12, background: 'rgba(33,30,48,0.92)' }}>
                          <div style={{ fontWeight: 700 }}>{item.mascota?.nombre || 'Mascota'}</div>
                          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 10 }}>
                            {item.servicio?.nombre || 'Servicio'} · {new Date(item.fecha_inicio).toLocaleDateString('es-PE')}
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            <div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Antes</div>
                              {item.antes ? (
                                <img src={item.antes.url} alt={item.antes.descripcion || 'Antes'} style={{ width: '100%', height: 110, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--border)' }} />
                              ) : (
                                <div style={{ height: 110, borderRadius: 10, border: '1px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Sin foto</div>
                              )}
                            </div>
                            <div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Después</div>
                              {item.despues ? (
                                <img src={item.despues.url} alt={item.despues.descripcion || 'Después'} style={{ width: '100%', height: 110, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--border)' }} />
                              ) : (
                                <div style={{ height: 110, borderRadius: 10, border: '1px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Sin foto</div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="card" style={{ margin: 0, padding: 14, background: 'linear-gradient(180deg, rgba(26,24,38,0.96), rgba(33,30,48,0.96))', borderColor: 'rgba(61,56,96,0.9)' }}>
                  <h4 style={{ margin: '0 0 10px 0', fontFamily: 'Sora,sans-serif' }}>Estado de puntos o promociones</h4>
                  <div style={{ display: 'grid', gap: 10 }}>
                    <div style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 12, background: 'rgba(33,30,48,0.92)' }}>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Puntos de fidelidad</div>
                      <div style={{ fontSize: '1.6rem', fontWeight: 800 }}>{stats.reporteDueno.estado_puntos_promociones?.puntos_fidelidad || 0}</div>
                    </div>
                    <div style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 12, background: 'rgba(33,30,48,0.92)' }}>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Nivel de cliente frecuente</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{stats.reporteDueno.estado_puntos_promociones?.nivel || 'Cliente'}</div>
                      <div style={{ marginTop: 6, color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                        {stats.reporteDueno.estado_puntos_promociones?.beneficio?.descripcion || 'Sigue acumulando servicios para desbloquear beneficios.'}
                      </div>
                    </div>
                    <div style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 12, background: 'rgba(33,30,48,0.92)' }}>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Promociones activas</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{stats.reporteDueno.estado_puntos_promociones?.promociones_temporales?.length || 0}</div>
                      <div style={{ marginTop: 6, color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                        {stats.reporteDueno.estado_puntos_promociones?.cupones?.length ? `${stats.reporteDueno.estado_puntos_promociones.cupones.length} cupón(es) disponible(s)` : 'No tienes cupones activos por ahora.'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {stats.cupones?.length ? (
            <div className="card" style={{marginBottom:20,padding:18,border:'1px solid rgba(196,149,106,0.35)',background:'linear-gradient(135deg, rgba(255,248,225,0.95), rgba(255,255,255,0.98))'}}>
              <div style={{display:'flex',justifyContent:'space-between',gap:16,alignItems:'center',flexWrap:'wrap'}}>
                <div>
                  <div style={{fontSize:'0.82rem',letterSpacing:'0.08em',textTransform:'uppercase',color:'var(--text-muted)',marginBottom:4}}>Cupón destacado</div>
                  <h3 style={{margin:'0 0 6px 0',fontFamily:'Sora,sans-serif'}}>🎟️ {stats.cupones[0].nombre}</h3>
                  <div style={{fontSize:'0.95rem',color:'var(--text-muted)'}}>{stats.cupones[0].descripcion || 'Descuento disponible para tu próxima compra en tienda.'}</div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:'0.82rem',color:'var(--text-muted)',marginBottom:6}}>Presenta o copia este código</div>
                  <div style={{display:'inline-flex',alignItems:'center',gap:10,background:'rgba(255,255,255,0.9)',border:'1px solid var(--border)',borderRadius:12,padding:'10px 12px'}}>
                    <code style={{fontSize:'1.15rem',fontWeight:800,letterSpacing:'0.08em',background:'transparent'}}>{stats.cupones[0].codigo}</code>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        navigator.clipboard?.writeText(stats.cupones[0].codigo);
                        toast.success('Código copiado ✅');
                      }}
                    >
                      Copiar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <div className="card" style={{marginBottom:20,borderLeft:'4px solid var(--brand-light)',padding:16}}>
            <h3 style={{margin:0,fontFamily:'Sora,sans-serif'}}>🎉 Promociones para ti</h3>
            <p style={{margin:'6px 0 12px',color:'var(--text-muted)'}}>Aprovecha descuentos y cupones exclusivos.</p>

            <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
              {stats.promocionesTemporales?.length ? stats.promocionesTemporales.map(p => (
                <div key={p.id} style={{minWidth:200,flex:'0 0 220px',background:'linear-gradient(90deg,#fff7ed,#fffef6)',border:'1px solid #fde3b7',padding:12,borderRadius:8}}>
                  <div style={{fontWeight:700}}>{p.nombre}</div>
                  <div style={{fontSize:'0.85rem',color:'var(--text-muted)',marginBottom:8}}>{p.descripcion || (p.tipo === 'porcentaje' ? `${p.valor}% off` : `S/ ${p.valor}`)}</div>
                  {p.codigo && <div style={{marginBottom:8}}><strong>Código:</strong> <code style={{background:'transparent',padding:'2px 6px',borderRadius:4}}>{p.codigo}</code></div>}
                  <div style={{display:'flex',gap:8}}>
                    <button className="btn btn-primary" onClick={() => window.location.href = `/tienda?coupon=${encodeURIComponent(p.codigo || '')}`} >Ver tienda</button>
                    {p.codigo && <button className="btn btn-tertiary" onClick={() => { navigator.clipboard?.writeText(p.codigo); alert('Código copiado: ' + p.codigo); }}>Copiar</button>}
                  </div>
                </div>
              )) : (
                <div style={{color:'var(--text-muted)'}}>No hay promociones activas por ahora.</div>
              )}
            </div>
          </div>

          <div className="card" style={{marginBottom:20,padding:16}}>
            <h3 style={{margin:0}}>⭐ Cliente frecuente</h3>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:8}}>
              <div>
                <div style={{fontSize:'0.95rem',color:'var(--text-muted)'}}>Tu nivel</div>
                <div style={{fontWeight:700,fontSize:'1.1rem'}}>{stats.clienteFrecuente?.nivel}</div>
                <div style={{fontSize:'0.85rem',color:'var(--text-muted)',marginTop:6}}>Servicios completados: <strong>{stats.clienteFrecuente?.completadas || 0}</strong></div>
              </div>
              <div style={{textAlign:'right'}}>
                {stats.clienteFrecuente?.beneficio ? (
                  <div style={{padding:10,background:'var(--bg-input)',borderRadius:8,border:'1px solid var(--border)'}}>
                    <div style={{fontSize:'0.85rem',color:'var(--text-muted)'}}>Beneficio</div>
                    <div style={{fontWeight:700}}>{stats.clienteFrecuente.beneficio.descripcion}</div>
                  </div>
                ) : (
                  <div style={{color:'var(--text-muted)'}}>Sigue acumulando servicios para obtener beneficios.</div>
                )}
              </div>
            </div>
          </div>

          <div className="card" style={{marginBottom:20,padding:16}}>
            <h3 style={{margin:0}}>🎟️ Cupones</h3>
            <p style={{margin:'6px 0 12px',color:'var(--text-muted)'}}>Aplica códigos en la tienda al pagar.</p>
            {stats.cupones?.length ? (
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {stats.cupones.map(c => (
                  <div key={c.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:10,border:'1px solid var(--border)',borderRadius:8}}>
                    <div>
                      <div style={{fontWeight:600}}>{c.nombre}</div>
                      <div style={{fontSize:'0.85rem',color:'var(--text-muted)'}}>{c.codigo} — {c.tipo === 'porcentaje' ? `${c.valor}%` : `S/ ${c.valor}`}</div>
                    </div>
                    <div style={{display:'flex',gap:8}}>
                      <button className="btn btn-tertiary" onClick={() => { navigator.clipboard?.writeText(c.codigo); alert('Cupón copiado: ' + c.codigo); }}>Copiar código</button>
                      <button className="btn btn-primary" onClick={() => window.location.href = `/tienda?coupon=${encodeURIComponent(c.codigo)}`}>Usar ahora</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{color:'var(--text-muted)'}}>No tienes cupones disponibles.</div>
            )}
          </div>
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
