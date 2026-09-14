---
description: Cierra el trabajo en curso — verifica, commitea, abre PR, espera a la CI y mergea a main
allowed-tools: Bash, Read, Edit, Glob, Grep
---

Cierra el trabajo que acabas de hacer y llévalo a producción. **Ejecuta los
pasos en orden y párate en el primero que falle**: un paso rojo no se rodea, se
arregla.

Contexto: `!git branch --show-current` · `!git status --short`

## 1 · Rama correcta

Si estás en `main`, o si la rama no sale de un `origin/main` reciente:

```
git fetch origin
git switch -c <tipo>/<asunto-en-kebab> origin/main
```

`<tipo>` es `feat`, `fix`, `docs`, `chore`, `test` o `refactor`. Los cambios sin
commitear viajan contigo al cambiar de rama.

## 2 · Verificación local, completa

```
npm run lint
npm run typecheck
npm test
npm run test:types
npm run build
npm audit --audit-level=low
```

`npm test` corre en UTC en la CI a propósito, que es la zona del runtime de
Vercel; si tocaste fechas, ejecútalo también con `TZ=UTC` en local.

Si tocaste RLS, migraciones, RPC o Storage, añade la batería HTTP contra
**Supabase local** (nunca el remoto):

```
npx supabase start
npx supabase status -o json > supabase-local.json
node scripts/write-local-env.mjs supabase-local.json
npm run test:integration
```

## 3 · Alinear la documentación

Antes de commitear, comprueba que no dejas el repo mintiendo:

- Si cambió el estado del proyecto, actualiza el bloque **⚑ ESTADO ACTUAL** de
  `CLAUDE.md`. No toques el registro histórico de debajo salvo para tachar algo
  que haya quedado cerrado.
- Si añadiste una migración, añádela a la lista y **di explícitamente en el
  resumen que queda pendiente de aplicar por Gabriel**: tú no tocas el remoto.
- Si cambiaste una tabla, RPC, política o configuración de Auth que consuma el
  paciente, recuerda en el resumen que la app móvil `terap-app` es un segundo
  cliente del mismo backend.

## 4 · Commit

Conventional commits, en español y en minúsculas, un commit por bloque
funcional:

```
git add -A
git commit -m "<tipo>(<ámbito>): <qué cambia, en imperativo>"
```

## 5 · PR

```
git push -u origin HEAD
gh pr create --fill --base main
```

En el cuerpo del PR: qué cambia, qué has descartado y por qué, **qué migraciones
quedan pendientes de aplicar**, y qué ha quedado sin hacer.

## 6 · Esperar a la CI

```
gh pr checks --watch
```

Son tres jobs: calidad (lint · typecheck · test · test:types · build),
auditoría (`npm audit --audit-level=high`) e integración contra Supabase local.
El PR genera además un preview de Vercel: si el cambio se ve, ábrelo y míralo.

## 7 · Merge — esto despliega en producción

```
gh pr merge --squash --delete-branch
```

El hook `scripts/guard-agente.mjs` comprueba contra GitHub que **todos** los
checks estén en verde antes de dejar pasar el merge. Si alguno falla, vuelve al
paso 2. Vercel despliega solo al entrar en `main`.

**No mergees si** la migración que acompaña al código no está aplicada en el
remoto: el código nuevo sobre el esquema viejo rompe producción. En ese caso
para, deja el PR abierto y dilo — la migración la aplica Gabriel.

## 8 · Resumen

Al terminar, en cinco líneas: qué has cambiado, qué queda pendiente por parte de
Gabriel (migraciones, decisiones, validaciones), y el enlace del PR y del
despliegue.
