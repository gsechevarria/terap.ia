begin;
alter table public.storage_cleanup_jobs add column available_at timestamptz not null default now();
create table public.pending_uploads (
 path text primary key, bucket text not null check(bucket in ('files','receipts')),
 professional_id uuid not null references public.professionals(id), patient_id uuid references public.patients(id),
 size_bytes bigint not null check(size_bytes>0 and size_bytes<=20971520), mime text not null,
 created_at timestamptz not null default now()
);
alter table public.pending_uploads enable row level security;
create policy pending_uploads_owner on public.pending_uploads for all to authenticated
 using(professional_id=(select public.current_professional_id()))
 with check(professional_id=(select public.current_professional_id())
   and ((bucket='receipts' and patient_id is null and split_part(path,'/',1)=professional_id::text)
     or (bucket='files' and public.professional_owns_patient(patient_id) and split_part(path,'/',1)=patient_id::text)));
create function public.queue_abandoned_upload() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.storage_cleanup_jobs(bucket,path,available_at) values(new.bucket,new.path,now()+interval '1 day');
 return new;
end; $$;
create trigger pending_upload_cleanup after insert on public.pending_uploads for each row execute function public.queue_abandoned_upload();
create function public.confirm_upload_reference() returns trigger language plpgsql security definer set search_path='' as $$
declare v_path text; previous text; v_bucket text;
begin
 if TG_TABLE_NAME='gastos' then v_path:=new.adjunto_path; v_bucket:='receipts';
   if TG_OP='UPDATE' then previous:=old.adjunto_path; end if;
 else v_path:=new.storage_path; v_bucket:='files';
   if TG_OP='UPDATE' then previous:=old.storage_path; end if;
 end if;
 if v_path is not null and v_path is distinct from previous and auth.uid() is not null then
   delete from public.pending_uploads u where u.path=v_path and u.bucket=v_bucket
     and u.professional_id=new.professional_id;
   if not found then raise exception 'Archivo pendiente no disponible'; end if;
   delete from public.storage_cleanup_jobs j where j.path=v_path and j.bucket=v_bucket;
 end if;
 return new;
end; $$;
create trigger documents_confirm_upload before insert or update on public.documents for each row execute function public.confirm_upload_reference();
create trigger resources_confirm_upload before insert or update on public.resources for each row execute function public.confirm_upload_reference();
create trigger gastos_confirm_upload before insert or update on public.gastos for each row execute function public.confirm_upload_reference();
commit;
