-- =============================================================================
-- Invitaciones · propiedad, destinatario y superficie pública (ago 2026)
--
-- Tres agujeros distintos sobre la misma tabla:
--
-- 1. La política `invitations_all_by_professional` solo validaba
--    `professional_id` — el del propio llamante, luego siempre pasaba — y nadie
--    validaba `patient_id`. Con el UUID de un paciente ajeno (que no es
--    secreto: va en la URL y en las rutas de Storage) se creaba una invitación
--    a su ficha y se canjeaba desde otra cuenta.
--
-- 2. `accept_invitation` no tenía `revoke`, así que conservaba EXECUTE para
--    PUBLIC y `anon` lo heredaba: PostgREST la exponía en
--    POST /rest/v1/rpc/accept_invitation. Sin sesión, `auth.uid()` es NULL, la
--    función NO fallaba y escribía `user_id = NULL`: bloqueo permanente y
--    silencioso de la cuenta del paciente. Contrasta con las dos RPC de
--    20260725090001, donde el revoke sí se hizo.
--    Tampoco comparaba `invitations.email` con el correo de la cuenta, así que
--    el enlace era una credencial portadora pura: un reenvío del correo o un
--    dispositivo compartido bastaban para vincular a otra persona a la ficha
--    clínica.
--
-- 3. `invitation_preview` respondía también a tokens caducados o ya usados y
--    devolvía el nombre del profesional a cualquiera con un enlace viejo. Para
--    `anon`, el nombre de un psicólogo asociado a un destinatario es un dato de
--    salud por inferencia (art. 9 RGPD).
-- =============================================================================

-- 1) La invitación solo puede apuntar a un paciente propio ---------------------
drop policy if exists invitations_all_by_professional on public.invitations;
create policy invitations_all_by_professional on public.invitations
  for all to authenticated
  using (professional_id = (select public.current_professional_id()))
  with check (
    professional_id = (select public.current_professional_id())
    and public.professional_owns_patient(patient_id)
  );

-- 2) Caducidad de 7 días a 72 horas -------------------------------------------
-- Una invitación es un secreto en el correo de alguien; cuanto menos viva,
-- menor la ventana de reenvío o de acceso a un buzón comprometido.
alter table public.invitations
  alter column expires_at set default (now() + interval '72 hours');

-- 3) accept_invitation: sesión, destinatario y ficha libre ---------------------
create or replace function public.accept_invitation(p_token text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_inv   public.invitations%rowtype;
  v_uid   uuid := auth.uid();
  v_email text;
  v_hash  text := encode(extensions.digest(p_token, 'sha256'), 'hex');
begin
  -- Sin esto, una llamada anónima escribía user_id = NULL y dejaba la ficha
  -- inaccesible para siempre, sin ningún error.
  if v_uid is null then
    raise exception 'autenticación requerida';
  end if;

  select email into v_email from auth.users where id = v_uid;

  select * into v_inv from public.invitations
   where token_hash = v_hash
     and accepted_at is null
     and expires_at > now()
   for update;
  if not found then
    raise exception 'Invitación inválida, caducada o ya utilizada'
      using errcode = 'P0001';
  end if;

  -- El enlace deja de ser una credencial portadora: solo lo canjea la dirección
  -- a la que se emitió.
  if v_inv.email is null
     or lower(v_inv.email) is distinct from lower(v_email) then
    raise exception 'Esta invitación no corresponde a tu cuenta'
      using errcode = 'P0002';
  end if;

  -- Un user_id = un paciente (índice `patients_user_id_unique`).
  if exists (select 1 from public.patients where user_id = v_uid) then
    raise exception 'La cuenta ya está vinculada a un paciente'
      using errcode = 'P0003';
  end if;

  -- Evita que una invitación reemitida robe una ficha ya vinculada.
  if exists (
    select 1 from public.patients
     where id = v_inv.patient_id and user_id is not null
  ) then
    raise exception 'Esta ficha ya tiene una cuenta vinculada'
      using errcode = 'P0004';
  end if;

  update public.patients
     set user_id = v_uid,
         email = coalesce(email, v_email)
   where id = v_inv.patient_id;

  update public.invitations set accepted_at = now() where id = v_inv.id;
  return v_inv.patient_id;
end;
$$;

revoke all on function public.accept_invitation(text) from public, anon;
grant execute on function public.accept_invitation(text) to authenticated;

-- 4) invitation_preview: solo invitaciones vivas y sin nombre propio -----------
-- Sigue siendo accesible a `anon` (la landing /invite es pública), pero ya solo
-- confirma que el enlace sirve y hasta cuándo. Quien tenga un enlace caducado
-- recibe 0 filas y no averigua nada.
create or replace function public.invitation_preview(p_token text)
returns table (valid boolean, professional_name text, expires_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select
    true as valid,
    null::text as professional_name,
    i.expires_at
  from public.invitations i
  where i.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and i.accepted_at is null
    and i.expires_at > now()
$$;

revoke all on function public.invitation_preview(text) from public;
grant execute on function public.invitation_preview(text) to anon, authenticated;
