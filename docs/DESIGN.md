# Sistema visual de terap.ia

Referencia de cualquier pantalla nueva del **panel del profesional** (`/pro`).
La fuente visual es `docs/design/referencia-hoy.html`; los valores vivos están
en `src/app/globals.css`, que es lo que manda cuando este documento y el código
discrepen.

**Fuera de este documento:** la app del paciente (`/app`), que tiene su propio
sistema aislado en `src/app/app/_ui/patient.css` con prefijo `.tp-app`, y la
portada (`/`), aislada en `src/app/_landing/landing.css` con prefijo
`.lp-terap`. Los tres sistemas conviven a propósito y **no** se unifican: un
selector desnudo en cualquiera de ellos repinta a los otros en cuanto se navega
por cliente, que es un fallo que este repositorio ya ha tenido dos veces.

---

## La idea

Una hoja de trabajo blanca sobre un lienzo que no lo es. Todo lo demás se
deriva de ahí: si el fondo de la aplicación fuera blanco, la hoja no sería una
hoja y habría que dibujarle un borde o una sombra para separarla. Al no serlo,
la separación ya está hecha y **no hace falta ninguna sombra en todo el
sistema**.

Tres consecuencias que conviene no deshacer:

1. **Sin sombras.** Ni en tarjetas, ni en diálogos, ni en menús. Lo que separa
   es el color de fondo y la línea de 1 px.
2. **La jerarquía la hacen el tamaño, el peso y el espacio**, no las cajas.
   Cuatro tarjetas idénticas en mosaico dicen que las cuatro cosas importan lo
   mismo, y casi nunca es verdad.
3. **Las zonas se separan con una línea y aire**, no metiendo cada una en su
   propia caja.

---

## Tokens

Se declaran en `:root` con `light-dark()`, así que **una sola declaración por
token cubre los tres casos**: sin clase se sigue la preferencia del sistema, y
`.light` / `.dark` en `<html>` la fuerzan. Las vistas **no llevan `dark:`**.

Los nombres **se reasignan, no se renombran**. `--ink-3` aparece en más de cien
sitios: cambiar su valor corrige el contraste en todos a la vez; cambiar su
nombre obliga a tocar cien ficheros.

### Superficies

| Token | Claro | Oscuro | Para qué |
|---|---|---|---|
| `--canvas` | `#E9ECE8` | `#121614` | Fondo de la aplicación, detrás de la barra lateral y alrededor de la hoja |
| `--surface` | `#FFFFFF` | `#1B201D` | La hoja, las tablas, los bloques |
| `--surface-muted` | `#F1F3F0` | `#242A26` | Hunde: buscador, segmentados, sesiones realizadas |
| `--surface-subtle` | `#F6F7F5` | `#1F2522` | Tinta sin hundir: cabeceras de tabla, días no activos |

Alias históricos, mantenidos para no tocar las ~40 vistas que los usan:
`--surface-2` → `--surface-subtle`, y `--surface-3` / `--panel` / `--sunken` →
`--surface-muted`.

### Líneas

| Token | Claro | Oscuro | Para qué |
|---|---|---|---|
| `--line` | `#E4E7E3` | `#2E3531` | Divisores de sección y bordes de tabla |
| `--line-soft` | `#EEF0ED` | `#272E2A` | Filas de tabla y líneas horarias |
| `--line-strong` | `#C8CEC9` | `#414A45` | Eje de gráficas y borde discontinuo de huecos libres |

### Tinta

| Token | Claro | Oscuro | Para qué |
|---|---|---|---|
| `--ink-1` | `#1D2420` | `#ECF1EE` | Texto principal |
| `--ink-2` | `#3C4641` | `#C2CCC6` | Cuerpo secundario |
| `--ink-3` | `#56605B` | `#9EA9A3` | Metadatos, etiquetas de columna |
| `--ink-4` | `#626C67` | `#939D97` | Contadores, horas del eje, pies |
| `--ink-disabled` | `#6A706D` | `#8A948E` | **Solo** lo pasado o cancelado |

Alias: `--ink` → `--ink-1`, `--ink-faint` → `--ink-disabled`.

### Acento y datos

