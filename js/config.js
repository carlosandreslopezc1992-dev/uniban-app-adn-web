/**
 * config.js — Único archivo que se edita al cambiar de servidor.
 * Pega aquí la URL de la implementación de Apps Script (termina en /exec).
 * No es secreta: es la "puerta". La seguridad está en el usuario, la
 * contraseña y el token, que valida el servidor.
 */
const CONFIG_APP = {
  URL_SERVIDOR: 'https://script.google.com/macros/s/AKfycbztB0r_QSEIZXuxbMJikhTNLrEMJ5LrJU9BRmdYiTln2sglKPUPq5nn8guOk-0fjb_Vug/exec',
  VERSION: '0.2.0',
  TIEMPO_ESPERA_MS: 45000
};
