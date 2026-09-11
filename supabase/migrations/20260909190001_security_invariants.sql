-- Correcciones verificables: no borra ni reinterpreta datos históricos.
begin;
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_pro_id uuid;
  v_role   text := 'patient';
begin
  -- Un rol ya presente en app metadata (alta creada por un admin) manda sobre
  -- lo que venga del cliente.
  if new.raw_app_meta_data ->> 'role' in ('professional', 'patient') then
    v_role := new.raw_app_meta_data ->> 'role';
  end if;

  if v_role not in ('professional', 'patient') or v_role is null then
    v_role := 'patient';   -- por defecto, el rol sin privilegios
  end if;

  update auth.users
     set raw_app_meta_data =
           coalesce(raw_app_meta_data, '{}'::jsonb)
           || jsonb_build_object('role', v_role)
   where id = new.id;

  if v_role = 'professional' then
    insert into public.professionals (user_id, email, full_name)
    values (new.id, new.email, new.raw_user_meta_data ->> 'full_name')
    on conflict (user_id) do nothing
    returning id into v_pro_id;

    if v_pro_id is not null then
      perform public.ensure_consent_template(v_pro_id);
    end if;
  end if;

  return new;
end;
$$;
create or replace function public.patients_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if TG_OP = 'INSERT' then
    if new.user_id is not null and auth.uid() is not null then
      raise exception 'La cuenta se vincula mediante invitación';
    end if;
    return new;
  end if;
  if public.current_professional_id() is distinct from old.professional_id
     and (new.professional_id is distinct from old.professional_id
          or new.status is distinct from old.status) then
    raise exception 'No autorizado a modificar el vínculo o el estado del paciente';
  end if;

  -- El vínculo con la cuenta solo se establece aceptando una invitación.
  --
  -- Se permite en dos casos:
  --  · `accept_invitation` marca el GUC `terapia.linking_patient` dentro de su
  --    transacción (`current_setting(..., true)` devuelve NULL si no está);
  --  · `auth.uid()` es NULL, es decir, la llamada NO viene de un usuario
  --    autenticado por PostgREST sino de `service_role`/`postgres` (seed,
  --    scripts de prueba, mantenimiento). Ese rol ya salta la RLS entera, así
  --    que bloquearlo aquí no aportaría seguridad y sí rompería el seed.
  --
  -- Lo que se cierra es el caso real del hallazgo: un PROFESIONAL autenticado
  -- reasignando o borrando el `user_id` de una ficha por PostgREST, sin token,
  -- sin caducidad y sin dejar registro.
  if new.user_id is distinct from old.user_id
     and auth.uid() is not null
     and coalesce(current_setting('terapia.linking_patient', true), '') <> 'on' then
    raise exception 'El vínculo con la cuenta solo se establece aceptando una invitación';
  end if;

  return new;
