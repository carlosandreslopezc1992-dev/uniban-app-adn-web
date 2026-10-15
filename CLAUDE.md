# App ADN Unibán — Pantallas (repositorio `uniban-app-adn-web`)

## Qué es este proyecto
Pantallas de la **App ADN** de Unibán: una PWA (app web instalable en Android e iPhone) para el inventario de
insumos de empaque en fincas. Se publica con **GitHub Pages** desde la rama `main`.

- Coordinador: **Andrés** (Carlos Andrés López Ceballos). Equipo: Diego Leon Gomez Henao y Daniel Felipe Moreno Caro.
- Andrés está aprendiendo programación (nivel intermedio). Explica en español, paso a paso.
- El servidor vive en el repositorio privado `uniban-app-adn` (Google Apps Script). Las reglas de negocio,
  la seguridad y los permisos por rol están **allá**, no aquí.

## ⚠️ Este repositorio es PÚBLICO
Nunca agregar: datos de fincas o personas, contraseñas, tokens, IDs de hojas de cálculo ni reglas de negocio
sensibles. Solo pantallas, estilos e imágenes de marca. La URL `/exec` del servidor sí puede estar aquí: es
la puerta, no la llave.

## Archivos
| Archivo | Responsabilidad |
|---|---|
| `index.html` | Estructura de las vistas (`vista-login`, `vista-clave`, `vista-inicio`, `vista-registro`, `vista-pendientes`, `vista-maestro`, `vista-finca-form`, `vista-grupo-form`) |
| `css/estilos.css` | Colores y estilos según Manual de Marca |
| `js/config.js` | `CONFIG_APP`: URL del servidor (`/exec`), versión, tiempo de espera |
| `js/api.js` | `Api.llamar(accion, datos, token)`: única puerta al servidor |
| `js/app.js` | Lo común: sesión, vistas, mensajes, catálogo, lista con búsqueda, ingreso, cambio de contraseña, inicio, salida y arranque. Publica el objeto `App` |
| `js/registro.js` | Solicitar acceso (pantalla pública) |
| `js/pendientes.js` | Solicitudes pendientes: aprobar y rechazar (solo ADMIN) |
| `js/maestros.js` | Maestros de Fincas y Grupos: lista con buscador y filtros, crear, editar, inactivar y reactivar (solo ADMIN) |
| `sw.js` | Service worker, estrategia "primero la red" |
| `manifest.json` | Nombre, colores e íconos de la app instalable |

## Reglas de código
1. Toda llamada al servidor pasa por `Api.llamar`. Se envía como `text/plain` para evitar la consulta CORS previa.
2. El servidor responde `{ ok, datos }` o `{ ok:false, error, codigo }`. Si `codigo === 'SESION'`, volver al ingreso.
3. La sesión (token + perfil + vencimiento) se guarda en `localStorage` con la llave `adn_sesion`.
   **La contraseña nunca se guarda**; solo vive en memoria durante el cambio obligatorio.
4. Para ocultar elementos usar el atributo `hidden` (existe la regla `[hidden]{display:none !important}`).
5. Diseño **móvil primero**: campos de 16 px o más (evita el zoom en iPhone), botones grandes, una columna.
6. Textos de la interfaz en español, tono cercano y claro, pensando en personal de finca.
7. Al cambiar archivos, subir `CONFIG_APP.VERSION` y el nombre `CACHE` en `sw.js`.
8. **Un archivo JS por módulo.** Lo común vive en `app.js` y se comparte con el objeto global `App`
   (`App.aviso`, `App.crear`, `App.leerSesion`…). Cada módulo es una función que se ejecuta sola, `(function () { … })();`, y:
   - se engancha con `App.alEntrarInicio(fn)` para mostrar sus botones según el rol, y con `App.alSalir(fn)` para
     borrar sus datos en memoria al cerrar sesión;
   - se carga en `index.html` **después** de `app.js`, y se agrega a `ARCHIVOS` en `sw.js`;
   - nunca llama funciones de otro módulo: si algo se necesita en dos módulos, va a `app.js`.
9. Crear elementos con `App.crear` (usa `textContent`). Nunca `innerHTML` con datos que vienen del servidor.

## Marca Unibán (Manual de Marca)
| Uso | Color |
|---|---|
| Verde principal (PANTONE 348C) | `#00843D` |
| Verde lima (PANTONE 376C) | `#84BD00` |
| Arena (fondo, Warm Gray 1C) | `#E4E0DB` |
| Gris texto (Cool Gray 11C) | `#53565A` |
| Gris claro (Cool Gray 6C) | `#A7A8AA` |
| Naranja acento (PANTONE 1495C) | `#FF8F1C` |

Tipografía: **Nunito** (reemplazo de Gotham Rounded). Logo: `img/logo-uniban-blanco.png` sobre fondo verde.
Usar las variables CSS de `:root`; no escribir colores sueltos.

## Terminología Unibán
**SEM** = semana · **SM** = Santa Marta · **URABÁ** = Urabá · **Alineación** (nunca "programación").

## Flujo para cada cambio
1. Editar y probar con **Live Server** (botón "Go Live" de VS Code), nunca abriendo el archivo con `file:///`.
2. Commit con mensaje en español → **pedir permiso a Andrés antes de `git push`**.
3. GitHub Pages publica en 1 o 2 minutos (pestaña Actions con ✅).
4. Las apps instaladas se actualizan solas al abrirse con internet.

## Modo aprendizaje (obligatorio en cada cambio)
Andrés quiere volverse fuerte en vibe coding. Después de cada cambio de código, agrega un bloque corto:

> **🎓 Modo aprendizaje**
> **Qué hace:** la idea en una frase.
> **La línea clave:** el fragmento más importante, explicado en palabras simples.
> **Concepto:** el nombre técnico (evento, DOM, promesa, localStorage…) para reconocerlo en otros proyectos.
> **Pruébalo tú:** de vez en cuando, un cambio pequeño para que lo haga él mismo.

Breve. Prioriza que entienda, no la cantidad de explicación.

## Reglas de trabajo con Andrés
1. Antes de pedir permiso para un comando, explica en una o dos frases, en palabras simples, qué hace y si solo lee o si cambia algo.
2. Clasifica cada acción: solo lectura / cambio local reversible / publica (git push, clasp push, Nueva versión) / irreversible. Para "publica" e "irreversible", adviértelo de forma explícita y espera mi confirmación escrita.
3. Nunca ejecutes sin mi confirmación expresa: --force, git clean, git restore, git reset --hard, borrar archivos, borrar filas del Sheet, clasp deploy o crear una implementación nueva. Antes de un clasp push --force, verifica con git diff que appsscript.json no cambió y compara con lo que hay en Apps Script.
4. Cuando una solicitud de permiso ofrezca una opción con * (autorización permanente), recuérdame que debo elegir la de una sola vez, salvo en comandos de solo lectura.
5. Todo plan termina con una sección "Riesgos y casos no cubiertos".
6. Si un cambio toca ingreso, contraseñas o escritura de datos, no lo des por verificado solo con el servidor falso: dame también una lista corta para probarlo contra el servidor real.
7. Publica en pasos pequeños: primero el servidor (probado y con su Nueva versión) y luego las pantallas. Nunca hagas git push de pantallas que dependan de rutas del servidor que aún no están publicadas.
8. Al cerrar cada sesión, dame un resumen: estado de los dos repos, qué está publicado y qué queda sin commit.
