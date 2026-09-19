# terap.ia — la app del paciente: contexto para evaluar un módulo nuevo

Documento de contexto. Describe **qué es la aplicación del paciente hoy, con qué
reglas está construida y qué tendría que cumplir cualquier módulo nuevo** que se
le añada. Está escrito para alguien que no tiene acceso al código.

Lo que aquí se afirma está tomado del repositorio, no de memoria. Donde algo no
está verificado, se dice.

---

## 1. Qué es el producto

**terap.ia** es una aplicación de bienestar mental para **psicólogos de consulta
privada y sus pacientes**. Producto completo, en producción desde septiembre de
2026, con dos áreas separadas:

- **`/pro`** — panel del profesional (agenda, expedientes, pagos, contabilidad).
- **`/app`** — aplicación del paciente. **Es el objeto de este documento.**

La app del paciente se distribuye como **PWA**. Existe además un segundo cliente
nativo (Expo) que ataca el mismo backend, así que **cualquier cambio de esquema,
RLS, RPC o configuración de autenticación afecta a dos clientes**.

Hoy el entorno es de **demostración con datos ficticios**, con una franja
permanente que lo declara. El paso a datos reales está bloqueado por requisitos
jurídicos, no técnicos (ver §3).

---

## 2. Restricciones de producto — vinculantes

Estas no son preferencias de estilo. Son decisiones tomadas para mantener el
producto fuera de tres marcos regulatorios, y **un módulo nuevo que las rompa no
es un módulo mejor: es un producto distinto, con otro coste de cumplimiento**.

### 2.1 Nada que interprete o recomiende clínicamente

Interpretar o recomendar convertiría la aplicación en **producto sanitario**
(MDR, Reglamento UE 2017/745), con marcado CE y todo lo que arrastra.

Consecuencias concretas y visibles en el código:

- El diario emocional registra el ánimo y lo muestra. **No lo analiza, no
  sugiere nada, no detecta patrones.** Desde el 19-sep muestra un mensaje fijo
  de acompañamiento al elegir «Mal» o «Regular», que depende solo de la opción
  pulsada: no lee la nota, no usa ningún modelo y no avisa a nadie.
- Los cuestionarios clínicos (PHQ-9, GAD-7) se puntúan en base de datos, pero
  **al paciente NO se le muestra ni su puntuación ni su severidad**. Solo una
  confirmación de que ha respondido. La puntuación la ve el profesional.
- La única excepción es el **ítem 9 del PHQ-9** (ideación suicida): si el
  paciente lo marca, ve inmediatamente recursos de emergencia reales (024, 112 y
  los que haya cargado su profesional). No es interpretación; es un teléfono.

### 2.2 Nada que emita facturas

Evita **Veri*factu** y la Ley Antifraude española. La aplicación hace
**seguimiento** de pagos (precios, bonos de sesiones, deuda, exportación para la
gestoría) pero **nunca emite una factura**. Hay un libro registro de facturas
emitidas *fuera* de la aplicación: anotar no es emitir.

### 2.3 Datos de salud, artículo 9 del RGPD

Todo lo que el paciente escribe es **categoría especial de datos**. El
consentimiento está versionado, firmado con hash del texto, y **no es
falsificable por el interesado**: se firma mediante una función de servidor que
hashea la plantilla activa en base de datos, no un texto enviado por el cliente.

### 2.4 Fuera de alcance por ahora

Videoconsulta integrada (solo hay un campo «enlace de videollamada» en la cita)
y mensajería profesional-paciente.

---

## 3. Arquitectura técnica

| | |
|---|---|
| Framework | Next.js 16 (App Router, React 19, TypeScript estricto) |
| Estilos | Tailwind CSS v4 (configuración en CSS, sin `tailwind.config.js`) |
| Backend | Supabase (PostgreSQL + Auth + Storage), región UE |
| Despliegue | Vercel |
| Tareas programadas | `pg_cron` + `pg_net` **dentro de Supabase**, no en Vercel |
| Pruebas | Vitest (lógica pura) · PGlite (PostgreSQL embebido: migraciones y RLS) · batería HTTP contra Supabase local |

Particularidades de Next.js 16 que importan: el *middleware* se llama ahora
**`proxy`** y corre en runtime Node.js; `cookies()` es **asíncrono**.

**No hay capa de API propia.** El navegador habla directamente con Supabase
(PostgREST), y **la autorización la impone la base de datos**, no el servidor de
aplicación. Esto es lo más importante de todo el documento: ver §5.

