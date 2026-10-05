# Sincronización panel del profesional ⇄ app del paciente

Prueba del 6-oct-2026. La batería vive en `tests/sincronizacion/` y se ejecuta con `npm run test:sincronizacion` contra Supabase **local**. La CI la ejecuta en el job de integración.

## Cómo se ha probado

**Las acciones y consultas reales, no copias.** Cada caso escribe con la server action real de un lado, por ejemplo `createTaskAction`. Después lee con la consulta real que pinta la pantalla del otro, por ejemplo `getTasksForPatient` del inicio del paciente. Las sesiones son reales: Supabase Auth emite el JWT y PostgREST aplica la RLS como en producción.

Solo se sustituye lo que existe únicamente dentro de un servidor Next:

- las cookies, porque el cliente de Supabase es el del usuario activo;
- `server-only`;
- `revalidatePath`, que se registra en vez de ejecutarse.

Además del Supabase local, se revisó el código entero: qué escribe cada acción, qué lee cada pantalla, con qué filtros, y todas las capas de caché.

## Resultado

**48 casos:**

- **41 correctos.** Cada dominio se replica bien en las dos direcciones.
- **7 fallos confirmados.**

**Estado a 6-oct, tras las correcciones:** los siete están corregidos (H0, H1, H2, H3 ×2, H4 y H5) y la batería tiene 52 casos, todos correctos y sin ninguna marca `it.fails`. H3 lleva la migración `20261006120001_solicitudes_por_asignacion`. H6, H7 y H8 se corrigieron también el 6-oct, con `RefrescoAutomatico` y el ajuste del formulario del diario. H9 lleva la migración `20261006130001_aviso_cambio_cita`. Lo que sigue es el diagnóstico original.

| Dominio | Profesional → paciente | Paciente → profesional |
|---|---|---|
| Ficha | Cambio de nombre: ✅ | — |
| Tareas | Crear, editar y borrar: ✅ | Completar con respuesta: ✅ |
| Citas sueltas | Crear con videollamada, mover, cancelar y borrar: ✅ | Confirmar y cancelar: ✅ |
| Citas recurrentes | **H0** corregido: la serie completa, a la misma hora de Madrid | — |
| Asistencia | Acudió genera deuda y pendiente la deshace: ✅. En una cita futura se rechaza: ✅ | — |
| Solicitudes | Aceptar crea la cita y cierra la solicitud: ✅ | Pedir, contador y retirar: ✅ |
| Escalas | Activar, desactivar y opt-in: ✅ | Responder; deja de estar pendiente: ✅ |
| Pagos y bonos | Deuda, cobro y sesiones de bono: ✅ | — |
| Recursos | Por paciente, generales y borrado: ✅ | — |
| Documentos y recursos en archivo | Subida real, compartir y dejar de compartir, también el acceso al archivo: ✅. **H5** corregido | — |
| Diario | — | Registrar y borrar: ✅ |
| Medicación | Apagado, activado, editar, retirar, situación y volver a apagar: ✅ | — |
| Notas privadas | No cruzan: ✅ | — |
| Aislamiento | Otro paciente no ve nada: ✅ | — |
| Archivar y reactivar | La app saca al paciente y la base no le da datos; al reactivar vuelve todo: ✅ | — |
| Avisos | Tarea, cita y escala nuevas encolan aviso: ✅ | — |

## Hallazgos

### Graves

**H0 · Las citas recurrentes no se podían crear. CORREGIDO el 6-oct:** cada fila lleva su id. Además, una fecha de fin enviada como día suelto ya incluye ese día; el formulario del panel ya enviaba 23:59 y no estaba afectado.

- **Dónde:** `createAppointmentAction`, en `src/lib/actions/appointments.ts`.
- **Por qué:** inserta la serie en un solo `insert` y solo la cita madre lleva `id`. supabase-js manda el resto con `id` NULL, y la base rechaza la serie entera.
- **Qué ve el psicólogo:** «No hemos podido guardar los cambios» al crear cualquier serie, sea semanal, quincenal o mensual.
- **Desde cuándo:** viene de un cambio del 7 de agosto, y ninguna prueba creaba series.
- **Arreglo:** dar un `crypto.randomUUID()` a cada fila.

**H5 · Subir archivos fallaba. CORREGIDO el 6-oct.** Gabriel lo confirmó en producción. Ahora se leen `size` y `contentType`, con `metadata` como respaldo. Además, el botón nativo para elegir el archivo no se veía, porque el reinicio de estilos lo dejaba como texto; ahora tiene la clase `.campo-archivo` en los cuatro selectores: documentos, recursos, alta de gasto y sustitución de justificante. Lo que sigue es el diagnóstico original.

- **Dónde:** `requireUploadedFile`, en `src/lib/upload-server.ts`.
- **Por qué:** compara `info().metadata.size` y `metadata.mimetype`, pero Storage devuelve el tamaño y el tipo en `size` y `contentType`, y deja `metadata` vacío.
- **Qué ve el psicólogo:** «El archivo no coincide con la subida autorizada» al subir un documento, un recurso en archivo o un justificante de gasto.
- **Comprobado:** en el Supabase local, con Storage v1.73.1.
- **Sin comprobar:** si producción lleva la misma versión; el agente no tiene acceso. Se confirma subiendo un documento cualquiera en terap.es.
- **Arreglo:** leer `size` y `contentType`, con `metadata` como respaldo.

