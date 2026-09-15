-- Cuadra el estado de los pagos con su método de cobro
-- ============================================================================
-- Desde el 15-sep el método manda sobre el estado en la interfaz: elegir un
-- método real deja el pago cobrado, y "Pendiente de cobro" lo deja pendiente.
--
-- Eso solo actúa cuando alguien CAMBIA el desplegable. Los pagos que ya tenían
-- método puesto y estado pendiente se quedan como estaban, y además no hay
-- forma cómoda de arreglarlos desde la interfaz: volver a elegir el mismo
-- método no dispara ningún cambio. Este script los cuadra de una pasada.
--
-- NO es una migración: no cambia el esquema y no debe reejecutarse sola.
--
-- Ejecuta el bloque 1, mira el recuento, y si te cuadra ejecuta el bloque 2.
-- ============================================================================

-- --- Bloque 1: solo lectura, qué se tocaría ---------------------------------
select
  p.professional_id,
  p.method,
  count(*)            as pagos_a_marcar_cobrados,
  sum(p.amount_cents) as importe_cents
from public.payments p
where p.status = 'pending'
  and p.method is not null
  -- Las imputaciones de bono (importe 0 ligado a una cita) no son cobros y no
  -- se tocan: su estado lo gestiona la liquidación de la cita.
  and not (p.session_pack_id is not null and p.appointment_id is not null)
group by p.professional_id, p.method
order by 1, 2;

-- --- Bloque 2: el cuadre -----------------------------------------------------
begin;

-- `paid_at` NO se fija aquí: lo pone el disparador `preserve_payment_date`, que
-- usa `coalesce(paid_at, now())`. Poner una fecha inventada sería peor que no
-- tener ninguna, porque acabaría en el libro de ingresos.
update public.payments p
set status = 'paid'
where p.status = 'pending'
  and p.method is not null
  and not (p.session_pack_id is not null and p.appointment_id is not null);

select count(*) as siguen_descuadrados
from public.payments
where status = 'pending' and method is not null
  and not (session_pack_id is not null and appointment_id is not null);

-- rollback;  -- <- descomenta para ensayar sin efecto
commit;

-- Para deshacerlo hacen falta los ids del bloque 1: anótalos antes si quieres
-- poder revertirlo con precisión.
