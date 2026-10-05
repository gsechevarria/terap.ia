-- =============================================================================
-- Pauta de medicación del paciente (módulo opcional por expediente)
--
-- QUÉ ES: la transcripción, por parte del psicólogo, de la pauta que ha
-- indicado el médico o el psiquiatra del paciente. El psicólogo NO prescribe
-- —en España no puede—, y por eso `prescrito_por` es obligatorio en cada
-- medicamento. La aplicación muestra lo anotado y nada más: no calcula dosis,
-- no comprueba interacciones, no sugiere cambios, no recuerda tomas ni
-- registra si se tomó. Cualquiera de esas cosas la acercaría a producto
-- sanitario (MDR) y está fuera de alcance por decisión del 6-oct-2026.
--
-- TRES TABLAS:
--
--   · `patient_medication`: una fila por expediente con el interruptor
--     «mostrar en la app del paciente» (apagado por defecto, como las escalas)
--     y la situación general: requiere medicación sí / no / sin indicar.
--   · `medication_entries`: un medicamento por fila. No se borra: se RETIRA
--     (`retirada_at`). En una pauta de medicación hace falta poder saber qué
--     tomaba el paciente antes, y un borrado lo perdería.
--   · `medication_changes`: registro de cambios —quién, qué y cuándo, con el
--     antes y el después—. Lo escriben SOLO los disparadores de esta
--     migración; nadie tiene permiso de API para insertar, editar ni borrar
--     en ella.
--
-- ACCESO (mismo criterio que `20260916100003_rls_organization_scope`):
--
--   · Profesional asignado al expediente (`professional_owns_patient`): lee y
--     escribe. Aquí NO se limita la edición a quien creó la fila, a diferencia
--     de las notas: una pauta tiene que poder actualizarla quien sustituye al
--     titular, y el registro de cambios dice quién lo hizo.
--   · Paciente: SOLO lectura, SOLO de sus expedientes y SOLO si el módulo está
--     activado. Apagarlo oculta la pauta en la base, no solo en la pantalla.
--     El paciente nunca ve el registro de cambios.
--
-- La app móvil `terap-app` comparte este backend; la migración solo añade
-- objetos, no cambia nada de lo que ya consume.
-- =============================================================================

begin;

-- --- Situación y visibilidad, por expediente ---------------------------------

create table if not exists public.patient_medication (
  patient_id           uuid primary key references public.patients (id) on delete cascade,
  visible_paciente     boolean not null default false,
  -- null = sin indicar; true = con pauta; false = no requiere medicación.
  requiere_medicacion  boolean,
  updated_at           timestamptz not null default now(),
  updated_by           uuid references public.professionals (id) on delete set null
);

comment on table public.patient_medication is
  'Módulo de medicación por expediente: si el paciente lo ve en su app y la situación general. Transcripción de la pauta de su médico; la aplicación no prescribe ni recomienda.';

-- --- Medicamentos -----------------------------------------------------------

create table if not exists public.medication_entries (
  id               uuid primary key default gen_random_uuid(),
  patient_id       uuid not null references public.patients (id) on delete cascade,
  -- Quién lo anotó. Lo fija la base, no el cliente (disparador de abajo).
  professional_id  uuid not null references public.professionals (id) on delete cascade,
  nombre           text not null,
  dosis            text not null,
  -- Momentos del día. Vacío solo si se toma «solo si hace falta».
  momentos         text[] not null default '{}',
  horario          text,
  frecuencia       text not null default 'diaria',
  -- ISO: 1 = lunes … 7 = domingo. Solo con frecuencia «dias_semana».
  dias_semana      smallint[] not null default '{}',
  con_comida       text not null default 'indiferente',
  instrucciones    text,
  prescrito_por    text not null,
  fecha_inicio     date,
  fecha_fin        date,
  retirada_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  updated_by       uuid references public.professionals (id) on delete set null,

  constraint medication_nombre_valido
    check (char_length(btrim(nombre)) between 1 and 200),
  constraint medication_dosis_valida
    check (char_length(btrim(dosis)) between 1 and 200),
  constraint medication_prescriptor_valido
    check (char_length(btrim(prescrito_por)) between 1 and 200),
  constraint medication_horario_longitud
    check (horario is null or char_length(horario) <= 120),
  constraint medication_instrucciones_longitud
    check (instrucciones is null or char_length(instrucciones) <= 1000),
  constraint medication_frecuencia_conocida
    check (frecuencia in ('diaria', 'dias_semana', 'si_precisa')),
  constraint medication_con_comida_conocida
    check (con_comida in ('indiferente', 'con_comida', 'en_ayunas', 'antes_comida', 'despues_comida')),
  constraint medication_momentos_conocidos
    check (momentos <@ array['manana', 'mediodia', 'tarde', 'noche']::text[]),
  constraint medication_momentos_si_pauta_fija
    check (frecuencia = 'si_precisa' or cardinality(momentos) > 0),
  constraint medication_dias_validos
    check (dias_semana <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]),
  constraint medication_dias_si_semanal
    check ((frecuencia = 'dias_semana') = (cardinality(dias_semana) > 0)),
  constraint medication_fechas_ordenadas
    check (fecha_fin is null or fecha_inicio is null or fecha_fin >= fecha_inicio)
);