### Medios

**H1 · Una sesión en curso desaparecía del inicio del paciente. CORREGIDO el 6-oct:** se muestra hasta que termina, rotulada «Sesión en curso · Ahora».

- **Dónde:** `getUpcomingAppointments` filtra `starts_at > ahora`.
- **Efecto:** a los cinco minutos de empezar, la tarjeta «Próxima sesión» y su botón de videollamada desaparecen. Es justo cuando el paciente llega tarde y lo busca.
- **Contraste:** «Citas» sí la muestra, porque filtra por `ends_at`.

**H3 · En un centro, el colaborador asignado no veía las solicitudes ni tenía al paciente en su listado. CORREGIDO el 6-oct:** las consultas dejan de filtrar por profesional de referencia y confían en la RLS, que da los expedientes asignados. Lo mismo `requireOwnedPatient`: antes el colaborador abría la ficha y no podía crear ni una tarea. La migración `20261006120001` deja resolver la solicitud a cualquier asignado. Una cita nueva va a la agenda de quien acepta; una movida, a la de quien la tenía.

- **Dónde:** `getRequestsForProfessional`, `countPendingRequests` y `listPatientsWithOverview` filtran por el profesional de referencia.
- **Efecto:** el colaborador sí abre la ficha, ve las tareas y ve al paciente en «Hoy», porque la RLS se lo permite.
- **Alcance:** solo afecta a centros con más de un profesional.

**H4 · Una cuenta con expediente en dos consultas rompía la app del paciente. CORREGIDO el 6-oct:** `getCurrentPatient` usa el mismo expediente al que van las escrituras del paciente (`current_patient_id()`, el activo y consentido más antiguo). Elegir entre consultas desde la app queda como funcionalidad aparte.

- **Dónde:** `getCurrentPatient` hace `.maybeSingle()` sobre `user_id`.
- **Efecto:** con dos filas PostgREST devuelve error y todas las pantallas de `/app` caen en la página de error.
- **Contexto:** el modelo de organizaciones del 16-sep permite expresamente que una persona sea paciente en dos centros.

**H6 · Una pantalla ya abierta no se actualizaba sola. CORREGIDO el 6-oct:** `src/components/RefrescoAutomatico.tsx`, montado en los layouts de `/app` y `/pro`, hace `router.refresh()` en cuatro casos: al volver a la app tras más de 10 s fuera, al reconectar, al volver con atrás o adelante desde la caché del navegador, y cada 2 minutos mientras la pantalla está a la vista. El estado de los formularios se conserva. Diagnóstico original: afecta a los dos lados.

- **Causa:** no hay tiempo real, ni sondeo, ni refresco al volver la app al primer plano.
- **Cuánto dura:** el paciente con la PWA abierta ve lo que había al cargar hasta que navega a otra pantalla, recarga o hace él mismo una acción. Pueden ser horas si la app estaba en segundo plano.
- **Atrás y adelante:** también muestran la versión anterior.
- **Lo que sí funciona:** una navegación nueva siempre trae datos frescos. No hay ninguna caché que sirva datos viejos: el service worker solo usa la página sin conexión y todo es `force-dynamic`.
- **Arreglo propuesto:** `router.refresh()` al volver al primer plano (`visibilitychange`). Sería barato y no necesita tiempo real.

### Bajos

- **H2 · Una cita futura cancelada desaparecía de la ficha. CORREGIDO el 6-oct:** ahora sale en «Próximas citas» con su estado. «Próximas citas» excluye las canceladas e «Historial» exige que ya haya pasado. Sigue visible en la agenda y en «Todas las citas».
- **H7 · El formulario del diario podía quedarse con el valor de la carga. CORREGIDO el 6-oct:** se ajusta cuando cambia el registro de hoy o el día. De paso, el editor de etiquetas de la ficha se vuelve a montar si cambian las etiquetas. `MoodEntryForm` guarda en estado lo recibido al montarse. Se nota con el mismo paciente en dos dispositivos o al cruzar la medianoche con la app abierta.
- **H8 · Los contadores de la barra lateral no se actualizaban al cambiar de sección. CORREGIDO el 6-oct:** `RefrescoAutomatico` refresca también al navegar si el último refresco tiene más de un minuto. Afecta a «Solicitudes» y al punto de avisos, porque el layout no se vuelve a pedir en navegaciones internas. Se actualizan al recargar.
- **H9 · Mover o cancelar una cita no avisa al paciente.** Solo se avisa al crearla. Es una decisión de producto, no un fallo.

### Lo que NO es un problema, aunque lo parezca

**Huecos de `revalidatePath`.** Varias acciones del profesional no invalidan rutas de `/app`, por ejemplo recursos y documentos. Ocurre lo mismo al revés con `/pro/patients`.

No tiene efecto entre usuarios. `revalidatePath` solo refresca el navegador de quien hace el cambio, y no hay caché de datos en el servidor. Arreglarlo no haría que el otro dispositivo se enterase antes. Para eso está H6.

## Cómo ejecutarla

```
npx supabase start
npx supabase status -o json > supabase-local.json
node scripts/write-local-env.mjs supabase-local.json
npm run test:sincronizacion
```

`tests/sincronizacion/entorno.ts` se niega a ejecutarse si `.env.test` no apunta a `localhost`: la batería crea usuarios y escribe datos.
