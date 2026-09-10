# Dependencias y reproducibilidad

Verificado el 10 de septiembre de 2026 en Node 24.15.0 con `npm audit --audit-level=low`: **0 vulnerabilidades conocidas**, incluyendo desarrollo. No hay exclusiones de advisories.

- Next.js y eslint-config-next: 16.3.4, fijados conjuntamente.
- SheetJS: tarball oficial 0.20.3 con integridad en package-lock.json. Sustituye xlsx 0.18.5 y elimina la excepción anterior. La instalación desde este CDN es el método publicado por [SheetJS](https://docs.sheetjs.com/docs/getting-started/installation/frameworks/).
- Vitest y cobertura: 4.1.11. La configuración `.mts` declara ESM explícitamente.
- PGlite 0.5.8: PostgreSQL embebido para ejecutar migraciones y comprobar RLS, sin servidores ni conexión remota. Auth y Storage se modelan para esta batería; no sustituye su integración HTTP.
- Overrides de desarrollo: sharp ^0.35.4 y tar ^7.5.21 dentro de @capacitor/assets, uuid ^11.1.1 dentro de xcode. Eliminan dependencias transitivas vulnerables. `capacitor-assets --help`, generación de UUID con xcode y conversión de imagen a PNG con sharp se han ejecutado correctamente; la generación completa y las compilaciones nativas quedan para un entorno Android/iOS.

`npm ci` usa el lockfile. Repetir lint, typecheck, test, test:types, build y audit al actualizar dependencias. Un audit limpio informa de avisos conocidos; no prueba por sí solo la seguridad del producto.