| Token | Claro | Oscuro | Para qué |
|---|---|---|---|
| `--accent` | `#2F6B4F` | `#6FB894` | Acción primaria, navegación activa, enlaces |
| `--accent-soft` | `#E5EFE8` | `#1E2F27` | Bloques de sesión confirmada, día actual |
| `--accent-solid` | `#2F6B4F` | `#2A5E46` | El bloque verde macizo |
| `--accent-solid-ink` | `#FFFFFF` | `#FFFFFF` | Texto sobre él |
| `--accent-on-dark` | `#CFE3D7` | `#BFD9CB` | Texto secundario sobre él |
| `--green-1` … `--green-5` | `#E5EFE8` `#C2DACB` `#8FBDA3` `#5A9677` `#2F6B4F` | | Escala de datos: ocupación, mapas de calor |

`--accent` se aclara en oscuro porque ahí tiene que funcionar como **texto**.
`--accent-solid` **no**: se queda oscuro en los dos temas. Si siguiera a
`--accent`, la tarjeta de próxima sesión pasaría de ser el elemento más rotundo
de la pantalla al más pálido en cuanto anocheciera.

La escala `--green-*` codifica **cantidad**, nunca mejoría ni empeoramiento.

### Semánticos

| Token | Claro | Oscuro | Para qué |
|---|---|---|---|
| `--danger` | `#B42318` | `#F08A80` | Línea de «ahora», aviso de seguridad, insignia |
| `--danger-ink` | `#8F1B12` | `#FCA9A0` | Texto sobre fondo claro de peligro |
| `--warning-ink` | `#8A5200` | `#E3B466` | «Sin confirmar». Solo texto, nunca relleno |
| `--warning-line` | `#E8D6AE` | `#6A5A33` | Borde de cita sin confirmar |
| `--hatch` | trama de 45º | | Franjas bloqueadas y fuera de horario |

`--hatch` no es un color, es una textura, y por eso se lee como «aquí no se
agenda» sin depender de distinguir un gris de otro.

---

## Contraste

Generado con `npm run test:contraste`, que **lee los valores del propio
`globals.css`** y por tanto no puede quedarse desfasado. Criterio WCAG 2.1 AA:
4,5:1 para texto normal.

| Texto | Sobre | Uso | Claro | Oscuro |
|---|---|---|---:|---:|
| `--ink-1` | `--surface` | texto principal sobre la hoja | 15.84 | 14.46 |
| `--ink-1` | `--canvas` | texto principal sobre el lienzo | 13.30 | 15.98 |
| `--ink-1` | `--surface-muted` | texto sobre bloque hundido | 14.20 | 12.82 |
| `--ink-1` | `--surface-subtle` | texto sobre cabecera de tabla | 14.74 | 13.66 |
| `--ink-1` | `--accent-soft` | texto sobre cita confirmada | 13.46 | 12.33 |
| `--ink-2` | `--surface` | cuerpo secundario | 9.79 | 10.03 |
| `--ink-2` | `--canvas` | cuerpo secundario en la barra lateral | 8.22 | 11.08 |
| `--ink-2` | `--surface-muted` | cuerpo secundario hundido | 8.78 | 8.89 |
| `--ink-3` | `--surface` | metadatos y etiquetas de columna | 6.52 | 6.81 |
| `--ink-3` | `--canvas` | metadatos sobre el lienzo | 5.47 | 7.52 |
| `--ink-3` | `--surface-muted` | placeholder del buscador | 5.84 | 6.04 |
| `--ink-3` | `--surface-subtle` | etiquetas de cabecera de tabla | 6.07 | 6.43 |
| `--ink-4` | `--surface` | contadores y pies | 5.44 | 5.91 |
| `--ink-4` | `--canvas` | contadores de la barra lateral | 4.57 | 6.53 |
| `--ink-4` | `--surface-muted` | horas del eje | 4.88 | 5.24 |
| `--ink-4` | `--surface-subtle` | día de la semana no activo | 5.06 | 5.58 |
| `--ink-disabled` | `--surface` | sesión cancelada | 5.06 | 5.28 |
| `--ink-disabled` | `--surface-muted` | sesión realizada | 4.53 | 4.68 |
| `--accent` | `--surface` | enlaces y acciones | 6.29 | 7.05 |
| `--accent` | `--canvas` | navegación activa | 5.28 | 7.79 |
| `--accent` | `--surface-muted` | enlace sobre hundido | 5.64 | 6.25 |
| `--accent` | `--accent-soft` | enlace sobre cita confirmada | 5.35 | 6.01 |
| `--danger` | `--surface` | aviso pendiente en la agenda | 6.57 | 6.81 |
| `--danger-ink` | `--danger-soft` | titular de la franja de seguridad | 8.15 | 8.29 |
| `--warning-ink` | `--surface` | sin confirmar | 6.39 | 8.64 |
| `--warning-ink` | `--surface-muted` | sin confirmar sobre hundido | 5.72 | 7.66 |
| `--accent-solid-ink` | `--accent-solid` | texto de la tarjeta de próxima sesión | 6.29 | 7.53 |
| `--accent-on-dark` | `--accent-solid` | texto secundario de esa tarjeta | 4.68 | 5.02 |
| `--banner-ink` | `--banner-bg` | franja reglamentaria | 13.30 | 13.77 |
| `--success` | `--success-soft` | estado correcto | 5.58 | 7.76 |
| `--info` | `--info-soft` | aviso informativo | 6.15 | 7.35 |
| `--danger` | `--danger-soft` | texto de peligro sobre su fondo | 5.95 | 6.33 |
| `--accent` | `--surface-subtle` | enlace sobre tinte claro | 5.86 | 6.66 |

