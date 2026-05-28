import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

export default function AdminReportsPage() {
  const { usuario } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!usuario) return;
    void (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await api.get('/dashboard/reports');
        setData(res.data);
      } catch (err) {
        setError(err.response?.data?.error || err.message || 'Error cargando reportes');
      } finally {
        setLoading(false);
      }
    })();
  }, [usuario]);

  if (!usuario) return null;
  return (
    <div>
      <h2>Reportes Administrativos</h2>
      {loading && <p>Cargando reportes...</p>}
      {error && <div style={{ color: 'var(--danger)' }}>⚠️ {error}</div>}
      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 8 }}>
            <h3>Ventas totales (30d)</h3>
            <p><strong>Total:</strong> {data.ventas_totales?.totalIngresos ?? data.ventas_totales?.totalIngresos}</p>
            <p><strong>Servicios:</strong> {data.ventas_totales?.ingresosServicios}</p>
            <p><strong>Tienda:</strong> {data.ventas_totales?.ingresosTienda}</p>
          </div>

          <div style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 8 }}>
            <h3>Ocupación global</h3>
            <p><strong>Minutos reservados:</strong> {data.ocupacion_global?.minutosReservados}</p>
            <p><strong>Capacidad (min):</strong> {data.ocupacion_global?.capacidadMinutos}</p>
            <p><strong>% Ocupación:</strong> {data.ocupacion_global?.porcentaje}%</p>
          </div>

          <div style={{ gridColumn: '1 / -1', padding: 12, border: '1px solid var(--border)', borderRadius: 8 }}>
            <h3>Ranking de productos</h3>
            <ol>
                {(data.ranking?.productos || []).map(p => (
                  <li key={p.producto_id}>
                    {p.nombre || p.producto_id} {p.top_variante?.sku ? `(${p.top_variante.sku})` : ''} — cantidad: {p.cantidad} — ingresos: {p.ingresos}
                  </li>
                ))}
            </ol>
          </div>

          <div style={{ gridColumn: '1 / -1', padding: 12, border: '1px solid var(--border)', borderRadius: 8 }}>
            <h3>Ranking de servicios</h3>
            <ol>
              {(data.ranking?.servicios || []).map(s => (
                <li key={s.servicio_id}>{s.nombre || s.servicio_id} — cantidad: {s.cantidad} — ingresos: {s.ingresos}</li>
              ))}
            </ol>
          </div>

          <div style={{ gridColumn: '1 / -1', padding: 12, border: '1px solid var(--border)', borderRadius: 8 }}>
            <h3>Auditoría de insumos (muestra)</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr><th>Producto</th><th>Entregado</th><th>Usado</th><th>Descontado</th></tr>
              </thead>
              <tbody>
                {(data.auditoria_insumos || []).slice(0,20).map(i => (
                  <tr key={i.producto_id}>
                    <td>{i.producto_id}</td>
                    <td>{i.entregado}</td>
                    <td>{i.usado}</td>
                    <td>{i.descontado}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 8 }}>
            <h3>NPS</h3>
            <p>{data.nps === null ? 'No hay datos' : `${data.nps} (NPS)`}</p>
          </div>
        </div>
      )}
    </div>
  );
}
