-- =============================================================================
-- VACIAR LOS DATOS DE DEMOSTRACIÓN
--
-- Deja la base limpia para empezar las pruebas de verdad: sin pacientes
-- ficticios, sin citas sembradas, sin gastos inventados. Conserva lo que hace
-- falta para que la aplicación siga funcionando y para que tú sigas entrando.
--
-- ⚠️ ESTO BORRA. No hay deshacer. Antes de ejecutarlo:
--
--      npm run copia:datos
--
--    y comprueba la copia con `--verificar`. Si esa copia no existe, no
--    ejecutes esto: el plan gratuito de Supabase no tiene recuperación a un
--    punto en el tiempo.
--
-- CÓMO SE USA
--   1. Edita la lista `cuentas_a_conservar` de abajo con TUS correos.
--   2. Ejecuta el bloque de DIAGNÓSTICO (el primero). No borra nada.
--   3. Si los números cuadran, ejecuta el bloque de BORRADO.
--
-- Va todo dentro de una transacción: o entra entero o no entra nada.
-- =============================================================================


-- ========================= 1. DIAGNÓSTICO (no borra) =========================
-- Qué hay ahora y qué sobreviviría. Ejecuta esto primero y léelo.

select 'cuentas de autenticación'        as que, count(*)::text as cuantos from auth.users
union all select 'profesionales',        count(*)::text from public.professionals
union all select 'organizaciones',       count(*)::text from public.organizations
union all select 'expedientes',          count(*)::text from public.patients
union all select 'citas',                count(*)::text from public.appointments
union all select 'pagos',                count(*)::text from public.payments
union all select 'gastos',               count(*)::text from public.gastos
union all select 'entradas de diario',   count(*)::text from public.mood_entries
union all select 'respuestas de escala', count(*)::text from public.scale_responses
union all select 'invitaciones',         count(*)::text from public.invitations
union all select 'objetos en Storage',   count(*)::text from storage.objects
union all select '--- SE CONSERVA ---',  ''
union all select 'catálogo de escalas',  count(*)::text from public.scales
union all select 'enlaces de emergencia globales',
                                         count(*)::text from public.emergency_links where professional_id is null
union all select 'administradores de plataforma',
                                         count(*)::text from public.platform_admins;


-- ============================ 2. BORRADO =====================================
-- EDITA LA LISTA antes de ejecutar. Son los correos que NO se tocan.

begin;

create temp table cuentas_a_conservar (email text primary key) on commit drop;

insert into cuentas_a_conservar (email) values
  ('gsechevarria@gmail.com')       -- administrador de plataforma. NO quitar.
  -- , ('otro-correo@dominio')     -- añade aquí los que quieras conservar
  ;

-- Salvaguarda: si la lista se queda vacía por un descuido, la transacción
-- aborta antes de borrar nada. Vaciar la base Y perder el acceso a la vez es
-- el error que no se puede deshacer.
do $$
begin
  if (select count(*) from cuentas_a_conservar) = 0 then
    raise exception 'La lista de cuentas a conservar está vacía: abortando';
  end if;
  if not exists (
    select 1 from public.platform_admins a
    join auth.users u on u.id = a.user_id
    join cuentas_a_conservar c on lower(c.email) = lower(u.email)
  ) then
    raise exception
      'Ninguna cuenta conservada es administrador de plataforma: abortando. '
      'Sin administrador no se puede aprobar ningún alta profesional después.';
  end if;
end $$;

-- --- Contenido clínico y de negocio -----------------------------------------
-- En orden de hijos a padres. No se confía en los `on delete cascade`: son
-- correctos, pero un borrado explícito se lee y se audita mejor.

-- Expediente fiscal
delete from public.factura_cobros;
delete from public.expediente_documentos;

-- `facturas.rectifica_a` y `retenciones_pagos_cuenta.rectifica_a` apuntan a su
-- PROPIA tabla con `on delete restrict`. Una sola sentencia las vacía sin
-- problema —la comprobación de integridad se hace al terminar, cuando ya no
-- queda ninguna referencia— y hay una regresión con cadenas de rectificativas
-- que lo sujeta. No hace falta borrarlas por capas; lo que sí importa es no
-- partir estos dos `delete` en varios.
delete from public.facturas;
delete from public.retenciones_pagos_cuenta;
delete from public.checklist_personal;
delete from public.expedientes_fiscales;
delete from public.actividades_fiscales;

-- Contabilidad
delete from public.bienes_inversion;
delete from public.gastos;
delete from public.configuracion_fiscal;

-- Clínico
delete from public.task_completions;
delete from public.tasks;
delete from public.scale_responses;
delete from public.scale_assignments;
delete from public.mood_entries;
delete from public.consents;
delete from public.consent_templates;
delete from public.documents;
delete from public.resources;
delete from public.patient_notes;
delete from public.pending_uploads;

