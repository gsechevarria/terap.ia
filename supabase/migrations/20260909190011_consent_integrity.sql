begin;
create or replace function public.has_current_consent() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.patients p join auth.users u on u.id=p.user_id
   join public.consents c on c.patient_id=p.id and c.professional_id=p.professional_id
   join public.consent_templates t on t.id=c.template_id
   where p.user_id=auth.uid() and p.status='active' and c.accepted
     and u.raw_app_meta_data->>'role'='patient' and u.email_confirmed_at is not null
     and c.template_version=t.version and c.content_body=t.body
     and c.content_hash=encode(extensions.digest(t.body,'sha256'),'hex')
     and t.id=(select latest.id from public.consent_templates latest
       where latest.professional_id=p.professional_id and latest.active order by latest.version desc limit 1))
$$;
create or replace function public.consent_template_immutable() returns trigger language plpgsql set search_path='' as $$
begin
 if new.body is distinct from old.body or new.title is distinct from old.title
    or new.version is distinct from old.version or new.professional_id is distinct from old.professional_id then
   raise exception 'Crea una nueva versión del consentimiento para modificar su contenido';
 end if;
 return new;
end; $$;
commit;
