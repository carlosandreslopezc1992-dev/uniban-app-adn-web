/**
 * pendientes.js — Solicitudes pendientes (solo ADMIN): aprobar o rechazar.
 * Se engancha al inicio para mostrar el botón con el contador cuando el rol es ADMIN.
 * Usa lo común de app.js a través de App.
 */
(function () {
  const { $, ROLES, ROLES_SOLICITABLES, ZONAS, necesitaCodigo, leerSesion, mostrar, aviso, ocupado, crear,
    llenarRoles, manejarError, volverAInicio, cargarCatalogo, opcionesCatalogo, nombreCatalogo, crearBuscador } = App;

  let pendientes = []; // solicitudes que ve el ADMIN

  // Al mostrar el inicio: solo el ADMIN ve el botón, y se trae el contador.
  App.alEntrarInicio(s => {
    const esAdmin = s.perfil.rol === 'ADMIN';
    $('inicio-pendientes').hidden = !esAdmin;
    if (esAdmin) cargarPendientes(s, 'inicio-mensaje');
  });
  App.alSalir(() => { pendientes = []; });

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
  $('pendientes-volver').addEventListener('click', volverAInicio);
})();
