-- Criterio C1 de docs/DIAGNOSTICO-HISTORICOS.md
-- ============================================================================
-- Cierra la revisión de los bienes de inversión históricos, que nacieron con
-- `fiscal_review_required = true` (la columna se añadió con ese valor por
-- defecto en la migración 20260909190009).
--
-- LEE ESTO ANTES DE EJECUTAR NADA
-- -------------------------------
-- La bandera NO significa «falta un dato». Significa: «este valor de adquisición
-- se calculó con una regla que no consta». Apagarla con un update y dejar el
-- valor como está sería mentir. Lo que hace este script es **recalcular** el
-- valor con la fórmula real de `save_expense` y solo entonces apagarla:
--
--   valor = (base + cuota_iva · (1 − iva_recuperable/100)) · afectación / 100
--
-- Eso puede CAMBIAR el valor de adquisición, y con él la amortización de
-- ejercicios que ya se han mostrado. Por eso el bloque 1 te enseña el antes y el
-- después: míralo, y si la diferencia te sorprende, no sigas.
--
-- Requisito: ejecuta primero `regularizar-gastos-demo.sql`. Sin
-- `iva_recuperable_pct` en el gasto de origen no hay fórmula que aplicar.
--
-- Alternativa sin SQL: abre cada bien en /pro/contabilidad/gastos y vuelve a
-- guardarlo sin cambiar nada. `save_expense` hace exactamente esto, y queda
-- registrado como una edición del profesional. Con 3 bienes es perfectamente
-- viable, y es la opción que recomiendo si algún día estos datos dejan de ser
-- ficticios.
-- ============================================================================

-- --- Bloque 1: antes y después, sin tocar nada ------------------------------
select
  b.id,
  b.descripcion,
  b.fecha_adquisicion,
  b.valor_adquisicion_cents                     as valor_actual_cents,
  round((g.base_cents + g.cuota_iva_cents * (1 - g.iva_recuperable_pct / 100.0))
        * g.porcentaje_afectacion / 100.0)::int as valor_recalculado_cents,
  round((g.base_cents + g.cuota_iva_cents * (1 - g.iva_recuperable_pct / 100.0))
        * g.porcentaje_afectacion / 100.0)::int - b.valor_adquisicion_cents
                                                as diferencia_cents,
  g.iva_recuperable_pct,
  g.porcentaje_afectacion
from public.bienes_inversion b
join public.gastos g on g.id = b.gasto_id
where b.fiscal_review_required
order by b.fecha_adquisicion;

-- Bienes marcados cuyo gasto de origen NO tiene porcentaje: estos NO se pueden
-- recalcular todavía. Si aparece alguno, ejecuta antes regularizar-gastos-demo.
select b.id, b.descripcion
from public.bienes_inversion b
join public.gastos g on g.id = b.gasto_id
where b.fiscal_review_required and g.iva_recuperable_pct is null;

-- Bienes marcados y huérfanos (sin gasto de origen): requieren decisión aparte,
-- este script no los toca.
select b.id, b.descripcion
from public.bienes_inversion b
where b.fiscal_review_required and b.gasto_id is null;

-- --- Bloque 2: recálculo y cierre de la revisión ----------------------------
begin;

update public.bienes_inversion b
set valor_adquisicion_cents =
      round((g.base_cents + g.cuota_iva_cents * (1 - g.iva_recuperable_pct / 100.0))
            * g.porcentaje_afectacion / 100.0)::int,
    fiscal_review_required = false
from public.gastos g
where g.id = b.gasto_id
  and b.fiscal_review_required
  and g.iva_recuperable_pct is not null;

select count(*) as siguen_pendientes
from public.bienes_inversion where fiscal_review_required;

-- rollback;  -- <- descomenta para ensayar sin efecto
commit;

-- Para deshacerlo necesitas los `valor_actual_cents` del bloque 1. Guárdalos
-- antes de ejecutar el bloque 2: este script no los conserva en ningún sitio.
