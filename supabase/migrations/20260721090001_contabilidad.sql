-- =============================================================================
-- Sesión 6 · Módulo Contabilidad (agregador fiscal + exports para gestoría)
--
--   ALCANCE (decisión de producto, NO TODO):
--     · DENTRO: gastos deducibles, configuración fiscal, bienes de inversión,
--       vista fiscal de ingresos (deriva de payments), estimaciones ORIENTATIVAS.
--     · FUERA: emisión de facturas (evita Verifactu / Ley Antifraude), envío a
--       AEAT, OCR. No hay tablas ni campos de facturación.
--
--   ADAPTACIONES AL SCHEMA REAL (prevalece sobre el spec en español):
--     · `professional_id uuid references public.professionals(id)` (no auth.users):
--       el resto del proyecto ata todo a `professionals.id` y resuelve el ámbito
--       con `public.current_professional_id()`. Mismo patrón de RLS.
--     · Dinero en CÉNTIMOS (int), como payment_settings/payments/session_packs.
--       Evita coma flotante y el quirk de PostgREST (numeric se serializa como
--       string). El motor fiscal trabaja en euros y convierte en el borde.
--     · Porcentajes como int (% entero): IVA {0,4,10,21}, afectación y
--       amortización en % entero. Suficiente para el caso y sin numeric-string.
--     · Adjunto = ruta de Storage (bucket privado `receipts`), servido por URL
--       firmada (mismo patrón que documents/`files`), no una URL pública.
-- =============================================================================

-- === configuración fiscal (1 fila por profesional) ==========================
create table public.configuracion_fiscal (
  id                       uuid primary key default gen_random_uuid(),
  professional_id          uuid not null references public.professionals (id) on delete cascade,
  regimen                  text not null default 'estimacion_directa_simplificada'
                             check (regimen in ('estimacion_directa_simplificada','estimacion_directa_normal')),
  situacion_iva            text not null default 'exenta'
                             check (situacion_iva in ('exenta','sujeta','mixta')),
  epigrafe_iae             text default '776',
  fecha_alta_actividad     date,                       -- para retención reducida 7% (alta + 2 años)
  aplica_retencion_default boolean not null default false, -- pacientes particulares: false
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  unique (professional_id)
);
create index configuracion_fiscal_professional_id_idx
  on public.configuracion_fiscal (professional_id);

-- === gastos deducibles ======================================================
create table public.gastos (
  id                     uuid primary key default gen_random_uuid(),
  professional_id        uuid not null references public.professionals (id) on delete cascade,
  fecha                  date not null,
  proveedor_nombre       text,
  proveedor_nif          text,
  categoria_deducible    text not null
                           check (categoria_deducible in (
                             'cuota_colegial','seguro_rc','formacion','alquiler_consulta',
                             'suministros','software','material','gestoria','desplazamiento','otros')),
  concepto               text,
  base_cents             int not null check (base_cents >= 0),
  tipo_iva               int not null default 0 check (tipo_iva >= 0 and tipo_iva <= 100),  -- % IVA soportado
  cuota_iva_cents        int not null default 0 check (cuota_iva_cents >= 0),
  total_cents            int not null check (total_cents >= 0),
  porcentaje_afectacion  int not null default 100 check (porcentaje_afectacion between 0 and 100),
  es_bien_inversion      boolean not null default false,
  adjunto_path           text,                          -- ruta en Storage (bucket `receipts`)
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index gastos_professional_id_idx on public.gastos (professional_id);
create index gastos_fecha_idx           on public.gastos (fecha);

-- === bienes de inversión (amortizaciones) ===================================
create table public.bienes_inversion (
  id                       uuid primary key default gen_random_uuid(),
  professional_id          uuid not null references public.professionals (id) on delete cascade,
  gasto_id                 uuid references public.gastos (id) on delete set null,
  descripcion              text not null,
  fecha_adquisicion        date not null,
  valor_adquisicion_cents  int not null check (valor_adquisicion_cents >= 0),
  porcentaje_amortizacion  int not null check (porcentaje_amortizacion between 0 and 100), -- tablas simplificadas
  anios_amortizacion       int,
  created_at               timestamptz not null default now()
);
create index bienes_inversion_professional_id_idx on public.bienes_inversion (professional_id);

-- Índice adicional en payments.fecha efectiva no es posible (columna calculada);
-- payments ya tiene índice por professional_id. Las consultas por trimestre
-- filtran por rango sobre paid_at/created_at en la vista.

create trigger configuracion_fiscal_set_updated_at
  before update on public.configuracion_fiscal
  for each row execute function public.set_updated_at();
create trigger gastos_set_updated_at
  before update on public.gastos
  for each row execute function public.set_updated_at();

-- === vista fiscal de ingresos (deriva de payments; NO duplica ingresos) =====
--   security_invoker = true  →  la vista se ejecuta con los permisos del que
--   consulta, por lo que HEREDA la RLS de payments/patients (sin él, una vista
--   normal correría como su dueño y saltaría la RLS: fuga de datos entre
--   profesionales). Solo ingresos EFECTIVAMENTE cobrados (status = 'paid').
--   Importes en céntimos (int) igual que payments.
create view public.v_ingresos_fiscales
  with (security_invoker = true) as
select
  p.id,
  p.professional_id,
  coalesce(p.paid_at, p.created_at)                         as fecha,
  p.amount_cents                                            as total_cents,
  case when coalesce(cf.situacion_iva, 'exenta') = 'exenta'
       then 'exenta' else 'sujeta' end                      as tipo_operacion,
  p.amount_cents                                            as base_cents,   -- exenta: base = total (sin IVA)
  0                                                         as cuota_iva_cents,
  coalesce(cf.aplica_retencion_default, false)              as retencion_aplicable,
  pt.full_name                                              as nombre_pagador
from public.payments p
left join public.configuracion_fiscal cf on cf.professional_id = p.professional_id
left join public.patients pt              on pt.id = p.patient_id
where p.status = 'paid';

-- =============================================================================
-- RLS — cada profesional solo ve/gestiona lo suyo (idéntico al resto del proyecto)
-- =============================================================================
alter table public.configuracion_fiscal enable row level security;
alter table public.gastos               enable row level security;
alter table public.bienes_inversion     enable row level security;

create policy configuracion_fiscal_all_by_professional on public.configuracion_fiscal
  for all to authenticated
  using (professional_id = public.current_professional_id())
  with check (professional_id = public.current_professional_id());

create policy gastos_all_by_professional on public.gastos
  for all to authenticated
  using (professional_id = public.current_professional_id())
  with check (professional_id = public.current_professional_id());

create policy bienes_inversion_all_by_professional on public.bienes_inversion
  for all to authenticated
  using (professional_id = public.current_professional_id())
  with check (professional_id = public.current_professional_id());

-- La vista hereda la RLS de las tablas base (security_invoker). No lleva policy
-- propia; el acceso queda restringido por payments/patients/configuracion_fiscal.

-- =============================================================================
-- Storage: bucket privado `receipts` para justificantes de gasto.
--   Convención de ruta: <professionalId>/<archivo>.  Solo el profesional dueño.
-- =============================================================================
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

create policy "receipts_select_professional"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'receipts'
    and ((storage.foldername(name))[1])::uuid = public.current_professional_id()
  );

create policy "receipts_insert_professional"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'receipts'
    and ((storage.foldername(name))[1])::uuid = public.current_professional_id()
  );

create policy "receipts_delete_professional"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'receipts'
    and ((storage.foldername(name))[1])::uuid = public.current_professional_id()
  );
