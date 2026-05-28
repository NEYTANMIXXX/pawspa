import React, { useState } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';

const formatMoney = (v) => `Bs. ${Number(v || 0).toFixed(2)}`;

export default function CierreCajaPage() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [cierre, setCierre] = useState(null);
  const [declared, setDeclared] = useState('');

  const crearCierre = async () => {
    try {
      setLoading(true);
      const { data } = await api.post('/caja/cierres', { date });
      setCierre(data.data);
      setDeclared('');
      toast.success('Borrador de cierre creado');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error creando cierre');
    } finally { setLoading(false); }
  };

  const cerrar = async () => {
    if (!cierre) return toast.error('Primero crea el borrador');
    if (declared === '') return toast.error('Ingresa el monto declarado');
    try {
      setLoading(true);
      const { data } = await api.patch(`/caja/cierres/${cierre.id}/close`, { cierre_declarado: Number(declared), notas: '' });
      setCierre(data.data);
      toast.success('Cierre cerrado');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error cerrando caja');
    } finally { setLoading(false); }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">💼 Cierre de caja</h1>
          <p className="page-subtitle">Genera el cierre diario, revisa totales por método y cierra la caja.</p>
        </div>
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 18 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="date" className="form-control" value={date} onChange={(e) => setDate(e.target.value)} />
          <button className="btn btn-primary" onClick={crearCierre} disabled={loading}>Crear borrador</button>
        </div>
      </div>

      {cierre ? (
        <div className="card" style={{ padding: 16 }}>
          <h3 style={{ marginTop: 0 }}>Cierre {cierre.fecha}</h3>
          <div style={{ display: 'grid', gap: 8 }}>
            <div>Total ingresos: <strong>{formatMoney(cierre.total_ingresos)}</strong></div>
            <div>Total egresos: <strong>{formatMoney(cierre.total_egresos)}</strong></div>
            <div>Estado: <strong>{cierre.estado}</strong></div>
          </div>

          <div style={{ marginTop: 12 }}>
            <h4>Totales por método</h4>
            <div style={{ display: 'grid', gap: 8 }}>
              {(cierre.cierre_item || []).map((it) => (
                <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>{it.metodo_pago} ({it.cantidad_transacciones} tx)</div>
                  <div style={{ fontWeight: 800 }}>{formatMoney(it.total)}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
            <input className="form-control" placeholder="Monto declarado" value={declared} onChange={(e) => setDeclared(e.target.value)} />
            <button className="btn btn-primary" onClick={cerrar} disabled={loading}>Cerrar</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