La tabla la produce `node scripts/contraste-tokens.mjs --markdown`. Si un token
cambia y baja de AA, `npm run test:contraste` sale con código 1.

### Dos desviaciones respecto a la paleta especificada

Ambas por contraste, ambas medidas, ambas anotadas en `globals.css`:

- **`--ink-4`: `#66706B` → `#626C67`.** El especificado da 4,30:1 sobre
  `--canvas`, y sobre `--canvas` es justo donde van los contadores de la barra
  lateral, a 12,5 px. Ahora 4,57:1.
- **`--ink-disabled`: `#8A928E` → `#6A706D`.** El especificado da 3,19:1 sobre
  blanco y 2,86:1 sobre `--surface-muted`, que es el fondo de las sesiones ya
  realizadas. Ahí no hay solo un tachado decorativo: están el nombre del
  paciente y la palabra «Realizada», que son información.

En **oscuro** la restricción va al revés y aprieta más: apagar un texto es
acercarlo al fondo, y el fondo ya es oscuro. `--ink-4` y `--ink-disabled`
acaban a 1,12:1 el uno del otro, casi indistinguibles. Por debajo de ahí se
incumple AA, así que lo que separa una sesión realizada del resto en modo
oscuro no es el gris: es el tachado, la palabra «Realizada» y el fondo hundido.
Que es como debía ser de todas formas, porque **el color nunca puede ser el
único portador**.

### Exentos del criterio, y por qué

Bordes y barras cuya información va SIEMPRE también en texto, lo que los deja
fuera de WCAG 1.4.11:

- `--line`, `--line-soft` — separadores decorativos, no transmiten información.
- `--line-strong` — eje y borde de hueco libre; el hueco lleva su texto al lado
  («Libre de 14:30 a 16:00, 1 h 30 min»).
- `--green-3`, `--green-2` — barras de ocupación; la cifra de horas va escrita
  debajo de cada barra, y la semana de la gráfica va en su `title`.
- `--warning-line` — borde de cita sin confirmar; la palabra «sin confirmar» va
  dentro del bloque.

---

## Tipografía

**Familia única: Schibsted Grotesk**, cargada con `next/font/google` en 400,
500, 600 y 700. Respaldo `system-ui, -apple-system, "Segoe UI", sans-serif`.

`next/font` la auto-hospeda en el build, así que **no hay ninguna petición a
Google en tiempo de ejecución**. Eso importa por dos motivos y no solo por
velocidad: la CSP puede seguir con `font-src 'self'`, y la IP del profesional no
viaja a un tercero por abrir su panel. Un `@import` a `fonts.googleapis.com`
**se bloquearía en silencio** y la tipografía caería al respaldo sin avisar; ya
pasó con la portada.

