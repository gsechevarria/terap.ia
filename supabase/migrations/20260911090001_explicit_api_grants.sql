-- Permisos explícitos: las instalaciones nuevas no autoexponen tablas.
-- RLS y los triggers siguen limitando propietario, rol y operaciones RPC.
begin;
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on table
  public.professionals, public.patients, public.invitations,
  public.tasks, public.task_completions, public.scales,
  public.scale_assignments, public.scale_responses, public.appointments,
  public.payment_settings, public.session_packs, public.payments,
  public.mood_entries, public.resources, public.documents,
  public.consent_templates, public.consents, public.emergency_links,
  public.patient_notes, public.agenda_blocks, public.push_subscriptions,
  public.notification_preferences, public.device_push_tokens,
  public.configuracion_fiscal, public.gastos, public.bienes_inversion,
  public.pending_uploads
  to authenticated, service_role;
grant select on public.notifications, public.v_ingresos_fiscales to authenticated;
grant all on public.notifications, public.notification_deliveries,
  public.storage_cleanup_jobs, public.v_ingresos_fiscales to service_role;
grant usage, select on all sequences in schema public to service_role;
commit;
