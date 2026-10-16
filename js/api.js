/**
 * api.js — Toda la comunicación con el servidor pasa por aquí.
 * Se envía como text/plain para que el navegador no haga una consulta
 * previa (CORS) que Apps Script no responde.
 */
const Api = {
  // ¿La URL configurada es la del servidor real? El ID de la implementación va entre /s/ y /exec.
  esServidorReal() {
    const idReal = CONFIG_APP.URL_REAL.split('/s/')[1].split('/')[0];
    return String(CONFIG_APP.URL_SERVIDOR || '').indexOf(idReal) >= 0;
  },

  // Explica por qué no se puede llamar al servidor, o devuelve '' si todo está bien.
  problemaConfig() {
    const c = CONFIG_APP;
    const url = String(c.URL_SERVIDOR || '');
    if (url.indexOf('/exec') < 0) {
      return c.ES_PRODUCCION
        ? 'Falta configurar la URL del servidor en js/config.js'
        : 'Falta la URL de tu servidor de pruebas en js/config.local.js (cópialo de js/config.local.ejemplo.js).';
    }
    if (!c.ES_PRODUCCION && Api.esServidorReal() && !c.PERMITIR_SERVIDOR_REAL) {
      return 'Tu js/config.local.js apunta al servidor REAL. Pon la URL de tu servidor de pruebas.';
    }
    return '';
  },

  async llamar(accion, datos, token) {
    const problema = Api.problemaConfig();
    if (problema) throw { mensaje: problema, codigo: 'CONFIG' };
    const control = new AbortController();
    const reloj = setTimeout(() => control.abort(), CONFIG_APP.TIEMPO_ESPERA_MS);
    let respuesta;
    try {
      const r = await fetch(CONFIG_APP.URL_SERVIDOR, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ accion: accion, token: token || null, datos: datos || {} }),
        redirect: 'follow',
        signal: control.signal
      });
      respuesta = await r.json();
    } catch (e) {
      throw {
        mensaje: e.name === 'AbortError'
          ? 'El servidor tardó demasiado. Revisa tu señal e intenta de nuevo.'
          : 'No hay conexión con el servidor. Revisa tu señal.',
        codigo: 'RED'
      };
    } finally {
      clearTimeout(reloj);
    }
    if (!respuesta.ok) throw { mensaje: respuesta.error, codigo: respuesta.codigo };
    return respuesta.datos;
  }
};
