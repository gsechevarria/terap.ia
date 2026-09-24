-- =============================================================================
-- Verificación de la colegiación contra el registro público del colegio
--
-- El alta profesional consulta, desde el SERVIDOR, el registro público de
-- colegiados del colegio declarado. Si el número existe tal cual, el nombre
-- coincide y figura como ejerciente, el alta se aprueba sola. Si no, queda
-- pendiente de una persona, con el motivo guardado.
--
-- Decisión de producto (24-sep-2026, Gabriel): aprobación AUTOMÁTICA. Queda
-- anotado el riesgo que se aceptó: el registro prueba que ese colegiado existe
-- y ejerce, no que quien se registra sea él. Nombre y número son públicos. Las
-- mitigaciones que sí van aquí:
--   · solo el servidor puede aprobar por esta vía (`service_role`); nadie puede
--     llamarla con una evidencia inventada;
--   · un número ya verificado en otra cuenta no se aprueba por segunda vez;
--   · solo se aprueba lo que estaba PENDIENTE: nunca se deshace un rechazo;
--   · la evidencia queda guardada y la administración ve las aprobaciones
--     automáticas para poder revocarlas.
--
-- Además cierra un hueco ANTERIOR a esto: `professionals_update_self` dejaba a
-- cada profesional actualizar cualquier columna de su fila —incluido
-- `verification_status`—, y el disparador solo protegía `user_id` y
-- `deleted_at`. Una cuenta con acreditación «sin comprobar» podía ponerse ella
-- misma «verificada». La aplicación nunca escribe esa tabla directamente
-- (todo va por funciones SECURITY DEFINER), así que cerrarlo no rompe nada.
--
-- Idempotente y reejecutable. No cambia la firma de ninguna función existente.
-- =============================================================================

begin;

-- ---------------------------------------------------------------- columnas ---

alter table public.professionals
  add column if not exists verification_source     text,
  add column if not exists verification_evidence   jsonb,
  add column if not exists verification_checked_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'professionals_verification_source_check'
  ) then
    alter table public.professionals
      add constraint professionals_verification_source_check
      check (verification_source is null or verification_source in ('manual', 'registro'));
  end if;
end $$;

comment on column public.professionals.verification_source is
  'Quién decidió el estado de acreditación: manual (administración) o registro (consulta automática al registro del colegio).';
comment on column public.professionals.verification_evidence is
  'Última consulta al registro del colegio: URL, número consultado, fila devuelta, veredicto y fecha. La escribe solo el servidor.';

-- ----------------------------------------------- escritura directa, cerrada ---

-- Mismo nombre y misma firma (returns trigger): `create or replace` basta.
create or replace function public.guard_professional_identity()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated' and (
       new.user_id is distinct from old.user_id
    or new.deleted_at is distinct from old.deleted_at
    -- Identidad profesional y acreditación: solo por funciones del servidor.
    or new.full_name is distinct from old.full_name
    or new.colegio is distinct from old.colegio
    or new.numero_colegiado is distinct from old.numero_colegiado
    or new.verification_status is distinct from old.verification_status
    or new.verification_note is distinct from old.verification_note
    or new.verification_reviewed_by is distinct from old.verification_reviewed_by
    or new.verification_reviewed_at is distinct from old.verification_reviewed_at
    or new.verification_source is distinct from old.verification_source
    or new.verification_evidence is distinct from old.verification_evidence
    or new.verification_checked_at is distinct from old.verification_checked_at
  ) then
    raise exception 'La identidad profesional solo la administra el servidor';
  end if;
  return new;
end;
$$;

-- ------------------------------------------- registro: sin reescribir lo aprobado ---

/*
 * Igual que en 20260916100004 salvo una cosa: con la acreditación ya APROBADA,
 * reintentar el asistente no cambia nombre, colegio ni número. Si no, bastaba
 * con aprobarse con un número y volver a pasar por el asistente con otro.
 */
