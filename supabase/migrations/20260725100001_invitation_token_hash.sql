-- =============================================================================
-- Invitaciones · el token deja de guardarse en claro (jul 2026)
--
-- Antes: invitations.token en claro + invitation_preview/accept_invitation
-- comparaban por igualdad de texto. Un volcado de BD (o un log) exponía tokens
-- de un solo uso reutilizables. Ahora la BD guarda solo el SHA-256; el token en
-- claro vive únicamente en el enlace que se entrega al paciente.
--
-- NOTA: se hace backfill del hash desde el token existente para no romper los
-- enlaces ya emitidos (datos ficticios de demo). En producción, lo correcto
-- sería INVALIDAR los tokens vivos y regenerarlos (el claro ya estuvo en BD).
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- 1) Nueva columna + backfill desde el token actual --------------------------
alter table public.invitations
  add column if not exists token_hash text;

update public.invitations
   set token_hash = encode(extensions.digest(token, 'sha256'), 'hex')
 where token_hash is null
   and token is not null;

create unique index if not exists invitations_token_hash_unique
  on public.invitations (token_hash);

alter table public.invitations
  alter column token_hash set not null;

-- 2) Lookups por hash --------------------------------------------------------
create or replace function public.accept_invitation(p_token text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_inv public.invitations%rowtype;
  v_hash text := encode(extensions.digest(p_token, 'sha256'), 'hex');
begin
  select * into v_inv
  from public.invitations
  where token_hash = v_hash
    and accepted_at is null
    and expires_at > now()
  for update;

  if not found then
    raise exception 'Invitación inválida, caducada o ya utilizada';
  end if;

  update public.patients
     set user_id = auth.uid(),
         email = coalesce(email, (select email from auth.users where id = auth.uid()))
   where id = v_inv.patient_id;

  update public.invitations
     set accepted_at = now()
   where id = v_inv.id;

  return v_inv.patient_id;
end;
$$;

create or replace function public.invitation_preview(p_token text)
returns table (valid boolean, professional_name text, expires_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (i.accepted_at is null and i.expires_at > now()) as valid,
    p.full_name as professional_name,
    i.expires_at
  from public.invitations i
  join public.professionals p on p.id = i.professional_id
  where i.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
$$;

grant execute on function public.invitation_preview(text) to anon, authenticated;

-- 3) Fuera el token en claro -------------------------------------------------
-- El nuevo alta genera el token en la app, guarda solo el hash y devuelve el
-- claro una única vez para construir el enlace (ver createInvitationAction).
alter table public.invitations alter column token drop default;
alter table public.invitations drop column token;
