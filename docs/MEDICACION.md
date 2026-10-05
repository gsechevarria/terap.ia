# Pauta de medicación

Módulo opcional por paciente, añadido el 6-oct-2026. Migración `20261006100001_medicacion.sql` (la 50).

## Qué es y qué no es

El psicólogo **transcribe** la pauta que ha indicado el médico o el psiquiatra del paciente. En España el psicólogo no prescribe, así que «Prescrito por» es obligatorio en cada medicamento.

La aplicación muestra lo anotado y nada más. No hace ninguna de estas cosas:

- calcular dosis;
- comprobar interacciones;
- sugerir cambios;
- recordar tomas;
- registrar si el paciente se lo ha tomado.

Las dos últimas se descartaron de forma explícita el 6-oct-2026. Cualquiera de ellas acercaría el producto a la categoría de producto sanitario (MDR). Si se retoman, hay que decidirlo de nuevo, no añadirlas sin más.

## Dónde está

| Quién | Dónde | Qué ve o hace |
|---|---|---|
| Profesional | Ficha del paciente, pestaña **Medicación** | Casilla «Mostrar la pauta en la app del paciente», situación (sin indicar, no requiere o con pauta), alta, edición y retirada de medicamentos, retirados y registro de cambios |
| Paciente | **Más → Mi medicación** (`/app/medicacion`) | La pauta de hoy por momento del día, la pauta completa, lo que empieza más adelante y un aviso fijo para no cambiar la medicación sin hablar con su médico |
| Paciente | **Inicio**, tarjeta «Tu medicación de hoy» | Solo si hay algo pautado para hoy |

Si el módulo está apagado, el paciente no ve ni la entrada en «Más». No es solo la pantalla: la base no le devuelve las filas.

## Modelo

- **`patient_medication`**: una fila por expediente. Guarda `visible_paciente`, que por defecto es `false`, y `requiere_medicacion`, que es `null`, `true` o `false`.
- **`medication_entries`**: un medicamento por fila. **No se borra, se retira** con `retirada_at`. La base impide cambiar el expediente y el autor de una fila.
- **`medication_changes`**: registro de cambios con el antes y el después. Lo escriben solo los disparadores, y nadie tiene permiso de API para insertar, editar ni borrar en ella.

**Acceso:**

- Lee y escribe el profesional asignado al expediente (`professional_owns_patient`). A diferencia de las notas, puede editar quien sustituye al titular, y el registro de cambios dice quién lo hizo.
- El paciente solo lee, solo sus expedientes y solo con el módulo activado.
- El registro de cambios lo ve solo el profesional.

Las pruebas están en `scripts/lib/sql-regressions.mjs`, en el bloque «Medicación»: 8 regresiones que cubren visibilidad, aislamiento, borrado, autoría y coherencia de la pauta.

## Aplicar

La migración solo añade objetos, así que no toca nada de lo que ya consume la app móvil `terap-app`.

1. Pega `supabase/migrations/20261006100001_medicacion.sql` en el editor SQL del panel de Supabase y ejecútalo.
2. Comprueba el resultado:

   ```sql
   select count(*) from information_schema.tables
    where table_schema = 'public'
      and table_name in ('patient_medication', 'medication_entries', 'medication_changes');
   -- 3
   ```

3. Fusiona el PR. El código nuevo sobre el esquema viejo rompería la pestaña.

Como se aplica desde el editor, el historial del CLI vuelve a quedar desincronizado. Ver «Convenciones» en `CLAUDE.md`.

## Revertir

Solo si el módulo no tiene datos que conservar. Primero se revierte el código y después:

```sql
begin;
drop table if exists public.medication_changes;
drop table if exists public.medication_entries;
drop table if exists public.patient_medication;
drop function if exists public.medication_visible_to_patient(uuid);
drop function if exists public.medication_entries_log();
drop function if exists public.patient_medication_log();
drop function if exists public.medication_entries_before_write();
drop function if exists public.patient_medication_before_write();
commit;
```
