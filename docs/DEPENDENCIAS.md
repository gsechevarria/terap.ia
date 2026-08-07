# Dependencias: excepciones y por qué

Este fichero existe para que las excepciones aceptadas en `npm audit` estén
documentadas **en el repositorio**, y no solo en la cabeza de quien las aceptó.

## `xlsx@0.18.5` — advisories aceptados

`npm audit` marca `xlsx` por *prototype pollution* y *ReDoS*. 0.18.5 es la
última versión publicada en el registro público de npm y esos avisos **no están
corregidos en ese canal**: el mantenedor publica los parches fuera de npm, en
`cdn.sheetjs.com`.

**Por qué se acepta hoy:** ambos advisories afectan al *parser*. Aquí la
librería se usa **solo para escribir**, desde datos propios y ya validados:

- `XLSX.utils.book_new()`
- `XLSX.utils.aoa_to_sheet()`
- `XLSX.write()`

No se llama a `XLSX.read` ni a `XLSX.readFile` en ningún punto del repositorio,
así que no hay entrada no confiable que pueda alcanzar el parser. El único
consumidor es `src/app/pro/contabilidad/export/route.ts`, que lleva un comentario
apuntando aquí.

**Condición para revisar esta excepción:** en cuanto se importe un XLSX de un
tercero —por ejemplo, para cargar gastos desde el fichero de la gestoría— esta
excepción deja de ser válida y hay que migrar antes de escribir esa función.

### Cómo salir de la excepción

Dos caminos, por orden de preferencia:

1. **Fijar el tarball oficial por integridad**, que sí trae los parches:
   ```
   npm i https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz
   ```
   Contra: la instalación depende de un CDN externo, lo que complica los
   entornos sin salida a internet y las builds reproducibles.

2. **Sustituir por `exceljs`**, que está en npm y se mantiene. Es la opción
   limpia; cuesta reescribir `buildXlsx` (unas 60 líneas).

Mientras tanto, la CI ejecuta `npm audit --audit-level=high --omit=dev`, que no
incluye este paquete por ser dependencia de producción con el aviso conocido: si
apareciera un advisory **nuevo** de severidad alta, el job fallaría.

## Actualizaciones automáticas

`.github/dependabot.yml` abre PR semanales agrupados (Next, Supabase, Capacitor,
desarrollo y resto) para que la revisión sea abordable en vez de veinte PR
sueltos que nadie mira.
