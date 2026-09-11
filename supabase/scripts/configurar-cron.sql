-- Ejecutar como administrador después de guardar terap_cron_secret en Vault.
-- Se crea INACTIVO; activar después de desplegar y comprobar el endpoint.
begin;
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
do $$ begin
  if not exists (select 1 from vault.secrets where name = 'terap_cron_secret') then
    raise exception 'Falta terap_cron_secret en Vault';
  end if;
end $$;
select cron.schedule('terap-notifications', '* * * * *', $job$
  select net.http_get(
    url := 'https://terap.vercel.app/api/cron/notifications',
    headers := jsonb_build_object('Authorization', 'Bearer ' ||
      (select decrypted_secret from vault.decrypted_secrets where name = 'terap_cron_secret')),
    timeout_milliseconds := 55000
  );
$job$);
select cron.alter_job(jobid, active := false)
from cron.job where jobname = 'terap-notifications';
commit;
-- Activar: select cron.alter_job(jobid, active := true) from cron.job where jobname = 'terap-notifications';
-- Pausar: select cron.alter_job(jobid, active := false) from cron.job where jobname = 'terap-notifications';
-- Verificar HTTP: select id,status_code,timed_out,error_msg from net._http_response order by id desc limit 10;
