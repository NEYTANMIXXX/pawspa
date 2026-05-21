// ============================================================
// PawSpa — Utilidades 2FA / TOTP
// ============================================================

const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const crypto = require('crypto');

/**
 * Genera un secret TOTP y código QR para autenticador
 */
const generarSecretTotp = async (email, nombreApp = 'PawSpa') => {
  const secret = speakeasy.generateSecret({
    name: `${nombreApp} (${email})`,
    issuer: nombreApp,
    length: 32,
  });

  const qrCode = await QRCode.toDataURL(secret.otpauth_url);

  return {
    secret: secret.base32,
    otpauth_url: secret.otpauth_url,
    qrCode,
  };
};

/**
 * Verifica un token TOTP
 */
const verificarTokenTotp = (token, secret, window = 2) => {
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token: token.toString(),
    window,
  });
};

/**
 * Genera códigos de respaldo (10 códigos de 8 caracteres)
 */
const generarCodigosRespaldo = () => {
  const codigos = [];
  for (let i = 0; i < 10; i++) {
    codigos.push(crypto.randomBytes(4).toString('hex').toUpperCase());
  }
  return codigos;
};

/**
 * Valida y usa un código de respaldo
 */
const usarCodigoRespaldo = (codigo, codigosArray) => {
  const index = codigosArray.indexOf(codigo.toUpperCase());
  if (index > -1) {
    codigosArray.splice(index, 1);
    return true;
  }
  return false;
};

module.exports = {
  generarSecretTotp,
  verificarTokenTotp,
  generarCodigosRespaldo,
  usarCodigoRespaldo,
};
