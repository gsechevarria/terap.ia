# Revisión y correcciones — 10 de septiembre de 2026

## Alcance y protección del trabajo

Se ha trabajado exclusivamente en `PROYECTO-correcciones-20260909-185808`, rama `fix/correcciones-integrales-20260909-185808`, partiendo de `5b264c00fc2b287acd79183c2a3c8b8f594c26b6`. El repositorio original permanece separado.

La copia de seguridad previa está en `../BACKUPS/PROYECTO-20260909-185808`: `repositorio.zip`, `historial.bundle`, `manifest.json`, estado original y LEEME. Incluye los archivos locales; puede contener secretos y debe mantenerse privada. No se copiaron credenciales de producción al entorno de correcciones.

Se conservan, sin incluirlos en los commits de esta revisión, los tres scripts que ya estaban modificados o añadidos por el usuario:

- `supabase/scripts/reparar-historial.sql`
- `supabase/scripts/verificar-historial.sql`
- `supabase/scripts/verificar-remoto.sql`

Implementación guardada en el commit local `af26955` (`fix: integrar seguridad, transacciones y coherencia de datos`).

## Correcciones implementadas

| Área | Problema tratado y comportamiento resultante | Evidencia local |
|---|---|---|
| Roles | El alta sin rol administrativo explícito crea un paciente. `user_metadata` no concede privilegios. Un profesional desactivado pierde su ámbito de datos. | SQL y comprobación de tipos |
| Vinculación | Un profesional no puede asignar cuentas a fichas directamente. Invitación, vinculación y firma se completan de forma transaccional. | SQL |
| Consentimiento | Se muestra y firma la plantilla almacenada, con versión, cuerpo y hash. Una nueva versión requiere aceptación. Un hash histórico incoherente no habilita acceso. | SQL y build |
| Historial de consentimiento | Se conserva cada versión aceptada; las plantillas no se reescriben en el mismo identificador. Las RPC antiguas no permiten saltarse el alta completa. | SQL |
| Expedientes | Se archivan pacientes en lugar de permitir su borrado profesional. Las referencias de pagos y bienes deben corresponder al mismo profesional y paciente. | SQL |
| Escalas | Se comprueba asignación, escala, fechas, recurrencia y respuestas completas. El paciente no puede falsificar el acuse. El profesional no puede cambiar la respuesta al marcarla revisada. | SQL y pruebas de lógica |
| Alertas | Los contadores excluyen las respuestas ya revisadas; la lista de alertas pendientes se pagina sin truncarla a veinte registros. | Código, tipos y consultas paginadas |
| Tareas | Completar una tarea es una RPC con bloqueo de fila y resultado idempotente. No hay inserción directa por el paciente. | SQL |
| Diario | Una entrada por fecha de Madrid, editable durante el día. La interfaz recupera la entrada existente y permite actualizarla. | SQL, lógica y build |
| Citas | Asistencia, liquidación, devolución de sesión y cancelación se coordinan dentro de una transacción. Sin tarifa se revierte el cambio. Un cobro real no desaparece al corregir una cita. | SQL |
| Bonos | Compra y pago se crean juntos. Los reintentos con el mismo identificador no duplican compras. No se pueden modificar saldos por API directa. Se permite archivar y reactivar desde la ficha. | SQL, tipos y build |
| Pagos | Se preserva la fecha de cobro en reintentos. Se impide reasignar referencias económicas o editar una imputación como si fuera un cobro. | SQL |
| Gastos | Gasto, bien, IVA no recuperable y afectación se guardan juntos. Una edición parcial conserva la inversión y su amortización. | SQL y lógica |
| Histórico fiscal | Ingresos y gastos conservan su tratamiento por operación. Los históricos sin confirmar quedan pendientes de revisión; no se reinterpretan con la configuración actual. Los consumos de bono de importe cero no se exportan como ingresos. | SQL, prueba de actualización con históricos y lógica |
| Amortización | Se prorratea por días, incluyendo años bisiestos, se conserva la última fracción y nunca se supera el coste. La vida declarada es informativa en este cálculo lineal orientativo. | Pruebas de lógica |
| Exportación | Las retenciones confirmadas aparecen en el libro. Se separa el resumen anual del periodo de los libros; CSV neutraliza fórmulas en texto y PDF ajusta las líneas. ICS omite las notas profesionales. | Pruebas de lógica y build; revisión visual pendiente |
| Consultas | Los errores no se convierten en ceros o listas vacías. La paginación avanza según las filas recibidas, incluso con un límite de servidor inferior. Los solapes de agenda no dependen de un recorte fijo. | Pruebas de lógica |
| Fechas | Se usa Europe/Madrid en calendario, diario, ingresos y analítica. Las horas inexistentes por cambio de horario se rechazan. La recurrencia tiene un máximo real de 26 ocurrencias. | Pruebas de lógica |
| Archivos | Subida firmada directamente a Storage con límite de 20 MB y validación de formato, tamaño, propietario y referencia pendiente. El archivo de un recurso debe coincidir con su tipo. | SQL y lógica; Storage HTTP pendiente |
| Limpieza | Cola persistente para archivos sustituidos, eliminados o subidas abandonadas. El cron comprueba que el archivo ya no tenga referencias antes de limpiarlo. | SQL; ejecución real del trabajador pendiente |
| Notificaciones | Tareas, escalas y citas encolan avisos en su misma transacción. Cron reclama lotes exclusivos, registra entregas por dispositivo, reintenta y descarta recordatorios que ya no corresponden. | SQL y pruebas de autenticación del cron |
| Push | Solo se admiten endpoints de proveedores previstos. El contenido enviado es genérico; la navegación se restringe a rutas internas. Al cerrar sesión se revocan las suscripciones de la cuenta. | SQL, lógica y build |
| Canales no implementados | La interfaz no ofrece fallback por correo. El push nativo queda desactivado hasta disponer de emisor FCM/APNs y validación en dispositivos. | Código y configuración |
| Formularios | Las acciones devuelven resultados estructurados y mensajes de validación en producción. Los formularios conservan los valores al fallar; el gasto conserva también el archivo seleccionado. Los errores de preferencias y contraseña quedan gestionados. | Tipos, lógica y build; interacción visual pendiente |
| Accesibilidad | El diálogo de edición de cita tiene nombre accesible, gestión de Tab/Escape, restauración de foco y desplazamiento en pantallas pequeñas. Los contactos de emergencia quedan fuera del bloqueo biométrico. | Código y build; teclado/dispositivos pendientes |
| CSP y telemetría | Nonce por petición para scripts, HTML dinámico, orígenes externos acotados. Sentry requiere activación explícita, no envía texto libre ni trazas. | Pruebas de lógica, proxy y build |
| Dependencias | Next y herramientas actualizados, SheetJS desde el tarball oficial, overrides documentados y lockfile actualizado. | Audit sin vulnerabilidades conocidas |
| Validación continua | SQL y comprobación reproducible de tipos en CI. Integración HTTP obligatoria en PR y main, con Supabase local desechable y sin operaciones de borrado del script. | Configuración y sintaxis; CI remota pendiente |

