-- ============================================================================
-- Trigger de estado de factura según sus pagos.
--
-- Problema: recalcularEstadoFactura() vive en el cliente (getFacturaById +
-- cálculo JS + UPDATE). Si el bundle está viejo (Service Worker de la PWA),
-- hay un hipo de red, o una carrera, el estado NO se actualiza y nadie se
-- entera (la factura #310 quedó "Pendiente" con saldo 0).
--
-- Solución: recalcular el estado en la base, con un trigger sobre apsol_private.pagos.
-- No se puede saltear. La app sigue llamando a recalcularEstadoFactura() para
-- el webhook "pago_recibido"; el UPDATE de estado que hace ahí queda como
-- fallback (no-op si el trigger ya lo dejó bien).
--
-- La fórmula del neto replica src/services/facturacion.js -> calcularMontosFactura:
--   bruto   = (tarifa_base_uva>0 y valor_uva_dia>0) ? round(tarifa*valor,2) : round(monto,2)
--   desc    = tieneUVA ? round(bruto * pct/100, 2) : 0
--   neto    = round(bruto - desc, 2), luego floor a redondeo_multiplo si > 0
--   estado  = 0 pagos -> Pendiente ; round(neto - pagado,2) > 0 -> Cobrada parcial ; si no -> Cobrada total
-- ============================================================================

create or replace function apsol_private.fn_recalc_estado_factura(p_fid uuid)
returns void
language plpgsql
security definer
set search_path = apsol_private, public
as $$
declare
  v_tarifa numeric; v_valor numeric; v_pct numeric; v_monto numeric; v_mult numeric;
  v_bruto numeric; v_desc numeric; v_neto numeric;
  v_pagado numeric; v_npagos int;
  v_estado_actual text; v_nuevo text;
begin
  select coalesce(tarifa_base_uva,0), coalesce(valor_uva_dia,0), coalesce(porcentaje_descuento,0),
         coalesce(monto,0), coalesce(redondeo_multiplo,0), estado::text
    into v_tarifa, v_valor, v_pct, v_monto, v_mult, v_estado_actual
  from apsol_private.facturacion where id = p_fid;

  if not found then return; end if;

  if v_tarifa > 0 and v_valor > 0 then
    v_bruto := round(v_tarifa * v_valor, 2);
    v_desc  := round(v_bruto * v_pct / 100.0, 2);
  else
    v_bruto := round(v_monto, 2);
    v_desc  := 0;
  end if;

  v_neto := round(v_bruto - v_desc, 2);
  if v_mult > 0 then
    v_neto := floor(v_neto / v_mult) * v_mult;
  end if;

  select coalesce(sum(monto), 0), count(*) into v_pagado, v_npagos
  from apsol_private.pagos where facturacion_id = p_fid;

  if v_npagos = 0 then
    v_nuevo := 'Pendiente';
  elsif round(v_neto - v_pagado, 2) > 0 then
    v_nuevo := 'Cobrada parcial';
  else
    v_nuevo := 'Cobrada total';
  end if;

  if v_nuevo is distinct from v_estado_actual then
    update apsol_private.facturacion set estado = v_nuevo::apsol_private.estado_factura where id = p_fid;
  end if;
end;
$$;

create or replace function apsol_private.trg_recalc_estado_factura()
returns trigger
language plpgsql
security definer
set search_path = apsol_private, public
as $$
begin
  perform apsol_private.fn_recalc_estado_factura(coalesce(new.facturacion_id, old.facturacion_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_recalc_estado_factura on apsol_private.pagos;
create trigger trg_recalc_estado_factura
after insert or update or delete on apsol_private.pagos
for each row execute function apsol_private.trg_recalc_estado_factura();

-- Backfill: recalcular todas las facturas (arregla las que quedaron mal, ej. #310).
select apsol_private.fn_recalc_estado_factura(id) from apsol_private.facturacion;
