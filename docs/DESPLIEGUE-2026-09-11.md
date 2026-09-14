# Despliegue de terap.ia — 11 de septiembre de 2026

- Producción: https://terap.vercel.app
- Repositorio: https://github.com/gsechevarria/terap.ia
- Propuesta integrada: https://github.com/gsechevarria/terap.ia/pull/1
- Commit de producción: `8ac6931b6b46a490822f4aa85cb252954c96564d`.
- Despliegue con configuración verificada: `dpl_DVW9ohDCEUxhYTebT7ycKi23tPrV`.
- Supabase `levufuoigdlexscpvlgk`: 39 migraciones aplicadas (13 nuevas).

## Verificación

CI de la propuesta y de main completada correctamente: lint, tipos, 124 pruebas de lógica, 38 regresiones SQL, 39 migraciones, conservación de históricos, integración HTTP con Auth/PostgREST/Storage y operaciones simultáneas, auditoría y compilación. La integración ejecutó 11 escenarios con datos ficticios locales.

Producción: portada, acceso y manifiesto responden 200. Con una sesión profesional temporal, panel, agenda, pagos, analítica y gastos responden 200 sin errores RSC. La sesión temporal se cerró. Las rutas privadas sin sesión redirigen al acceso y el cron sin autorización responde 401. La llamada autenticada al cron responde 200 y `ok: true`.

La introspección remota coincide con los nombres de las 30 tablas, sus columnas, la vista y las 25 funciones tipadas; esto no afirma identidad textual ni de nulabilidad con el generador del CLI.

Vercel Hobby no permite cron cada minuto. La programación se ha trasladado a Supabase (`pg_cron` y `pg_net`), con secreto en Vault y Vercel. La primera invocación programada devolvió HTTP 200 sin timeout ni error. No se ha contratado ningún plan adicional. Las credenciales de servidor y VAPID se han comprobado sin publicarlas.

## Copia de seguridad y conservación

Copia más reciente antes de las migraciones: `../BACKUPS/SUPABASE-predeploy-20260911-072941/database.dump`, con índice de objetos y SHA-256 en `manifest.json`. Es privada. Existe también la copia del repositorio original en `../BACKUPS/PROYECTO-20260909-185808`.

El archivo PostgreSQL se pudo abrir; la primera copia también se decodificó íntegramente a SQL. No se ha ensayado una restauración completa sobre otra instancia de Supabase. Storage contenía cero objetos.

Antes y después: 17 pacientes, 3 profesionales, 217 citas, 157 pagos, 933000 céntimos acumulados en pagos y 31 gastos. No se borraron datos ni se alteraron los importes históricos. El original y los tres scripts preexistentes del usuario se conservaron.

## Aspectos pendientes de los datos de prueba

El diagnóstico detecta 121 ingresos sin tratamiento fiscal confirmado, 31 gastos y 3 bienes pendientes de revisión; hay cinco bonos con diferencias entre saldo y consumos y cinco sin el registro de compra esperado. Son incoherencias históricas: no se han inventado pagos, consumos o criterios fiscales para hacerlas desaparecer. No hay pagos vinculados a expedientes ajenos, roles profesionales incoherentes ni endpoints push inválidos.

No se ha realizado revisión visual con navegador conectado, pruebas en móviles físicos ni entrega push a un dispositivo real. El push nativo y el envío alternativo por correo siguen desactivados. El dominio configurado es `terap.vercel.app`; no se ha identificado otro dominio personalizado.