## Migraciones nuevas

Se han añadido once migraciones, `20260909190001` a `20260909190011`: invariantes de seguridad; transacciones económicas; consentimiento versionado; entregas y limpieza; subidas pendientes; fiscalidad de ingresos; protección frente a escrituras directas; notificaciones transaccionales; fiscalidad de gastos; tareas idempotentes; integridad del consentimiento.

Se han ejecutado las **37 migraciones del repositorio** en PostgreSQL embebido. El ensayo introduce registros anteriores a las correcciones y comprueba que sus importes se conservan y su revisión fiscal queda pendiente.

Las restricciones `NOT VALID` protegen escrituras nuevas sin reparar ni borrar datos históricos. El script [diagnostico-correcciones-202609.sql](../supabase/scripts/diagnostico-correcciones-202609.sql) permite localizar incoherencias tras aplicar las migraciones en una copia aislada. Revisar cada resultado antes de validar restricciones. No ejecutar reparaciones masivas ni marcar migraciones como aplicadas sin comprobar el esquema real.

Estas migraciones **no se han aplicado a Supabase remoto**. El código y las migraciones forman una misma entrega: no publicar solo el frontend sobre el esquema anterior.

## Verificación realizada y límites

- `npm test`: **124 pruebas, 8 archivos, correctas**.
- `npm run test:types`: **37 regresiones SQL**, conservación de históricos, alta sin escalada y tipos reproducibles.
- `npm run typecheck`: correcto.
- `npm run lint`: correcto, sin advertencias.
- `npm run build`: correcto con credenciales ficticias; las páginas que requieren nonce se generan dinámicamente.
- `npm audit --audit-level=low`: **0 vulnerabilidades conocidas**, incluyendo desarrollo.
- `capacitor-assets --help`, generación de UUID con xcode y conversión PNG con sharp: correctos. No equivalen a una compilación nativa completa.
- `scripts/write-local-env.mjs`: comprobado con estado ficticio; genera tres variables en líneas independientes sin mostrar claves.
- La guardia de integración rechaza destinos remotos, credenciales en URL y rutas distintas de la raíz antes de cualquier petición.