---

## 4. Identidad, roles y aislamiento

### 4.1 El rol

Tres valores, y viven **solo** en `app_metadata` del usuario de autenticación,
que únicamente escribe el servidor:

- `patient` — el rol sin privilegios. Es el que se asigna por defecto.
- `professional_pending` — alta enviada, pendiente de revisión humana.
- `professional` — aprobado.

**Nunca se lee `user_metadata`**: es de escritura libre para el propio usuario,
así que cualquier paciente podría ascenderse a profesional.

### 4.2 Rol ≠ contexto de trabajo

`app_metadata.role` dice qué **puede** hacer la cuenta. Dónde trabaja lo dicen
sus datos: sus membresías de organización y sus expedientes.

**Una misma persona puede ser profesional en un centro y paciente en otro.** Sus
expedientes en centros distintos **no se fusionan**: son documentos clínicos
separados, con consentimientos separados, y ninguno de los dos profesionales ve
el del otro. Por eso `current_patient_id()` tiene hermano en plural
(`current_patient_ids()`).

> Un módulo nuevo que asuma «un usuario = un paciente = un profesional» estará
> mal desde el primer día.

### 4.3 La organización es la unidad de aislamiento

Consulta individual o centro con varios profesionales. Dos separaciones que no
conviene romper:

- **Administrar ≠ acceder.** Ser miembro de un centro da permisos sobre el
  centro y el equipo; **no abre un solo expediente**. El acceso clínico se
  concede expediente a expediente.
- El profesional de referencia de un expediente y quien tiene acceso a él son
  cosas distintas.

### 4.4 Defensa en profundidad

Tres capas, y la última es la que manda:

1. **`proxy.ts`** — refresca la sesión y redirige por rol. Es **optimista**, no
   es la capa de autorización.
2. **Layout de servidor de cada área** — revalida el usuario y el rol. El layout
   de `/app` exige además **consentimiento firmado** antes de renderizar nada.
3. **Row Level Security en PostgreSQL** — la verdadera frontera.

---

## 5. Cómo se lee y cómo se escribe

Esto es el corazón de la arquitectura y donde un módulo nuevo se juega su
seguridad.

### 5.1 Lectura: RLS por política

El paciente lee directamente las tablas, y la política decide qué filas ve.
Tablas con lectura del paciente hoy:

`patients` (solo la suya) · `professionals` (solo el suyo) · `appointments` ·
`appointment_requests` · `tasks` y `task_completions` · `scale_assignments` y
`scale_responses` · `mood_entries` · `resources` · `documents` (solo los
marcados como compartidos) · `payments`, `payment_settings`, `session_packs` ·
`consents` y `consent_templates` · `notifications` · `patient_assignments`.

### 5.2 Escritura: casi todo pasa por funciones de servidor

Aquí está el patrón que hay que entender. **Las escrituras sensibles no tienen
política de `INSERT`/`UPDATE`.** El único camino es una función `SECURITY
DEFINER` con permisos concedidos explícitamente. Motivo: una política valida
*filas*, pero no puede garantizar que una operación de varios pasos sea atómica
ni que se hayan hecho las comprobaciones de negocio.

Ejemplos reales, y por qué se hizo así:

| Operación | Función | Por qué no es una política |
|---|---|---|
| Confirmar o cancelar una cita | `patient_respond_appointment` | La política anterior permitía al paciente cambiar **cualquier** columna: el horario, las notas del psicólogo… |
| Firmar el consentimiento | `patient_accept_consent` / `complete_onboarding` | El interesado podía fabricar su propia evidencia del artículo 9. Ahora el hash se calcula en servidor sobre la plantilla activa. |
| Pedir cita | `patient_request_appointment` | Tope de 3 solicitudes vivas, antelación mínima de 1 h, comprobación de solapes contra citas y bloqueos. La tabla **no tiene política de insert**. |
| Retirar una solicitud | `patient_withdraw_request` | |
| Completar una tarea | `complete_patient_task` | Idempotencia. |
| Aceptar una invitación | `accept_invitation` | Token de un solo uso, comprobación del destinatario, vinculación atómica. |

Lo que sí es escritura directa por política: **el diario emocional** (con una
restricción: es **inmutable pasado el día**, se separa en insert / select /
update-hoy / delete-hoy) y **las respuestas a cuestionarios** (validadas además
por disparador en servidor).

