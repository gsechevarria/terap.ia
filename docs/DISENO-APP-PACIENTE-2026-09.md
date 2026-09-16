# App del paciente — dirección de interfaz móvil 02

Integración de la entrega `terap-mobile-v2` (15-sep-2026) en el área `/app`.
Rama `feat/app-paciente-diseno-movil-v2`. **Pendiente de revisión; no fusionada.**

Qué NO ha cambiado: el backend, la autenticación, los permisos, la RLS, las
migraciones, las server actions, las RPC, el opt-in de escalas, las reglas de
citas y bonos, y el hecho de que la app no interpreta ni puntúa nada para el
paciente. Esto es piel y composición.

---

## Qué se ha hecho con cada archivo de la entrega

| Entrega | Destino |
|---|---|
| `index.html` | Referencia de composición. Convertido a componentes de React en `src/app/app/`. |
| `mobile.css` | Transcrito a `src/app/app/_ui/patient.css`, **aislado bajo `.tp-app`**. |
| `preview.js` | **No se integra.** Solo controlaba pantallas y selección visual. Cada punto suyo se ha conectado al servicio real. |
| `.presentation-label`, `.presentation-footer`, `.phone` | Retirados. Son el marco de revisión de escritorio, no producto. |

## Aislamiento del CSS

`mobile.css` trae selectores desnudos —`body`, `button`, `svg`, `a`, `h1`,
`:focus-visible`— porque está pensado para una página autónoma. Importarlo tal
cual habría repintado el panel del profesional con solo haber pasado antes por
la app del paciente: Next conserva el CSS ya cargado al navegar por cliente. Es
literalmente lo que ocurrió con la portada (ver `src/app/_landing/landing.css`).

Los **279 selectores cuelgan de `.tp-app`** y las variables llevan prefijo
`--tp-`, porque `--ink`, `--line` y `--accent` ya existen en `globals.css` y
significan otra cosa. `src/lib/patient-css.test.ts` falla si alguien vuelve a
colar un selector suelto o redefine una variable ajena.

El bloque de reinicio local es deliberadamente corto: el preflight de Tailwind
ya deja en cero márgenes, rellenos y bordes y hereda tipografía y color en los
controles. **`patient.css` va sin capa, así que gana a cualquier utilidad de
Tailwind**; un `.tp-app button { background: none }` habría despintado el
selector de fecha y los botones de Ajustes, que son componentes compartidos con
el panel del profesional. Esos cuatro (`PushToggle`,
`NotificationPreferences`, `SignOutForm`, `DateField`) **no se tocan**: se les
cambia la piel desde el bloque final de `patient.css`.

## Dos desviaciones respecto a la entrega

### 1. Contraste

La paleta no llegaba a AA (4,5:1) en textos de 10-13 px, donde no aplica la
excepción de texto grande. Medido color a color sobre su propio fondo:

| Color de la entrega | Dónde | Ratio | Sustituido por |
|---|---|---|---|
| `#929da2` | nota de pie | 2,66:1 | `#626c73` · 5,14:1 |
| `#9aa5aa` | placeholder | 2,41:1 | `#626c73` · 5,13:1 |
| `#8c9aa1` | días del gráfico | 2,77:1 | `#626c73` · 5,14:1 |
| `#8b99a0` | fecha del diario | 2,81:1 | `#626c73` · 5,14:1 |
| `#849096` | segmentado inactivo | 2,84:1 | `#626c73` · 4,65:1 |
| `#8b949a` | estado de solicitud | 2,96:1 | `#626c73` · 5,14:1 |
| `#85959c` | hora del historial | 2,97:1 | `#626c73` · 5,14:1 |
| `#597986` | píldora de estado | 4,08:1 | `#4f6f7c` · 4,71:1 |
| `#4d7787` | puntuación del diario | 4,23:1 | `#456d7c` · 4,88:1 |
| `#93714a` | «Fecha pasada» | 3,87:1 | `#83623c` · 4,82:1 |
| `#a16a66` | «Cancelar» | 4,40:1 | `#95605c` · 4,89:1 |

En vez de inventar ocho grises nuevos se colapsan en **uno informativo**
(`--tp-muted`), del mismo tono azulado, verificado sobre las cuatro superficies
donde se pinta. La jerarquía la sostienen el tamaño y el peso, que es el
criterio que la propia entrega enuncia. El acento `#087b82` (4,82:1) y el rojo
de cabecera `#8e5554` (5,62:1) ya cumplían y se conservan literales; los seis
textos sobre el bloque petróleo también (5,02:1 el más bajo).

