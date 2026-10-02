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
| `index.html` | Estructura de las vistas (`vista-login`, `vista-clave`, `vista-inicio`) |
| `css/estilos.css` | Colores y estilos según Manual de Marca |
| `js/config.js` | `CONFIG_APP`: URL del servidor (`/exec`), versión, tiempo de espera |
| `js/api.js` | `Api.llamar(accion, datos, token)`: única puerta al servidor |
| `js/app.js` | Lógica de vistas: ingreso, cambio de contraseña, inicio, sesión |
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
