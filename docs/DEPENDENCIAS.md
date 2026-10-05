# Dependencias y reproducibilidad

Verificado el 5 de octubre de 2026 con `npm run audit` (umbral `low`, incluyendo desarrollo): ningún aviso fuera de la excepción de abajo.

## Auditoría con excepciones

`npm audit` no sabe ignorar un aviso concreto: o se baja el umbral o se excluye todo el desarrollo, y ambas cosas dejan pasar avisos nuevos en silencio. Por eso la auditoría, en local y en la CI, la hace `scripts/auditoria-dependencias.mjs`:

- Tolera **solo** los identificadores GHSA de su lista. Un paquete se perdona únicamente si todo lo que lo hace vulnerable es una excepción.
- Falla si una excepción ha pasado su fecha de revisión, y avisa cuando una ya no hace falta.
- Local: `npm run audit` (umbral `low`). CI: `--audit-level=high`.

| Aviso | Paquete | Por qué se tolera | Revisar |
|---|---|---|---|
| [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) | `braces` | DoS con patrones anidados. **No hay versión corregida** (3.0.3 es la última). Solo llega por `eslint-config-next` → `@next/eslint-plugin-next` → `fast-glob` → `micromatch`: herramienta de desarrollo, fuera del build de producción, que solo procesa patrones del propio repositorio. La alternativa de npm es bajar `eslint-config-next` a la 14. | 2026-11-05 |

## Versiones

- Next.js y eslint-config-next: 16.3.8, fijados conjuntamente. Subidos desde 16.3.4 el 5-oct por [GHSA-vcvr-r3jv-pc5j](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j) (crítico, ejecución remota en `next/og` `ImageResponse`; la aplicación no lo usa).
- `brace-expansion` (1.1.21, 2.1.7, 5.0.12) y `fast-uri` 3.1.8: actualizados en el lockfile dentro de los rangos ya declarados, sin overrides.
- SheetJS: tarball oficial 0.20.3 con integridad en package-lock.json. Sustituye xlsx 0.18.5 y elimina la excepción anterior. La instalación desde este CDN es el método publicado por [SheetJS](https://docs.sheetjs.com/docs/getting-started/installation/frameworks/).
- Vitest y cobertura: 4.1.11. La configuración `.mts` declara ESM explícitamente.
- PGlite 0.5.8: PostgreSQL embebido para ejecutar migraciones y comprobar RLS, sin servidores ni conexión remota. Auth y Storage se modelan para esta batería; no sustituye su integración HTTP.
- Overrides de desarrollo: sharp ^0.35.4 y tar ^7.5.21 dentro de @capacitor/assets, uuid ^11.1.1 dentro de xcode. Eliminan dependencias transitivas vulnerables. `capacitor-assets --help`, generación de UUID con xcode y conversión de imagen a PNG con sharp se han ejecutado correctamente; la generación completa y las compilaciones nativas quedan para un entorno Android/iOS.

`npm ci` usa el lockfile. Repetir lint, typecheck, test, test:types, build y audit al actualizar dependencias. Un audit limpio informa de avisos conocidos; no prueba por sí solo la seguridad del producto.
