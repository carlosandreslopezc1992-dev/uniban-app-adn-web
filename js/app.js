/**
 * app.js — Lógica de las pantallas: ingreso, cambio de contraseña e inicio.
 * La sesión (token + perfil) se guarda en el celular solo hasta que vence
 * (8 horas) o hasta que el usuario sale. La contraseña NUNCA se guarda:
 * solo se mantiene en memoria el tiempo justo para cambiar la temporal.
 */
(function () {
  const LLAVE_SESION = 'adn_sesion';
  let claveEnMemoria = null; // solo durante el cambio obligatorio

  const $ = id => document.getElementById(id);
  const ROLES = {
    ADMIN: 'Administrador', ADM_OFERTA: 'Adm. de la Oferta', COMERCIAL: 'Comercial',
    GRUPO: 'Coordinador de grupo', FINCA: 'Finca', ALMACEN: 'Almacén',
    LIDER_ALMACEN: 'Líder de almacén', FABRICA: 'Fábrica de Cajas',
    LIDER_FABRICA: 'Líder Fábrica de Cajas', AUDITORIA: 'Auditoría'
  };

  // ---------- Sesión ----------
  function leerSesion() {
    try {
      const s = JSON.parse(localStorage.getItem(LLAVE_SESION));
      if (s && s.exp > Date.now()) return s;
    } catch (e) { /* sin sesión */ }
    borrarSesion();
    return null;
  }
  function guardarSesion(s) {
    try { localStorage.setItem(LLAVE_SESION, JSON.stringify(s)); } catch (e) { /* modo privado */ }
  }
  function borrarSesion() {
    try { localStorage.removeItem(LLAVE_SESION); } catch (e) { /* nada */ }
  }
  function dispositivo() {
    return /Mobi|Android|iPhone/i.test(navigator.userAgent) ? 'APP_MOVIL' : 'APP_PC';
  }

  // ---------- Vistas ----------
  function mostrar(vista) {
    ['vista-login', 'vista-clave', 'vista-inicio'].forEach(v => { $(v).hidden = v !== vista; });
    window.scrollTo(0, 0);
  }
  function aviso(id, texto, tipo) {
    const el = $(id);
    el.textContent = texto || '';
    el.className = 'mensaje' + (tipo ? ' mensaje--' + tipo : '');
    el.hidden = !texto;
  }
  function ocupado(boton, si, texto) {
    boton.disabled = si;
    if (si) { boton.dataset.texto = boton.textContent; boton.textContent = texto; }
    else if (boton.dataset.texto) { boton.textContent = boton.dataset.texto; }
  }

  function irAInicio(s) {
    $('inicio-nombre').textContent = s.perfil.nombre;
    $('inicio-rol').textContent = ROLES[s.perfil.rol] || s.perfil.rol;
    $('inicio-zona').textContent = s.perfil.zona === 'TODAS' ? 'Todas las zonas' : s.perfil.zona;
    const vence = new Date(s.exp).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    $('inicio-sesion').textContent = 'Sesión activa hasta las ' + vence;
    mostrar('vista-inicio');
  }

  function irACambioClave(obligatorio) {
    $('form-clave').reset();
    aviso('clave-mensaje', '');
    evaluarReglas();
    $('bloque-actual').hidden = obligatorio;
    $('clave-cancelar').hidden = obligatorio;
    $('clave-intro').textContent = obligatorio
      ? 'Por seguridad, cambia la contraseña temporal por una que solo tú conozcas.'
      : 'Escribe tu contraseña actual y la nueva.';
    mostrar('vista-clave');
  }

  // Si el servidor dice que la sesión no sirve, se vuelve al ingreso.
  function manejarError(err, idMensaje) {
    if (err.codigo === 'SESION') {
      borrarSesion();
      mostrar('vista-login');
      aviso('login-mensaje', err.mensaje, 'info');
      return;
    }
    aviso(idMensaje, err.mensaje || 'Ocurrió un error inesperado.');
  }

  // ---------- Ingreso ----------
  $('form-login').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const usuario = $('login-usuario').value.trim();
    const clave = $('login-clave').value;
    if (!usuario || !clave) { aviso('login-mensaje', 'Escribe tu usuario y tu contraseña.'); return; }

    aviso('login-mensaje', '');
    const boton = $('login-boton');
    ocupado(boton, true, 'Validando…');
    try {
      const r = await Api.llamar('login', { usuario: usuario, clave: clave, dispositivo: dispositivo() });
      const sesion = { token: r.token, perfil: r.perfil, exp: Date.now() + r.horas * 3600 * 1000 };
      guardarSesion(sesion);
      $('login-clave').value = '';
      if (r.perfil.cambiar_clave) {
        claveEnMemoria = clave;
        irACambioClave(true);
      } else {
        irAInicio(sesion);
      }
    } catch (err) {
      manejarError(err, 'login-mensaje');
    } finally {
      ocupado(boton, false);
    }
  });

  // ---------- Cambio de contraseña ----------
  function evaluarReglas() {
    const n = $('clave-nueva').value;
    const c = $('clave-confirmar').value;
    const reglas = {
      largo: n.length >= 8,
      letra: /[A-Za-z]/.test(n),
      numero: /[0-9]/.test(n),
      igual: n.length > 0 && n === c
    };
    document.querySelectorAll('#reglas li').forEach(li => {
      li.classList.toggle('cumple', reglas[li.dataset.regla]);
    });
    return Object.values(reglas).every(Boolean);
  }
  $('clave-nueva').addEventListener('input', evaluarReglas);
  $('clave-confirmar').addEventListener('input', evaluarReglas);

  $('form-clave').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (!evaluarReglas()) { aviso('clave-mensaje', 'Revisa que la contraseña cumpla todas las reglas.'); return; }
    const sesion = leerSesion();
    if (!sesion) { mostrar('vista-login'); return; }

    const obligatorio = $('bloque-actual').hidden;
    const actual = obligatorio ? claveEnMemoria : $('clave-actual').value;
    if (!actual) { aviso('clave-mensaje', 'Escribe tu contraseña actual.'); return; }

    const boton = $('clave-boton');
    ocupado(boton, true, 'Guardando…');
    try {
      await Api.llamar('cambiarClave', { claveActual: actual, claveNueva: $('clave-nueva').value }, sesion.token);
      claveEnMemoria = null;
      sesion.perfil.cambiar_clave = false;
      guardarSesion(sesion);
      irAInicio(sesion);
    } catch (err) {
      manejarError(err, 'clave-mensaje');
    } finally {
      ocupado(boton, false);
    }
  });

  $('clave-cancelar').addEventListener('click', () => {
    const s = leerSesion();
    s ? irAInicio(s) : mostrar('vista-login');
  });

  // ---------- Inicio ----------
  $('inicio-cambiar-clave').addEventListener('click', () => irACambioClave(false));

  $('inicio-salir').addEventListener('click', async () => {
    const s = leerSesion();
    borrarSesion();
    claveEnMemoria = null;
    mostrar('vista-login');
    if (s) { try { await Api.llamar('cerrarSesion', { dispositivo: dispositivo() }, s.token); } catch (e) { /* sin red: igual sale */ } }
  });

  // ---------- Mostrar / ocultar contraseña ----------
  document.querySelectorAll('.ver-clave').forEach(b => {
    b.addEventListener('click', () => {
      const input = $(b.dataset.para);
      const ver = input.type === 'password';
      input.type = ver ? 'text' : 'password';
      b.textContent = ver ? 'Ocultar' : 'Ver';
      b.setAttribute('aria-label', ver ? 'Ocultar contraseña' : 'Mostrar contraseña');
    });
  });

  // ---------- Arranque ----------
  $('version').textContent = CONFIG_APP.VERSION;
  const s = leerSesion();
  if (s && s.perfil.cambiar_clave) {
    // La clave temporal ya no está en memoria: hay que ingresar de nuevo.
    borrarSesion();
    mostrar('vista-login');
  } else if (s) {
    irAInicio(s);
  } else {
    mostrar('vista-login');
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* la app funciona igual */ });
  }
})();
