/**
 * app.js — Lógica de las pantallas: ingreso, cambio de contraseña, inicio,
 * solicitud de acceso y aprobación de solicitudes (ADMIN).
 * La sesión (token + perfil) se guarda en el celular solo hasta que vence
 * (8 horas) o hasta que el usuario sale. La contraseña NUNCA se guarda:
 * solo se mantiene en memoria el tiempo justo para cambiar la temporal.
 */
(function () {
  const LLAVE_SESION = 'adn_sesion';
  let claveEnMemoria = null; // solo durante el cambio obligatorio
  let catalogo = null;        // { fincas, grupos } de listarCatalogo, solo en memoria
  let catalogoPromesa = null;
  let pendientes = [];        // solicitudes que ve el ADMIN

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
  function mostrar(vista) {
    ['vista-login', 'vista-clave', 'vista-inicio', 'vista-registro', 'vista-pendientes']
      .forEach(v => { $(v).hidden = v !== vista; });
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
    const esAdmin = s.perfil.rol === 'ADMIN';
    $('inicio-pendientes').hidden = !esAdmin;
    mostrar('vista-inicio');
    if (esAdmin) cargarPendientes(s, 'inicio-mensaje');
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
  const reglasRegistro = () => evaluarReglas('reg-clave', 'reg-confirmar', 'reg-reglas');

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
    pendientes = [];
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

  // ---------- Solicitar acceso ----------
  llenarRoles($('reg-rol'));
  const regBuscador = crearBuscador($('reg-cod'), $('reg-cod-lista'),
    () => opcionesCatalogo($('reg-rol').value, $('reg-zona').value));

  function actualizarBloqueCodigo() {
    const rol = $('reg-rol').value;
    const zona = $('reg-zona').value;
    $('reg-bloque-cod').hidden = !necesitaCodigo(rol);
    $('reg-cod-etiqueta').textContent = rol === 'GRUPO' ? 'Grupo' : 'Finca';
    $('reg-cod').disabled = !zona;
    $('reg-cod').placeholder = zona ? 'Escribe para buscar' : 'Primero elige la zona';
    regBuscador.revisar(opcionesCatalogo(rol, zona));
    if (necesitaCodigo(rol) && zona) {
      cargarCatalogo()
        .then(() => regBuscador.revisar(opcionesCatalogo(rol, zona)))
        .catch(err => aviso('registro-mensaje', err.mensaje));
    }
  }
  $('reg-rol').addEventListener('change', actualizarBloqueCodigo);
  $('reg-zona').addEventListener('change', actualizarBloqueCodigo);
  $('reg-clave').addEventListener('input', reglasRegistro);
  $('reg-confirmar').addEventListener('input', reglasRegistro);

  function irARegistro() {
    $('form-registro').reset();
    regBuscador.limpiar();
    aviso('registro-mensaje', '');
    $('registro-bloque-form').hidden = false;
    $('registro-listo').hidden = true;
    actualizarBloqueCodigo();
    reglasRegistro();
    mostrar('vista-registro');
    cargarCatalogo().catch(() => { /* se reintenta al elegir rol y zona */ });
  }

  // Las mismas reglas que revisa el servidor; aquí solo ahorran un viaje.
  function validarRegistro() {
    const rol = $('reg-rol').value;
    if (!$('reg-nombre').value.trim()) return 'Escribe tu nombre.';
    if (!CORREO_VALIDO.test($('reg-correo').value.trim())) return 'Escribe un correo válido, por ejemplo nombre@correo.com.';
    if (!$('reg-zona').value) return 'Elige tu zona.';
    if (ROLES_SOLICITABLES.indexOf(rol) < 0) return 'Elige el rol que solicitas.';
    if (necesitaCodigo(rol) && !$('reg-cod').dataset.cod) {
      return rol === 'FINCA' ? 'Elige tu finca de la lista.' : 'Elige tu grupo de la lista.';
    }
    if (!reglasRegistro()) return 'Revisa que la contraseña cumpla todas las reglas.';
    return '';
  }

  $('form-registro').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const error = validarRegistro();
    if (error) { aviso('registro-mensaje', error); return; }

    aviso('registro-mensaje', '');
    const rol = $('reg-rol').value;
    const boton = $('registro-boton');
    ocupado(boton, true, 'Enviando…');
    try {
      await Api.llamar('registrarse', {
        nombre: $('reg-nombre').value.trim(),
        correo: $('reg-correo').value.trim(),
        celular: $('reg-celular').value.trim(),
        zona: $('reg-zona').value,
        rol: rol,
        cod_finca_o_grupo: necesitaCodigo(rol) ? $('reg-cod').dataset.cod : '',
        clave: $('reg-clave').value,
        dispositivo: dispositivo()
      });
      $('form-registro').reset(); // la contraseña no queda escrita en la pantalla
      regBuscador.limpiar();
      $('registro-bloque-form').hidden = true;
      $('registro-listo').hidden = false;
      window.scrollTo(0, 0);
    } catch (err) {
      manejarError(err, 'registro-mensaje');
    } finally {
      ocupado(boton, false);
    }
  });

  $('login-registro').addEventListener('click', irARegistro);
  $('registro-volver').addEventListener('click', () => mostrar('vista-login'));
  $('registro-listo-volver').addEventListener('click', () => mostrar('vista-login'));

  // ---------- Solicitudes pendientes (ADMIN) ----------
  // Trae la lista y el catálogo (para mostrar nombres de finca/grupo; si falla, se muestran códigos).
  async function cargarPendientes(s, idMensaje) {
    $('inicio-pendientes-n').textContent = '…';
    try {
      const [lista] = await Promise.all([
        Api.llamar('listarPendientes', {}, s.token),
        cargarCatalogo().catch(() => null)
      ]);
      pendientes = lista;
      $('inicio-pendientes-n').textContent = lista.length;
      return true;
    } catch (err) {
      $('inicio-pendientes-n').textContent = '?';
      manejarError(err, idMensaje);
      return false;
    }
  }

  async function actualizarPendientes() {
    const s = leerSesion();
    if (!s) { mostrar('vista-login'); return; }
    $('pendientes-resumen').textContent = 'Cargando…';
    $('pendientes-lista').replaceChildren();
    if (await cargarPendientes(s, 'pendientes-mensaje')) pintarPendientes();
  }

  function pintarPendientes() {
    const n = pendientes.length;
    $('pendientes-resumen').textContent = n === 0 ? 'No hay solicitudes pendientes.'
      : n === 1 ? 'Hay 1 solicitud esperando tu revisión.'
      : 'Hay ' + n + ' solicitudes esperando tu revisión.';
    $('inicio-pendientes-n').textContent = n;
    $('pendientes-lista').replaceChildren(...pendientes.map(tarjetaSolicitud));
  }

  function tarjetaSolicitud(u) {
    const tarjeta = crear('article', 'tarjeta solicitud');
    tarjeta.appendChild(crear('h2', '', u.nombre));

    const fecha = u.fecha_registro
      ? new Date(u.fecha_registro).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
      : '—';
    const datos = crear('dl', 'solicitud__datos');
    [
      ['Rol', ROLES[u.rol] || u.rol],
      ['Finca o grupo', nombreCatalogo(u.rol, u.cod_finca_o_grupo)],
      ['Zona', ZONAS[u.zona] || u.zona],
      ['Correo', u.correo],
      ['Celular', u.celular || '—'],
      ['Fecha', fecha]
    ].forEach(([k, v]) => {
      datos.appendChild(crear('dt', '', k));
      datos.appendChild(crear('dd', '', String(v)));
    });
    tarjeta.appendChild(datos);

    const mensaje = crear('div', 'mensaje');
    mensaje.setAttribute('role', 'alert');
    mensaje.hidden = true;

    const panelAprobar = panelAprobacion(u, mensaje);
    const panelRechazar = panelRechazo(u, mensaje);
    const bAprobar = crear('button', 'boton', 'Aprobar');
    const bRechazar = crear('button', 'boton boton--peligro', 'Rechazar');
    bAprobar.type = bRechazar.type = 'button';
    bAprobar.addEventListener('click', () => {
      panelAprobar.hidden = !panelAprobar.hidden;
      panelRechazar.hidden = true;
      aviso(mensaje, '');
    });
    bRechazar.addEventListener('click', () => {
      panelRechazar.hidden = !panelRechazar.hidden;
      panelAprobar.hidden = true;
      aviso(mensaje, '');
    });
    const acciones = crear('div', 'solicitud__acciones');
    acciones.append(bAprobar, bRechazar);

    tarjeta.append(acciones, panelAprobar, panelRechazar, mensaje);
    return tarjeta;
  }

  // Aprobar: confirma o ajusta el rol (nunca ADMIN). Si el rol final es FINCA o
  // GRUPO pide elegir cuál; si no, se envía TODAS para no dejar un código viejo.
  function panelAprobacion(u, mensaje) {
    const id = 'ap-' + u.id_usuario;
    const panel = crear('div', 'solicitud__panel');
    panel.hidden = true;

    const lRol = crear('label', '', 'Rol que se aprueba');
    lRol.htmlFor = id + '-rol';
    const select = crear('select');
    select.id = id + '-rol';
    llenarRoles(select, u.rol);

    const bloque = crear('div');
    const lCod = crear('label');
    lCod.htmlFor = id + '-cod';
    const caja = crear('div', 'buscador');
    const input = crear('input');
    input.id = id + '-cod';
    input.autocomplete = 'off';
    input.placeholder = 'Escribe para buscar';
    const lista = crear('ul', 'buscador__lista');
    lista.hidden = true;
    caja.append(input, lista);
    bloque.append(lCod, caja);
    const buscador = crearBuscador(input, lista, () => opcionesCatalogo(select.value, u.zona));

    if (necesitaCodigo(u.rol) && u.cod_finca_o_grupo && u.cod_finca_o_grupo !== 'TODAS') {
      const lista0 = opcionesCatalogo(u.rol, u.zona) || [];
      buscador.elegir(lista0.find(op => op.cod === u.cod_finca_o_grupo) || { cod: u.cod_finca_o_grupo });
    }
    function ajustar() {
      bloque.hidden = !necesitaCodigo(select.value);
      lCod.textContent = select.value === 'GRUPO' ? 'Grupo' : 'Finca';
      buscador.revisar(opcionesCatalogo(select.value, u.zona));
    }
    select.addEventListener('change', ajustar);
    ajustar();

    const confirmar = crear('button', 'boton', 'Confirmar aprobación');
    confirmar.type = 'button';
    confirmar.addEventListener('click', () => {
      const rol = select.value;
      if (ROLES_SOLICITABLES.indexOf(rol) < 0) { aviso(mensaje, 'Elige un rol válido.'); return; }
      const cod = necesitaCodigo(rol) ? input.dataset.cod || '' : 'TODAS';
      if (!cod) { aviso(mensaje, rol === 'FINCA' ? 'Elige la finca de la lista.' : 'Elige el grupo de la lista.'); return; }
      resolver(u, 'aprobarUsuario',
        { id_usuario: u.id_usuario, rol: rol, cod_finca_o_grupo: cod, zona: u.zona },
        confirmar, mensaje, 'Aprobada: ' + u.nombre + ' ya puede ingresar como ' + ROLES[rol] + '.');
    });

    panel.append(lRol, select, bloque, confirmar);
    return panel;
  }

  // Rechazar: el motivo es obligatorio (queda en la bitácora del servidor).
  function panelRechazo(u, mensaje) {
    const id = 're-' + u.id_usuario;
    const panel = crear('div', 'solicitud__panel');
    panel.hidden = true;
    const etiqueta = crear('label', '', 'Motivo del rechazo');
    etiqueta.htmlFor = id + '-motivo';
    const motivo = crear('textarea');
    motivo.id = id + '-motivo';
    motivo.rows = 3;
    const confirmar = crear('button', 'boton boton--peligro-lleno', 'Confirmar rechazo');
    confirmar.type = 'button';
    confirmar.addEventListener('click', () => {
      const texto = motivo.value.trim();
      if (!texto) { aviso(mensaje, 'Escribe el motivo del rechazo.'); motivo.focus(); return; }
      resolver(u, 'rechazarUsuario', { id_usuario: u.id_usuario, motivo: texto },
        confirmar, mensaje, 'Rechazada la solicitud de ' + u.nombre + '.');
    });
    panel.append(etiqueta, motivo, confirmar);
    return panel;
  }

  async function resolver(u, accion, datos, boton, mensaje, textoOk) {
    const s = leerSesion();
    if (!s) { mostrar('vista-login'); return; }
    aviso(mensaje, '');
    ocupado(boton, true, 'Guardando…');
    try {
      await Api.llamar(accion, datos, s.token);
      pendientes = pendientes.filter(x => x.id_usuario !== u.id_usuario);
      pintarPendientes();
      aviso('pendientes-mensaje', textoOk, 'ok');
      window.scrollTo(0, 0);
    } catch (err) {
      if (err.codigo === 'ESTADO') {
        // Otra persona ya la resolvió: se trae la lista de nuevo.
        await actualizarPendientes();
        aviso('pendientes-mensaje', 'Esa solicitud ya había sido resuelta. Actualicé la lista.', 'info');
      } else {
        manejarError(err, mensaje);
      }
    } finally {
      ocupado(boton, false);
    }
  }

  $('inicio-pendientes').addEventListener('click', () => {
    aviso('pendientes-mensaje', '');
    mostrar('vista-pendientes');
    actualizarPendientes();
  });
  $('pendientes-volver').addEventListener('click', () => {
    const s = leerSesion();
    s ? irAInicio(s) : mostrar('vista-login');
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
