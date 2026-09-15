-- =============================================================================
-- Expediente fiscal anual · recopilación, revisión y exportación para gestoría
--
--   QUÉ ES: un expediente por ejercicio y profesional, con estado, que agrupa lo
--   que el gestor necesita para preparar la renta. NO presenta ante la AEAT, no
--   calcula la cuota de renta y no emite facturas.
--
--   POR QUÉ TRES CONCEPTOS SEPARADOS, Y NO UNO:
--     · `payments`  = COBROS. Ya existía. Sigue siendo la fuente de verdad de
--       lo que ha entrado en caja. No se toca.
--     · `facturas`  = FACTURACIÓN. Nuevo. El documento emitido, con serie,
--       número y destinatario fiscal. Es un LIBRO REGISTRO: la aplicación
--       anota facturas emitidas fuera de ella, no las emite (Verifactu).
--     · Ingresos fiscales = DERIVADO de ambos según el criterio de imputación.
--       No se almacena: se calcula, para que no haya dos verdades.
--   Un cobro puede imputarse a una factura (`factura_cobros`) sin dejar de ser
--   un cobro, y una factura puede no tener cobro todavía.
--
--   DISTINGUIR AUSENCIA DE CERO: los campos que el profesional puede no saber
--   son NULL, nunca 0 ni false por defecto. `desconocido` y `no_aplica` son
--   valores explícitos de sus enums. Un dato que falta bloquea el cálculo que
--   dependa de él; no lo convierte en cero.
--
--   TERRITORIO: se recoge siempre. Las reglas verificadas de la aplicación son
--   de territorio común; País Vasco, Navarra, Canarias, Ceuta y Melilla se
--   pueden registrar y exportar, pero sus cálculos quedan PENDIENTES. La
--   columna existe para que el dato no se pierda, no para extrapolar reglas.
-- =============================================================================

begin;

-- === Tipos ==================================================================

create type public.territorio_fiscal as enum (
  'comun', 'alava', 'bizkaia', 'gipuzkoa', 'navarra',
  'canarias', 'ceuta', 'melilla'
);

create type public.criterio_imputacion as enum (
  'devengo',      -- regla general
  'cobros_pagos', -- art. 7.2 RIRPF, requiere opción ejercida
  'desconocido'
);

create type public.estado_expediente as enum (
  'borrador',
  'pendiente_informacion',
  'preparado_revision',
  'revisado'
);

create type public.tipo_destinatario as enum (
  'particular', 'clinica', 'aseguradora', 'empresa', 'profesional', 'otro'
);

/*
 * Categoría ADMINISTRATIVA del servicio. No decide la tributación: solo
 * describe qué se hizo. La exención sanitaria depende de la titulación del
 * profesional y de la finalidad de diagnóstico, prevención o tratamiento, no
 * del nombre del servicio ni de quién paga.
 */
create type public.categoria_servicio as enum (
  'asistencia_sanitaria', 'formacion', 'peritaje', 'consultoria',
  'seleccion_personal', 'coaching', 'otro'
);

/*
 * Tratamiento de IVA de la operación. `exenta`, `no_sujeta` y `sujeta` a tipo
 * cero son tres cosas distintas y no pueden colapsarse en "IVA = 0": tienen
 * efectos diferentes en el 303 y en la prorrata.
 */
create type public.tratamiento_iva as enum (
  'sujeta', 'exenta', 'no_sujeta', 'pendiente'
);

create type public.tipo_factura as enum ('ordinaria', 'rectificativa', 'anticipo');

create type public.estado_registro_fiscal as enum (
  'propuesto',   -- lo trajo una importación o una derivación automática
  'confirmado',  -- el profesional lo ha revisado y entra en el expediente
  'pendiente',   -- falta información para decidir
  'excluido'     -- revisado y fuera, con motivo
);

create type public.clase_retencion as enum (
  'soportada_cliente',      -- el cliente se la practicó al profesional
  'practicada_colaborador', -- el profesional se la practicó a un tercero
  'pago_fraccionado_irpf',  -- modelo 130
  'liquidacion_iva'         -- modelo 303
);

-- === Configuración fiscal: lo que faltaba para poder decidir =================
-- Todo NULL por defecto: no saber no es lo mismo que responder que no.

