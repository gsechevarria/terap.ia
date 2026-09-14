# Históricos incoherentes de los datos de demostración — criterio propuesto

**14 de septiembre de 2026. Nada de esto está aplicado.** Este documento propone
un criterio para cada incoherencia y se detiene ahí: no se ha escrito, borrado ni
modificado ni un solo dato, ni en el remoto ni en local.

Las cifras vienen del diagnóstico ejecutado el 11-sep y recogido en
[DESPLIEGUE-2026-09-11.md](DESPLIEGUE-2026-09-11.md). **No he vuelto a consultar
el remoto**: el agente no tiene —ni debe tener— credenciales de esa base. Antes
de decidir nada conviene reejecutar el diagnóstico, que es de solo lectura:

```sql
-- supabase/scripts/diagnostico-correcciones-202609.sql
-- begin transaction read only; … commit;
```

El origen de cada incoherencia sí está verificado, leyendo las migraciones y
`scripts/seed.mjs` de este repositorio.

---

## Consecuencia que conviene conocer antes de decidir

**La sección de Contabilidad está caída para los profesionales de demostración**,
y no por un fallo: por diseño.

`src/lib/queries/contabilidad.ts` se niega a calcular con históricos sin
confirmar. Las tres guardas lanzan excepción:

| Línea | Guarda | Mensaje |
|---|---|---|
| [contabilidad.ts:40](../src/lib/queries/contabilidad.ts#L40) | `row.fiscal_review_required` | «Hay cobros pendientes de revisión fiscal…» |
| [contabilidad.ts:57](../src/lib/queries/contabilidad.ts#L57) | `g.iva_recuperable_pct == null` | «Revisa el IVA recuperable de los gastos históricos…» |
| [contabilidad.ts:76](../src/lib/queries/contabilidad.ts#L76) | `b.fiscal_review_required` | «Revisa el gasto de origen de los bienes históricos…» |

Como `getFiscalArrays` es lo que consumen `/pro/contabilidad` y
`/pro/contabilidad/export`, **ambas fallan** mientras quede una fila pendiente.
`/pro/contabilidad/gastos` y `/pro/contabilidad/configuracion` siguen
funcionando: usan las lecturas crudas.

Y un detalle que amplía el daño: los ingresos y los gastos se filtran por
ejercicio, pero **los bienes de inversión no**
([contabilidad.ts:157](../src/lib/queries/contabilidad.ts#L157)). Un solo bien
con `fiscal_review_required = true` tumba el panel de contabilidad **de todos los
ejercicios**, no solo del suyo.

Esto encaja con lo verificado en producción el 11-sep, donde se comprobó
`/pro/contabilidad/gastos` pero no el panel `/pro/contabilidad`.

La decisión, entonces, no es «limpiar por limpieza»: es si quieres poder enseñar
Contabilidad en la demostración.

---

## A · 121 ingresos sin tratamiento fiscal confirmado

**Qué detecta.** `select id from public.payments where status='paid' and
amount_cents>0 and fiscal_snapshot is null`.

**Por qué existe.** Una sola causa, y es deliberada: la migración
[`20260909190006_fiscal_snapshots`](../supabase/migrations/20260909190006_fiscal_snapshots.sql)
añade `payments.fiscal_snapshot` **sin relleno retroactivo**, y lo dice en su
primera línea: «No se reconstruye el pasado usando la configuración de hoy». Todo
pago anterior a la migración quedó a `null` a propósito.

> **Corrección (14-sep).** La primera versión de este documento añadía una
> segunda causa: que `scripts/seed.mjs` insertaba los pagos antes que la
> `configuracion_fiscal`, dejando sin datos al disparador
> `payments_capture_fiscal`. **Es falso.** Me guié por el número de línea en el
> fichero en vez de por el orden de llamada: `seedContabilidad()` —que hace el
> `upsert` de la configuración— se invoca en la línea 427, antes que
> `seedPatient()` en la 447. Con la configuración ya escrita, el disparador
> encuentra `situacion_iva = 'exenta'` y captura el snapshot. **Una siembra
> limpia NO reproduce esta clase A.** Sí reproduce las clases B, C, D y E; ver
> «Qué reproducía el sembrado» más abajo.

**Qué no se puede deducir.** Cuál era el tratamiento fiscal *en la fecha de cada
cobro*. La configuración actual de los profesionales de demostración declara
`situacion_iva: "exenta"` (`seed.mjs:349`), pero eso es lo que declara hoy, no
prueba lo que se aplicó entonces. Sobre datos reales esa distinción es el motivo
de que la migración no rellenara nada.

**Criterio propuesto (A1, recomendado para este entorno).** Como los datos son
ficticios y la única historia que existe es la que escribió el propio `seed.mjs`,
aplicar en bloque el criterio que ese mismo `seed.mjs` declara: `tipo_operacion =
'exenta'`, `tipo_iva = 0`, `base_cents = amount_cents`, `cuota_iva_cents = 0`,
`retencion_cents = 0`. Con dos condiciones que considero innegociables:

- Marcar el snapshot con `"source": "regularizacion_demo"`, **no** con
  `"confirmacion_profesional"` ni `"configuracion"`. El registro debe decir que
  fue una regularización en bloque de datos ficticios, no una confirmación
  profesional que nadie hizo.
- Que la sentencia viva en `supabase/scripts/` como script de mantenimiento
  ejecutado a mano, con `where fiscal_snapshot is null`, y **no** como migración:
  no es un cambio de esquema y no debe reejecutarse sola sobre datos reales.

**Alternativas.** A2: confirmarlos uno a uno en la interfaz, que ya existe
(`PaymentFiscalEditor`, pestaña Pagos de cada ficha) — correcto, pero son 121
confirmaciones a mano. A3: no tocar nada y asumir que Contabilidad no se enseña.

**Si no se decide nada:** el panel de contabilidad y su exportación siguen caídos.

---

## B · 31 gastos sin IVA recuperable

**Qué detecta.** `select id from public.gastos where iva_recuperable_pct is null`.

**Por qué existe.** La migración
[`20260909190009_expense_fiscal_history`](../supabase/migrations/20260909190009_expense_fiscal_history.sql)
añade la columna sin valor por defecto ni relleno. Los 31 gastos que sembró
`seed.mjs` son anteriores.

**Qué sí está codificado.** A diferencia del caso A, aquí la regla ya existe en
el código y no hay que inventarla. `save_expense` deriva el porcentaje de la
situación de IVA cuando no se le pasa uno:

```sql
case coalesce(cfg.situacion_iva,'exenta')
  when 'exenta' then 0 when 'sujeta' then 100 else cfg.prorrata_iva_pct end
```

**Criterio propuesto (B1).** Aplicar a los 31 gastos exactamente esa expresión,
con la configuración de su propio profesional. Con `situacion_iva = 'exenta'` el
resultado es `0`, que es además el caso conservador: nada de IVA recuperable.
Mismo envoltorio que en A — script de mantenimiento con `where
iva_recuperable_pct is null`, no migración.

**Alternativa (B2).** Abrirlos uno a uno en `/pro/contabilidad/gastos`: el campo
`iva_recuperable_pct` ya está en el formulario de edición
([GastosTable.tsx:142](../src/app/pro/contabilidad/_components/GastosTable.tsx#L142))
y al guardar pasa por `save_expense`. 31 ediciones, y de paso se revisa cada
gasto. Es la opción defendible si algún día estos datos dejan de ser ficticios.

---

## C · 3 bienes de inversión pendientes de revisión

**Qué detecta.** `select id, gasto_id from public.bienes_inversion where
fiscal_review_required`.

**Por qué existe.** La misma migración añade la columna con `not null default
true`: **todos** los bienes preexistentes quedaron marcados. Solo `save_expense`
la pone a `false`, al recalcular el bien desde su gasto de origen.

**Cuidado con el atajo.** Poner la bandera a `false` con un `update` directo
sería mentir: la bandera significa «este valor de adquisición se calculó con una
regla que no consta», y apagarla no cambia el valor. El camino honesto es
reguardar el gasto de origen, que recalcula

```sql
value_cents := round((base_cents + cuota_iva_cents*(1-recuperable/100.0))
                     * porcentaje_afectacion/100.0)
```

**y esto puede cambiar `valor_adquisicion_cents`**, y con él la amortización de
ejercicios ya mostrados. Con `exenta` (recuperable = 0) el valor pasa a ser
`total_cents * afectacion / 100`. No puedo decirte si coincide con lo sembrado
sin consultar el remoto.

**Criterio propuesto (C1).** Resolver B primero y luego reguardar los 3 gastos de
origen desde `/pro/contabilidad/gastos` sin cambiar ningún campo. Son tres
ediciones; el recálculo queda registrado y trazable. **Antes**, anotar los
`valor_adquisicion_cents` actuales para poder comparar: si cambian, es
información, no un fallo.

**No recomiendo** el `update … set fiscal_review_required = false` en bloque.

---

## D · 5 bonos con el saldo descuadrado

**Qué detecta.** `used_sessions <> count(payments con session_pack_id y
appointment_id no nulo)`.

**Por qué existe.** Verificado en `scripts/seed.mjs:206-213`: el bono se inserta
con `used_sessions: 4` directamente, con la `service_role`, sin crear las cuatro
filas de imputación que produciría `settle_attended_appointment`. El descuadre es
**íntegramente** artefacto de la siembra; ninguna acción de usuario lo causó.

**Qué impacto tiene hoy.** Escaso. El saldo que ve el paciente es
`total_sessions - used_sessions`, así que la interfaz es coherente consigo misma
y enseña 6 sesiones restantes. El descuadre solo aparece en la auditoría. No
dispara el `raise exception 'Bono incoherente'` de `unsettle_appointment`, que
exige una fila de pago que aquí no existe.

**Qué no se debe hacer.** Fabricar las cuatro imputaciones. Requeriría inventar
`appointment_id` —la consulta cuenta solo pagos con cita— y eso es inventar
sesiones celebradas que nunca existieron. Queda descartado.

**Criterio propuesto (D1, recomendado).** No tocar el dato y arreglar el origen:
corregir `seed.mjs` para que los bonos pasen por `create_session_pack`, y
resembrar en limpio la próxima vez que quieras un entorno de demostración
presentable. Mientras tanto, los cinco bonos quedan documentados aquí.

**Alternativa (D2).** `used_sessions = 0` en esos cinco bonos: cuadra la
invariante sin inventar nada, pero destruye la historia sembrada (el paciente
pasaría a ver 10 sesiones disponibles). **Alternativa (D3):** `active = false`,
que los aparta de los cálculos conservando el registro.

---

## E · 5 bonos sin registro de compra

**Qué detecta.** Bonos con `price_cents > 0` sin un pago asociado de importe
`price_cents` y sin cita.

**Por qué existe.** El mismo `insert` directo de `seed.mjs`. Desde
[`20260909190002_financial_transactions`](../supabase/migrations/20260909190002_financial_transactions.sql),
`create_session_pack` crea el bono **y** su pago de compra en la misma
transacción; la siembra se salta esa función.

**Qué impacto tiene.** Los 500 € de cada bono no figuran como ingreso. En la
demostración los ingresos están infravalorados en unos 2.500 €. Sobre datos
reales sería un agujero contable.

**Qué no se debe hacer sin decidirlo tú.** Crear los cinco pagos de compra
**inventa 2.500 € de ingreso** que nunca se cobraron y mueve las estimaciones
fiscales. Que sea «lo que habría pasado por el camino correcto» no lo convierte
en un hecho registrado.

**Criterio propuesto (E1).** El mismo que D1: arreglar `seed.mjs` y resembrar. Si
prefieres no resembrar, **E2**: crear los cinco pagos con `status = 'pending'`
(que es lo que hace `create_session_pack`, no `'paid'`) y `note = 'Compra de bono
— regularización de datos de demostración'`. Al quedar pendientes no entran como
ingreso cobrado y la trazabilidad queda escrita en la propia fila.

---

## Qué reproducía el sembrado — ya corregido

`scripts/seed.mjs` escribe con la `service_role`, así que los disparadores de
guarda (`guard_transactional_write`, que solo bloquea a `authenticated`) lo dejan
insertar directamente. Eso le permitía saltarse las reglas que la aplicación sí
aplica, y **volvía a generar las clases B, C, D y E en cada siembra limpia**. La
clase A no: ver la corrección de más arriba.

| Clase | Qué hacía el sembrado | Qué hace ahora |
|---|---|---|
| B | Insertaba los gastos sin `iva_recuperable_pct` | Siembra `0`, el mismo valor que deriva `save_expense` con `situacion_iva = 'exenta'` |
| C | Insertaba los bienes con `valor_adquisicion_cents = base` y la bandera por defecto (`true`) | Calcula el valor con la **misma fórmula que `save_expense`** —`(base + cuota·(1−recuperable/100))·afectación/100`— y deja `fiscal_review_required = false` |
| D | `used_sessions: 4` sin ninguna imputación | Crea una imputación de importe 0 por sesión, ligada a una **cita atendida real** |
| E | Bono sin registro de compra | Crea la fila de compra por `price_cents`, como hace `create_session_pack` |

De paso, los pagos de las citas atendidas ahora llevan su `appointment_id`, que
es lo que hace `settle_attended_appointment` en la aplicación; antes eran filas
sueltas sin relación con la cita que las originaba.

**El bono no puede crearse llamando a `create_session_pack`**, aunque sería lo
ideal: la función resuelve al profesional con `current_professional_id()`, que
depende de `auth.uid()`. El sembrado corre con la `service_role` y sin JWT, así
que `auth.uid()` es nulo y la llamada acabaría en «No autorizado». Por eso el
sembrado replica el resultado de la función en vez de invocarla.

Nada de esto toca los datos ya existentes en el remoto: solo cambia lo que
produciría una siembra futura.

---

## Lo que necesito que decidas

| | Decisión | Recomendación |
|---|---|---|
| A | 121 ingresos: regularizar en bloque, uno a uno, o dejarlos | **A1** con `source: "regularizacion_demo"` |
| B | 31 gastos: aplicar la regla de `save_expense` en bloque o editarlos | **B1** (el resultado es 0 con `exenta`) |
| C | 3 bienes: reguardar el gasto de origen | **C1**, anotando antes los valores actuales |
| D | 5 bonos descuadrados | **D1**: no tocar los existentes; la siembra ya está corregida |
| E | 5 bonos sin compra | **E1**: igual que D |
| — | ¿Resembramos el entorno de demostración en limpio? | Es lo único que deja la historia coherente de verdad, y ya no arrastra estas cinco clases |

Con A y B resueltos —y C detrás— la sección de Contabilidad vuelve a poder
enseñarse. D y E no la bloquean.

## Los scripts ya están escritos — los ejecutas tú

Los tres criterios recomendados viven en `supabase/scripts/`, listos para pegar
en el editor SQL del panel. **No los ejecuta el agente**, y cada uno lleva su
`where` para no alcanzar filas ya confirmadas:

| Script | Qué hace | Reversible |
|---|---|---|
| [`regularizar-ingresos-demo.sql`](../supabase/scripts/regularizar-ingresos-demo.sql) | Criterio **A1** sobre `payments` con `fiscal_snapshot is null` | Sí: basta volver a poner el snapshot a `null` |
| [`regularizar-gastos-demo.sql`](../supabase/scripts/regularizar-gastos-demo.sql) | Criterio **B1** sobre `gastos` con `iva_recuperable_pct is null` | Sí |
| [`revisar-bienes-demo.sql`](../supabase/scripts/revisar-bienes-demo.sql) | Criterio **C1**: enseña antes y después, y recalcula con la fórmula de `save_expense` | Sí, con los valores que imprime antes |

Empieza por el primer bloque de cada uno, que es de solo lectura y te dice
cuántas filas tocaría. Los tres van envueltos en una transacción con
`rollback` comentado al final: quita el comentario para ensayarlos sin efecto.
