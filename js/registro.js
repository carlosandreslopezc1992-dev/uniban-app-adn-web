/**
 * registro.js — Solicitar acceso (pantalla pública).
 * La persona llena sus datos y queda PENDIENTE hasta que un ADMIN la apruebe.
 * Usa lo común de app.js a través de App.
 */
(function () {
  const { $, ROLES_SOLICITABLES, CORREO_VALIDO, necesitaCodigo, aviso, ocupado, mostrar,
    llenarRoles, manejarError, dispositivo, evaluarReglas, cargarCatalogo, opcionesCatalogo, crearBuscador } = App;

  const reglasRegistro = () => evaluarReglas('reg-clave', 'reg-confirmar', 'reg-reglas');

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
})();