Es el mismo criterio con el que `globals.css` ya se desvió de su propia
especificación, y está anotado en el sitio.

**Reversible:** cuatro variables en `patient.css`, con la medición al lado.

### 2. Modo oscuro

La entrega es solo clara y así queda por defecto (`color-scheme: light` en
`.tp-app`). Pero la app del paciente ya seguía la preferencia del sistema, y
forzar el blanco dejaba deslumbrado a quien la abre de noche. Bajo `.dark` los
tokens `--tp-*` se **reasignan a los de `globals.css`** en lugar de inventar una
segunda paleta que mantener. Se elige en `/app/more` → Aspecto, con el
`ThemeToggle` que ya existía.

## Lo que sustituye a los avisos de diseño de `preview.js`

| Punto de la maqueta | Flujo real |
|---|---|
| Selección de ánimo (inicio) | `addMoodEntryAction` al toque. La nota de hoy viaja en la llamada —si no, se borraba— y la selección **vuelve atrás si el servidor rechaza**. |
| Selección de ánimo (diario) | Compositor con nota y botón explícito. «Guardado» solo tras resolver bien. |
| Panel de tarea | `completeTaskAction`. No cierra hasta que el servidor confirma. |
| «Confirmar asistencia» / «Cancelar» | `patient_respond_appointment` (RPC, sin cambios). |
| «Pedir otro día» / «Pedir una cita» | `patient_request_appointment`. El éxito dice «Solicitud enviada», nunca «confirmada». |
| «Ayuda urgente» | `tel:024`, el destino que la app ya usaba. **No se ha inventado ninguno.** |
| Cuestionarios | `submitScaleResponseAction`. Sin puntuación ni severidad para el paciente; solo «x de 9 respondidas». El aviso del ítem de riesgo del PHQ-9 se conserva íntegro. |

Las siete pantallas llevan estados de carga (`loading.tsx`), vacío, error y
éxito, que la maqueta no dibujaba.

## Añadidos sobre la entrega

- **Fila de pagos en el inicio**, solo con deuda o bono vivo. Esconder un importe
  pendiente detrás de dos toques era una regresión funcional.
- **Huecos en el gráfico semanal.** Un día sin registro es un hueco, no un cero:
  un cero diría que la persona se sintió fatal, y lo que pasó es que no escribió.
  El texto alternativo lo dice igual.
- **`ScrollReset`.** Quien desplaza es un contenedor interno, no la ventana, así
  que Next no lo restaura: sin esto se aterrizaba a media pantalla al cambiar de
  pestaña.
- **`interactiveWidget: "resizes-content"`** en el `viewport` del layout del
  paciente. Es lo que hace habitable un armazón de 100 dvh con teclado virtual:
  sin él el teclado tapa el campo y la barra inferior flota encima. Se declara
  solo aquí; el panel del profesional desplaza la página entera y no lo necesita.
- `.tp-session-info h2` lleva `text-transform: capitalize`: el día de la semana
  llega en minúscula de `toLocaleString` en español y abre línea.

## Alcance

Rediseñadas: **Inicio, Citas y Diario** (las tres de la entrega) más el armazón,
y, por decisión de producto del 16-sep, también **Recursos, Más, Pagos,
Notificaciones, Pedir cita y Cuestionario**, que la entrega no cubre. La
composición de esas seis es propia, no aprobada, y sigue el mismo lenguaje.

`MoodLogger.tsx` se elimina: lo sustituyen `MoodCheckin` (inicio) y
`MoodComposer` (diario), que son gestos distintos.

## Verificación hecha

- `npm run lint`, `npm run typecheck`, `npm run build` — OK.
- `npm test` — **164** pruebas (4 nuevas, de aislamiento del CSS).
- `npm run test:types` — **51** regresiones SQL, 41 migraciones. Sin cambios de
  esquema en esta rama.
- Revisión a **320 / 375 / 390 / 430 px**, claro y oscuro, y con el viewport
  reducido 300 px para modelar el teclado, sobre marcos con viewport propio y el
  CSS de producción.

## Verificación que falta

Dispositivo físico. Esta rama no lo cubre y no puede: teclado real de iOS y
Android, área segura del iPhone, rebote del desplazamiento, el `<dialog>` en la
capa superior del navegador, y la instalación como PWA. Sigue en la lista
pendiente del proyecto, junto a la entrega push real.