**Sin serif y sin monoespaciada.** El ancho de dígito fijo lo da
`font-variant-numeric: tabular-nums`, aplicado al `body` entero. La clase
`.mono` sobrevive y ahora solo asegura eso; `--font-mono` apunta a la misma
pila que `--font-sans`.

| Uso | Tamaño | Peso | Espaciado |
|---|---|---|---|
| Título de página (`h1`, `.page-title`) | 40 | 600 | −0,03em, interlineado 1,08 |
| Nombre en la tarjeta de próxima sesión | 26 | 600 | −0,02em |
| Cifra destacada (`.figure`) | 28 | 600 | −0,02em |
| Título de sección (`h2`, `.section-title`) | 17 | 600 | −0,01em |
| Cuerpo destacado | 16 | 400 | interlineado 1,55 |
| Cuerpo | 14 | 400 | |
| Secundario | 13–13,5 | 400 | |
| Metadatos | 12–12,5 | 400 | |

**Los campos de formulario van a 16 px y no se bajan.** Por debajo de eso iOS
hace zoom automático al enfocar, y evitarlo con `maximumScale: 1` bloquea el
pinch-zoom e incumple WCAG 1.4.4 en una aplicación que muestra escalas clínicas
e importes.

---

## Radios

Tienen jerarquía. No se usa uno solo para todo: el radio dice **qué tan grande
es la cosa**.

| Elemento | Radio | Utilidad Tailwind |
|---|---|---|
| Hoja de trabajo | 14 | `rounded-4xl` |
| Tarjeta de próxima sesión, diálogos | 12 | `rounded-3xl` |
| Contenedor de tabla, tarjetas | 10 | `rounded-2xl` |
| Días de la semana, controles de cabecera | 8 | `rounded-xl` |
| Botones y enlaces dentro del contenido | 7 | `rounded-lg` |
| Bloques de agenda, franjas de aviso | 6 | `rounded-md` |
| Barras de gráfica | 3 | `rounded-sm` |
| Leyendas | 2 | `rounded-xs` |

---

## Anatomía del shell

```
franja reglamentaria          30 px, --banner-bg, texto --banner-ink a 12,5 px
└── lienzo --canvas
    ├── barra lateral         236 px, SOBRE el lienzo, sin panel ni borde
    │   ├── marca             MarcaTerap: cuadrado #172e3a con «t» #d2ed87 + «terap.» en Manrope 800
    │   ├── navegación        elementos de 36 px, radio 7, icono 17 px trazo 1,7
    │   │                     activo: fondo --surface, peso 600, icono --accent
    │   │                     grupos separados por línea, SIN títulos de grupo
    │   └── pie               conmutador de aspecto + identidad con iniciales
    └── hoja --surface        margen 12 px (0 por la izquierda), radio 14
        ├── cabecera          60 px: fecha larga · buscador 300 px con Ctrl K ·
        │                     señal de avisos · «Nueva cita»
        └── contenido         30 px arriba y abajo, 32 px a los lados
```

Por debajo de **1024 px** la barra lateral pasa a cajón (`CajonNavegacion`, que
reutiliza el mismo `ProNav`, no una copia) y la hoja ocupa todo el ancho, sin
margen ni radio: en un móvil, 12 px de margen alrededor de todo es ancho de
contenido que se pierde.

La franja reglamentaria va **oscura en los dos temas**, y por eso usa
`--banner-bg` y no `--ink-1`: en oscuro `--ink-1` es casi blanco, y 30 px de
blanco encendido cruzando la pantalla de noche no es lo que debe hacer un aviso
sobre datos de salud.

---

## Reglas anti-plantilla

Ante la duda, en cualquier pantalla:

- **Ninguna etiqueta en MAYÚSCULAS con espaciado.** Todo en minúscula de frase.
- **Nada de metadatos encadenados con «·».** Comas, o columnas.
- **Nada de «→»** añadido a botones o enlaces.
- **Ninguna palabra suelta en cursiva o color dentro de un titular.**
- **Nada de tarjetas idénticas en mosaico.** Cada bloque recibe el tratamiento
  que pide su jerarquía: sólido (lo que va a pasar ahora), franja (el aviso),
  sin caja sobre la hoja (agendas y listas), tabla con cabecera tintada, bloque
  tintado sin borde (cifras secundarias).
