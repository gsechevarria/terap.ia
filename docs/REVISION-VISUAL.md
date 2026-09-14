# Revisión visual en navegador — guion para ejecutar a mano

**Por qué existe este documento.** La revisión visual de los dos roles lleva
pendiente desde el despliegue del 11-sep. El agente **no puede hacerla**: este
entorno no tiene navegador ni ninguna herramienta que lo conduzca (no hay
Playwright ni Puppeteer en `package.json`), y la verificación del 11-sep se hizo
sobre el HTML servido, que no es lo mismo que mirar la pantalla. Lo que sigue es
el guion para que lo recorra una persona.

Cada comprobación dice **qué se espera** y de dónde sale esa expectativa, para
que un resultado distinto sea un hallazgo y no una duda.

## Preparación

- Entorno: `https://terap.vercel.app` (demostración, `NEXT_PUBLIC_DEMO_MODE=true`).
- Credenciales ficticias que deja `scripts/seed-demo.mjs`:
  `dra.romero@demo.terapia` (profesional) y `ana.nadal@demo.terapia` (paciente).
- Navegador con la consola abierta (pestañas **Console** y **Network**) durante
  todo el recorrido. Un aviso de CSP o un error de RSC en consola cuenta como
  fallo aunque la pantalla se vea bien.
- Dos perfiles de navegador o una ventana privada: hacen falta las dos sesiones a
  la vez en el apartado 4 y en el 8.

> Los apartados marcados **(requiere Gabriel)** necesitan `service_role` o el
> panel de Supabase. No los puede preparar el agente.

---

## 1 · Consentimiento: alta y renovación

**Alta.** Desde la ficha de un paciente sin cuenta → *Generar enlace de
invitación* → abrir el enlace en la otra ventana.

- [ ] `/invite/<token>` muestra la vista pública sin exigir sesión.
- [ ] Tras el enlace mágico se llega a `/onboarding/<token>` con el texto del
      consentimiento **traído de la base de datos**, no incrustado en el cliente
      (lo sirve `get_onboarding_consent`).
- [ ] Sin marcar la casilla, el botón no completa el alta.
- [ ] Completado el alta, `/app` carga. El enlace de invitación **ya no vale**:
      reabrirlo da error (token de un solo uso).

**Renovación (requiere Gabriel).** No hay interfaz de profesional para editar
plantillas de consentimiento — lo he comprobado, no existe. Para provocar la
renovación hay que insertar a mano una nueva versión activa en
`consent_templates` para esa profesional.