create or replace function public.register_professional(
  p_full_name        text,
  p_practice_kind    public.organization_kind,
  p_org_name         text default null,
  p_colegio          text default null,
  p_numero_colegiado text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid    uuid := auth.uid();
  v_email  text;
  v_pro    uuid;
  v_org    uuid;
  v_estado public.verification_status;
begin
  if v_uid is null then
    raise exception 'autenticación requerida' using errcode = 'P0100';
  end if;
  if coalesce(trim(p_full_name), '') = '' then
    raise exception 'El nombre es obligatorio' using errcode = 'P0101';
  end if;

  select email into v_email from auth.users where id = v_uid;

  select id, verification_status into v_pro, v_estado
    from public.professionals where user_id = v_uid;

  if v_pro is null then
    insert into public.professionals
      (user_id, email, full_name, verification_status, colegio, numero_colegiado,
       practice_kind, onboarding_completed_at)
    values (v_uid, v_email, trim(p_full_name), 'pending', nullif(trim(p_colegio), ''),
            nullif(trim(p_numero_colegiado), ''), p_practice_kind, now())
    returning id into v_pro;
  elsif v_estado = 'approved' then
    update public.professionals
       set practice_kind = p_practice_kind,
           onboarding_completed_at = coalesce(onboarding_completed_at, now())
     where id = v_pro;
  else
    update public.professionals
       set full_name = trim(p_full_name),
           colegio = nullif(trim(p_colegio), ''),
           numero_colegiado = nullif(trim(p_numero_colegiado), ''),
           practice_kind = p_practice_kind,
           onboarding_completed_at = coalesce(onboarding_completed_at, now())
     where id = v_pro;
  end if;

  select m.organization_id into v_org
    from public.organization_members m
   where m.professional_id = v_pro and m.role = 'owner' and m.status = 'active'
   order by m.created_at limit 1;

  if v_org is not null then
    update public.organizations
       set name = coalesce(nullif(trim(p_org_name), ''), trim(p_full_name)),
           kind = p_practice_kind
     where id = v_org;
  end if;

  update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
         || jsonb_build_object('role',
              case when raw_app_meta_data ->> 'role' = 'professional'
                   then 'professional' else 'professional_pending' end)
   where id = v_uid;

  perform public.ensure_consent_template(v_pro);

  perform public.write_audit('professional.registered', 'professional', v_pro, v_org,
    jsonb_build_object('practice_kind', p_practice_kind, 'has_colegiado',
                       nullif(trim(p_numero_colegiado), '') is not null));
  return v_pro;
end;
$$;
revoke all on function public.register_professional(text, public.organization_kind, text, text, text) from public, anon;
grant execute on function public.register_professional(text, public.organization_kind, text, text, text) to authenticated;

-- ------------------------------------------ revisión manual: queda anotada ---

create or replace function public.admin_review_professional(
  p_professional_id uuid,
  p_status          public.verification_status,
  p_note            text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare v_user uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'Solo un administrador de plataforma puede revisar acreditaciones'
      using errcode = 'P0102';
  end if;
  if p_status not in ('approved', 'rejected', 'pending') then
    raise exception 'Estado de revisión no válido' using errcode = 'P0103';
  end if;

  update public.professionals
     set verification_status = p_status,
         verification_note = p_note,
         verification_reviewed_by = auth.uid(),
         verification_reviewed_at = now(),
         verification_source = 'manual'
   where id = p_professional_id
  returning user_id into v_user;

  if v_user is null then
    raise exception 'Profesional no encontrado' using errcode = 'P0104';
  end if;

  update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
         || jsonb_build_object('role',
              case when p_status = 'approved' then 'professional'
                   else 'professional_pending' end)
   where id = v_user;

  perform public.write_audit('professional.reviewed', 'professional', p_professional_id, null,
    jsonb_build_object('status', p_status));
end;
$$;
revoke all on function public.admin_review_professional(uuid, public.verification_status, text) from public, anon;
grant execute on function public.admin_review_professional(uuid, public.verification_status, text) to authenticated;

-- --------------------------------------------- verificación por el registro ---

/*
 * La llama SOLO el servidor, con `service_role`, después de haber consultado él
 * mismo el registro del colegio. `authenticated` no tiene permiso: si lo
 * tuviera, cualquiera podría pasarle `p_approve = true` con una evidencia
 * inventada.
 *
 * Siempre guarda la evidencia. Aprueba solo si se le pide, si la cuenta estaba
 * PENDIENTE y si ese número no está ya verificado en otra cuenta. Devuelve qué
 * ha hecho: 'approved', 'recorded', 'not_pending' o 'duplicate'.
 */
create or replace function public.registry_verify_professional(
  p_professional_id uuid,
  p_evidence        jsonb,
  p_approve         boolean
) returns text language plpgsql security definer set search_path = '' as $$
declare
  v_estado public.verification_status;
  v_user   uuid;
  v_integ  text := p_evidence ->> 'integracion';
  v_numero text := p_evidence ->> 'numeroConsultado';
begin
  select verification_status, user_id into v_estado, v_user
    from public.professionals
   where id = p_professional_id and deleted_at is null
     for update;
  if v_user is null then
    raise exception 'Profesional no encontrado' using errcode = 'P0104';
  end if;

  update public.professionals
     set verification_evidence = p_evidence,
         verification_checked_at = now()
   where id = p_professional_id;

  if not p_approve or v_integ is null or v_numero is null then
    perform public.write_audit('professional.registry_checked', 'professional', p_professional_id, null,
      jsonb_build_object('veredicto', p_evidence ->> 'veredicto'));
    return 'recorded';
  end if;

  if v_estado <> 'pending' then
    return 'not_pending';
  end if;

  -- Un número del registro, una cuenta. El segundo que lo presente va a
  -- revisión manual aunque el registro coincida.
  if exists (
    select 1 from public.professionals o
     where o.id <> p_professional_id
       and o.deleted_at is null
       and o.verification_status in ('approved', 'provisional')
       and o.verification_evidence ->> 'integracion' = v_integ
       and o.verification_evidence ->> 'numeroConsultado' = v_numero
  ) then
    update public.professionals
       set verification_note = 'Ese número ya está verificado en otra cuenta: revisión manual.'
     where id = p_professional_id;
    perform public.write_audit('professional.registry_duplicate', 'professional', p_professional_id, null,
      jsonb_build_object('integracion', v_integ, 'numero', v_numero));
    return 'duplicate';
  end if;

  update public.professionals
     set verification_status = 'approved',
         verification_source = 'registro',
         verification_note = 'Verificado automáticamente en el registro público del colegio.',
         verification_reviewed_by = null,
         verification_reviewed_at = now()
   where id = p_professional_id;

  update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
         || jsonb_build_object('role', 'professional')
   where id = v_user;

  perform public.write_audit('professional.registry_approved', 'professional', p_professional_id, null,
    jsonb_build_object('integracion', v_integ, 'numero', v_numero));
  return 'approved';
end;
$$;
revoke all on function public.registry_verify_professional(uuid, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.registry_verify_professional(uuid, jsonb, boolean) to service_role;

-- --------------------------------------------- contexto propio: el origen ---

create or replace function public.my_professional_context()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
      'professional_id',     p.id,
      'full_name',           p.full_name,
      'verification_status', p.verification_status,
      'verification_note',   p.verification_note,
      'verification_source', p.verification_source,
      -- Su PROPIA última comprobación: qué dijo el registro, para que sepa
      -- qué corregir. No expone nada de nadie más.
      'verification_check_verdict', p.verification_evidence ->> 'veredicto',
      'verification_check_detail',  p.verification_evidence ->> 'detalle',
      'practice_kind',       p.practice_kind,
      'colegio',             p.colegio,
      'numero_colegiado',    p.numero_colegiado,
      'organization_id',     o.id,
      'organization_name',   o.name,
      'organization_kind',   o.kind,
      'organization_role',   m.role,
      'access_status',       a.status)
    from public.professionals p
    left join public.organization_members m
      on m.professional_id = p.id and m.status = 'active'
    left join public.organizations o on o.id = m.organization_id
    left join public.organization_access a on a.organization_id = o.id
   where p.user_id = auth.uid()
   order by case when m.role = 'owner' then 0 else 1 end
   limit 1
$$;
revoke all on function public.my_professional_context() from public, anon;
grant execute on function public.my_professional_context() to authenticated;

commit;
