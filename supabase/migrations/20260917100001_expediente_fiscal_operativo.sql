-- =============================================================================
-- El expediente fiscal (20260915100001) no podía usarse. Dos motivos
-- independientes, los dos encontrados al escribir la comprobación del vaciado
-- de la demostración, que necesitaba dar de alta una factura para ejercitar su
-- clave foránea.
--
-- ---------------------------------------------------------------------------
-- 1. Sus siete tablas nunca recibieron permisos de API
-- ---------------------------------------------------------------------------
--
-- `20260911090001_explicit_api_grants` enumera tabla por tabla lo que ve
-- `authenticated`, precisamente porque las instalaciones nuevas de Supabase ya
-- no exponen sola una tabla nueva. El expediente fiscal se creó DESPUÉS y no
-- añadió ninguna línea a esa lista, así que sus siete tablas quedaron sin un
-- solo permiso: leer o escribir una factura desde la aplicación devuelve
-- «permission denied for table facturas», con la RLS correcta y sin llegar a
-- evaluarse.
--
-- Se declaran aquí, con el mismo criterio que el resto: `authenticated` opera
-- y la RLS decide sobre qué filas; `service_role` mantiene todo para los
-- procesos de servidor. Si el proyecto remoto los tenía por privilegios por
-- defecto, esto no cambia nada; si no los tenía, deja de estar roto.
--
-- ---------------------------------------------------------------------------
-- 2. El disparador de la ruta del justificante rechazaba TODA alta
-- ---------------------------------------------------------------------------
--
-- `guard_ruta_justificante` cuelga de las TRES tablas, y resolvía el campo así:
--
--     ruta := case TG_TABLE_NAME
--       when 'facturas'                 then new.documento_path
--       when 'retenciones_pagos_cuenta' then new.justificante_path
--       when 'checklist_personal'       then new.documento_path
--     end;
--
-- En PL/pgSQL `new` es un registro y la expresión se planifica ENTERA antes de
-- ejecutarse: `CASE` no evita que se resuelvan las ramas que no se van a tomar.
-- Sobre `facturas` no existe `justificante_path` y sobre
-- `retenciones_pagos_cuenta` no existe `documento_path`, así que toda escritura
-- moría con
--
--     42703: record "new" has no field "justificante_path"
--
-- Es decir: desde que se desplegó el expediente fiscal (20260915100001), el
-- libro registro de facturas, las retenciones y el checklist personal no
-- admitían ni una fila. La interfaz existe y la RLS es correcta; lo que fallaba
-- era el disparador, y fallaba SIEMPRE, no en un caso raro.
--
-- Se arregla leyendo la fila por `to_jsonb(new)`, que no depende del tipo
-- concreto. La regla que se comprueba no cambia: la ruta tiene que empezar por
-- el identificador del profesional, para que nadie apunte a la carpeta de otro
-- y se la lleve en su ZIP.
--
-- No cambia la firma ni el tipo de retorno, así que no hace falta `drop`.
-- =============================================================================

begin;

grant select, insert, update, delete on table
  public.actividades_fiscales, public.expedientes_fiscales,
  public.facturas, public.factura_cobros,
  public.retenciones_pagos_cuenta, public.checklist_personal,
  public.expediente_documentos
  to authenticated, service_role;

create or replace function public.guard_ruta_justificante()
returns trigger language plpgsql set search_path = '' as $$
declare fila jsonb := to_jsonb(new); ruta text;
begin
  ruta := case TG_TABLE_NAME
    when 'facturas'                 then fila ->> 'documento_path'
    when 'retenciones_pagos_cuenta' then fila ->> 'justificante_path'
    when 'checklist_personal'       then fila ->> 'documento_path'
    else null
  end;
  if ruta is not null and split_part(ruta, '/', 1) <> (fila ->> 'professional_id') then
    raise exception 'El justificante no pertenece a este profesional';
  end if;
  return new;
end; $$;

commit;