end;
$$;
drop trigger if exists patients_guard on public.patients;
-- El nombre anterior varía entre revisiones; se conserva el guard de UPDATE.
create trigger patients_guard_insert before insert on public.patients
for each row execute function public.patients_guard();
drop policy if exists patients_delete_by_professional on public.patients;
-- Archivo mediante status=archived; las purgas requieren un procedimiento administrativo.
create or replace function public.accept_invitation(p_token text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_inv   public.invitations%rowtype;
  v_uid   uuid := auth.uid();
  v_email text;
  v_hash  text := encode(extensions.digest(p_token, 'sha256'), 'hex');
begin
  if v_uid is null then
    raise exception 'autenticación requerida';
  end if;

  select email into v_email from auth.users
    where id = v_uid and email_confirmed_at is not null
      and coalesce(raw_app_meta_data->>'role', 'patient') = 'patient';
  if v_email is null then raise exception 'Se requiere una cuenta de paciente con correo verificado'; end if;

  select * into v_inv from public.invitations
   where token_hash = v_hash
     and accepted_at is null
     and expires_at > now()
   for update;
  if not found then
    raise exception 'Invitación inválida, caducada o ya utilizada'
      using errcode = 'P0001';
  end if;

  if v_inv.email is null
     or lower(v_inv.email) is distinct from lower(v_email) then
    raise exception 'Esta invitación no corresponde a tu cuenta'
      using errcode = 'P0002';
  end if;

  perform 1 from public.patients where id = v_inv.patient_id for update;
  if not found then raise exception 'Paciente no disponible'; end if;

  if exists (select 1 from public.patients where user_id = v_uid) then
    raise exception 'La cuenta ya está vinculada a un paciente'
      using errcode = 'P0003';
  end if;

  if exists (
    select 1 from public.patients
     where id = v_inv.patient_id and user_id is not null
  ) then
    raise exception 'Esta ficha ya tiene una cuenta vinculada'
      using errcode = 'P0004';
  end if;

  perform set_config('terapia.linking_patient', 'on', true);

  update public.patients
     set user_id = v_uid,
         email = coalesce(email, v_email)
   where id = v_inv.patient_id and user_id is null;
  if not found then raise exception 'La ficha ya está vinculada'; end if;

  perform set_config('terapia.linking_patient', 'off', true);

  update public.invitations set accepted_at = now() where id = v_inv.id;
  update public.invitations set expires_at = least(expires_at, now())
    where patient_id = v_inv.patient_id and id <> v_inv.id and accepted_at is null;
  return v_inv.patient_id;
end;
$$;
-- Una ruta referenciada no concede acceso a objetos de otro paciente.
drop policy if exists files_select_patient_shared on storage.objects;
create policy files_select_patient_shared on storage.objects for select to authenticated using (
 bucket_id = 'files'
 and (storage.foldername(name))[1] = (select public.current_patient_id())::text
 and (
   exists (select 1 from public.documents d where d.storage_path = storage.objects.name
      and d.patient_id = (select public.current_patient_id()) and d.shared_with_patient)
   or exists (select 1 from public.resources r where r.storage_path = storage.objects.name
      and r.patient_id = (select public.current_patient_id()))
 )
);
create function public.guard_file_reference() returns trigger
language plpgsql set search_path = '' as $$
begin
 if new.storage_path is not null and new.storage_path <> ''
    and (new.patient_id is null or split_part(new.storage_path, '/', 1) <> new.patient_id::text) then
   raise exception 'El archivo debe pertenecer al paciente';
 end if;
 return new;
end; $$;
create trigger documents_file_reference before insert or update on public.documents
 for each row execute function public.guard_file_reference();
create trigger resources_file_reference before insert or update on public.resources
 for each row execute function public.guard_file_reference();

-- FK compuestas: NOT VALID mantiene históricos, pero protege toda escritura nueva.
alter table public.patients add constraint patients_id_pro_unique unique (id, professional_id);
alter table public.appointments add constraint appointments_owner_unique unique (id, professional_id, patient_id);
alter table public.session_packs add constraint session_packs_owner_unique unique (id, professional_id, patient_id);
alter table public.gastos add constraint gastos_owner_unique unique (id, professional_id);
alter table public.payments drop constraint payments_appointment_id_fkey;
alter table public.payments drop constraint payments_session_pack_id_fkey;
alter table public.payments add constraint payments_appointment_owner_fk
 foreign key (appointment_id, professional_id, patient_id)
 references public.appointments(id, professional_id, patient_id) on delete restrict not valid;
alter table public.payments add constraint payments_pack_owner_fk
 foreign key (session_pack_id, professional_id, patient_id)
 references public.session_packs(id, professional_id, patient_id) on delete restrict not valid;
alter table public.payments add constraint payments_patient_owner_fk
 foreign key (patient_id, professional_id) references public.patients(id, professional_id) not valid;
alter table public.bienes_inversion add constraint bienes_gasto_owner_fk
 foreign key (gasto_id, professional_id) references public.gastos(id, professional_id) not valid;

create function public.guard_scale_submission() returns trigger
language plpgsql security definer set search_path = '' as $$
declare a public.scale_assignments%rowtype; last_day date; today date := (now() at time zone 'Europe/Madrid')::date;
begin
 select * into a from public.scale_assignments where id = new.assignment_id for update;
 -- Importación administrativa de históricos ficticios: conserva sus fechas.
 if auth.uid() is null and found and a.patient_id=new.patient_id and a.scale_id=new.scale_id then return new; end if;
 if not found or a.patient_id <> new.patient_id or a.scale_id <> new.scale_id
    or not a.active or a.starts_on > today or a.ends_on < today then
   raise exception 'Asignación no disponible';
 end if;
 if a.assignment_type = 'recurring' and coalesce(a.recurrence_interval_days,0) < 1 then
   raise exception 'Intervalo no válido';
 end if;
 select max((submitted_at at time zone 'Europe/Madrid')::date) into last_day
 from public.scale_responses where assignment_id = a.id;
 if last_day is not null and (a.assignment_type = 'one_off'
     or today < last_day + a.recurrence_interval_days) then
   raise exception 'Esta escala ya está respondida para el periodo';
 end if;
 new.acknowledged_at := null; new.acknowledged_by := null;
 new.submitted_at := now(); new.created_at := now();
 return new;
end; $$;
create trigger scale_responses_00_validate before insert on public.scale_responses
 for each row execute function public.guard_scale_submission();
create or replace function public.compute_scale_response()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_def       jsonb;
  v_item      jsonb;
  v_key       text;
  v_min       int;
  v_max       int;
  v_val       int;
  v_total     int := 0;
  v_expected  int;
  v_flag_item int;
  v_flag_thr  int;
  v_sev       text;
begin
  if jsonb_typeof(new.answers) <> 'object' or exists (
    select 1 from jsonb_each(new.answers) a
    where jsonb_typeof(a.value) <> 'number' or a.value::text !~ '^[0-9]+$'
  ) then raise exception 'Las respuestas deben ser enteros no nulos'; end if;
  select definition into v_def from public.scales where id = new.scale_id;
  if v_def is null then
    raise exception 'Escala % no encontrada', new.scale_id;
  end if;

  v_expected := jsonb_array_length(v_def -> 'items');

  -- Rango válido a partir de las opciones declaradas en el catálogo.
  select min((o ->> 'value')::int), max((o ->> 'value')::int)
    into v_min, v_max
    from jsonb_array_elements(v_def -> 'options') as o;

  -- Suma SOLO los ítems de la definición y exige que estén TODOS presentes.
  for v_item in select * from jsonb_array_elements(v_def -> 'items') loop
    v_key := v_item ->> 'id';
    if not (new.answers ? v_key) then
      raise exception 'Respuesta incompleta: falta el ítem %', v_key
        using errcode = 'P0010';
    end if;
    v_val := (new.answers ->> v_key)::int;
    if v_val < v_min or v_val > v_max then
      raise exception 'Valor fuera de rango en el ítem %', v_key
        using errcode = 'P0011';
    end if;
    v_total := v_total + v_val;
  end loop;

  -- Claves de más (ítems inventados) también invalidan la respuesta: si no, un
  -- envío podría inflar la puntuación con claves que no son de la escala.
  if (select count(*) from jsonb_object_keys(new.answers)) <> v_expected then
    raise exception 'La respuesta contiene ítems que no pertenecen a la escala'
      using errcode = 'P0012';
  end if;

  new.score := v_total;

  -- Severidad por los tramos publicados (solo clasifica, no interpreta).
  select (s.value ->> 'label') into v_sev
    from jsonb_array_elements(v_def -> 'scoring' -> 'severity') as s
   where v_total between (s.value ->> 'min')::int and (s.value ->> 'max')::int
   limit 1;
  new.severity := v_sev;

  -- Ítem de riesgo. Arriba ya se ha exigido que TODOS los ítems estén, así que
  -- aquí no puede faltar; se comprueba igualmente porque el `coalesce(..., 0)`
  -- de la versión anterior es exactamente lo que ocultaba la ideación suicida.
  v_flag_item := (v_def ->> 'flag_item')::int;
  if v_flag_item is not null then
    if not (new.answers ? v_flag_item::text) then
      raise exception 'Falta el ítem de riesgo' using errcode = 'P0010';
    end if;
    v_flag_thr := coalesce((v_def ->> 'flag_threshold')::int, 1);
    new.flagged := (new.answers ->> v_flag_item::text)::int >= v_flag_thr;
  else
    new.flagged := false;
  end if;

  return new;
end;
$$;
create or replace function public.scale_responses_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 if (to_jsonb(new) - array['acknowledged_at','acknowledged_by'])
     is distinct from (to_jsonb(old) - array['acknowledged_at','acknowledged_by']) then
   raise exception 'Las respuestas son inmutables';
 end if;
 if not public.professional_owns_patient(old.patient_id) then raise exception 'No autorizado'; end if;
 new.acknowledged_at := coalesce(old.acknowledged_at, now());
 new.acknowledged_by := coalesce(old.acknowledged_by, public.current_professional_id());
 return new;
end; $$;

alter table public.mood_entries alter column entry_date set default ((now() at time zone 'Europe/Madrid')::date);
drop policy if exists mood_entries_insert_by_patient on public.mood_entries;
create policy mood_entries_insert_by_patient on public.mood_entries for insert to authenticated
 with check (patient_id = (select public.current_patient_id()) and entry_date = (now() at time zone 'Europe/Madrid')::date);
drop policy if exists mood_entries_update_today on public.mood_entries;
create policy mood_entries_update_today on public.mood_entries for update to authenticated
 using (patient_id = (select public.current_patient_id()) and entry_date = (now() at time zone 'Europe/Madrid')::date)
 with check (patient_id = (select public.current_patient_id()) and entry_date = (now() at time zone 'Europe/Madrid')::date);
commit;