### 5.3 El camino desde la interfaz

`Componente cliente` → `server action` (en `src/lib/actions/`) → `RPC o tabla`.
Las lecturas van por una **capa de consultas centralizada** (`src/lib/queries/`);
no se hacen consultas sueltas desde las páginas.

### 5.4 Invalidación de caché — trampa conocida

Next.js cachea rutas renderizadas en servidor. `revalidatePath` sobre una ruta
que nadie invalida **no da ningún error**: el dato queda bien en la base y la
pantalla enseña lo de antes. Ha fallado en las dos direcciones ya.

Hay dos ayudantes, `revalidatePaciente()` y `revalidateProfesional()`, y una
**prueba automática** que falla si una acción escribe en nombre del paciente sin
invalidar nada del profesional, o al revés.

> **No hay tiempo real.** La invalidación refresca al siguiente acceso a la
> pantalla; no empuja nada. Es una decisión, no una carencia pendiente.

---

## 6. Qué hace la app del paciente hoy

Armazón de **100 dvh**: cabecera y navegación fijas, una sola zona que se
desplaza. Barra inferior de cinco pestañas, con área segura de iOS.

**El teléfono 024** (línea española de atención a la conducta suicida) está
visible en la cabecera **de todas las pantallas**, sin esconderse detrás de
ningún menú.

### Pestaña 1 — Inicio (`/app`)

Saludo con fecha · **próxima sesión** destacada (con enlace de videollamada si
lo hay) · aviso de solicitudes de cita pendientes · **cuestionarios activos** ·
**tareas** asignadas por el profesional, que el paciente marca como hechas con
un texto libre opcional · registro rápido de ánimo · deuda pendiente.

Si la cuenta no tiene expediente vinculado, se gestiona ese estado
explícitamente.

### Pestaña 2 — Citas (`/app/appointments`)

Próximas y anteriores · **confirmar o cancelar** · descargar el `.ics` ·
abrir la videollamada.

**Pedir cita** (`/app/appointments/new`): día y franjas horarias, pensado para
el pulgar. Genera una *solicitud*, que el profesional resuelve. Aceptarla crea o
mueve la cita y cierra la solicitud en la misma transacción.

Matiz de producto: **cancelar no es pedir permiso**. La cancelación directa del
paciente no pasa por el circuito de solicitudes — no presentarse es su derecho.

### Pestaña 3 — Diario (`/app/diary`)

Ánimo en **cuatro caras** (Mal · Regular · Bien · Muy bien) con nota libre,
histórico y gráfica semanal. Sin análisis ni sugerencias. Un registro por día e
inmutable pasado el día.

Conviven **dos escalas**: los registros anteriores al 19-sep usan la de cinco
opciones y conservan su valor y su significado. Cada fila lleva su escala en
`mood_entries.mood_scale`, y no se mezclan en una gráfica ni se promedian. Ver
[DIARIO-EMOCIONAL.md](DIARIO-EMOCIONAL.md).

### Pestaña 4 — Recursos (`/app/resources`)

Enlaces y archivos (PDF, audio) que comparte el profesional. Los archivos se
sirven por **URL firmada**, y la RLS de Storage decide si se emite.

### Pestaña 5 — Más (`/app/more`)

Pagos · notificaciones · contraseña · tema claro/oscuro · cerrar sesión.

### Fuera de las pestañas

- **Cuestionario** (`/app/scales/[assignmentId]`) — solo aparecen las escalas
  que el profesional ha activado **y** que tocan por calendario. Sin activación,
  el paciente no ve ninguna. Responder no devuelve puntuación.
- **Alta por invitación** — enlace con token de un solo uso → consentimiento →
  entrada. Es el **único** camino para que exista una cuenta de paciente: **no
  hay autorregistro**.
- **Notificaciones** — Web Push con VAPID, filtradas por preferencias del propio
  paciente en el momento del envío (el profesional no puede leer esas
  preferencias). Push nativo desactivado: no hay emisor configurado.

---

## 7. Sistema visual

El CSS de la app del paciente vive **aislado** en un único fichero, con sus 279
selectores colgando de una clase raíz `.tp-app` y sus variables con prefijo
propio.

El aislamiento no es estética, es una corrección: la entrega original traía
selectores desnudos (`body`, `button`, `svg`, `a`) y **Next conserva el CSS ya
cargado al navegar por cliente**, así que bastaba con pasar por la app del
paciente para repintar el panel del profesional. Hay una **prueba que falla si
alguien vuelve a colar un selector suelto** o redefine una variable global.

