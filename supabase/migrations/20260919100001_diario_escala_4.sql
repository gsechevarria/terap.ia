-- =============================================================================
-- Diario emocional: escala de cuatro caras, sin reescribir el histórico
--
-- El diario nació con una escala de 1 a 5 («Muy mal · Mal · Normal · Bien ·
-- Muy bien»). Pasa a cuatro opciones («Mal · Regular · Bien · Muy bien»).
--
-- El problema no es el rango, es el SIGNIFICADO. En la escala de cinco, un 3
-- es «Normal»; en la de cuatro, un 3 es «Bien». Convertir los valores antiguos
-- —o, peor, dejarlos quietos y reinterpretarlos con las etiquetas nuevas—
-- cambiaría en silencio lo que un paciente dijo sobre cómo se sentía un martes
-- de agosto. Eso es falsificar un registro clínico, aunque sea sin querer.
--
-- Por eso la escala viaja CON cada fila:
--
--   · `mood_scale` = cuántas opciones tenía la escala con la que se registró.
--   · Las filas anteriores se quedan en 5, que es exactamente lo que eran.
--   · Las nuevas se graban con 4.
--
-- Ninguna fila cambia de valor y ninguna cambia de significado. La aplicación
-- sabe leer las dos, las muestra por separado y NO las promedia ni las dibuja
-- en la misma serie: no son la misma medida.
--
-- Límite del discriminante, dicho explícitamente: `mood_scale` distingue por
-- número de opciones, no por versión de etiquetas. Si algún día se renombran
-- las cuatro caras sin cambiar cuántas son, esta columna no bastará y hará
-- falta un discriminante propio.
--
-- No toca RLS: las políticas de `mood_entries` (propiedad del expediente,
-- inserción solo con fecha de hoy en hora española, edición y borrado solo el
-- mismo día) siguen exactamente igual y siguen siendo quien decide.
-- =============================================================================

begin;

-- La escala con la que se registró la fila. 5 para todo lo anterior: no es un
-- valor de relleno, es lo que de verdad eran.
alter table public.mood_entries
  add column if not exists mood_scale smallint not null default 5;

comment on column public.mood_entries.mood_scale is
  'Número de opciones de la escala con la que se registró esta fila (5 = escala original 1-5; 4 = escala de cuatro caras). El valor de mood_value solo se interpreta junto a esta columna.';

-- El rango deja de ser fijo y pasa a depender de la escala de la propia fila.
-- El `check` original (`mood_value between 1 and 5`) permitiría un 5 en una
-- fila de escala 4, que no significa nada.
alter table public.mood_entries
  drop constraint if exists mood_entries_mood_value_check;

alter table public.mood_entries
  drop constraint if exists mood_entries_escala_conocida;
alter table public.mood_entries
  add constraint mood_entries_escala_conocida check (mood_scale in (4, 5));

alter table public.mood_entries
  drop constraint if exists mood_entries_valor_en_escala;
alter table public.mood_entries
  add constraint mood_entries_valor_en_escala
  check (mood_value between 1 and mood_scale);

-- Longitud de la nota. El límite ya existía, pero solo en la acción de
-- servidor, y RECORTABA en silencio: quien escribía de más perdía el final sin
-- enterarse. Ahora se rechaza arriba, con aviso, y la base lo sostiene.
--
-- `not valid` a propósito: protege toda escritura nueva sin arriesgar el
-- despliegue por una fila histórica más larga. Es la misma convención que usan
-- las claves compuestas de 20260909190001.
alter table public.mood_entries
  drop constraint if exists mood_entries_nota_longitud;
alter table public.mood_entries
  add constraint mood_entries_nota_longitud
  check (note is null or char_length(note) <= 5000) not valid;

commit;