create index if not exists medication_entries_patient_idx
  on public.medication_entries (patient_id, retirada_at, created_at);

comment on table public.medication_entries is
  'Medicamentos de la pauta transcrita por el psicólogo. prescrito_por es obligatorio: el psicólogo no prescribe. No se borran; se retiran (retirada_at).';

-- --- Registro de cambios ----------------------------------------------------

create table if not exists public.medication_changes (
  id               bigint generated always as identity primary key,
  patient_id       uuid not null references public.patients (id) on delete cascade,
  entry_id         uuid references public.medication_entries (id) on delete set null,
  professional_id  uuid references public.professionals (id) on delete set null,
  accion           text not null,
  antes            jsonb,
  despues          jsonb,
  created_at       timestamptz not null default now(),
  constraint medication_changes_accion_conocida
    check (accion in ('alta', 'cambio', 'retirada', 'reactivada', 'visibilidad', 'situacion'))
);

create index if not exists medication_changes_patient_idx
  on public.medication_changes (patient_id, created_at desc);

-- --- Disparadores -----------------------------------------------------------

/*
 * Antes de escribir un medicamento: la autoría la fija la base. En el alta,
 * `professional_id` es siempre quien escribe (la RLS lo exige además); en un
 * cambio no se puede mover a otro expediente ni reescribir el autor original.
 */
create or replace function public.medication_entries_before_write()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if new.patient_id is distinct from old.patient_id
       or new.professional_id is distinct from old.professional_id
       or new.created_at is distinct from old.created_at then
      raise exception 'No se puede cambiar el expediente ni el autor de un medicamento';
    end if;
  end if;
  new.nombre := btrim(new.nombre);
  new.dosis := btrim(new.dosis);
  new.prescrito_por := btrim(new.prescrito_por);
  new.updated_at := now();
  new.updated_by := public.current_professional_id();
  return new;
end;
$$;

drop trigger if exists medication_entries_before_write on public.medication_entries;
create trigger medication_entries_before_write
  before insert or update on public.medication_entries
  for each row execute function public.medication_entries_before_write();

create or replace function public.patient_medication_before_write()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.patient_id is distinct from old.patient_id then
    raise exception 'No se puede mover el módulo a otro expediente';
  end if;
  new.updated_at := now();
  new.updated_by := public.current_professional_id();
  return new;
end;
$$;

drop trigger if exists patient_medication_before_write on public.patient_medication;
create trigger patient_medication_before_write
  before insert or update on public.patient_medication
  for each row execute function public.patient_medication_before_write();

/*
 * Después de escribir: una fila en el registro de cambios. `security definer`
 * porque `authenticated` no tiene ningún permiso sobre `medication_changes`:
 * el único camino para escribir ahí es este.
 */
create or replace function public.medication_entries_log()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_accion text;
  v_antes jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) - 'updated_at' - 'updated_by' end;
  v_despues jsonb := to_jsonb(new) - 'updated_at' - 'updated_by';
begin
  if tg_op = 'INSERT' then
    v_accion := 'alta';
  elsif old.retirada_at is null and new.retirada_at is not null then
    v_accion := 'retirada';
  elsif old.retirada_at is not null and new.retirada_at is null then
    v_accion := 'reactivada';
  elsif v_antes = v_despues then
    return null; -- guardar sin cambiar nada no es un cambio
  else
    v_accion := 'cambio';
  end if;
  insert into public.medication_changes (patient_id, entry_id, professional_id, accion, antes, despues)
  values (new.patient_id, new.id, public.current_professional_id(), v_accion, v_antes, v_despues);
  return null;
end;
$$;

drop trigger if exists medication_entries_log on public.medication_entries;
create trigger medication_entries_log
  after insert or update on public.medication_entries
  for each row execute function public.medication_entries_log();

