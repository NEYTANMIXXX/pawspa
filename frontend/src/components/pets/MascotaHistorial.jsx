import React, { useEffect, useState } from 'react';
import api from '../../utils/api';

export default function MascotaHistorial({ mascotaId, onClose }) {
  const [loading, setLoading] = useState(true);
  const [historial, setHistorial] = useState([]);

  useEffect(() => {
    let mounted = true;
    const cargar = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/mascotas/${mascotaId}/historial`);
        if (!mounted) return;
        setHistorial(res.data.data || []);
      } catch (e) {
        console.error('Error cargando historial', e);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    cargar();
    return () => { mounted = false; };
  }, [mascotaId]);

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{maxWidth:720}}>
        <div className="modal-header">
          <span className="modal-title">Historial de servicios</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {loading ? (
            <div className="flex-center" style={{height:120}}>Cargando...</div>
          ) : !historial.length ? (
            <div className="empty-state">No hay servicios anteriores.</div>
          ) : (
            <div style={{display:'grid',gap:12}}>
              {historial.map(h => (
                <div key={h.id} className="card" style={{padding:12}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <div>
                      <div style={{fontWeight:700}}>{h.servicios?.nombre || '—'}</div>
                      <div style={{fontSize:12,color:'var(--text-muted)'}}>{new Date(h.fecha_inicio).toLocaleString()}</div>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <div>{h.groomers?.usuarios ? `${h.groomers.usuarios.nombre} ${h.groomers.usuarios.apellido}` : ''}</div>
                      <div style={{fontWeight:700}}>{h.precio_acordado ? `$ ${h.precio_acordado}` : '—'}</div>
                    </div>
                  </div>
                  {h.observaciones && <div style={{marginTop:8,color:'var(--text-muted)'}}>{h.observaciones}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
