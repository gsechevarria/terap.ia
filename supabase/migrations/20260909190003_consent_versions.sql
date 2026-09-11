begin;
drop index if exists public.consents_patient_uq;
create unique index consents_patient_template_uq on public.consents(patient_id,template_id);

create function public.has_current_consent() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.patients p join public.consents c on c.patient_id=p.id
   where p.user_id=auth.uid() and p.status='active' and c.accepted
     and c.template_id=(select t.id from public.consent_templates t
       where t.professional_id=p.professional_id and t.active order by t.version desc limit 1))
$$;
create or replace function public.current_patient_id() returns uuid language sql stable security definer set search_path='' as $$
 select id from public.patients where user_id=auth.uid() and status='active' and public.has_current_consent()
$$;
create function public.get_onboarding_consent(p_token text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
declare pro uuid; t public.consent_templates%rowtype; mail text;
begin
 select email into mail from auth.users where id=auth.uid() and email_confirmed_at is not null
   and raw_app_meta_data->>'role'='patient';
 if mail is null then raise exception 'Cuenta de paciente verificada requerida'; end if;
 select professional_id into pro from public.patients where user_id=auth.uid() and status='active';
 if pro is null then
   select professional_id into pro from public.invitations
   where token_hash=encode(extensions.digest(p_token,'sha256'),'hex')
     and lower(email)=lower(mail) and accepted_at is null and expires_at>now();
 end if;
 if pro is null then raise exception 'Invitación no disponible'; end if;
 select * into t from public.consent_templates where professional_id=pro and active order by version desc limit 1;
 if not found then raise exception 'No hay consentimiento activo'; end if;
 return jsonb_build_object('id',t.id,'version',t.version,'title',t.title,'body',t.body,
    'hash',encode(extensions.digest(t.body,'sha256'),'hex'));
end; $$;
create function public.complete_onboarding(p_token text,p_template_id uuid,p_content_hash text) returns uuid
language plpgsql security definer set search_path='' as $$
declare pid uuid; t jsonb; signed uuid;
begin
 -- Valida el texto que se mostró antes de cualquier vinculación.
 t := public.get_onboarding_consent(p_token);
 if t->>'id' is distinct from p_template_id::text or t->>'hash' is distinct from p_content_hash then
   raise exception 'El consentimiento ha cambiado. Recarga y revisa la nueva versión';
 end if;
 select id into pid from public.patients where user_id=auth.uid() for update;
 if pid is null then pid := public.accept_invitation(p_token); end if;
 insert into public.consents(professional_id,patient_id,template_id,template_version,accepted,content_hash,content_body,signed_at)
 select professional_id,pid,p_template_id,(t->>'version')::int,true,p_content_hash,t->>'body',now()
 from public.patients where id=pid
 on conflict(patient_id,template_id) do nothing returning id into signed;
 if signed is null then select id into signed from public.consents where patient_id=pid and template_id=p_template_id; end if;
 return signed;
end; $$;
revoke execute on function public.accept_invitation(text),public.patient_accept_consent() from authenticated;
revoke all on function public.get_onboarding_consent(text),public.complete_onboarding(text,uuid,text),public.has_current_consent() from public,anon;
grant execute on function public.get_onboarding_consent(text),public.complete_onboarding(text,uuid,text),public.has_current_consent() to authenticated;

-- Revocar invitaciones previas y generar la nueva es una sola operación.
create function public.issue_invitation(p_patient_id uuid,p_token_hash text) returns timestamptz
language plpgsql security definer set search_path='' as $$
declare p public.patients%rowtype; expires timestamptz;
begin
 select * into p from public.patients where id=p_patient_id and professional_id=public.current_professional_id() for update;
 if not found or p.user_id is not null or p.email is null or p.status<>'active' then raise exception 'Paciente no disponible para invitar'; end if;
 if p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'Token no válido'; end if;
 update public.invitations set expires_at=least(expires_at,now()) where patient_id=p.id and accepted_at is null;
 insert into public.invitations(professional_id,patient_id,email,token_hash)
 values(p.professional_id,p.id,p.email,p_token_hash) returning expires_at into expires;
 return expires;
end; $$;
revoke all on function public.issue_invitation(uuid,text) from public,anon;
grant execute on function public.issue_invitation(uuid,text) to authenticated;
commit;
