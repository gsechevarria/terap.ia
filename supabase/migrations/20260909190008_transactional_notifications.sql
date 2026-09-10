begin;
create function public.queue_created_item() returns trigger language plpgsql security definer set search_path='' as $$
declare recipient uuid; kind text; target text; detail jsonb;
begin
 select user_id into recipient from public.patients where id=new.patient_id and status='active';
 if recipient is null then return new; end if;
 if TG_TABLE_NAME='tasks' then kind:='new_task'; target:='/app';
 elsif TG_TABLE_NAME='scale_assignments' then
   if not new.active then return new; end if;
   kind:='new_scale'; target:='/app';
 else
   if new.parent_appointment_id is not null then return new; end if;
   kind:='appointment_created'; target:='/app/appointments';
 end if;
 detail:=jsonb_build_object('url',target);
 if TG_TABLE_NAME='appointments' then detail:=detail||jsonb_build_object('appointment_id',new.id,'starts_at',new.starts_at); end if;
 insert into public.notifications(user_id,professional_id,patient_id,channel,type,title,body,payload,status,dedupe_key)
 values(recipient,new.professional_id,new.patient_id,'push',kind,'terap.ia','Tienes una novedad en tu cuenta.',detail,'queued',TG_TABLE_NAME||':'||new.id)
 on conflict(dedupe_key) where dedupe_key is not null do nothing;
 return new;
end; $$;
create trigger tasks_notify after insert on public.tasks for each row execute function public.queue_created_item();
create trigger scales_notify after insert on public.scale_assignments for each row execute function public.queue_created_item();
create trigger appointments_notify after insert on public.appointments for each row execute function public.queue_created_item();
-- Nadie fabrica avisos por API: solo los productores transaccionales y el cron.
drop policy if exists notifications_insert_by_professional on public.notifications;
create or replace function public.patient_respond_appointment(p_appointment_id uuid,p_action text)
returns void language plpgsql security definer set search_path='' as $$
declare patient uuid:=public.current_patient_id();
begin
 if patient is null then raise exception 'Acepta el consentimiento vigente para continuar'; end if;
 if p_action is null or p_action not in ('confirm','cancel') then raise exception 'Acción no válida'; end if;
 update public.appointments set status=case p_action when 'confirm' then 'confirmed'::public.appointment_status else 'cancelled'::public.appointment_status end
 where id=p_appointment_id and patient_id=patient and status in ('scheduled','confirmed') and attendance='pending';
 if not found then raise exception 'Cita no disponible'; end if;
end; $$;
commit;