alter table public.configuracion_fiscal
  add column territorio public.territorio_fiscal,
  add column comunidad_autonoma text,
  add column criterio_imputacion public.criterio_imputacion,
  -- El criterio de cobros y pagos exige haber ejercido la opción. Se guarda la
  -- evidencia, no solo la afirmación.
  add column criterio_evidencia_path text,
  add column fecha_baja_actividad date,
  add column tiene_empleados boolean,
  add column tiene_colaboradores boolean,
  add column tiene_alquileres boolean,
  add column operaciones_internacionales boolean,
  -- Consulta: propia, alquilada, compartida o domicilio parcialmente afecto.
  add column tipo_consulta text,
  add column vivienda_m2_totales numeric(7,2),
  add column vivienda_m2_afectos numeric(7,2);

comment on column public.configuracion_fiscal.comunidad_autonoma is
  'Código o nombre de CCAA. Se recoge para el gestor; la aplicación no aplica deducciones autonómicas.';

-- === Actividades y epígrafes (varios por profesional) ========================
-- La tabla anterior tenía un único `epigrafe_iae`. Un psicólogo puede tener
-- actividad sanitaria y formación declaradas a la vez, y eso cambia el IVA.

create table public.actividades_fiscales (
  id               uuid primary key default gen_random_uuid(),
  professional_id  uuid not null references public.professionals (id) on delete cascade,
  epigrafe_iae     text not null,
  descripcion      text,
  situacion_iva    text,
  fecha_alta       date,
  fecha_baja       date,
  -- Documento censal (036/037) que la acredita, si se aporta.
  censal_path      text,
  principal        boolean not null default false,
  created_at       timestamptz not null default now()
);
create index actividades_fiscales_pro_idx
  on public.actividades_fiscales (professional_id);

-- === Expediente anual ========================================================

create table public.expedientes_fiscales (
  id               uuid primary key default gen_random_uuid(),
  professional_id  uuid not null references public.professionals (id) on delete cascade,
  ejercicio        int not null check (ejercicio between 2015 and 2100),
  estado           public.estado_expediente not null default 'borrador',
  territorio       public.territorio_fiscal,
  -- Quién y cuándo lo dio por revisado. NO implica aprobación profesional del
  -- gestor: es la persona de la consulta que declara haberlo repasado.
  revisado_por     text,
  revisado_at      timestamptz,
  nota_gestor      text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (professional_id, ejercicio)
);

-- === Facturación (libro registro; la aplicación NO emite facturas) ===========

