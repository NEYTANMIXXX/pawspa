// ============================================================
// PawSpa — Recibo de Pago
// ============================================================
import React from 'react';

export default function PaymentReceipt({ pago, onClose }) {
  if (!pago) return null;

  const fechaPago = new Date(pago.fecha_pago).toLocaleString('es-PE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });

  const tipoMetodo = {
    efectivo: '💵 Pago en tienda',
    qr: '📱 Código QR',
    transferencia: '🏦 Transferencia bancaria',
    otros: '💳 Otro método'
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 450 }}>
        <div className="modal-header">
          <span className="modal-title">✅ Pago Confirmado</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {/* Indicador de éxito */}
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div
              style={{
                width: 80,
                height: 80,
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto',
                fontSize: '2.5rem',
                marginBottom: 16
              }}
            >
              ✅
            </div>
            <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>¡Pagado correctamente!</h2>
            <p style={{ color: 'var(--text-muted)', marginTop: 8 }}>
              Tu cita ha sido confirmada
            </p>
          </div>

          {/* Detalles del recibo */}
          <div
            style={{
              padding: 16,
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: 8,
              marginBottom: 16
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
                  Número de factura
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                  {pago.numero_factura}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
                  Fecha
                </div>
                <div style={{ fontSize: '0.95rem' }}>
                  {fechaPago}
                </div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: 12,
                  marginBottom: 8
                }}
              >
                <span>Subtotal:</span>
                <span>Bs. {pago.subtotal.toFixed(2)}</span>
              </div>
              {pago.descuento > 0 && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gap: 12,
                    marginBottom: 8,
                    color: 'var(--success)'
                  }}
                >
                  <span>Descuento:</span>
                  <span>- Bs. {pago.descuento.toFixed(2)}</span>
                </div>
              )}
              {pago.impuestos > 0 && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gap: 12,
                    marginBottom: 8
                  }}
                >
                  <span>Impuestos:</span>
                  <span>Bs. {pago.impuestos.toFixed(2)}</span>
                </div>
              )}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: 12,
                  paddingTop: 8,
                  borderTop: '1px solid var(--border)',
                  fontWeight: 700,
                  fontSize: '1.1rem'
                }}
              >
                <span>Total pagado:</span>
                <span>Bs. {pago.total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Método de pago */}
          <div
            style={{
              padding: 12,
              backgroundColor: 'rgba(59, 130, 246, 0.05)',
              borderLeft: '4px solid var(--primary)',
              borderRadius: 4,
              marginBottom: 16
            }}
          >
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 4 }}>
              Método de pago
            </div>
            <div style={{ fontWeight: 600 }}>
              {tipoMetodo[pago.tipo_pago] || pago.tipo_pago}
            </div>
          </div>

          {/* Próximos pasos */}
          <div
            style={{
              padding: 12,
              backgroundColor: 'rgba(168, 85, 247, 0.05)',
              borderRadius: 4
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 8 }}>📋 Próximos pasos:</div>
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: '0.9rem', lineHeight: 1.6 }}>
              <li>Tu cita está confirmada</li>
              <li>Recibirás un recordatorio 24 horas antes</li>
              <li>Presenta tu código de cita en la tienda</li>
            </ul>
          </div>
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="btn btn-primary"
            onClick={onClose}
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
