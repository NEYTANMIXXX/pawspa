// ============================================================
// PawSpa — Selector de Método de Pago
// ============================================================
import React, { useState } from 'react';
import QRCode from 'qrcode.react';
import toast from 'react-hot-toast';
import api from '../utils/api';

export default function PaymentMethodSelector({ slotId, monto, onPaymentSuccess, onClose }) {
  const [metodo, setMetodo] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePago = async () => {
    if (!metodo) {
      toast.error('Selecciona un método de pago.');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/reservas/pagos', {
        slot_id: slotId,
        monto,
        tipo_pago: metodo,
        notas: `Pago registrado vía ${metodo}`
      });

      toast.success('Pago registrado exitosamente ✅');
      onPaymentSuccess(response.data.data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al registrar pago.');
    } finally {
      setLoading(false);
    }
  };

  const codigoQR = `PAWSPA-PAGO-${slotId.slice(0, 8).toUpperCase()}`;

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 500 }}>
        <div className="modal-header">
          <span className="modal-title">💳 Método de Pago</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div style={{ marginBottom: 24 }}>
            <p style={{ color: 'var(--text-muted)', marginBottom: 12 }}>
              <strong>Monto total:</strong> S/ {monto.toFixed(2)}
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* Opción: Efectivo */}
              <div
                onClick={() => setMetodo('efectivo')}
                style={{
                  padding: 16,
                  border: `2px solid ${metodo === 'efectivo' ? 'var(--primary)' : 'var(--border)'}`,
                  borderRadius: 8,
                  cursor: 'pointer',
                  backgroundColor: metodo === 'efectivo' ? 'rgba(var(--primary-rgb), 0.1)' : 'transparent',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ fontSize: '2rem', marginBottom: 8 }}>💵</div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Efectivo</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Paga en la tienda
                </div>
              </div>

              {/* Opción: QR */}
              <div
                onClick={() => setMetodo('qr')}
                style={{
                  padding: 16,
                  border: `2px solid ${metodo === 'qr' ? 'var(--primary)' : 'var(--border)'}`,
                  borderRadius: 8,
                  cursor: 'pointer',
                  backgroundColor: metodo === 'qr' ? 'rgba(var(--primary-rgb), 0.1)' : 'transparent',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ fontSize: '2rem', marginBottom: 8 }}>📱</div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>QR</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Escanea el código
                </div>
              </div>
            </div>
          </div>

          {/* Mostrar detalles según método */}
          {metodo === 'efectivo' && (
            <div
              style={{
                padding: 16,
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderLeft: '4px solid var(--primary)',
                borderRadius: 4,
                marginBottom: 16
              }}
            >
              <p style={{ margin: 0, lineHeight: 1.6 }}>
                <strong>📍 Pago en tienda</strong>
                <br />
                Presenta tu cita confirmada en nuestro local y efectúa el pago en caja. El groomer iniciará tu servicio una vez confirmado el pago.
              </p>
            </div>
          )}

          {metodo === 'qr' && (
            <div
              style={{
                padding: 16,
                backgroundColor: 'rgba(168, 85, 247, 0.1)',
                borderRadius: 8,
                marginBottom: 16,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center'
              }}
            >
              <div style={{ marginBottom: 12 }}>
                <strong>Escanea con tu billetera digital:</strong>
              </div>
              <div
                style={{
                  padding: 12,
                  backgroundColor: 'white',
                  borderRadius: 8,
                  display: 'flex',
                  justifyContent: 'center'
                }}
              >
                <QRCode
                  value={codigoQR}
                  size={200}
                  level="H"
                  includeMargin={true}
                />
              </div>
              <p style={{ marginTop: 12, fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                Código: <code>{codigoQR}</code>
              </p>
            </div>
          )}

          {metodo === 'qr' && (
            <div
              style={{
                padding: 16,
                backgroundColor: 'rgba(34, 197, 94, 0.05)',
                borderLeft: '4px solid var(--success)',
                borderRadius: 4,
                marginBottom: 16
              }}
            >
              <p style={{ margin: 0, lineHeight: 1.6, fontSize: '0.9rem' }}>
                <strong>✅ Pago inmediato</strong>
                <br />
                Tu cita se confirmará automáticamente tras completar la transacción.
              </p>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handlePago}
            disabled={!metodo || loading}
          >
            {loading ? 'Procesando...' : 'Confirmar pago'}
          </button>
        </div>
      </div>
    </div>
  );
}
