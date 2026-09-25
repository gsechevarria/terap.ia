-- =============================================================================
-- Doble factor para la administración de plataforma, y altas incompletas
--
-- 1. `is_platform_admin()` exige ahora que la sesión esté en `aal2`, es decir,
--    que haya pasado el segundo factor (TOTP de Supabase Auth). Se exige EN LA
--    BASE, no solo en la pantalla: todas las RPC de administración y la
--    política de lectura de `/admin` cuelgan de esta función, así que una
--    sesión con solo contraseña no administra nada aunque llame a la API a
--    mano.
--
--    Para poder ofrecer el paso del segundo factor hace falta saber si la
--    cuenta ES administradora antes de que lo haya pasado: eso lo dice
--    `is_platform_admin_account()`, que no concede nada.
--
-- 2. `incomplete_signup_user_id(correo)`: la cuenta de un alta profesional que
--    se quedó a medias, para que el servidor la borre y el alta vuelva a
--    empezar desde cero (decisión de Gabriel, 25-sep-2026). Solo la ejecuta
--    `service_role`. Solo devuelve una cuenta que no tiene NADA: ni ficha
--    profesional, ni expediente, ni rol profesional, ni es administradora.
--
-- Idempotente. No cambia la firma de ninguna función existente.
-- =============================================================================

begin;

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid())
     and coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
$$;

/**
 * ¿Esta cuenta figura como administradora, haya pasado o no el segundo factor?
 * Solo sirve para decidir qué pantalla enseñar (pedir el código o no). No
 * autoriza nada: para eso está `is_platform_admin()`.
 */
create or replace function public.is_platform_admin_account()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid())
$$;
revoke all on function public.is_platform_admin_account() from public, anon;
grant execute on function public.is_platform_admin_account() to authenticated;

/**
 * La cuenta de un alta a medias con ese correo, o null.
 *
 * «A medias» es muy estricto a propósito, porque lo que devuelve se borra:
 * correo ya confirmado (las no confirmadas las reenvía el propio Auth), sin
 * fila en `professionals`, sin expediente de paciente, sin rol profesional ni
 * pendiente, y fuera de `platform_admins`. Una cuenta así no tiene ningún dato
 * que perder.
 */
create or replace function public.incomplete_signup_user_id(p_email text)
returns uuid language sql stable security definer set search_path = '' as $$
  select u.id
    from auth.users u
   where lower(u.email) = lower(trim(p_email))
     and u.email_confirmed_at is not null
     and coalesce(u.raw_app_meta_data ->> 'role', 'patient')
         not in ('professional', 'professional_pending')
     and not exists (select 1 from public.professionals p where p.user_id = u.id)
     and not exists (select 1 from public.patients pa where pa.user_id = u.id)
     and not exists (select 1 from public.platform_admins a where a.user_id = u.id)
   limit 1
$$;
revoke all on function public.incomplete_signup_user_id(text) from public, anon, authenticated;
grant execute on function public.incomplete_signup_user_id(text) to service_role;

commit;