create table public.facturas (
  id                  uuid primary key default gen_random_uuid(),
  professional_id     uuid not null references public.professionals (id) on delete cascade,
  serie               text,
  numero              text,
  tipo                public.tipo_factura not null default 'ordinaria',
  -- Una rectificativa apunta siempre a la que corrige.
  rectifica_a         uuid references public.facturas (id) on delete restrict,
  fecha_emision       date not null,
  fecha_operacion     date,
  -- Ejercicio al que se imputa, que puede no ser el de emisión.
  ejercicio_imputacion int,
  criterio_imputacion public.criterio_imputacion,
  patient_id          uuid references public.patients (id) on delete set null,
  destinatario_nombre text,
  destinatario_nif    text,
  destinatario_tipo   public.tipo_destinatario,
  categoria_servicio  public.categoria_servicio,
  actividad_id        uuid references public.actividades_fiscales (id) on delete set null,
  base_cents          int not null,
  tratamiento_iva     public.tratamiento_iva not null default 'pendiente',
  tipo_iva            int check (tipo_iva between 0 and 100),
  cuota_iva_cents     int,
  retencion_pct       int check (retencion_pct between 0 and 100),
  retencion_cents     int,
  total_cents         int not null,
  -- Justificante del documento emitido fuera de la aplicación.
  documento_path      text,
  origen              text not null default 'manual',
  -- Huella de la fila de origen en una importación, para no duplicar al
  -- reimportar el mismo fichero.
  import_hash         text,
  estado              public.estado_registro_fiscal not null default 'propuesto',
  motivo_exclusion    text,
  notas               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index facturas_pro_ejercicio_idx
  on public.facturas (professional_id, ejercicio_imputacion);
-- Serie y número no se repiten dentro de un profesional cuando constan.
create unique index facturas_serie_numero_uq
  on public.facturas (professional_id, serie, numero)
  where serie is not null and numero is not null;
-- Una misma fila importada no entra dos veces.
create unique index facturas_import_uq
  on public.facturas (professional_id, import_hash)
  where import_hash is not null;

-- === Cobros imputados a facturas ============================================
-- Enlaza facturación con cobros SIN duplicar el importe: el dinero vive en
-- `payments`; aquí solo consta qué parte de qué factura cubre.

create table public.factura_cobros (
  id            uuid primary key default gen_random_uuid(),
  factura_id    uuid not null references public.facturas (id) on delete cascade,
  payment_id    uuid references public.payments (id) on delete set null,
  fecha         date not null,
  importe_cents int not null check (importe_cents <> 0),
  created_at    timestamptz not null default now()
);
create index factura_cobros_factura_idx on public.factura_cobros (factura_id);
-- Un cobro no se imputa dos veces a la misma factura.
create unique index factura_cobros_payment_uq
  on public.factura_cobros (factura_id, payment_id)
  where payment_id is not null;

-- === Retenciones y pagos a cuenta ===========================================

create table public.retenciones_pagos_cuenta (
  id               uuid primary key default gen_random_uuid(),
  professional_id  uuid not null references public.professionals (id) on delete cascade,
  ejercicio        int not null,
  clase            public.clase_retencion not null,
  periodo          text,               -- '1T', '2T', '3T', '4T', 'anual'
  modelo           text,               -- '130', '303', '111', '115'…
  importe_cents    int not null,
  fecha            date,
  -- Certificado de retenciones o justificante de presentación.
  justificante_path text,
  -- Una rectificación apunta a la que corrige.
  rectifica_a      uuid references public.retenciones_pagos_cuenta (id) on delete restrict,
  estado           public.estado_registro_fiscal not null default 'propuesto',
  notas            text,
  created_at       timestamptz not null default now()
);
create index retenciones_pro_ejercicio_idx
  on public.retenciones_pagos_cuenta (professional_id, ejercicio);

-- === Checklist personal para el gestor ======================================
-- Separado de la contabilidad profesional a propósito: son datos de la renta
-- personal, no de la actividad.

create table public.checklist_personal (
  id               uuid primary key default gen_random_uuid(),
  professional_id  uuid not null references public.professionals (id) on delete cascade,
  ejercicio        int not null,
  clave            text not null,
  -- `null` = sin responder. No es lo mismo que "no aplica".
  aplica           boolean,
  aportado         boolean not null default false,
  documento_path   text,
  notas            text,
  updated_at       timestamptz not null default now(),
  unique (professional_id, ejercicio, clave)
);

-- === Documentos del expediente ==============================================
-- Solo lo que el profesional selecciona explícitamente. Nunca documentación
-- clínica: la restricción de bucket lo impide a nivel de dato.

create table public.expediente_documentos (
  id              uuid primary key default gen_random_uuid(),
  expediente_id   uuid not null references public.expedientes_fiscales (id) on delete cascade,
  -- `files` es el bucket de documentación clínica y NO se admite aquí.
  bucket          text not null default 'receipts' check (bucket in ('receipts')),
  path            text not null,
  titulo          text,
  -- A qué registro acompaña, para el índice del expediente.
  referencia_tipo text,
  referencia_id   uuid,
  created_at      timestamptz not null default now(),
  unique (expediente_id, bucket, path)
);

-- === RLS ====================================================================
-- Mismo patrón que el resto del módulo: el ámbito es el profesional actual.

alter table public.actividades_fiscales      enable row level security;
alter table public.expedientes_fiscales      enable row level security;
alter table public.facturas                  enable row level security;
alter table public.factura_cobros            enable row level security;
alter table public.retenciones_pagos_cuenta  enable row level security;
alter table public.checklist_personal        enable row level security;
alter table public.expediente_documentos     enable row level security;

drop policy if exists actividades_fiscales_owner on public.actividades_fiscales;
create policy actividades_fiscales_owner on public.actividades_fiscales
  for all to authenticated
  using (professional_id = (select public.current_professional_id()))
  with check (professional_id = (select public.current_professional_id()));

drop policy if exists expedientes_fiscales_owner on public.expedientes_fiscales;
create policy expedientes_fiscales_owner on public.expedientes_fiscales
  for all to authenticated
  using (professional_id = (select public.current_professional_id()))
  with check (professional_id = (select public.current_professional_id()));

drop policy if exists facturas_owner on public.facturas;
create policy facturas_owner on public.facturas
  for all to authenticated
  using (professional_id = (select public.current_professional_id()))
  with check (
    professional_id = (select public.current_professional_id())
    -- Si la factura se ata a un paciente, tiene que ser suyo.
    and (patient_id is null or public.professional_owns_patient(patient_id))
  );

drop policy if exists retenciones_owner on public.retenciones_pagos_cuenta;
create policy retenciones_owner on public.retenciones_pagos_cuenta
  for all to authenticated
  using (professional_id = (select public.current_professional_id()))
  with check (professional_id = (select public.current_professional_id()));

drop policy if exists checklist_personal_owner on public.checklist_personal;
create policy checklist_personal_owner on public.checklist_personal
  for all to authenticated
  using (professional_id = (select public.current_professional_id()))
  with check (professional_id = (select public.current_professional_id()));

-- Las tablas hijas heredan el ámbito de su padre, comprobándolo de verdad:
-- sin este `exists`, bastaría conocer un UUID ajeno para escribir en él.
drop policy if exists factura_cobros_owner on public.factura_cobros;
create policy factura_cobros_owner on public.factura_cobros
  for all to authenticated
  using (exists (
    select 1 from public.facturas f
    where f.id = factura_cobros.factura_id
      and f.professional_id = (select public.current_professional_id())
  ))
  with check (exists (
    select 1 from public.facturas f
    where f.id = factura_cobros.factura_id
      and f.professional_id = (select public.current_professional_id())
  ));

drop policy if exists expediente_documentos_owner on public.expediente_documentos;
create policy expediente_documentos_owner on public.expediente_documentos
  for all to authenticated
  using (exists (
    select 1 from public.expedientes_fiscales e
    where e.id = expediente_documentos.expediente_id
      and e.professional_id = (select public.current_professional_id())
  ))
  with check (exists (
    select 1 from public.expedientes_fiscales e
    where e.id = expediente_documentos.expediente_id
      and e.professional_id = (select public.current_professional_id())
  ));

-- === Guardas de coherencia ==================================================

/*
 * Una rectificativa sin factura de origen no es una rectificativa, y una
 * factura no puede rectificarse a sí misma ni rectificar la de otro
 * profesional. Se comprueba en disparador porque una restricción CHECK no
 * puede consultar otra fila.
 */
create or replace function public.guard_factura_rectificativa()
returns trigger language plpgsql set search_path = '' as $$
declare origen public.facturas%rowtype;
begin
  if new.tipo = 'rectificativa' and new.rectifica_a is null then
    raise exception 'Una factura rectificativa debe indicar a cuál rectifica';
  end if;
  if new.rectifica_a is not null then
    if new.rectifica_a = new.id then
      raise exception 'Una factura no puede rectificarse a sí misma';
    end if;
    select * into origen from public.facturas where id = new.rectifica_a;
    if not found or origen.professional_id <> new.professional_id then
      raise exception 'La factura rectificada no está disponible';
    end if;
  end if;
  -- El ejercicio de imputación por defecto es el de emisión, pero se puede
  -- cambiar: es justo el dato que el criterio de cobros y pagos altera.
  if new.ejercicio_imputacion is null then
    new.ejercicio_imputacion := extract(year from new.fecha_emision)::int;
  end if;
  return new;
end; $$;
create trigger facturas_rectificativa
  before insert or update on public.facturas
  for each row execute function public.guard_factura_rectificativa();

/*
 * Un expediente revisado deja constancia de quién y cuándo. Volver a
 * "borrador" limpia esa constancia: conservarla sugeriría que sigue revisado.
 */
create or replace function public.guard_expediente_revision()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.estado = 'revisado' and (new.revisado_por is null or btrim(new.revisado_por) = '') then
    raise exception 'Indique quién revisa el expediente antes de marcarlo como revisado';
  end if;
  if new.estado = 'revisado' then
    new.revisado_at := coalesce(new.revisado_at, now());
  else
    new.revisado_at := null;
    new.revisado_por := null;
  end if;
  new.updated_at := now();
  return new;
end; $$;
create trigger expedientes_revision
  before insert or update on public.expedientes_fiscales
  for each row execute function public.guard_expediente_revision();

/*
 * El justificante de una factura o de una retención vive en el bucket privado
 * `receipts`, cuya ruta empieza por el id del profesional. Sin esta guarda, un
 * profesional podía apuntar a la carpeta de otro y exportarla en su ZIP.
 */
create or replace function public.guard_ruta_justificante()
returns trigger language plpgsql set search_path = '' as $$
declare ruta text;
begin
  ruta := case TG_TABLE_NAME
    when 'facturas' then new.documento_path
    when 'retenciones_pagos_cuenta' then new.justificante_path
    when 'checklist_personal' then new.documento_path
    else null
  end;
  if ruta is not null and split_part(ruta, '/', 1) <> new.professional_id::text then
    raise exception 'El justificante no pertenece a este profesional';
  end if;
  return new;
end; $$;
create trigger facturas_ruta before insert or update on public.facturas
  for each row execute function public.guard_ruta_justificante();
create trigger retenciones_ruta before insert or update on public.retenciones_pagos_cuenta
  for each row execute function public.guard_ruta_justificante();
create trigger checklist_ruta before insert or update on public.checklist_personal
  for each row execute function public.guard_ruta_justificante();

commit;
