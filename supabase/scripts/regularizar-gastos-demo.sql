-- Criterio B1 de docs/DIAGNOSTICO-HISTORICOS.md
-- ============================================================================
-- Rellena `gastos.iva_recuperable_pct` en los gastos históricos, que quedaron a
-- null al añadirse la columna (migración 20260909190009).
--
-- A diferencia de los ingresos, aquí NO se inventa criterio: se aplica la misma
-- expresión que usa `save_expense` cuando no se le pasa el porcentaje.
--
--   case coalesce(cfg.situacion_iva,'exenta')
--     when 'exenta' then 0 when 'sujeta' then 100 else cfg.prorrata_iva_pct end
--
-- NO es una migración. Ejecuta el bloque 1, mira el recuento, y si te cuadra
-- ejecuta el bloque 2.
-- ============================================================================

-- --- Bloque 1: solo lectura -------------------------------------------------
select
  g.professional_id,
  c.situacion_iva,
  c.prorrata_iva_pct,
  count(*) as gastos_sin_porcentaje,
  -- Lo que se les pondría:
  case coalesce(c.situacion_iva, 'exenta')
    when 'exenta' then 0 when 'sujeta' then 100 else c.prorrata_iva_pct
  end as porcentaje_a_aplicar
from public.gastos g
left join public.configuracion_fiscal c on c.professional_id = g.professional_id
where g.iva_recuperable_pct is null
group by g.professional_id, c.situacion_iva, c.prorrata_iva_pct
order by 1;

-- Si algún profesional sale en 'mixta' con `prorrata_iva_pct` nula, PARA: sin
-- prorrata declarada no hay porcentaje que aplicar, y suponer uno sería
-- inventarlo. Esa prorrata se declara en /pro/contabilidad/configuracion.

-- --- Bloque 2: el relleno ---------------------------------------------------
begin;

update public.gastos g
set iva_recuperable_pct = case coalesce(c.situacion_iva, 'exenta')
      when 'exenta' then 0 when 'sujeta' then 100 else c.prorrata_iva_pct
    end
from public.configuracion_fiscal c
where c.professional_id = g.professional_id
  and g.iva_recuperable_pct is null
  -- Sin prorrata declarada en régimen mixto no se toca nada.
  and (c.situacion_iva <> 'mixta' or c.prorrata_iva_pct is not null);

select count(*) as siguen_sin_porcentaje
from public.gastos where iva_recuperable_pct is null;

-- rollback;  -- <- descomenta para ensayar sin efecto
commit;

-- Para deshacerlo hay que saber cuáles eran null antes; apunta los ids del
-- bloque 1 si quieres poder revertirlo con precisión.