- [ ] Con la nueva versión activa, el paciente que ya había firmado y entra en
      `/app` es redirigido a `/onboarding/current`
      ([layout.tsx:29](../src/app/app/layout.tsx#L29)).
- [ ] Se le muestra el **texto nuevo**, no el que firmó.
- [ ] Mientras no acepte, no alcanza ninguna vista de `/app`: `current_patient_id()`
      depende de `has_current_consent()`, así que sin firma no hay ni datos.
- [ ] Al aceptar, **se conserva la firma anterior**: quedan dos filas en
      `consents`, no una sobrescrita.

---

## 2 · Fallos de conexión

Con **Network → Offline**, o bloqueando el dominio de Supabase:

- [ ] Una acción de servidor que falla muestra un mensaje en español y **no** una
      pantalla en blanco. Hay límites de error en `/`, `/app`, `/pro` y
      `/pro/contabilidad`.
- [ ] Ninguna consulta fallida se disfraza de lista vacía: donde no hay datos
      debe distinguirse «no hay nada» de «no se pudo cargar».
- [ ] Al recuperar la red, reintentar funciona sin recargar entera la página.
- [ ] Recargar estando sin red en `/app` sirve `offline.html` desde el service
      worker (`public/sw.js`), no el error del navegador.

---

## 3 · Formularios

En el alta de gasto (`/pro/contabilidad/gastos`) y en el alta de paciente:

- [ ] Si la acción falla, **los valores escritos siguen ahí**. En el gasto, el
      archivo seleccionado también.
- [ ] Los mensajes de validación se ven en producción (no solo en desarrollo).
- [ ] El selector de fecha propio (`DateField`) abre, navega por mes y año, y el
      valor viaja con el formulario.
- [ ] Cambiar preferencias de notificación y contraseña muestra el resultado,
      acierte o falle.

---

## 4 · Diálogo de cita con teclado

`/pro/agenda`, vista de día o semana. **Solo teclado, sin ratón:**

- [ ] Se llega a una cita con Tab y se abre con Enter.
- [ ] El diálogo se anuncia como «Modificar cita» (`role="dialog"`, `aria-modal`,
      `aria-label`, en [AgendaCalendar.tsx:799](../src/app/pro/_components/AgendaCalendar.tsx#L799)).
- [ ] Tab **no se escapa** del diálogo; ciclo cerrado.
- [ ] Escape lo cierra y el foco **vuelve** a la cita de origen.
- [ ] Con la ventana a 375 px de ancho, el diálogo se desplaza y los botones
      quedan alcanzables.
- [ ] Con un lector de pantalla, los campos de asistencia se leen con su nombre.

---

## 5 · Exportaciones

| Ruta | Qué comprobar |
|---|---|
| `/pro/contabilidad/export?formato=xlsx` | Tres hojas de libros + resumen; **la fila de aviso de parámetros sin confirmar está dentro del archivo**; se abre en Excel y en LibreOffice |
| `…&formato=pdf` | Las líneas no se salen ni se solapan |
| `…&formato=csv` | Separador `;`, decimales con coma, BOM (tildes correctas en Excel); un texto que empiece por `=`, `+`, `-` o `@` sale **neutralizado**, no como fórmula |
| `/pro/pagos/export` | Respeta los filtros aplicados en `/pro/pagos/historico` |
| `/appointments/<id>/ics` | Se importa en Google Calendar y en Apple Calendar con la hora correcta; **no** incluye las notas del profesional |
| `/pro/patients/<id>/scales/<id>/export` | CSV con BOM |

⚠️ **`/pro/contabilidad` y `/pro/contabilidad/export` fallarán hoy**, y es a
propósito: hay históricos sin confirmar. Ver
[DIAGNOSTICO-HISTORICOS.md](DIAGNOSTICO-HISTORICOS.md). Este apartado no se puede
cerrar hasta que se decida ese criterio.

---

## 6 · CSP

La política se genera por petición con nonce en [`src/proxy.ts`](../src/proxy.ts)
a partir de [`src/lib/csp.ts`](../src/lib/csp.ts).

- [ ] **Cero avisos de CSP en consola** recorriendo las siete vistas del panel y
      las siete de la app.
- [ ] En las cabeceras de respuesta, `script-src` trae `'nonce-…'` y
      `'strict-dynamic'`, y **no** `'unsafe-eval'` (eso solo en desarrollo).
- [ ] `connect-src` incluye el origen de Supabase y su equivalente `wss:`; las
      llamadas a la base no se bloquean.
- [ ] Los gráficos SVG (`ScoreChart`, `BarChart`) se pintan: usan atributos
      `style`, cubiertos por `style-src 'unsafe-inline'`.
- [ ] `frame-ancestors 'none'`: la app no se deja incrustar en un `iframe`.

---

## 7 · PWA

En un móvil físico, Android y iOS:

- [ ] Se instala desde el navegador; icono y nombre correctos.
- [ ] Abierta como aplicación (standalone), arranca en `/app`.
- [ ] `AppTabBar` queda **por encima** del indicador de inicio de iOS (área
      segura) y no tapa contenido al hacer scroll hasta abajo.
- [ ] La pestaña activa se marca correctamente en las cinco secciones.
- [ ] El botón **024** está siempre visible en la cabecera y llama.
- [ ] `/app/appointments/new` es usable con el pulgar: día y franjas horarias.
- [ ] Al navegar, se ven los `loading.tsx` en vez de pantallas en blanco.
- [ ] Web Push: activar en `/app/settings`, aceptar el permiso, y confirmar que
      llega un aviso. Push **nativo** sigue desactivado a propósito, y el
      fallback por correo no existe en la interfaz: no aparecen como opción.

---

## 8 · Cierre de sesión compartiendo dispositivo

El escenario real: paciente y profesional usan el mismo portátil de consulta.

- [ ] Al cerrar sesión desde `/app/more`, **se borran las suscripciones push de
      esa cuenta** (`push_subscriptions` y `device_push_tokens`,
      [signout/route.ts](../src/app/auth/signout/route.ts)). Si el borrado falla,
      la respuesta es 503 y **la sesión no se cierra en silencio**.
- [ ] Tras cerrar sesión, el botón «atrás» del navegador **no** devuelve datos
      del paciente a la pantalla.
- [ ] Entrando después como profesional, no llega ningún aviso push dirigido al
      paciente anterior.
- [ ] Rutas privadas sin sesión (`/app`, `/pro`, `/pro/pagos`) redirigen a
      `/login`.
- [ ] El banner de demostración sigue visible en los dos roles.

---

## Cómo anotar el resultado

Una línea por casilla que falle: ruta, rol, navegador, qué se esperaba, qué pasó,
y captura si es visual. Lo que salga de aquí se convierte en encargos concretos;
lo que pase, se marca en el bloque **ESTADO ACTUAL** de `CLAUDE.md` como
verificación hecha y con qué fecha.
