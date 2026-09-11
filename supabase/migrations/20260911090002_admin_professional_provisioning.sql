-- GoTrue aplica app_metadata después del INSERT al crear usuarios por Admin API.
-- Solo la metadata administrativa puede aprovisionar un profesional.
begin;
create function public.provision_admin_professional()
returns trigger language plpgsql security definer set search_path='' as $$
declare pro uuid;
begin
  if new.raw_app_meta_data->>'role' = 'professional' then
    insert into public.professionals(user_id,email,full_name)
    values(new.id,new.email,new.raw_user_meta_data->>'full_name')
    on conflict(user_id) do nothing returning id into pro;
    if pro is not null then perform public.ensure_consent_template(pro); end if;
  end if;
  return new;
end;
$$;
revoke all on function public.provision_admin_professional() from public,anon,authenticated;
create trigger on_auth_admin_role_updated
  after update of raw_app_meta_data on auth.users
  for each row when (new.raw_app_meta_data->>'role' = 'professional')
  execute function public.provision_admin_professional();
commit;
