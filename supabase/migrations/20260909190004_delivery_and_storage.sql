begin;
-- Solo proveedores de Web Push conocidos, nunca IP, puerto alternativo o URL con usuario.
create function public.valid_push_endpoint(v text) returns boolean language sql immutable set search_path='' as $$
 select length(v) <= 4096 and v ~ '^https://(fcm[.]googleapis[.]com|updates[.]push[.]services[.]mozilla[.]com|web[.]push[.]apple[.]com|[a-z0-9-]+[.]notify[.]windows[.]com)/[^[:space:]#]+$'
$$;
alter table public.push_subscriptions add constraint push_endpoint_allowed check(public.valid_push_endpoint(endpoint)) not valid;
alter table public.push_subscriptions add constraint push_keys_valid check(p256dh ~ '^[A-Za-z0-9_-]{87}=?$' and auth ~ '^[A-Za-z0-9_-]{22}={0,2}$') not valid;
drop policy if exists notifications_insert_self on public.notifications;
drop policy if exists notifications_insert_by_professional on public.notifications;
create policy notifications_insert_by_professional on public.notifications for insert to authenticated with check (
 professional_id=(select public.current_professional_id()) and exists(select 1 from public.patients p
 where p.id=notifications.patient_id and p.professional_id=notifications.professional_id and p.user_id=notifications.user_id)
 and type in ('appointment_created','new_task','new_scale') and status='queued'
 and sent_at is null and read_at is null
);
drop policy if exists notifications_update_own on public.notifications;
create function public.mark_notification_read(p_id uuid) returns void language sql security definer set search_path='' as $$
 update public.notifications set read_at=coalesce(read_at,now()) where id=p_id and user_id=auth.uid()
$$;
revoke all on function public.mark_notification_read(uuid) from public,anon;
grant execute on function public.mark_notification_read(uuid) to authenticated;

alter table public.notifications add column lock_token uuid;
alter table public.notifications add column locked_until timestamptz;
alter table public.notifications add column dedupe_key text;
create unique index notifications_dedupe_uq on public.notifications(dedupe_key) where dedupe_key is not null;
create table public.notification_deliveries(
 notification_id uuid not null references public.notifications(id) on delete cascade,
 subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
 sent_at timestamptz not null default now(), primary key(notification_id,subscription_id)
);
alter table public.notification_deliveries enable row level security;
grant all on public.notification_deliveries to service_role;
create function public.claim_notifications(p_token uuid,p_limit int default 20) returns setof public.notifications
language sql security definer set search_path='' as $$
 update public.notifications set lock_token=p_token,locked_until=now()+interval '2 minutes'
 where id in (select id from public.notifications where status='queued'
 and coalesce(scheduled_for,now()) <= now() and coalesce(next_attempt_at,now()) <= now()
 and coalesce(locked_until,now()) <= now()
 order by (type='scale_flag') desc,created_at,id limit least(greatest(p_limit,1),20) for update skip locked)
 returning *
$$;
create function public.queue_appointment_reminders() returns int language plpgsql security definer set search_path='' as $$
declare n int;
begin
 insert into public.notifications(user_id,professional_id,patient_id,type,title,body,payload,dedupe_key)
 select p.user_id,a.professional_id,a.patient_id,'appointment_reminder','terap.ia','Tienes una novedad en tu cuenta.',
 jsonb_build_object('url','/app/appointments','appointment_id',a.id,'starts_at',a.starts_at),
 'reminder:'||a.id::text||':'||a.starts_at::text
 from public.appointments a join public.patients p on p.id=a.patient_id
 where a.status in ('scheduled','confirmed') and a.starts_at>now() and a.starts_at<=now()+interval '24 hours'
 and p.user_id is not null and p.status='active'
 on conflict(dedupe_key) where dedupe_key is not null do nothing;
 get diagnostics n=row_count; return n;
end; $$;
revoke all on function public.claim_notifications(uuid,int),public.queue_appointment_reminders() from public,anon,authenticated;
grant execute on function public.claim_notifications(uuid,int),public.queue_appointment_reminders() to service_role;

-- Cola duradera para borrar objetos únicamente después del cambio de metadatos.
create table public.storage_cleanup_jobs (
 id uuid primary key default gen_random_uuid(), bucket text not null check(bucket in ('files','receipts')),
 path text not null, created_at timestamptz not null default now(), unique(bucket,path)
);
alter table public.storage_cleanup_jobs enable row level security;
grant all on public.storage_cleanup_jobs to service_role;
create function public.queue_storage_cleanup() returns trigger language plpgsql security definer set search_path='' as $$
declare path text; nextpath text; bucket text;
begin
 if TG_TABLE_NAME='gastos' then path:=old.adjunto_path; bucket:='receipts';
   if TG_OP='UPDATE' then nextpath:=new.adjunto_path; end if;
 else path:=old.storage_path; bucket:='files';
   if TG_OP='UPDATE' then nextpath:=new.storage_path; end if;
 end if;
 if path is not null and path is distinct from nextpath then
   insert into public.storage_cleanup_jobs(bucket,path) values(bucket,path) on conflict do nothing;
 end if;
 return null;
end; $$;
create trigger gastos_cleanup after update or delete on public.gastos for each row execute function public.queue_storage_cleanup();
create trigger documents_cleanup after update or delete on public.documents for each row execute function public.queue_storage_cleanup();
create trigger resources_cleanup after update or delete on public.resources for each row execute function public.queue_storage_cleanup();
commit;