create or replace function public.patient_medication_log()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or old.visible_paciente is distinct from new.visible_paciente then
    insert into public.medication_changes (patient_id, professional_id, accion, antes, despues)
    values (new.patient_id, public.current_professional_id(), 'visibilidad',
            case when tg_op = 'UPDATE' then jsonb_build_object('visible_paciente', old.visible_paciente) end,
            jsonb_build_object('visible_paciente', new.visible_paciente));
  end if;
  if tg_op = 'INSERT' or old.requiere_medicacion is distinct from new.requiere_medicacion then
    insert into public.medication_changes (patient_id, professional_id, accion, antes, despues)
    values (new.patient_id, public.current_professional_id(), 'situacion',
            case when tg_op = 'UPDATE' then jsonb_build_object('requiere_medicacion', old.requiere_medicacion) end,
            jsonb_build_object('requiere_medicacion', new.requiere_medicacion));
  end if;
  return null;
end;
$$;

drop trigger if exists patient_medication_log on public.patient_medication;
create trigger patient_medication_log
  after insert or update on public.patient_medication
  for each row execute function public.patient_medication_log();

revoke all on function public.medication_entries_log() from public, anon, authenticated;
revoke all on function public.patient_medication_log() from public, anon, authenticated;

-- --- RLS --------------------------------------------------------------------

alter table public.patient_medication enable row level security;
alter table public.medication_entries enable row level security;
alter table public.medication_changes enable row level security;

/** ¿El paciente actual tiene el módulo visible en este expediente suyo? */
create or replace function public.medication_visible_to_patient(p_patient_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.patient_medication m
     where m.patient_id = p_patient_id
       and m.visible_paciente
       and p_patient_id in (select public.current_patient_ids())
  )
$$;
revoke all on function public.medication_visible_to_patient(uuid) from public, anon;
grant execute on function public.medication_visible_to_patient(uuid) to authenticated;

-- patient_medication
drop policy if exists patient_medication_select_by_professional on public.patient_medication;
create policy patient_medication_select_by_professional on public.patient_medication
  for select to authenticated using (public.professional_owns_patient(patient_id));
drop policy if exists patient_medication_insert_by_professional on public.patient_medication;
create policy patient_medication_insert_by_professional on public.patient_medication
  for insert to authenticated with check (public.professional_owns_patient(patient_id));
drop policy if exists patient_medication_update_by_professional on public.patient_medication;
create policy patient_medication_update_by_professional on public.patient_medication
  for update to authenticated
  using (public.professional_owns_patient(patient_id))
  with check (public.professional_owns_patient(patient_id));
drop policy if exists patient_medication_select_by_patient on public.patient_medication;
create policy patient_medication_select_by_patient on public.patient_medication
  for select to authenticated
  using (visible_paciente and patient_id in (select public.current_patient_ids()));

-- medication_entries
drop policy if exists medication_entries_select_by_professional on public.medication_entries;
create policy medication_entries_select_by_professional on public.medication_entries
  for select to authenticated using (public.professional_owns_patient(patient_id));
drop policy if exists medication_entries_insert_by_professional on public.medication_entries;
create policy medication_entries_insert_by_professional on public.medication_entries
  for insert to authenticated with check (
    professional_id = (select public.current_professional_id())
    and public.professional_owns_patient(patient_id));
drop policy if exists medication_entries_update_by_professional on public.medication_entries;
create policy medication_entries_update_by_professional on public.medication_entries
  for update to authenticated
  using (public.professional_owns_patient(patient_id))
  with check (public.professional_owns_patient(patient_id));
drop policy if exists medication_entries_select_by_patient on public.medication_entries;
create policy medication_entries_select_by_patient on public.medication_entries
  for select to authenticated
  using (public.medication_visible_to_patient(patient_id));

-- medication_changes: solo lectura, solo el profesional asignado.
drop policy if exists medication_changes_select_by_professional on public.medication_changes;
create policy medication_changes_select_by_professional on public.medication_changes
  for select to authenticated using (public.professional_owns_patient(patient_id));

-- --- Permisos de API (convención de 20260911090001) ---------------------------
-- Sin `delete` en ninguna: un medicamento se retira, el módulo se apaga y el
-- registro de cambios no se toca.

revoke all on table public.patient_medication, public.medication_entries, public.medication_changes
  from anon, authenticated;
grant select, insert, update on table public.patient_medication, public.medication_entries
  to authenticated;
grant select on table public.medication_changes to authenticated;
grant all on table public.patient_medication, public.medication_entries, public.medication_changes
  to service_role;

commit;