PGlite ejecuta PostgreSQL y RLS, pero modela los catálogos de Auth y Storage; **no prueba GoTrue, PostgREST, Storage HTTP ni concurrencia entre conexiones reales**. Los tipos se han generado de ese esquema embebido y deben contrastarse con el CLI contra la instancia completa antes del despliegue.

`supabase status` confirma que no existe el motor local de Docker disponible (`docker_engine` no encontrado). No se ha ejecutado `npm run test:integration`. La batería HTTP nueva contiene once escenarios, con fixtures locales conservadas al terminar; los antiguos scripts por área delegan en ella. No se atribuyen a la nueva batería los recuentos históricos de las anteriores.

La revisión interactiva en navegador sigue pendiente: en la revisión anterior el control automático rechazó arrancar el servidor local sin facilitar motivo. Durante esta sesión también rechazó la primera preparación de integración; se resolvió preparando una alternativa sin operaciones de borrado. No se ha intentado eludir el bloqueo del servidor.

## Lo necesario antes de publicar

1. Disponer de Docker/Supabase local o de CI con Docker; instalar desde el lockfile, arrancar una instancia desechable, generar `.env.test` con `scripts/write-local-env.mjs` y ejecutar la batería HTTP completa. Revisar especialmente relaciones PostgREST, concurrencia, URLs firmadas y subida de archivos.
2. Probar en navegador los dos roles, alta y renovación del consentimiento, fallos de conexión, formularios, diálogo con teclado, exportaciones y CSP; probar también la PWA y el cierre de sesión compartiendo dispositivo.
3. Aplicar las migraciones en staging respaldado, ejecutar el diagnóstico de históricos y confirmar los tratamientos fiscales pendientes. Revisar administrativamente las altas profesionales antiguas: el rol actual no demuestra el origen legítimo de un alta realizada bajo el esquema vulnerable.
4. Configurar Web Push y un programador del cron compatible con la frecuencia de `vercel.json`; comprobar entrega, reintentos y limpieza real. El plan de hosting no se ha consultado ni modificado.
5. Mantener desactivados push nativo y telemetría hasta su validación correspondiente. El emisor FCM/APNs y el fallback por correo no se han implementado como parte de esta corrección.
6. Validar con los responsables del producto el uso de datos reales, conservación y alcance de las estimaciones fiscales. Esta revisión técnica no acredita cumplimiento ni transforma los resúmenes en declaraciones presentadas.

No hay remoto Git configurado en la copia. No se ha hecho push ni despliegue.

## Prompt unificado para completar la validación pendiente

> Trabaja exclusivamente en PROYECTO-correcciones-20260909-185808 y lee AGENTS.md, CLAUDE.md y docs/CORRECCIONES-2026-09.md. Conserva los tres scripts del usuario excluidos de los commits. Usa las guías locales de la versión instalada de Next.js. Parte de los cambios y pruebas existentes, sin rehacerlos ni afirmar que la integración HTTP ya está validada. Con Supabase local desechable disponible, ejecuta npm ci, lint, typecheck, test, test:types, build, audit y test:integration. Corrige los fallos reales, manteniendo las garantías de roles, consentimiento, transacciones, aislamiento de archivos, integridad fiscal y privacidad. Contrasta los tipos con Supabase completo. Comprueba en navegador los flujos de ambos roles, errores de red, accesibilidad, CSP, exportaciones y PWA. En staging respaldado, revisa el diagnóstico de históricos y comprueba que las migraciones se corresponden con el estado real; no elimines ni repares datos ambiguos automáticamente. Valida Web Push, cron y limpieza de archivos con credenciales de pruebas. Mantén desactivados los canales no implementados. Documenta resultados reales y bloqueos, y deja commits revisables. No envíes mensajes, no publiques ni alteres producción sin autorización explícita para ese entorno.
