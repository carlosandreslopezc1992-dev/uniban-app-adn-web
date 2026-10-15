/**
 * maestros.js — Maestro de Fincas y Grupos (solo ADMIN).
 * Lista con buscador y filtros, formulario de crear/editar, e inactivar o
 * reactivar con confirmación. Las reglas las valida el servidor (08_maestros.js);
 * aquí solo se evita mandar lo que de seguro va a fallar.
 * Usa lo común de app.js a través de App.
 */
(function () {
  const { $, ZONAS, leerSesion, mostrar, aviso, ocupado, crear, normalizar, manejarError,
    volverAInicio, olvidarCatalogo } = App;

  const MAX_VISIBLES = 50;
  const CODIGO_VALIDO = /^[A-Z0-9-]{1,20}$/; // la misma regla que usa el servidor

  let datos = null;        // { fincas, grupos, coordinadores } de listarMaestros, solo en memoria
  let tipoLista = 'fincas'; // 'fincas' o 'grupos'
  let editando = null;     // registro que se edita; null = nuevo

  // Solo el ADMIN ve el bloque Maestros. Al salir se borra lo que había en memoria.
  App.alEntrarInicio(s => { $('inicio-maestros').hidden = s.perfil.rol !== 'ADMIN'; });
  App.alSalir(() => { datos = null; editando = null; });

  // ---------- Pequeñas ayudas ----------
  const esFincas = () => tipoLista === 'fincas';
  const grupoPorCod = cod => datos.grupos.find(g => g.cod_grupo === cod);
  const zonaTexto = z => ZONAS[z] || z || '—';
  const plural = (n, uno, varios) => n + ' ' + (n === 1 ? uno : varios);
  const codigoNormal = v => String(v || '').trim().toUpperCase();
  const porNombre = campo => (a, b) =>
    String(a[campo]).localeCompare(String(b[campo]), 'es', { numeric: true, sensitivity: 'base' });
  const marcadas = nombre => [...document.querySelectorAll('input[name="' + nombre + '"]:checked')].map(i => i.value);

  function marcar(nombre, valores) {
    document.querySelectorAll('input[name="' + nombre + '"]').forEach(i => { i.checked = valores.indexOf(i.value) >= 0; });
  }
  function bloquear(nombre, si) {
    document.querySelectorAll('input[name="' + nombre + '"]').forEach(i => { i.disabled = si; });
  }
  function opcion(valor, texto) {
    const o = crear('option', '', texto);
    o.value = valor;
    return o;
  }
  // Texto de ayuda debajo de un campo; vacío = se oculta.
  function ayuda(id, texto) {
    $(id).textContent = texto || '';
    $(id).hidden = !texto;
  }
  // La finca de un proveedor INDEPENDIENTE: su grupo es INDEPENDIENTE y tiene su mismo código.
  function esFincaIndependiente(f) {
    const g = grupoPorCod(f.cod_grupo);
    return !!g && g.tipo === 'INDEPENDIENTE' && g.cod_grupo === f.cod_finca;
  }

  // ---------- Lista ----------
  function abrirLista(tipo) {
    tipoLista = tipo;
    $('maestro-titulo').textContent = esFincas() ? 'Fincas' : 'Grupos';
    $('maestro-nueva').textContent = esFincas() ? 'Nueva finca' : 'Nuevo grupo';
    $('maestro-bloque-tipo').hidden = esFincas();
    $('maestro-buscar').value = '';
    $('maestro-zona').value = '';
    $('maestro-estado').value = 'ACTIVO'; // Activos por defecto
    $('maestro-tipo').value = '';
    aviso('maestro-mensaje', '');
    mostrar('vista-maestro');
    cargar();
  }

  async function cargar() {
    const s = leerSesion();
    if (!s) { mostrar('vista-login'); return; }
    $('maestro-resumen').textContent = 'Cargando…';
    $('maestro-lista').replaceChildren();
    $('maestro-mas').hidden = true;
    try {
      datos = await Api.llamar('listarMaestros', {}, s.token);
      pintar();
    } catch (err) {
      $('maestro-resumen').textContent = '';
      manejarError(err, 'maestro-mensaje');
    }
  }

  // Filtra por zona, estado, tipo (solo grupos) y texto (código o nombre, sin importar tildes).
  function filtrados(todos) {
    const texto = normalizar($('maestro-buscar').value);
    const zona = $('maestro-zona').value;
    const estado = $('maestro-estado').value;
    const tipo = $('maestro-tipo').value;
    const campoNombre = esFincas() ? 'nombre_finca' : 'nombre_grupo';
    const campoCod = esFincas() ? 'cod_finca' : 'cod_grupo';
    return todos
      .filter(x => (!zona || x.zona === zona) &&
        (!estado || x.estado === estado) &&
        (esFincas() || !tipo || x.tipo === tipo) &&
        (!texto || normalizar(x[campoCod] + ' ' + x[campoNombre]).includes(texto)))
      .sort(porNombre(campoNombre));
  }

  function pintar() {
    if (!datos) return;
    const todos = esFincas() ? datos.fincas : datos.grupos;
    const lista = filtrados(todos);
    const [uno, varios] = esFincas() ? ['finca', 'fincas'] : ['grupo', 'grupos'];
    $('maestro-resumen').textContent = !lista.length ? 'No hay ' + varios + ' con esos filtros.'
      : plural(lista.length, uno, varios) + (lista.length < todos.length ? ' (de ' + todos.length + ' en total).' : '.');
    $('maestro-lista').replaceChildren(...lista.slice(0, MAX_VISIBLES).map(esFincas() ? tarjetaFinca : tarjetaGrupo));
    $('maestro-mas').hidden = lista.length <= MAX_VISIBLES;
    $('maestro-mas').textContent = 'Mostrando ' + MAX_VISIBLES + ' de ' + lista.length + '. Usa el buscador para ver más.';
  }

  /**
   * Tarjeta de un registro con botones Editar e Inactivar/Reactivar.
   * confirmacion: { texto, accion, datos, textoOk(r) }. Sin accion = solo se
   * muestra el aviso (por ejemplo, un grupo con fincas activas no se puede inactivar).
   */
  function tarjeta(titulo, etiquetas, filas, activo, alEditar, confirmacion) {
    const t = crear('article', 'tarjeta registro' + (activo ? '' : ' registro--inactivo'));
    t.appendChild(crear('h2', '', titulo));
    const et = crear('div', 'etiquetas');
    etiquetas.forEach(([texto, clase]) => et.appendChild(crear('span', 'etiqueta ' + clase, texto)));
    if (etiquetas.length) t.appendChild(et);
    const dl = crear('dl', 'solicitud__datos');
    filas.forEach(([k, v]) => dl.append(crear('dt', '', k), crear('dd', '', String(v))));
    t.appendChild(dl);

    const mensaje = crear('div', 'mensaje');
    mensaje.setAttribute('role', 'alert');
    mensaje.hidden = true;

    const panel = crear('div', 'solicitud__panel');
    panel.hidden = true;
    panel.appendChild(crear('p', 'confirmacion', confirmacion.texto));
    if (confirmacion.accion) {
      const bSi = crear('button', activo ? 'boton boton--peligro-lleno' : 'boton', activo ? 'Sí, inactivar' : 'Sí, reactivar');
      bSi.type = 'button';
      bSi.addEventListener('click', () => cambiarEstado(confirmacion, bSi, mensaje));
      panel.appendChild(bSi);
    }

    const bEditar = crear('button', 'boton boton--secundario', 'Editar');
    const bEstado = crear('button', activo ? 'boton boton--peligro' : 'boton', activo ? 'Inactivar' : 'Reactivar');
    bEditar.type = bEstado.type = 'button';
    bEditar.addEventListener('click', alEditar);
    bEstado.addEventListener('click', () => { panel.hidden = !panel.hidden; aviso(mensaje, ''); });
    const acciones = crear('div', 'solicitud__acciones');
    acciones.append(bEditar, bEstado);

    t.append(acciones, panel, mensaje);
    return t;
  }

  function tarjetaFinca(f) {
    const activo = f.estado === 'ACTIVO';
    const indep = esFincaIndependiente(f);
    const g = grupoPorCod(f.cod_grupo);
    const etiquetas = [];
    if (indep) etiquetas.push(['INDEPENDIENTE', 'etiqueta--suave']);
    if (!activo) etiquetas.push(['INACTIVA', 'etiqueta--inactivo']);
    const n = f.usuarios_activos;
    const confirmacion = activo ? {
      texto: n > 0 ? 'Esta finca tiene ' + plural(n, 'usuario activo', 'usuarios activos') + '. ¿Inactivarla de todas formas?'
        : '¿Inactivar la finca ' + f.nombre_finca + '? No se borra: podrás reactivarla después.',
      accion: 'cambiarEstadoFinca', datos: { cod_finca: f.cod_finca, estado: 'INACTIVO' },
      textoOk: r => 'Finca ' + f.cod_finca + ' inactivada.' +
        (r.usuarios_activos === 1 ? ' Su usuario activo sigue con acceso a la app.'
          : r.usuarios_activos > 1 ? ' Sus ' + r.usuarios_activos + ' usuarios activos siguen con acceso a la app.' : '')
    } : {
      texto: '¿Reactivar la finca ' + f.nombre_finca + '? Su grupo debe estar activo y ser de su misma zona.',
      accion: 'cambiarEstadoFinca', datos: { cod_finca: f.cod_finca, estado: 'ACTIVO' },
      textoOk: () => 'Finca ' + f.cod_finca + ' reactivada.'
    };
    return tarjeta(f.nombre_finca, etiquetas, [
      ['Código', f.cod_finca],
      ['Grupo', indep ? 'Proveedor independiente' : g ? g.nombre_grupo + ' (' + g.cod_grupo + ')' : f.cod_grupo],
      ['Zona', zonaTexto(f.zona)],
      ['Certificaciones', f.certificaciones.join(', ') || 'Ninguna'],
      ['Cliente', f.seleccionada_cliente === 'SI' ? 'Seleccionada' : 'No'],
      ['Usuarios activos', n]
    ], activo, () => abrirFinca(f), confirmacion);
  }

  function tarjetaGrupo(g) {
    const activo = g.estado === 'ACTIVO';
    const indep = g.tipo === 'INDEPENDIENTE';
    const etiquetas = [[indep ? 'INDEPENDIENTE' : 'GRUPO', 'etiqueta--suave']];
    if (!activo) etiquetas.push(['INACTIVO', 'etiqueta--inactivo']);
    const n = g.fincas_activas;
    let confirmacion;
    if (!activo) {
      confirmacion = {
        texto: '¿Reactivar el grupo ' + g.nombre_grupo + '?' + (indep ? ' Después podrás reactivar su finca.' : ''),
        accion: 'cambiarEstadoGrupo', datos: { cod_grupo: g.cod_grupo, estado: 'ACTIVO' },
        textoOk: () => 'Grupo ' + g.cod_grupo + ' reactivado.'
      };
    } else if (n > 0) {
      confirmacion = {
        texto: indep ? 'No se puede inactivar todavía: primero inactiva su finca (en Fincas).'
          : 'No se puede inactivar: tiene ' + plural(n, 'finca activa', 'fincas activas') +
            '. Primero inactívalas o muévelas a otro grupo.'
      };
    } else {
      confirmacion = {
        texto: '¿Inactivar el grupo ' + g.nombre_grupo + '? No se borra: podrás reactivarlo después.',
        accion: 'cambiarEstadoGrupo', datos: { cod_grupo: g.cod_grupo, estado: 'INACTIVO' },
        textoOk: () => 'Grupo ' + g.cod_grupo + ' inactivado.'
      };
    }
    const filas = [['Código', g.cod_grupo], ['Zona', zonaTexto(g.zona)]];
    if (!indep) {
      filas.push(['Coordinador', g.id_coordinador
        ? (g.nombre_coordinador || g.id_coordinador) + ' (' + g.id_coordinador + ')' : 'Sin coordinador']);
    }
    filas.push(['Fincas activas', n + (g.fincas_total > n ? ' de ' + g.fincas_total : '')]);
    return tarjeta(g.nombre_grupo, etiquetas, filas, activo, () => abrirGrupo(g), confirmacion);
  }

  async function cambiarEstado(conf, boton, mensaje) {
    const s = leerSesion();
    if (!s) { mostrar('vista-login'); return; }
    aviso(mensaje, '');
    ocupado(boton, true, 'Guardando…');
    try {
      const r = await Api.llamar(conf.accion, conf.datos, s.token);
      olvidarCatalogo(); // Registro y Aprobación verán la lista nueva
      aviso('maestro-mensaje', conf.textoOk(r), 'ok');
      window.scrollTo(0, 0);
      await cargar();
    } catch (err) {
      manejarError(err, mensaje);
    } finally {
      ocupado(boton, false);
    }
  }

  // Guarda un formulario; si sale bien vuelve a la lista con un mensaje.
  async function guardar(accion, datosForm, boton, idMensaje, textoOk) {
    const s = leerSesion();
    if (!s) { mostrar('vista-login'); return; }
    aviso(idMensaje, '');
    ocupado(boton, true, 'Guardando…');
    try {
      const r = await Api.llamar(accion, datosForm, s.token);
      olvidarCatalogo();
      mostrar('vista-maestro');
      if (r && r.sin_cambios) aviso('maestro-mensaje', 'No había cambios para guardar.', 'info');
      else aviso('maestro-mensaje', textoOk(r), 'ok');
      await cargar();
    } catch (err) {
      manejarError(err, idMensaje);
    } finally {
      ocupado(boton, false);
    }
  }

  // ---------- Formulario de finca ----------
  function abrirFinca(f) {
    editando = f || null;
    $('form-finca').reset();
    aviso('finca-mensaje', '');
    $('finca-titulo').textContent = f ? 'Editar finca' : 'Nueva finca';
    $('finca-cod').value = f ? f.cod_finca : '';
    $('finca-cod').disabled = !!f;
    $('finca-cod-ayuda').hidden = !f;
    $('finca-nombre').value = f ? f.nombre_finca : '';
    $('finca-zona').value = f ? f.zona : '';
    marcar('finca-cert', f ? f.certificaciones : []);
    marcar('finca-cliente', [f ? f.seleccionada_cliente : 'NO']);

    const indep = f && esFincaIndependiente(f);
    const conUsuarios = f && f.usuarios_activos > 0;
    $('finca-zona').disabled = !!(indep || conUsuarios);
    ayuda('finca-zona-ayuda', indep ? 'Es la finca de un proveedor independiente: la zona se cambia desde su grupo.'
      : conUsuarios ? 'No se puede cambiar la zona: tiene ' + plural(f.usuarios_activos, 'usuario activo', 'usuarios activos') + '.'
      : '');
    llenarGruposFinca(f ? f.cod_grupo : '');
    mostrar('vista-finca-form');
  }

  // Solo grupos ACTIVOS de la zona elegida y de tipo GRUPO (la finca de un
  // INDEPENDIENTE se crea sola al crear el grupo).
  function llenarGruposFinca(elegido) {
    const sel = $('finca-grupo');
    const zona = $('finca-zona').value;
    const f = editando;
    sel.replaceChildren();
    let texto = '';
    if (f && esFincaIndependiente(f)) {
      const g = grupoPorCod(f.cod_grupo);
      sel.appendChild(opcion(g.cod_grupo, g.nombre_grupo + ' (' + g.cod_grupo + ')'));
      sel.disabled = true;
      texto = 'Proveedor independiente: no se puede mover de grupo. Si cambias el nombre, también cambia el del grupo.';
    } else if (!zona) {
      sel.appendChild(opcion('', 'Primero elige la zona'));
      sel.disabled = true;
    } else {
      const grupos = datos.grupos
        .filter(g => g.estado === 'ACTIVO' && g.tipo === 'GRUPO' && g.zona === zona)
        .sort(porNombre('nombre_grupo'));
      sel.disabled = false;
      sel.appendChild(opcion('', grupos.length ? 'Elige el grupo' : 'No hay grupos activos en esta zona'));
      grupos.forEach(g => sel.appendChild(opcion(g.cod_grupo, g.nombre_grupo + ' (' + g.cod_grupo + ')')));
      if (grupos.some(g => g.cod_grupo === elegido)) sel.value = elegido;
      else if (elegido) texto = 'El grupo ' + elegido + ' no está activo en esta zona: elige otro.';
    }
    ayuda('finca-grupo-ayuda', texto);
  }

  $('finca-zona').addEventListener('change', () => llenarGruposFinca($('finca-grupo').value));

  $('form-finca').addEventListener('submit', ev => {
    ev.preventDefault();
    const cod = codigoNormal($('finca-cod').value);
    const d = {
      cod_finca: cod,
      nombre_finca: $('finca-nombre').value.trim(),
      zona: $('finca-zona').value,
      cod_grupo: $('finca-grupo').value,
      certificaciones: marcadas('finca-cert'),
      seleccionada_cliente: marcadas('finca-cliente')[0] || 'NO'
    };
    const error = !CODIGO_VALIDO.test(cod) ? 'El código solo puede tener letras, números y guion (máximo 20).'
      : !d.nombre_finca ? 'Escribe el nombre de la finca.'
      : !d.zona ? 'Elige la zona.'
      : !d.cod_grupo ? 'Elige el grupo.' : '';
    if (error) { aviso('finca-mensaje', error); return; }
    const nueva = !editando;
    guardar(nueva ? 'crearFinca' : 'editarFinca', d, $('finca-guardar'), 'finca-mensaje',
      () => 'Finca ' + cod + (nueva ? ' creada.' : ' actualizada.'));
  });
  $('finca-cancelar').addEventListener('click', () => mostrar('vista-maestro'));

  // ---------- Formulario de grupo ----------
  function abrirGrupo(g) {
    editando = g || null;
    $('form-grupo').reset();
    aviso('grupo-mensaje', '');
    $('grupo-titulo').textContent = g ? 'Editar grupo' : 'Nuevo grupo';
    marcar('grupo-tipo', [g ? g.tipo : 'GRUPO']);
    bloquear('grupo-tipo', !!g); // el tipo no se edita
    $('grupo-cod').value = g ? g.cod_grupo : '';
    $('grupo-cod').disabled = !!g;
    $('grupo-cod-ayuda').hidden = !g;
    $('grupo-nombre').value = g ? g.nombre_grupo : '';
    $('grupo-zona').value = g ? g.zona : '';
    const conFincas = g && g.fincas_activas > 0;
    $('grupo-zona').disabled = !!conFincas;
    ayuda('grupo-zona-ayuda', conFincas
      ? 'No se puede cambiar la zona: tiene ' + plural(g.fincas_activas, 'finca activa', 'fincas activas') + '.' : '');
    marcar('grupo-cert', []);
    marcar('grupo-cliente', ['NO']);
    ajustarTipoGrupo();
    mostrar('vista-grupo-form');
  }

  // INDEPENDIENTE: sin coordinador, y al crear pide los datos de su finca.
  function ajustarTipoGrupo() {
    const g = editando;
    const indep = (marcadas('grupo-tipo')[0] || 'GRUPO') === 'INDEPENDIENTE';
    $('grupo-bloque-coord').hidden = indep;
    $('grupo-bloque-indep').hidden = !indep || !!g;
    ayuda('grupo-tipo-ayuda', !g ? ''
      : indep ? 'El tipo no se puede cambiar. Si cambias el nombre, también cambia el de su finca.'
      : 'El tipo no se puede cambiar.');
    if (!indep) llenarCoordinadores();
  }

  // Coordinador: solo usuarios ACTIVOS con rol GRUPO asignados a este mismo grupo.
  function llenarCoordinadores() {
    const g = editando;
    const sel = $('grupo-coord');
    sel.replaceChildren(opcion('', 'Sin coordinador'));
    const candidatos = g ? datos.coordinadores.filter(c => c.cod_grupo === g.cod_grupo) : [];
    candidatos.forEach(c => sel.appendChild(opcion(c.id_usuario, c.nombre + ' (' + c.id_usuario + ')')));
    if (g && g.id_coordinador && !candidatos.some(c => c.id_usuario === g.id_coordinador)) {
      sel.appendChild(opcion(g.id_coordinador,
        (g.nombre_coordinador || g.id_coordinador) + ' (ya no es coordinador activo de este grupo)'));
    }
    sel.value = g ? g.id_coordinador : '';
    sel.disabled = sel.options.length === 1;
    ayuda('grupo-coord-ayuda', !g
      ? 'Se asigna después: primero crea el grupo y aprueba al usuario con rol Coordinador de grupo de este grupo.'
      : sel.options.length === 1 ? 'No hay usuarios activos con rol Coordinador de grupo en este grupo.' : '');
  }

  document.querySelectorAll('input[name="grupo-tipo"]').forEach(r => r.addEventListener('change', ajustarTipoGrupo));

  $('form-grupo').addEventListener('submit', ev => {
    ev.preventDefault();
    const cod = codigoNormal($('grupo-cod').value);
    const tipo = marcadas('grupo-tipo')[0] || 'GRUPO';
    const indep = tipo === 'INDEPENDIENTE';
    const d = {
      cod_grupo: cod,
      nombre_grupo: $('grupo-nombre').value.trim(),
      zona: $('grupo-zona').value,
      tipo: tipo,
      id_coordinador: indep ? '' : $('grupo-coord').value
    };
    const nuevo = !editando;
    if (indep && nuevo) {
      d.certificaciones = marcadas('grupo-cert');
      d.seleccionada_cliente = marcadas('grupo-cliente')[0] || 'NO';
    }
    const error = !CODIGO_VALIDO.test(cod) ? 'El código solo puede tener letras, números y guion (máximo 20).'
      : !d.nombre_grupo ? 'Escribe el nombre del grupo.'
      : !d.zona ? 'Elige la zona.' : '';
    if (error) { aviso('grupo-mensaje', error); return; }
    guardar(nuevo ? 'crearGrupo' : 'editarGrupo', d, $('grupo-guardar'), 'grupo-mensaje',
      r => nuevo ? 'Grupo ' + cod + ' creado.' + (r && r.finca ? ' También se creó su finca.' : '')
        : 'Grupo ' + cod + ' actualizado.');
  });
  $('grupo-cancelar').addEventListener('click', () => mostrar('vista-maestro'));

  // ---------- Botones de la lista ----------
  $('inicio-fincas').addEventListener('click', () => abrirLista('fincas'));
  $('inicio-grupos').addEventListener('click', () => abrirLista('grupos'));
  $('maestro-nueva').addEventListener('click', () => {
    if (!datos) { aviso('maestro-mensaje', 'Espera a que termine de cargar la lista.', 'info'); return; }
    esFincas() ? abrirFinca(null) : abrirGrupo(null);
  });
  $('maestro-buscar').addEventListener('input', pintar);
  ['maestro-zona', 'maestro-estado', 'maestro-tipo'].forEach(id => $(id).addEventListener('change', pintar));
  $('maestro-volver').addEventListener('click', volverAInicio);
})();
