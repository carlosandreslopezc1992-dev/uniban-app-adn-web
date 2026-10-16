/**
 * app.js — Lo común a todas las pantallas: sesión, vistas, mensajes, catálogo
 * de fincas y grupos, lista con búsqueda, ingreso, cambio de contraseña, inicio
 * y salida. Cada módulo (registro.js, pendientes.js…) vive en su propio archivo
 * y usa lo de aquí a través del objeto global App.
 *
 * La sesión (token + perfil) se guarda en el celular solo hasta que vence
 * (8 horas) o hasta que el usuario sale. La contraseña NUNCA se guarda:
 * solo se mantiene en memoria el tiempo justo para cambiar la temporal.
 */
(function () {
  const LLAVE_SESION = 'adn_sesion';
  let claveEnMemoria = null; // solo durante el cambio obligatorio
  let catalogo = null;        // { fincas, grupos } de listarCatalogo, solo en memoria
  let catalogoPromesa = null;
  const ganchosInicio = [];   // módulos que quieren enterarse cuando se muestra el inicio
  const ganchosSalir = [];    // módulos que borran sus datos al cerrar sesión

  const $ = id => document.getElementById(id);
  const ROLES = {
    ADMIN: 'Administrador', ADM_OFERTA: 'Adm. de la Oferta', COMERCIAL: 'Comercial',
    GRUPO: 'Coordinador de grupo', FINCA: 'Finca', ALMACEN: 'Almacén',
    LIDER_ALMACEN: 'Líder de almacén', FABRICA: 'Fábrica de Cajas',
    LIDER_FABRICA: 'Líder Fábrica de Cajas', AUDITORIA: 'Auditoría'
  };
  const ROLES_SOLICITABLES = Object.keys(ROLES).filter(r => r !== 'ADMIN'); // ADMIN nunca se pide ni se aprueba
  const ZONAS = { URABA: 'Urabá', SM: 'Santa Marta', TODAS: 'Todas las zonas' };
  const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // la misma regla que usa el servidor
  const necesitaCodigo = rol => rol === 'FINCA' || rol === 'GRUPO';

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
  // Muestra una sola vista. Busca todas las <section class="vista">, así un módulo
  // nuevo solo tiene que agregar su sección en index.html.
  function mostrar(vista) {
    document.querySelectorAll('main > .vista').forEach(v => { v.hidden = v.id !== vista; });
    window.scrollTo(0, 0);
  }
  // Recibe el id del recuadro de mensaje o el elemento mismo (tarjetas creadas desde JS).
  function aviso(id, texto, tipo) {
    const el = typeof id === 'string' ? $(id) : id;
    el.textContent = texto || '';
    el.className = 'mensaje' + (tipo ? ' mensaje--' + tipo : '');
    el.hidden = !texto;
  }
  function ocupado(boton, si, texto) {
    boton.disabled = si;
    if (si) { boton.dataset.texto = boton.textContent; boton.textContent = texto; }
    else if (boton.dataset.texto) { boton.textContent = boton.dataset.texto; }
  }
  // Crea un elemento con clase y texto. textContent (no innerHTML) evita que
  // un nombre escrito con código HTML se ejecute en la pantalla.
  function crear(etiqueta, clase, texto) {
    const e = document.createElement(etiqueta);
    if (clase) e.className = clase;
    if (texto !== undefined) e.textContent = texto;
    return e;
  }
  // Para buscar sin importar tildes ni mayúsculas: "Urabá" → "uraba".
  function normalizar(texto) {
    return String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  }
  function llenarRoles(select, elegido) {
    ROLES_SOLICITABLES.forEach(r => {
      const op = crear('option', '', ROLES[r]);
      op.value = r;
      op.selected = r === elegido;
      select.appendChild(op);
    });
  }

  function irAInicio(s) {
    $('inicio-nombre').textContent = s.perfil.nombre;
    $('inicio-rol').textContent = ROLES[s.perfil.rol] || s.perfil.rol;
    $('inicio-zona').textContent = ZONAS[s.perfil.zona] || s.perfil.zona;
    const vence = new Date(s.exp).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    $('inicio-sesion').textContent = 'Sesión activa hasta las ' + vence;
    aviso('inicio-mensaje', '');
    mostrar('vista-inicio');
    ganchosInicio.forEach(fn => fn(s)); // cada módulo muestra sus botones según el rol
  }
  // Para los botones "Volver" y "Cancelar": al inicio si hay sesión, si no al ingreso.
  function volverAInicio() {
    const s = leerSesion();
    s ? irAInicio(s) : mostrar('vista-login');
  }

  function irACambioClave(obligatorio) {
    $('form-clave').reset();
    aviso('clave-mensaje', '');
    reglasClave();
    $('bloque-actual').hidden = obligatorio;
    $('clave-cancelar').hidden = obligatorio;
    $('clave-titulo').textContent = obligatorio ? 'Crea tu contraseña' : 'Cambia tu contraseña';
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

  // ---------- Reglas de contraseña (cambio de contraseña y registro) ----------
  function evaluarReglas(idNueva, idConfirmar, idLista) {
    const n = $(idNueva).value;
    const c = $(idConfirmar).value;
    const reglas = {
      largo: n.length >= 8,
      letra: /[A-Za-z]/.test(n),
      numero: /[0-9]/.test(n),
      igual: n.length > 0 && n === c
    };
    document.querySelectorAll('#' + idLista + ' li').forEach(li => {
      li.classList.toggle('cumple', reglas[li.dataset.regla]);
    });
    return Object.values(reglas).every(Boolean);
  }
  const reglasClave = () => evaluarReglas('clave-nueva', 'clave-confirmar', 'reglas');

  // ---------- Cambio de contraseña ----------
  $('clave-nueva').addEventListener('input', reglasClave);
  $('clave-confirmar').addEventListener('input', reglasClave);

  $('form-clave').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (!reglasClave()) { aviso('clave-mensaje', 'Revisa que la contraseña cumpla todas las reglas.'); return; }
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

  $('clave-cancelar').addEventListener('click', volverAInicio);

  // ---------- Inicio ----------
  $('inicio-cambiar-clave').addEventListener('click', () => irACambioClave(false));

  $('inicio-salir').addEventListener('click', async () => {
    const s = leerSesion();
    borrarSesion();
    claveEnMemoria = null;
    ganchosSalir.forEach(fn => fn()); // cada módulo borra lo que tenga en memoria
    mostrar('vista-login');
    if (s) { try { await Api.llamar('cerrarSesion', { dispositivo: dispositivo() }, s.token); } catch (e) { /* sin red: igual sale */ } }
  });

  // ---------- Catálogo de fincas y grupos ----------
  // Se pide una sola vez por visita. Si falla, se borra la promesa para reintentar.
  function cargarCatalogo() {
    if (!catalogoPromesa) {
      catalogoPromesa = Api.llamar('listarCatalogo')
        .then(d => (catalogo = d))
        .catch(err => { catalogoPromesa = null; throw err; });
    }
    return catalogoPromesa;
  }
  // Para que la próxima vez se pida de nuevo (por ejemplo, después de crear una finca).
  function olvidarCatalogo() {
    catalogo = null;
    catalogoPromesa = null;
  }
  // Fincas (rol FINCA) o grupos (rol GRUPO) de la zona. null = la lista aún no llega.
  function opcionesCatalogo(rol, zona) {
    if (!catalogo) return null;
    const lista = rol === 'FINCA' ? catalogo.fincas : rol === 'GRUPO' ? catalogo.grupos : [];
    if (!zona || zona === 'TODAS') return lista;
    return lista.filter(x => normalizar(x.zona) === normalizar(zona) || normalizar(x.zona) === 'todas');
  }
  function textoOpcion(op) {
    return op.nombre && op.nombre !== op.cod ? op.nombre + ' (' + op.cod + ')' : op.cod;
  }
  function nombreCatalogo(rol, cod) {
    if (!necesitaCodigo(rol) || !cod || cod === 'TODAS') return 'No aplica';
    const lista = catalogo ? (rol === 'FINCA' ? catalogo.fincas : catalogo.grupos) : [];
    return textoOpcion(lista.find(x => x.cod === cod) || { cod: cod });
  }

  /**
   * Lista con búsqueda: al escribir muestra hasta 8 coincidencias por nombre o código.
   * El código elegido queda en input.dataset.cod ('' mientras no se elija uno).
   * obtenerOpciones() devuelve la lista ya filtrada por rol y zona.
   */
  function crearBuscador(input, lista, obtenerOpciones) {
    function cerrar() { lista.hidden = true; lista.replaceChildren(); }
    function elegir(op) {
      input.dataset.cod = op.cod;
      input.value = textoOpcion(op);
      cerrar();
    }
    function abrir() {
      const opciones = obtenerOpciones();
      lista.replaceChildren();
      if (!opciones) {
        lista.appendChild(crear('li', 'buscador__vacio', 'Cargando la lista…'));
      } else {
        const texto = normalizar(input.dataset.cod ? '' : input.value);
        const coinciden = opciones.filter(op => normalizar(op.nombre + ' ' + op.cod).includes(texto)).slice(0, 8);
        if (!coinciden.length) lista.appendChild(crear('li', 'buscador__vacio', 'Sin resultados'));
        coinciden.forEach(op => {
          const b = crear('button', 'buscador__opcion', textoOpcion(op));
          b.type = 'button';
          b.addEventListener('mousedown', ev => ev.preventDefault()); // que el campo no pierda el foco antes del clic
          b.addEventListener('click', () => elegir(op));
          const li = crear('li');
          li.appendChild(b);
          lista.appendChild(li);
        });
      }
      lista.hidden = false;
    }
    input.addEventListener('input', () => { input.dataset.cod = ''; abrir(); });
    input.addEventListener('focus', abrir);
    input.addEventListener('blur', cerrar);
    return {
      elegir: elegir,
      limpiar() { input.value = ''; input.dataset.cod = ''; cerrar(); },
      // Si la elección ya no corresponde al rol o la zona, se borra.
      revisar(opciones) {
        const cod = input.dataset.cod;
        if (cod && opciones && !opciones.some(op => op.cod === cod)) this.limpiar();
      }
    };
  }

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

  // ---------- Lo que comparten los módulos ----------
  window.App = {
    $, ROLES, ROLES_SOLICITABLES, ZONAS, CORREO_VALIDO, necesitaCodigo,
    leerSesion, dispositivo, mostrar, aviso, ocupado, crear, normalizar, llenarRoles,
    manejarError, evaluarReglas, irAInicio, volverAInicio,
    cargarCatalogo, olvidarCatalogo, opcionesCatalogo, textoOpcion, nombreCatalogo, crearBuscador,
    alEntrarInicio: fn => ganchosInicio.push(fn),
    alSalir: fn => ganchosSalir.push(fn)
  };

  // ---------- Entorno ----------
  // Fuera de GitHub Pages, la barra dice a qué servidor habla la app, para no confundir
  // la pestaña de pruebas con la real. En producción la etiqueta queda oculta.
  function mostrarEntorno() {
    if (CONFIG_APP.ES_PRODUCCION) return;
    const real = Api.esServidorReal();
    const problema = Api.problemaConfig();
    const e = $('entorno');
    e.textContent = problema ? (real ? 'REAL BLOQUEADO' : 'SIN SERVIDOR') : real ? 'SERVIDOR REAL' : 'PRUEBAS';
    if (problema || real) e.classList.add('barra__entorno--alerta');
    e.title = problema || CONFIG_APP.URL_SERVIDOR;
    e.hidden = false;
  }

  // ---------- Arranque ----------
  // DOMContentLoaded llega cuando ya se cargaron TODOS los scripts de index.html,
  // así los módulos ya se engancharon con alEntrarInicio antes de mostrar el inicio.
  document.addEventListener('DOMContentLoaded', () => {
    $('version').textContent = CONFIG_APP.VERSION;
    mostrarEntorno();
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
  });
})();