- **Las zonas se separan con una línea `--line` y espacio**, no con más cajas.
- **Nada de gradientes decorativos, bordes laterales de color ni emojis.**
- **Los textos dicen exactamente qué pasa:** «Enviar recordatorio», «Proponer
  cita», «Revisar ahora». No «Gestionar» ni «Ver más».
- **Los estados de cita van en texto de color, no en pastillas rellenas.** La
  pastilla rellena se reserva a los contadores y a lo crítico (`.counter`,
  `.st-solid`).
- **Los estados vacíos dicen qué hacer y no se disculpan.**

---

## Clases del sistema

Viven en `@layer components` de `globals.css`. En Tailwind v4 `@apply` **no
compone clases propias**, así que la base se comparte por grupo de selectores.

| Clase | Qué es |
|---|---|
| `.btn-primary` `.btn-ghost` `.btn-subtle` `.btn-danger` | Los tres niveles: macizo, con borde, sin caja. `.btn-sm` / `.btn-lg` ajustan el alto |
| `.field` `.field-label` | Campo a 16 px, radio 7, borde `--line-strong` |
| `.sheet` | La hoja de trabajo (radio 14, sin borde) |
| `.card` `.island` | Tarjeta con borde `--line`, radio 10 |
| `.tinted` | Bloque tintado sin borde, para cifras secundarias |
| `.table-wrap` `.table-base` | Contenedor de radio 10, cabecera `--surface-subtle`, filas `--line-soft` |
| `.segmented` | Segmentado; el activo se marca con `aria-current` o `aria-pressed` |
| `.tabs` `.tab` `.tab-active` | Pestañas subrayadas |
| `.st` + `.d-*` | Estado: punto de color más etiqueta **siempre** legible |
| `.counter` `.st-solid` | Las únicas pastillas rellenas del sistema |
| `.alert-clinical` | Franja de aviso de seguridad |
| `.page-title` `.section-title` `.section-label` `.figure` `.mono` | Tipografía |
| `.modal` `.modal-header` `.modal-body` `.modal-footer` | Diálogo, radio 12, sin sombra |
| `.empty` | Estado vacío |
| `.skeleton` | Esqueleto de carga |
| `.hatch` | Trama de bloqueo |

---

## Accesibilidad

- **Elementos reales**: `<button>` para acciones, `<a href>` para navegación,
  `<input>` con su `<label>`. Un `<div onClick>` no recibe foco ni se anuncia.
- **Foco visible**: `:focus-visible` pinta un contorno de 2 px en `--accent` con
  2 px de separación. No se quita.
- **El color nunca va solo.** Todo estado lleva etiqueta de texto.
- **`prefers-reduced-motion`** apaga animaciones y transiciones.
- **El zoom no se bloquea**: sin `maximumScale` ni `userScalable: false`.

---

## Lo que la maqueta pide y aquí no está

Anotado para que no se confunda con un olvido:

- **Entradas de navegación sin ruta**: «Mensajes», «Escalas», «Diario
  emocional», «Tareas», «Alertas» y «Documentos». En esta aplicación esas cosas
  viven dentro de la ficha del paciente y no tienen pantalla propia. Ponerlas en
  la barra lateral sería un menú con enlaces muertos.
- **Datos que no existen en el esquema** y que por tanto ningún bloque inventa:
  el horario o disponibilidad del profesional, la lista de espera, la frecuencia
  acordada con cada paciente, la sala o despacho y el estado «enlace de
  videollamada enviado». Las consecuencias concretas están comentadas en
  `src/lib/queries/hoy.ts`.
- **La línea discontinua del máximo** en la gráfica de ocupación: sería la
  disponibilidad semanal, que es justamente lo que no existe.
- **«Cancelaciones con menos de 24 h»**: `attendance = 'late_cancel'` es una
  etiqueta que el profesional marca a mano en el modal de asistencia. No hay
  ninguna regla que compare la hora de cancelación con la de la cita, así que el
  rótulo dice «que marcaste como tardías».

### Una desviación pedida a propósito

La maqueta acota la tarjeta de próxima sesión a «hoy o, si no queda ninguna, la
primera de mañana». **Se amplió a la siguiente cita sea cuando sea**, por
petición expresa del 23-sep: en una consulta con hueco, decir «no queda ninguna
sesión» cuando la hay dentro de tres días es sencillamente falso, y el estado
vacío dejaba de significar «no tienes nada» para significar «no tienes nada en
48 horas».

