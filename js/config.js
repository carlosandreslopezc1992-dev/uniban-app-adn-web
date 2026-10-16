/**
 * config.js — Dirección del servidor, versión y tiempo de espera.
 * En GitHub Pages (producción) la app usa el servidor REAL. En cualquier otro lugar
 * (Live Server en el PC, o en el celular con la IP del PC) NUNCA lo usa: carga
 * js/config.local.js, que cada desarrollador crea con la URL de SU servidor de
 * pruebas (copiando js/config.local.ejemplo.js). Ese archivo no se sube a GitHub.
 * La URL /exec no es secreta: es la "puerta". La seguridad está en el usuario, la
 * contraseña y el token, que valida el servidor.
 */
const CONFIG_APP = {
  URL_REAL: 'https://script.google.com/macros/s/AKfycbztB0r_QSEIZXuxbMJikhTNLrEMJ5LrJU9BRmdYiTln2sglKPUPq5nn8guOk-0fjb_Vug/exec',
  ES_PRODUCCION: location.hostname === 'carlosandreslopezc1992-dev.github.io',
  URL_SERVIDOR: '',              // se llena abajo (producción) o en js/config.local.js (pruebas)
  PERMITIR_SERVIDOR_REAL: false, // solo Andrés lo activa en su config.local.js, para probar antes de publicar
  VERSION: '0.3.1',
  TIEMPO_ESPERA_MS: 45000
};

if (CONFIG_APP.ES_PRODUCCION) {
  CONFIG_APP.URL_SERVIDOR = CONFIG_APP.URL_REAL;
} else {
  // document.write carga el archivo en orden, antes de api.js. En GitHub Pages nunca se pide.
  document.write('<script src="js/config.local.js"><\/script>');
}
