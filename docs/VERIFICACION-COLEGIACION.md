# Verificación de la colegiación contra el registro del colegio

Migración `20260924100001_verificacion_colegiacion.sql` (la 48). Código en
`src/lib/colegios/`.

## Qué hace

Al completar el alta profesional (`/registro`), el **servidor** consulta el
registro público de colegiados del colegio elegido con el número declarado:

| Resultado | Qué pasa |
|---|---|
| Número exacto encontrado, nombre coincide, «ejerciente» | Alta **aprobada sola** (`verification_source = 'registro'`) |
| Nombre distinto, no encontrado, no ejerciente, número inválido | Queda **pendiente**; la persona ve el motivo en `/registro/estado` y puede corregir y reintentar |
| Colegio sin integración, o la web del colegio falla o cambió | Queda **pendiente** para revisión manual, como antes |
| Número ya verificado en otra cuenta | Queda **pendiente** (`duplicate`) |
| Cuenta ya aprobada, rechazada o provisional | No se toca (`not_pending`) |

La evidencia (URL, número consultado, fila devuelta, veredicto, fecha) se guarda
en `professionals.verification_evidence` y se ve en `/admin`.

## La decisión, y el riesgo aceptado

**Aprobación automática, decidida por Gabriel el 24-sep-2026.** El registro
prueba que ese colegiado **existe y ejerce**; no prueba que quien se registra
**sea él**. Nombre y número son públicos. Mitigaciones:

- **Solo el servidor puede aprobar.** `registry_verify_professional` solo la
  ejecuta `service_role`, y el servidor la llama tras consultar él mismo el
  registro.
- **Un número, una cuenta.** No se aprueba un número ya verificado en otra
  cuenta.
- **No se deshacen decisiones.** Solo se aprueba lo que estaba pendiente.
- **Nada cambia tras aprobar.** Con la acreditación aprobada, reintentar el
  asistente no cambia nombre, colegio ni número.
- **Revocación de un clic.** `/admin` lista las «Aprobadas por el registro» con
  la consulta que las aprobó y un botón para revocarlas.

## Hueco anterior cerrado de paso

`professionals_update_self` permitía a cada profesional actualizar **cualquier
columna** de su fila, incluido `verification_status`. El disparador
`guard_professional_identity` solo protegía `user_id` y `deleted_at`, así que una
cuenta «sin comprobar» podía marcarse «verificada» ella misma por la API. Ahora
nombre, colegio, número y todas las columnas `verification_*` solo cambian por
funciones del servidor. La aplicación nunca escribía esa tabla directamente.

## Colegios

Estudio del 24-sep-2026. El Consejo General no tiene registro estatal: cada
colegio publica el suyo. **La búsqueda es parcial en todos los probados**, así
que siempre se exige el número exacto.

### Integrados

- **Madrid**: GET `listado-colegiados?q=`, HTML de servidor, muestra «Situacion:
  Ejerciente / No ejerciente». Sin `robots.txt` ni restricciones.
- **Asturias**: POST a `directorio_prof_list.php` (`var_numero`, `var_ejerce=0`),
  muestra «Ejerce: Si/No». El aviso legal solo prohíbe reproducir con fines
  comerciales.

### No integrados, y por qué

| Colegio | Motivo |
|---|---|
| Andalucía Oriental (copao.com, «AO») | Técnicamente fácil (POST `numcol`), pero solo distingue alta/baja, no ejerciente, y su aviso legal exige autorización escrita para cualquier «uso». Integrable si el colegio lo autoriza |
| La Rioja, Las Palmas, Álava, Gipuzkoa, Murcia, Extremadura, Andalucía Occidental | Buscan por número pero **no muestran situación**: estar en la lista es la única señal |
| Aragón, Tenerife, Castilla y León, Navarra | No buscan por número (solo apellido o listado completo). Navarra sí muestra situación, pero solo busca por nombre |
| Castilla-La Mancha, Illes Balears, Galicia, Ceuta, Melilla | Listado completo en una sola página, sin situación. Galicia prohíbe la ruta en `robots.txt` |
| Bizkaia | Su aviso legal prohíbe «extraer o reutilizar los contenidos» |
| Cantabria | Solo un PDF, y reutilización prohibida sin autorización escrita |
| Comunitat Valenciana | Protección antibots (Radware) |
| Catalunya | Protección de Cloudflare en todas las rutas |

Andalucía Occidental, además, pide 10 s entre peticiones y bloquea
explícitamente a los rastreadores de IA.

## Añadir un colegio

1. Una `IntegracionColegio` en `src/lib/colegios/<colegio>.ts`: normalizar el
   número, construir la petición, leer las filas (lanzando si el formato cambia)
   y decidir si ejerce.
2. Pruebas con HTML de **estructura real y datos inventados**. En el
   repositorio no va el dato de ningún colegiado.
3. Enlazarla en `COLEGIOS` (`src/lib/colegios/index.ts`).
4. Revisar antes su aviso legal y su `robots.txt`, y anotarlo aquí.

## Despliegue

La migración **se aplica antes** de fusionar: el código escribe
`verification_evidence` y llama a `registry_verify_professional`. Sin la
migración, el registro seguiría funcionando (la verificación falla en silencio y
todas las altas quedan pendientes, como hoy), pero **`/admin` dejaría de
cargar**, porque lee las columnas nuevas.

Requiere `SUPABASE_SERVICE_ROLE_KEY` en Vercel, que ya está (la usa el cron).