El encabezado nombra el día en cuanto no es hoy —«mañana», «el lunes», «el 14 de
octubre»— y la insignia pasa a contar en días a partir del día siguiente, porque
«en 31 h 12 min» obliga a hacer la cuenta para saber que es mañana. Las reglas
están en `nombreDelDia` y `formatCuantoFalta` (`src/lib/format.ts`), con pruebas.

---

## Revisión de la implantación (22-sep-2026)

Lo que se comprobó al cerrar el rediseño, y con qué.

### Contraste

`npm run test:contraste`: **66 pares, todos AA en los dos temas**. La tabla de
arriba es su salida. El script encontró un fallo real mientras se escribía —el
oscuro iba a quedar con `--ink-disabled` sobre `--surface-muted` en 4,4995:1—,
que es justo para lo que sirve.

### Teclado

- **«Hoy» no tiene un solo control que no sea un elemento real.** Sus siete
  componentes suman 17 enlaces, cero `<button>` y cero `<div onClick>` o
  `tabIndex` a mano: todo lo que se pulsa es un `<Link>`, así que el recorrido
  con tabulador y la activación con Intro salen del navegador.
- **Agenda**: los bloques del calendario son `<button>`, no `<div>`. El popup de
  vista previa y el modal de edición se cierran con Escape, el modal lleva
  `role="dialog"`, `aria-modal` y foco programático, y el velo de cierre por
  ratón va `aria-hidden` para no anunciarse como un control sin nombre.
- El foco visible (`:focus-visible`, contorno de 2 px en `--accent`) no se
  desactiva en ninguna pantalla.

### Responsive

Un solo corte en el shell, **1024 px**: por debajo, la barra lateral pasa a
cajón y la hoja ocupa todo el ancho sin margen ni radio. Dentro del contenido
los cortes son `sm` (640) y `lg` (1024).

Todos los anchos fijos del panel están sujetos a `lg:` o son `max-w-*`, así que
por debajo de 1024 px no hay ninguno: se comprobó uno a uno. A 390 px la tarjeta
de próxima sesión era el caso más apretado —sus dos columnas interiores sumaban
316 px de los 318 disponibles— y se bajó el mínimo de la gráfica de 180 a 160.

En móvil «Hoy» apila la **tarjeta de próxima sesión por delante de la barra de
jornada**: en un teléfono importa más a quién se atiende dentro de un rato que
cómo queda repartido el día. Se hace con `order`, no moviendo el marcado, para
que el `h1` siga siendo el primer elemento del documento.

### Pruebas

`npm test`: **224** (11 nuevas, sobre la frase de la jornada y el saludo).
`npm run lint`, `npm run typecheck` y `npm run build`, en verde.

Lo que estas pruebas **no** cubren, y conviene no confundir: en este repositorio
vitest corre en Node y ningún test renderiza componentes. Todo lo que toca la
interfaz se comprueba leyendo ficheros con expresiones regulares. **Nada de esto
sustituye a mirar la pantalla**, que sigue pendiente.

### Nada quedó tras una bandera

La especificación permitía esconder tras `NEXT_PUBLIC_FEATURE_*` los bloques sin
datos. **No se ha usado ninguna**, y el motivo es concreto: en la CI el `build`
solo recibe tres variables de entorno, así que cualquier bandera nueva llega
`undefined` y lo único que se compila y se typechequea es la rama apagada. Una
bandera habría dejado el código nuevo sin ninguna puerta de calidad.

En su lugar, cada bloque sin datos dice en voz alta lo que le falta — que es la
otra opción que la especificación daba. Están listados en «Lo que la maqueta
pide y aquí no está».

### Lo que sigue sin comprobarse

- **Revisión visual en navegador.** No hay pantalla en este entorno.
- **Dispositivo físico**: teclado real de iOS y Android, área segura del iPhone
  y rebote del desplazamiento.
- **Modo oscuro mirado de verdad.** Los 66 pares están medidos, pero medir el
  contraste no es lo mismo que ver si la pantalla resulta agradable.
