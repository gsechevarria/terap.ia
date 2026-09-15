-- Diagnóstico: por qué un paciente no ve sus tareas o sus citas
-- ============================================================================
-- SOLO LECTURA. Responde en orden a las tres causas posibles, que son
-- indistinguibles desde la pantalla porque las tres se ven igual: la app carga,
-- saluda por su nombre y no muestra nada.
--
--   1. La tarea o la cita se crearon para OTRO paciente.
--   2. El paciente no tiene el consentimiento vigente aceptado.
--   3. La cita ya pasó, o no está en estado visible.
--
-- Sustituya el correo por el de la cuenta con la que entra el paciente.
-- ============================================================================

begin transaction read only;

-- --- 1 · ¿Qué ficha está vinculada a esa cuenta? ----------------------------
-- Si no devuelve NADA, la cuenta existe en Auth pero no está vinculada a
-- ninguna ficha: la app dirá "todavía no estás vinculado a un profesional".
select
  p.id            as patient_id,
  p.full_name,
  p.status,
  p.professional_id,
  u.email
from auth.users u
join public.patients p on p.user_id = u.id
where lower(u.email) = lower('ana.nadal@demo.terapia');   -- ← cambiar

-- --- 2 · ¿Tiene aceptado el consentimiento VIGENTE? -------------------------
-- `current_patient_id()` exige consentimiento de la versión activa. Sin él, el
-- paciente ve su propia ficha (política `patients_select_self`, que no lo pide)
-- pero NO ve tareas, citas, escalas ni pagos: todas esas políticas pasan por
-- `current_patient_id()`. Ese desajuste es exactamente el síntoma descrito.
select
  p.full_name,
  t.version                       as version_activa,
  c.template_version              as version_aceptada,
  c.accepted,
  case
    when c.id is null                       then '🔴 NO ha aceptado ninguna versión'
    when c.template_id is distinct from t.id then '🔴 Aceptó una versión ANTERIOR: no ve nada'
    when not c.accepted                      then '🔴 Consta como no aceptado'
    else 'correcto'
  end as veredicto
from public.patients p
join auth.users u on u.id = p.user_id
left join lateral (
  select t.* from public.consent_templates t
  where t.professional_id = p.professional_id and t.active
  order by t.version desc limit 1
) t on true
left join public.consents c on c.patient_id = p.id and c.template_id = t.id
where lower(u.email) = lower('ana.nadal@demo.terapia');   -- ← cambiar

-- --- 3 · ¿Hay tareas y citas para ESA ficha? --------------------------------
-- Si sale 0 pero usted acaba de crearlas, se crearon para otro paciente.
select
  (select count(*) from public.tasks x where x.patient_id = p.id)        as tareas,
  (select count(*) from public.appointments x where x.patient_id = p.id) as citas_totales,
  (select count(*) from public.appointments x
     where x.patient_id = p.id
       and x.starts_at > now()
       and x.status in ('scheduled','confirmed'))                        as citas_visibles_en_la_app
from public.patients p
join auth.users u on u.id = p.user_id
where lower(u.email) = lower('ana.nadal@demo.terapia');   -- ← cambiar

-- --- 4 · Las últimas cinco citas creadas, y de quién son --------------------
-- Para comprobar de un vistazo si la que acaba de crear es de otro paciente, o
-- si su hora ya pasó. La app solo muestra las FUTURAS y no canceladas.
select
  a.created_at,
  a.starts_at,
  a.status,
  p.full_name                                  as paciente,
  case when p.user_id is null then 'sin cuenta' else 'con cuenta' end as vinculo,
  case
    when a.starts_at <= now()                          then '🔴 ya pasó: no se muestra'
    when a.status not in ('scheduled','confirmed')     then '🔴 estado no visible'
    else 'visible si es su paciente'
  end as veredicto
from public.appointments a
join public.patients p on p.id = a.patient_id
order by a.created_at desc
limit 5;

-- --- 5 · Las últimas cinco tareas creadas, y de quién son -------------------
select t.created_at, t.title, p.full_name as paciente,
       case when p.user_id is null then '🔴 sin cuenta: nadie las verá' else 'con cuenta' end as vinculo
from public.tasks t
join public.patients p on p.id = t.patient_id
order by t.created_at desc
limit 5;

commit;
