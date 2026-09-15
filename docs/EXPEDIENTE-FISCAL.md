# Expediente fiscal anual

**Qué es.** Un expediente por ejercicio y profesional que recopila, permite
revisar y exporta lo que el gestor necesita para preparar la declaración anual
de IRPF.

**Qué no es, y no va a serlo.** No presenta nada ante la AEAT. No calcula la
cuota de la renta. No emite facturas —eso mantiene el producto fuera de
Verifactu—. No decide si una operación está exenta de IVA.

---

## Cómo encaja con lo que ya había

El módulo de contabilidad anterior sigue en pie. Lo nuevo se apoya en él en
lugar de sustituirlo, y la regla que gobierna la integración es que **no haya
dos verdades sobre el mismo dato**:

| Concepto | Dónde vive | Quién lo escribe |
|---|---|---|
| **Cobros** | `payments` (ya existía) | La ficha del paciente, la liquidación de citas |
| **Facturación** | `facturas` (nuevo) | Libro registro: se anota lo emitido fuera de la aplicación |
| **Ingresos fiscales** | Derivado de ambos | Nadie: se calcula según el criterio de imputación |
| **Gastos** | `gastos` (ya existía) | `/pro/contabilidad/gastos` |
| **Bienes de inversión** | `bienes_inversion` (ya existía) | Se derivan del gasto marcado como inversión |

Un cobro puede imputarse a una factura (`factura_cobros`) sin dejar de ser un
cobro. Una factura puede no tener cobro todavía. El importe del dinero vive en
`payments` y no se copia.

---

## Las tres decisiones que gobiernan el módulo

### 1. Ausencia no es cero

`desconocido`, `no aplica` y `cero` son tres cosas distintas y se guardan como
tales. Los campos que el profesional puede no saber son `null`, nunca `0` ni
`false` por defecto. Un dato que falta **bloquea el cálculo que dependa de él**
en lugar de convertirse en un importe cero que parece una respuesta.

### 2. Una regla sin verificar no produce un número

Cada regla fiscal lleva su procedencia: fuente oficial, fecha en que se
contrastó y matices que cambian el resultado. Si no se ha podido verificar,
`estado: "pendiente"` y el cálculo que dependa de ella **no se presenta como
firme**. El expediente se recoge y se exporta igual; lo que cambia es que el
gestor ve qué queda por decidir.

### 3. El territorio no se extrapola

Territorio común tiene reglas verificadas para 2026. País Vasco, Navarra,
Canarias, Ceuta y Melilla **se pueden registrar y exportar**, pero sus cálculos
quedan pendientes. No se aplican las reglas de territorio común a un régimen
foral, ni el IVA peninsular donde rige IGIC o IPSI.

**Territorio común es el valor por defecto**, porque es el caso de la consulta
privada peninsular y bloquear el módulo entero por una casilla sin marcar no
ayuda a nadie. Pero se guarda como *asumido*, no como declarado: mientras
`territorio_confirmado` sea falso, el expediente y el ZIP arrastran el aviso de
que si la actividad tributa en régimen foral, en Canarias, Ceuta o Melilla esos
cálculos no le son aplicables. Asumir común **no alcanza** a un territorio
declarado distinto: ese sigue sin reglas verificadas.

---

## Reglas verificadas hoy

| Regla | Valor | Fuente | Verificada |
|---|---|---|---|
| Gastos de difícil justificación | 5 % | AEAT, sede — Estimación directa simplificada | 14-sep-2026 |
| Tope de difícil justificación | 2.000 € | AEAT, sede — misma página | 14-sep-2026 |
| Umbral de exención del modelo 130 | 70 % | Art. 109 RD 439/2007 y AEAT, sede — Pagos fraccionados | 15-sep-2026 |

**Con procedencia heredada**, declaradas en el repositorio en enero de 2026 sin
citar fuente y **no vueltas a contrastar**: porcentaje del pago fraccionado
(20 %), retención general (15 %), retención reducida (7 %) y la referencia del
art. 20.Uno.3º LIVA. Se conservan con esa etiqueta, no como comprobadas ahora.

**Pendientes de verificar:**

- **Modelo 130 en el primer año de actividad.** Sin ejercicio anterior de
  referencia no hay criterio unívoco contrastado. La obligación queda pendiente
  del gestor, no se resuelve sola.
- **El 10 % de Ceuta en 2026** para difícil justificación. La AEAT lo recoge; el
  motor aplica un porcentaje plano y no lo modela.

---

## Obligaciones formales

El checklist es **condicional**: nada se asigna por defecto a todo el mundo.
Cada modelo se evalúa con tres resultados posibles, y el tercero es tan válido
como los otros dos:

- **obligado** · **no obligado** · **pendiente**

«Pendiente» aparece cuando faltan datos, y el expediente dice **cuáles**. Un
checklist que marca «no obligado» por silencio es peor que no tener checklist.

El modelo 130 considera la regla del 70 %, el ejercicio anterior y el caso de
inicio de actividad. Sin ingresos del año anterior no se concluye «0 %»: se
concluye que la regla no puede aplicarse.

---

## Aritmética

Todo en **céntimos enteros** (`src/lib/fiscal/dinero.ts`). El motor anterior
trabajaba en euros con `number`, que es coma flotante binaria: un libro de
cuatrocientas líneas acumula error hasta descuadrar contra la suma de pantalla.

Política de redondeo, explícita porque siempre la hay: al céntimo más próximo,
con el medio céntimo **hacia arriba en valor absoluto**. Un abono no se redondea
en dirección contraria a su cargo.

---

## Estado de implementación

### Entregado

- Esquema completo: `expedientes_fiscales`, `facturas`, `factura_cobros`,
  `retenciones_pagos_cuenta`, `actividades_fiscales`, `checklist_personal`,
  `expediente_documentos`, más las columnas que faltaban en
  `configuracion_fiscal` (territorio, CCAA, criterio de imputación con
  evidencia, fecha de baja, empleados, colaboradores, alquileres, operaciones
  internacionales, tipo de consulta y superficies de vivienda afecta).
- RLS por profesional en las siete tablas, con las hijas comprobando la
  pertenencia del padre de verdad: sin ese `exists`, conocer un UUID ajeno
  bastaba para escribir en él.
- Guardas: una rectificativa exige factura de origen del mismo profesional y no
  puede rectificarse a sí misma; un expediente revisado exige constar quién lo
  revisó y limpia esa constancia al volver a borrador; los justificantes deben
  estar bajo la carpeta del propio profesional.
- Capa de reglas versionada, evaluador de obligaciones y aritmética en
  céntimos, con 22 pruebas.

### Pendiente

El asistente por pasos, el registro de facturación en pantalla, la importación
CSV/XLSX con mapeo de columnas, el checklist personal y el ZIP con manifiesto e
índice. Todo ello **depende de que el esquema esté aplicado**, que es cosa de
Gabriel.

---

## Antes de usarlo

1. **Aplicar la migración** `20260915100001_expediente_fiscal.sql`. No la aplica
   el agente.
2. **Confirmar el territorio** en el perfil fiscal. Por defecto se asume común
   y se calcula, pero con aviso hasta que alguien lo confirme.
3. Revisar con un asesor las reglas de procedencia heredada antes de dar por
   buenas las cifras que dependen de ellas.
