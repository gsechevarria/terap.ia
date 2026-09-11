begin;
create function public.complete_patient_task(p_id uuid,p_response text default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare patient uuid:=public.current_patient_id(); completed uuid;
begin
 if patient is null then raise exception 'Acepta el consentimiento vigente para continuar'; end if;
 perform 1 from public.tasks where id=p_id and patient_id=patient for update;
 if not found then raise exception 'Tarea no disponible'; end if;
 if length(p_response)>10000 then raise exception 'La respuesta es demasiado larga'; end if;
 select id into completed from public.task_completions where task_id=p_id and patient_id=patient order by created_at,id limit 1;
 if completed is not null then return completed; end if;
 insert into public.task_completions(task_id,patient_id,response_text) values(p_id,patient,nullif(btrim(p_response),'')) returning id into completed;
 return completed;
end; $$;
revoke all on function public.complete_patient_task(uuid,text) from public,anon;
grant execute on function public.complete_patient_task(uuid,text) to authenticated;
drop policy if exists task_completions_insert_by_patient on public.task_completions;
commit;
