-- Criterio A1 de docs/DIAGNOSTICO-HISTORICOS.md
-- ============================================================================
-- Da tratamiento fiscal a los cobros históricos que quedaron sin confirmar al
-- añadirse `payments.fiscal_snapshot` (migración 20260909190006, que a propósito
-- NO rellenó el pasado).
--
-- SOLO PARA EL ENTORNO DE DEMOSTRACIÓN, con datos ficticios. Sobre datos reales
-- esto sería inventar el criterio fiscal de un cobro pasado: ahí cada cobro se
-- confirma uno a uno desde la pestaña Pagos de la ficha del paciente.
--
-- NO es una migración y no debe ir a supabase/migrations/: no cambia el esquema
-- y no debe reejecutarse sola.
--
-- Cómo usarlo: ejecuta el bloque 1 y mira el recuento. Si te cuadra, ejecuta el
-- bloque 2. Para ensayarlo sin efecto, descomenta el `rollback` del final.
-- ============================================================================

-- --- Bloque 1: solo lectura, qué se tocaría ---------------------------------
select
  p.professional_id,
  count(*)                        as cobros_sin_confirmar,
  sum(p.amount_cents)             as importe_cents,
  min(coalesce(p.paid_at, p.created_at))::date as desde,
  max(coalesce(p.paid_at, p.created_at))::date as hasta
from public.payments p
where p.status = 'paid'
  and p.amount_cents > 0
  and p.fiscal_snapshot is null
group by p.professional_id
order by 1;

-- La configuración declarada por cada profesional, que es el criterio aplicado.
-- Si alguno NO estuviera en 'exenta', PARA: este script asume exención y habría
-- que revisar ese profesional aparte.
select professional_id, situacion_iva, tipo_iva_repercutido, aplica_retencion_default
from public.configuracion_fiscal
order by 1;

-- --- Bloque 2: la regularización -------------------------------------------
begin;

update public.payments p
set fiscal_snapshot = jsonb_build_object(
      'tipo_operacion',  'exenta',
      'tipo_iva',        0,
      'base_cents',      p.amount_cents,   -- exenta: la base es el total
      'cuota_iva_cents', 0,
      'retencion_cents', 0,
      -- Deliberadamente NO es 'confirmacion_profesional' ni 'configuracion':
      -- el registro debe decir que fue una regularización en bloque de datos
      -- ficticios, no una confirmación que nadie hizo.
      'source',          'regularizacion_demo',
      'recorded_at',     now()
    )
where p.status = 'paid'
  and p.amount_cents > 0
  and p.fiscal_snapshot is null
  -- Cinturón: solo profesionales que declaran exención sin retención.
  and exists (
    select 1 from public.configuracion_fiscal c
    where c.professional_id = p.professional_id
      and c.situacion_iva = 'exenta'
      and not c.aplica_retencion_default
  );

-- Comprobación: debe quedar en 0 para los profesionales exentos.
select count(*) as siguen_sin_confirmar
from public.payments p
where p.status = 'paid' and p.amount_cents > 0 and p.fiscal_snapshot is null;

-- rollback;  -- <- descomenta para ensayar sin efecto
commit;

-- Para deshacerlo: poner a null los snapshots marcados como regularización.
--   update public.payments set fiscal_snapshot = null
--   where fiscal_snapshot->>'source' = 'regularizacion_demo';