-- Agenda y dinero
--
-- `payments` va ANTES que `appointments` y que `session_packs`. Sus dos claves
-- compuestas —`payments_appointment_owner_fk` y `payments_pack_owner_fk`, de la
-- migración 20260909190001— son `on delete restrict` a propósito: impiden
-- borrar una cita liquidada o un bono y dejar el cobro colgando. Al revés, el
-- vaciado aborta con un 23503 a mitad del borrado.
delete from public.appointment_requests;
delete from public.payments;
delete from public.appointments;
delete from public.agenda_blocks;
delete from public.session_packs;
delete from public.payment_settings;

-- Avisos y correo
delete from public.notification_deliveries;
delete from public.notifications;
delete from public.push_subscriptions;
delete from public.device_push_tokens;
delete from public.notification_preferences;
delete from public.storage_cleanup_jobs;
delete from public.email_deliveries;

-- Enlaces de emergencia PROPIOS de un profesional. Los globales (024 y 112,
-- con `professional_id` nulo) se conservan: los usa la pantalla de riesgo.
delete from public.emergency_links where professional_id is not null;

-- Invitaciones y vínculos
delete from public.invitations;
delete from public.professional_invitations;
delete from public.patient_assignments;
delete from public.patients;

-- Organizaciones
--
-- `organization_members_guard_owner` impide dejar una organización sin
-- propietario activo, y vaciarlas todas es justo lo que hace. Es un disparador
-- diferido, así que aplazarlo no sirve: salta igual al confirmar. Se desactiva
-- para esta transacción y se vuelve a activar antes del `commit`; si algo
-- abortase por el camino, la desactivación se deshace con todo lo demás.
alter table public.organization_members disable trigger organization_members_guard_owner;

delete from public.organization_access;
delete from public.organization_members;
delete from public.organizations;

alter table public.organization_members enable trigger organization_members_guard_owner;

-- Perfiles profesionales
delete from public.professionals;

-- Rastro de auditoría de la etapa de demostración. Apunta a organizaciones que
-- ya no existen, así que conservarlo solo deja ruido. Coméntalo si prefieres
-- guardarlo.
delete from public.audit_log;

-- --- Cuentas de autenticación ------------------------------------------------
-- Las que no estén en la lista. `platform_admins` cuelga de `auth.users` con
-- `on delete cascade`, de ahí la salvaguarda de arriba.
delete from auth.users u
 where not exists (
   select 1 from cuentas_a_conservar c where lower(c.email) = lower(u.email)
 );

-- La cuenta conservada vuelve a empezar de cero como profesional: si tenía
-- rol o perfil de la etapa anterior, se queda sin ellos y podrá registrarse
-- por el asistente como cualquier otro.
update auth.users
   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) - 'role'
 where exists (
   select 1 from cuentas_a_conservar c where lower(c.email) = lower(auth.users.email)
 );

-- --- Comprobación antes de confirmar ----------------------------------------
do $$
declare v_pac int; v_pro int; v_org int; v_admin int; v_cuentas int;
begin
  select count(*) into v_pac  from public.patients;
  select count(*) into v_pro  from public.professionals;
  select count(*) into v_org  from public.organizations;
  select count(*) into v_admin from public.platform_admins;
  select count(*) into v_cuentas from auth.users;

  raise notice 'Tras el borrado: % cuentas, % profesionales, % organizaciones, % expedientes, % administradores',
    v_cuentas, v_pro, v_org, v_pac, v_admin;

  if v_pac <> 0 or v_pro <> 0 or v_org <> 0 then
    raise exception 'Ha quedado algo sin borrar: abortando';
  end if;
  if v_admin = 0 then
    raise exception 'No queda ningún administrador de plataforma: abortando';
  end if;
end $$;

commit;


-- ======================== 3. DESPUÉS DEL BORRADO =============================
--
-- Storage: el borrado de `storage.objects` NO se hace aquí a propósito. Quitar
-- la fila deja el fichero huérfano en el almacén. Si el diagnóstico decía que
-- hay objetos, bórralos desde el panel (Storage → files / receipts) o con la
-- API. A 11-sep-2026 había cero.
--
-- Comprueba que todo quedó coherente:
--
--     npm run informe:organizaciones -- --verificar
--
-- Debe decir 0 profesionales, 0 organizaciones y 0 expedientes. Si dice eso,
-- la base está limpia y puedes empezar por `/registro`.
--
-- El banner de demostración SE QUEDA. `NEXT_PUBLIC_DEMO_MODE=true` no se toca:
-- que los datos sean tuyos y no sembrados no los convierte en datos clínicos
-- reales, y retirarlo sigue bloqueado por el DPA y la base jurídica del art. 9.
-- =============================================================================
