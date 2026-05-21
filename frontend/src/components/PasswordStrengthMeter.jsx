// ============================================================
// PawSpa — Componente: Medidor de Fuerza de Contraseña
// ============================================================
import React, { useMemo } from 'react';

export default function PasswordStrengthMeter({ password = '' }) {
  const validar = useMemo(() => {
    const requisitos = {
      minLength: password.length >= 8,
      mayuscula: /[A-Z]/.test(password),
      minuscula: /[a-z]/.test(password),
      numero: /\d/.test(password),
      especial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
    };

    const cumplidos = Object.values(requisitos).filter(v => v).length;
    const total = Object.keys(requisitos).length;

    let puntos = cumplidos * 15;
    if (password.length >= 12) puntos += 15;
    if (password.length >= 16) puntos += 10;

    puntos = Math.min(100, puntos);

    let categoria = 'Muy débil';
    let color = '#ef4444'; // danger-red
    if (puntos >= 80) {
      categoria = 'Muy fuerte';
      color = '#22c55e'; // success-green
    } else if (puntos >= 60) {
      categoria = 'Fuerte';
      color = '#16a34a'; // strong-green
    } else if (puntos >= 40) {
      categoria = 'Moderada';
      color = '#eab308'; // warning-yellow
    } else if (puntos >= 20) {
      categoria = 'Débil';
      color = '#f97316'; // orange
    }

    return {
      puntos,
      categoria,
      color,
      cumplidos,
      total,
      detalles: requisitos,
      errors: Object.entries(requisitos)
        .filter(([_, v]) => !v)
        .map(([k]) => {
          const mensajes = {
            minLength: 'Mínimo 8 caracteres',
            mayuscula: 'Incluye mayúscula (A-Z)',
            minuscula: 'Incluye minúscula (a-z)',
            numero: 'Incluye número (0-9)',
            especial: 'Incluye carácter especial (!@#$%...)',
          };
          return mensajes[k];
        }),
    };
  }, [password]);

  if (!password) return null;

  return (
    <div style={{ marginTop: '12px', marginBottom: '16px' }}>
      {/* Barra de fuerza */}
      <div
        style={{
          height: '6px',
          background: '#e5e7eb',
          borderRadius: '3px',
          overflow: 'hidden',
          marginBottom: '8px',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${validar.puntos}%`,
            background: validar.color,
            transition: 'width 0.3s ease, background-color 0.3s ease',
          }}
        />
      </div>

      {/* Texto de fuerza y puntos */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.85rem',
          marginBottom: '8px',
        }}
      >
        <span style={{ color: validar.color, fontWeight: 600 }}>
          {validar.categoria}
        </span>
        <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>
          {validar.cumplidos}/{validar.total} requisitos
        </span>
      </div>

      {/* Lista de requisitos faltantes */}
      {validar.errors.length > 0 && (
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            fontSize: '0.8rem',
            color: '#ef4444',
          }}
        >
          {validar.errors.map((error, i) => (
            <li key={i} style={{ marginBottom: '4px' }}>
              ❌ {error}
            </li>
          ))}
        </ul>
      )}

      {/* Mensaje de éxito */}
      {validar.errors.length === 0 && (
        <div style={{ fontSize: '0.8rem', color: '#22c55e' }}>
          ✅ Contraseña fuerte
        </div>
      )}
    </div>
  );
}
