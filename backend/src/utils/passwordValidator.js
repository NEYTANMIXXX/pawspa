// ============================================================
// PawSpa — Validador de Contraseñas Seguras
// ============================================================

/**
 * Valida la complejidad de una contraseña
 * Requerimientos:
 * - Mínimo 8 caracteres
 * - Al menos 1 mayúscula
 * - Al menos 1 minúscula
 * - Al menos 1 número
 * - Al menos 1 carácter especial (!@#$%^&*)
 */
const validarComplejidad = (password) => {
  const requisitos = {
    minLength: password.length >= 8,
    mayuscula: /[A-Z]/.test(password),
    minuscula: /[a-z]/.test(password),
    numero: /\d/.test(password),
    especial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
  };

  const esValida = Object.values(requisitos).every(v => v === true);
  const cumplidos = Object.values(requisitos).filter(v => v === true).length;

  return {
    esValida,
    cumplidos,
    totalRequisitos: Object.keys(requisitos).length,
    detalles: requisitos,
    fuerza: calcularFuerza(cumplidos, password),
  };
};

/**
 * Calcula nivel de fuerza (0-100) y categoría
 */
const calcularFuerza = (cumplidos, password) => {
  let puntos = 0;

  // Base de requisitos cumplidos
  puntos += cumplidos * 15; // 0-75 pts

  // Longitud extra
  if (password.length >= 12) puntos += 15;
  if (password.length >= 16) puntos += 10;

  // Variedad de caracteres
  const tiposUnicos = new Set([
    /[a-z]/.test(password) ? 'lower' : null,
    /[A-Z]/.test(password) ? 'upper' : null,
    /\d/.test(password) ? 'digit' : null,
    /[!@#$%^&*]/.test(password) ? 'special' : null,
  ].filter(Boolean)).size;
  puntos += tiposUnicos * 5; // 0-20 pts

  puntos = Math.min(100, puntos);

  let categoria = 'Muy débil';
  if (puntos >= 80) categoria = 'Muy fuerte';
  else if (puntos >= 60) categoria = 'Fuerte';
  else if (puntos >= 40) categoria = 'Moderada';
  else if (puntos >= 20) categoria = 'Débil';

  return {
    puntos: Math.round(puntos),
    categoria,
    color: puntos >= 80 ? 'success' : puntos >= 60 ? 'success' : puntos >= 40 ? 'warning' : 'danger',
  };
};

/**
 * Obtiene mensaje de error descriptivo
 */
const obtenerMensajeError = (validacion) => {
  const { detalles } = validacion;
  const errores = [];

  if (!detalles.minLength) errores.push('Mínimo 8 caracteres');
  if (!detalles.mayuscula) errores.push('Incluye al menos 1 mayúscula (A-Z)');
  if (!detalles.minuscula) errores.push('Incluye al menos 1 minúscula (a-z)');
  if (!detalles.numero) errores.push('Incluye al menos 1 número (0-9)');
  if (!detalles.especial) errores.push('Incluye al menos 1 carácter especial (!@#$%^&*...)');

  return errores;
};

module.exports = {
  validarComplejidad,
  calcularFuerza,
  obtenerMensajeError,
};
