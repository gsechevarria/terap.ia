-- =============================================================================
-- El rol pasa a app_metadata (ago 2026)
--
-- PROBLEMA: `getUserRole` leía `app_metadata.role ?? user_metadata.role`, y el
-- rol solo se escribía en `user_metadata` (vía `signInWithOtp({ data })`).
-- `user_metadata` es de escritura libre para el propio usuario con la clave
-- anon:
--     await supabase.auth.updateUser({ data: { role: 'professional' } })
-- Como `getUserRole` es la única fuente de autorización de la aplicación por
-- encima de la RLS (proxy, ambos layouts, /auth/confirm y onboarding),
-- cualquier paciente podía convertirse en profesional.
--
-- Camino aún más corto: pedir un enlace mágico desde /login marcando
-- "Profesional". `shouldCreateUser` es true por defecto, el trigger creaba la
-- fila en `professionals` y listo.
--
-- SOLUCIÓN: el rol lo escribe SOLO el servidor, en `raw_app_meta_data`, desde
-- este trigger (SECURITY DEFINER). La app deja de mirar `user_metadata`.
--
-- ⚠️ ESTA MIGRACIÓN INCLUYE UN BACKFILL IMPRESCINDIBLE. Sin él, todas las
-- cuentas existentes (que tienen el rol solo en user metadata) se quedan sin
-- rol y NADIE puede entrar tras desplegar.
-- =============================================================================

-- 1) BACKFILL — copia el rol de user metadata a app metadata ------------------
-- Solo para los valores válidos y solo si app_metadata aún no lo trae.
-- Es idempotente: al reejecutarse no encuentra filas que actualizar.
update auth.users u
   set raw_app_meta_data =
         coalesce(u.raw_app_meta_data, '{}'::jsonb)
         || jsonb_build_object('role', u.raw_user_meta_data ->> 'role')
 where u.raw_user_meta_data ->> 'role' in ('professional', 'patient')
   and coalesce(u.raw_app_meta_data ->> 'role', '') not in
       ('professional', 'patient');

-- Red de seguridad: cualquier usuario con fila en `professionals` o `patients`
-- tiene rol por definición, aunque el metadata se hubiera perdido.
update auth.users u
   set raw_app_meta_data =
         coalesce(u.raw_app_meta_data, '{}'::jsonb)
         || jsonb_build_object('role', 'professional')
 where coalesce(u.raw_app_meta_data ->> 'role', '') not in
       ('professional', 'patient')
   and exists (select 1 from public.professionals p where p.user_id = u.id);

update auth.users u
   set raw_app_meta_data =
         coalesce(u.raw_app_meta_data, '{}'::jsonb)
         || jsonb_build_object('role', 'patient')
 where coalesce(u.raw_app_meta_data ->> 'role', '') not in
       ('professional', 'patient')
   and exists (select 1 from public.patients p where p.user_id = u.id);

-- 2) El alta fija el rol en app metadata --------------------------------------
-- Se conserva el resto del comportamiento de 20260725090001: crear la fila de
-- `professionals` y su plantilla de consentimiento por defecto.
--
-- El rol de entrada se sigue leyendo de `raw_user_meta_data` porque es lo único
-- que el cliente puede aportar al registrarse, pero se escribe en
-- `raw_app_meta_data` y a partir de ahí es intocable para el usuario. El alta de
-- profesional deja de ser autoservicio (ver `professionals_insert_self` abajo):
-- para que este camino cree un profesional, alguien con `service_role` tiene que
-- crear el usuario con `{ role: 'professional' }`.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_pro_id uuid;
  v_role   text := new.raw_user_meta_data ->> 'role';
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

-- 3) El alta de profesional deja de ser autoservicio ---------------------------
-- `professionals_insert_self` permitía a CUALQUIER autenticado —incluido un
-- paciente— insertarse su propia fila en `professionals` directamente por
-- PostgREST (20260717180002_identity.sql:151-153). Combinado con el fallo del
-- rol, era el segundo camino al mismo sitio.
-- El alta la hace `handle_new_user()` (SECURITY DEFINER, salta la RLS) o un
-- proceso administrativo con `service_role`.
drop policy if exists professionals_insert_self on public.professionals;