Ese fichero va **sin capa de cascada**, así que gana a cualquier utilidad de
Tailwind. Consecuencia práctica: su bloque de reinicio es corto **a propósito**,
y los componentes compartidos con el panel se repintan al final del fichero en
vez de modificarse.

Otras reglas: iconos de una única librería, **sin emojis en la interfaz**, y
modo oscuro por clase. Once colores de la entrega original se subieron para
cumplir **contraste AA**, porque la paleta entregada daba 2,41:1 en el texto de
marcador de posición.

---

## 8. Lo que deliberadamente no existe

Distinguir esto de «lo que falta» ahorra propuestas que ya se descartaron:

| No existe | Motivo |
|---|---|
| Autorregistro de pacientes | Solo por invitación de un profesional |
| Puntuación visible al paciente | §2.1 |
| Interpretación del diario | §2.1 — los mensajes de apoyo son texto fijo por opción, no interpretación |
| Emisión de facturas | §2.2 |
| Mensajería profesional-paciente | Fuera de alcance, fase posterior |
| Videoconsulta integrada | Solo un campo de enlace |
| Edición de su propia ficha | La ficha es documento clínico del profesional |
| Tiempo real | No previsto |
| Funcionamiento sin conexión | Hay página de «sin conexión» y precarga del armazón; cachear datos clínicos en el dispositivo es decisión de producto |

---

## 9. Qué tendría que cumplir un módulo nuevo

Lista de comprobación para evaluar cualquier propuesta:

1. **¿Interpreta, puntúa, recomienda o detecta patrones?** Si sí, choca con
   §2.1. Hay que rediseñarlo o aceptar el marco de producto sanitario.
2. **¿Emite algún documento con valor fiscal?** Choca con §2.2.
3. **¿Qué datos nuevos guarda?** Si son de salud, arrastran artículo 9: hay que
   decidir si entran en el consentimiento existente o requieren uno nuevo
   versionado.
4. **¿Cómo se aísla?** Toda tabla nueva necesita RLS **desde la migración que la
   crea**, y permisos de API declarados explícitamente: en este proyecto una
   tabla nueva **no se expone sola**.
5. **¿La escritura es de varios pasos o tiene reglas de negocio?** Entonces no
   lleva política de insert: lleva función `SECURITY DEFINER`.
6. **¿Funciona con una persona que es paciente en dos centros?** Ver §4.2.
7. **¿Qué pantallas del profesional quedan desactualizadas al escribir?** Hay
   que invalidarlas, y hay una prueba que lo exige.
8. **¿Afecta al segundo cliente nativo?** Cualquier cambio de esquema, RLS, RPC
   o autenticación, sí.
9. **¿Cabe en cinco pestañas?** La navegación está llena. Un módulo nuevo entra
   dentro de una existente, o desplaza a otro.
10. **¿Su CSS cuelga de la clase raíz?** Si no, repintará el panel del
    profesional.
11. **¿Añade una dependencia?** El proyecto las evita deliberadamente: son
    superficie de auditoría permanente. Hay un escritor de ZIP propio de unas
    100 líneas por ese motivo.

---

## 10. Estado y limitaciones que conviene conocer

- **Sin revisión en dispositivo físico.** Teclado real de iOS/Android, área
  segura del iPhone, rebote del desplazamiento y la PWA instalada **no se han
  comprobado nunca**. Se revisa a 320, 375, 390 y 430 px en navegador.
- **Entrega push real a un dispositivo**: sin comprobar.
- **Correo transaccional** limitado a una dirección hasta que haya dominio
  verificado.
- El envío de notificaciones por correo como alternativa al push **se retiró de
  la interfaz**: estaba modelado pero nunca se implementó, y una opción que no
  hace nada es peor que no ofrecerla.

---

## 11. Principio de fondo

Dos criterios explican la mayoría de las decisiones de este código, y sirven
para juzgar una propuesta nueva:

**La base de datos es la frontera de seguridad, no el servidor de aplicación.**
El cliente habla directamente con PostgREST. Si la RLS no lo impide, no está
impedido.

**Lo que no se ha comprobado se dice.** El repositorio distingue entre lo
verificado por una prueba, lo declarado por una persona y lo que nadie ha
mirado. Una propuesta que dependa de algo del tercer grupo debería decirlo.
