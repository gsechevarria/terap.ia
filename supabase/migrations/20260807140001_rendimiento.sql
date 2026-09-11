-- =============================================================================
-- Fase 4 · Rendimiento y reintentos (ago 2026)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Cola de notificaciones: reintentos
-- ---------------------------------------------------------------------------
-- `status = 'failed'` era terminal: si el usuario aún no tenía suscripción push
-- la notificación se marcaba como fallida y no se reintentaba nunca, aunque
-- activase el push cinco minutos después. Ahora se distingue "todavía no hay
-- canal" de "fallo definitivo".
alter table public.notifications
  add column if not exists retry_count int not null default 0;
alter table public.notifications
  add column if not exists next_attempt_at timestamptz;

create index if not exists notifications_cola_idx
  on public.notifications (status, scheduled_for, next_attempt_at)
  where status = 'queued';

-- ---------------------------------------------------------------------------
-- 2) Paginación real del histórico de pagos
-- ---------------------------------------------------------------------------
-- La query traía TODOS los pagos del profesional sin `order`, sin `limit` y sin
-- `range`, y filtraba por fechas en memoria. PostgREST corta en `db-max-rows`
-- (1.000) y, sin ORDER BY, el subconjunto devuelto ni siquiera es determinista:
-- con 4 años de historial, filtrar "enero 2024" mostraba 3 pagos en vez de 55 y
-- el total del panel reportaba una fracción de lo real, sin ningún aviso.
--
-- La columna generada permite ordenar y filtrar EN SQL por la fecha efectiva.
alter table public.payments
  add column if not exists fecha_efectiva timestamptz
  generated always as (coalesce(paid_at, created_at)) stored;

create index if not exists payments_fecha_efectiva_idx
  on public.payments (professional_id, fecha_efectiva desc);

-- ---------------------------------------------------------------------------
-- 3) Claves foráneas sin índice
-- ---------------------------------------------------------------------------
-- `patient_notes.professional_id` la usa la propia política RLS, así que sin
-- índice cada lectura de notas hacía un seq scan.
create index if not exists patient_notes_professional_id_idx on public.patient_notes (professional_id);
create index if not exists notifications_professional_id_idx on public.notifications (professional_id);
create index if not exists notifications_patient_id_idx      on public.notifications (patient_id);
create index if not exists scale_assignments_scale_id_idx    on public.scale_assignments (scale_id);
create index if not exists scale_responses_scale_id_idx      on public.scale_responses (scale_id);
create index if not exists appointments_parent_idx           on public.appointments (parent_appointment_id);
create index if not exists payments_session_pack_id_idx      on public.payments (session_pack_id);
create index if not exists documents_uploaded_by_idx         on public.documents (uploaded_by);
create index if not exists consents_template_id_idx          on public.consents (template_id);
create index if not exists bienes_inversion_gasto_id_idx     on public.bienes_inversion (gasto_id);

-- ---------------------------------------------------------------------------
-- 4) Índices compuestos para los accesos reales de la aplicación
-- ---------------------------------------------------------------------------
create index if not exists appointments_pro_starts_idx on public.appointments (professional_id, starts_at desc);
create index if not exists payments_pro_status_idx     on public.payments (professional_id, status, paid_at);
create index if not exists mood_entries_pat_date_idx   on public.mood_entries (patient_id, entry_date desc);
create index if not exists scale_responses_pat_sub_idx on public.scale_responses (patient_id, submitted_at desc);
create index if not exists gastos_pro_fecha_idx        on public.gastos (professional_id, fecha);

-- ---------------------------------------------------------------------------
-- 5) Políticas RLS que se re-evaluaban por fila
-- ---------------------------------------------------------------------------
-- Dos patrones:
--
--  a) Envolver el helper escalar en `(select ...)` para que el planner lo
--     promueva a InitPlan y lo evalúe UNA vez por consulta en vez de una por
--     fila.
--  b) Sustituir `professional_owns_patient(patient_id)` por un `IN`. Esa
--     función recibe una COLUMNA, así que es estructuralmente imposible de
--     cachear: se ejecuta por fila y cada ejecución lanza dos subconsultas
--     anidadas. Afecta justo a las tablas que más crecen (diario, respuestas de
--     escala, completado de tareas).
--
-- ⚠️ NO se ha medido contra el remoto: no se afirma ninguna mejora concreta.
--    En `docs/DEPLOY.md` está el `explain (analyze, buffers)` que hay que
--    ejecutar para comprobarlo.

alter policy patients_select_by_professional on public.patients
  using (professional_id = (select public.current_professional_id()));

alter policy mood_entries_select_by_professional on public.mood_entries
  using (
    patient_id in (
      select p.id from public.patients p
       where p.professional_id = (select public.current_professional_id())
    )
  );

alter policy scale_responses_select_by_professional on public.scale_responses
  using (
    patient_id in (
      select p.id from public.patients p
       where p.professional_id = (select public.current_professional_id())
    )
  );

alter policy task_completions_select_by_professional on public.task_completions
  using (
    task_id in (
      select t.id from public.tasks t
       where t.professional_id = (select public.current_professional_id())
    )
  );
