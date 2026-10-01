/**
 * api.js — Toda la comunicación con el servidor pasa por aquí.
 * Se envía como text/plain para que el navegador no haga una consulta
 * previa (CORS) que Apps Script no responde.
 */
const Api = {
  async llamar(accion, datos, token) {
    if (CONFIG_APP.URL_SERVIDOR.indexOf('/exec') < 0) {
      throw { mensaje: 'Falta configurar la URL del servidor en js/config.js', codigo: 'CONFIG' };
    }
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
