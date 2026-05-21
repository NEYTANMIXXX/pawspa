// ============================================================
// PawSpa — Registro de Pagos
// ============================================================
import React, { useEffect, useState, useCallback } from 'react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const estadoBadge = (e) => {
  const m = { verificado: 'badge-green', no_verificado: 'badge-yellow', cancelado: 'badge-red' };
  return `badge ${m[e] || 'badge-gray'}`;
};

const normalizarEstadoPago = (estado) => {
  if (estado === 'pagado') return 'verificado';
  if (estado === 'pendiente') return 'no_verificado';
  return estado;
};

const tipoMetodoBadge = (tipo) => {
  const m = {
    efectivo: 'badge-blue',
    qr: 'badge-purple',
    transferencia: 'badge-orange'
  };
  return `badge ${m[tipo] || 'badge-gray'}`;
};

const iconoMetodo = (tipo) => {
  const m = { efectivo: '💵', qr: '📱', transferencia: '🏦' };
  return m[tipo] || '💳';
};

export default function PagosPage() {
  const { esAdmin, esRecepcion } = useAuth();
  const [pagos, setPagos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroMetodo, setFiltroMetodo] = useState('');

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filtroEstado) {
        params.estado = filtroEstado === 'verificado'
          ? 'pagado'
          : filtroEstado === 'no_verificado'
            ? 'pendiente'
            : filtroEstado;
      }
      if (filtroMetodo) params.tipo_pago = filtroMetodo;
      const { data } = await api.get('/reservas/pagos', { params });
      setPagos((data.data || []).map(p => ({ ...p, estado: normalizarEstadoPago(p.estado) })));
    } catch (e) {
      toast.error('Error al cargar pagos');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [filtroEstado, filtroMetodo]);

  const actualizarEstado = async (pagoId, estado) => {
    try {
      await api.patch(`/reservas/pagos/${pagoId}/estado`, { estado });
      toast.success('Estado del pago actualizado ✅');
      cargar();
    } catch (e) {
      toast.error(e.response?.data?.error || 'No se pudo actualizar el estado.');
    }
  };

  useEffect(() => {
    if (esAdmin || esRecepcion) {
      cargar();
    }
  }, [cargar, esAdmin, esRecepcion]);

  if (!esAdmin && !esRecepcion) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: 16 }}>🔒</div>
        <p>No tienes permisos para acceder a esta página.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">💳 Registro de Pagos</h1>
          <p className="page-subtitle">{pagos.length} pago(s) encontrado(s)</p>
        </div>
      </div>

      <div className="search-bar">
        <select
          className="form-control"
          value={filtroEstado}
          onChange={e => setFiltroEstado(e.target.value)}
          style={{ maxWidth: 150 }}
        >
          <option value="">Todos los estados</option>
          <option value="verificado">Verificado</option>
          <option value="no_verificado">No verificado</option>
          <option value="cancelado">Cancelado</option>
        </select>

        <select
          className="form-control"
          value={filtroMetodo}
          onChange={e => setFiltroMetodo(e.target.value)}
          style={{ maxWidth: 150 }}
        >
          <option value="">Todos los métodos</option>
          <option value="efectivo">💵 Efectivo</option>
          <option value="qr">📱 QR</option>
          <option value="transferencia">🏦 Transferencia</option>
        </select>

        <button className="btn btn-secondary" onClick={cargar}>
          Actualizar
        </button>
      </div>

      {loading ? (
        <div className="flex-center" style={{ height: 200, fontSize: '2rem' }}>
          💳
        </div>
      ) : !pagos.length ? (
        <div className="empty-state">
          <div className="empty-state-icon">📭</div>
          No se encontraron pagos.
        </div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Factura</th>
                <th>Cliente</th>
                <th>Mascota / Servicio</th>
                <th>Método</th>
                <th>Monto</th>
                <th>Estado</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {pagos.map(p => (
                <tr key={p.id}>
                  <td>
                    <code style={{ fontSize: '0.8rem', padding: '2px 6px', backgroundColor: 'var(--bg-secondary)', borderRadius: 4 }}>
                      {p.numero_factura}
                    </code>
                  </td>
                  <td style={{ fontSize: '0.85rem' }}>
                    {p.clientes?.usuarios?.nombre} {p.clientes?.usuarios?.apellido}
                  </td>
                  <td style={{ fontSize: '0.85rem' }}>
                    <div>
                      <strong>{p.slot_reserva?.mascotas?.[0]?.nombre || '—'}</strong>
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      {p.slot_reserva?.servicios?.[0]?.nombre || '—'}
                    </div>
                  </td>
                  <td>
                    <span className={tipoMetodoBadge(p.tipo_pago)}>
                      {iconoMetodo(p.tipo_pago)} {p.tipo_pago}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600 }}>
                    S/ {parseFloat(p.total).toFixed(2)}
                  </td>
                  <td>
                    <select
                      className="form-control"
                      value={p.estado}
                      onChange={e => actualizarEstado(p.id, e.target.value)}
                      style={{ minWidth: 150 }}
                    >
                      <option value="verificado">Verificado</option>
                      <option value="no_verificado">No verificado</option>
                    </select>
                  </td>
                  <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {new Date(p.fecha_pago || p.creado_en).toLocaleString('es-PE', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Resumen de pagos */}
      {pagos.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginTop: 24 }}>
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 8 }}>
              Total recaudado
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>
              S/ {pagos
                .filter(p => p.estado === 'verificado')
                .reduce((sum, p) => sum + parseFloat(p.total || 0), 0)
                .toFixed(2)}
            </div>
          </div>

          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 8 }}>
              Total por QR
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>
              S/ {pagos
                .filter(p => p.tipo_pago === 'qr' && p.estado === 'verificado')
                .reduce((sum, p) => sum + parseFloat(p.total || 0), 0)
                .toFixed(2)}
            </div>
          </div>

          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 8 }}>
              Total en efectivo
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>
              S/ {pagos
                .filter(p => p.tipo_pago === 'efectivo' && p.estado === 'verificado')
                .reduce((sum, p) => sum + parseFloat(p.total || 0), 0)
                .toFixed(2)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
