-- =============================================================================
-- Sesión 2 · Vista previa pública de una invitación
--   Permite a la landing /invite/[token] mostrar si la invitación es válida y
--   de qué profesional, SIN exponer la tabla invitations por RLS. Requiere
--   conocer el token (alta entropía), así que no filtra nada de forma masiva.
-- =============================================================================

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
  where i.token = p_token
$$;

grant execute on function public.invitation_preview(text) to anon, authenticated;
