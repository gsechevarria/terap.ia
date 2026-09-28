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
    -- Dominio PRINCIPAL, sin redirección: `net.http_get` no sigue un 308, y
    -- llamando a un dominio que redirige, los recordatorios dejan de salir sin
    -- ningún error. `www.terap.es` redirige a `terap.es`.
    url := 'https://terap.es/api/cron/notifications',
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
-- Cambiar la URL de una tarea ya creada (así se pasó a terap.es el 28-sep):
--   select cron.alter_job((select jobid from cron.job where jobname = 'terap-notifications'),
--     command := $job$ select net.http_get(url := 'https://terap.es/api/cron/notifications',
--       headers := jsonb_build_object('Authorization', 'Bearer ' ||
--         (select decrypted_secret from vault.decrypted_secrets where name = 'terap_cron_secret')),
--       timeout_milliseconds := 55000); $job$);
