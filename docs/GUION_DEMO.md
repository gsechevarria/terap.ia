# Guion de demo (7-8 min)

> Entorno de demostración con **datos ficticios**. Prepara dos ventanas: portátil
> (panel profesional) y móvil (PWA paciente).

## Preparación (una vez)
1. `SEED_PRO_EMAIL=tu-correo@dominio npm run seed` (usa un correo al que puedas
   recibir el enlace mágico). Esto crea una consulta con ~6 pacientes y 3 meses de
   histórico bajo tu correo.
2. En Supabase → Authentication → URL Configuration: añade la URL pública a
   *Redirect URLs* (`https://<dominio>/**`).

## Recorrido (≈8 min)

1. **Acceso (30 s).** Landing → *Acceder* → introduce tu correo como **Profesional**
   → abre el enlace mágico → panel `/pro`. Enseña la **lista de pacientes** con
   resumen (tareas, próxima cita, alertas) y el **banner de demo** permanente.

2. **Alta de paciente por invitación (1 min).** *Nuevo paciente* → crea uno →
   en su ficha, **Generar enlace de invitación** → abre el enlace en el **móvil**
   → introduce un correo → enlace mágico → **firma el consentimiento** → entra a la
   PWA del paciente. (Opcional: *Añadir a pantalla de inicio* para mostrarla
   instalable.)

3. **Tarea (1 min).** En la ficha (portátil), pestaña **Tareas** → crea "Diario de
   gratitud" con fecha límite. En el **móvil**, el paciente la ve en su inicio y la
   **marca como hecha** con una nota. Vuelve al portátil: aparece "hecha".

4. **Cita + .ics (1 min).** **Agenda** → *Nueva cita* para el paciente (con link de
   videollamada). En el móvil, *Mis citas* → **Confirmar** y **Añadir al calendario
   (.ics)** → se abre en Google/Apple Calendar.

5. **Escala opt-in + alerta ítem 9 (1,5 min).** Ficha → **Escalas** → activa
   **PHQ-9**. En el móvil aparece en *Cuestionarios*; el paciente responde. Muestra
   el paciente **Ana Nadal** (del seed), cuya última respuesta marcó el **ítem 9**:
   en la ficha y el dashboard aparece la **alerta destacada**; al responderla, el
   paciente ve **recursos de emergencia** (024/112). Abre **Ver evolución**:
   gráfica + tabla + **Exportar CSV**.

6. **Diario emocional (1 min).** En el móvil, *¿Cómo estás hoy?* → registra ánimo.
   En la ficha, pestaña **Diario**: gráfica de evolución (sin interpretación).

7. **Pagos (1 min).** Ficha → **Pagos**: precio por sesión, **bono** con consumo,
   deuda. Marca una asistencia en Agenda y enseña cómo se genera el pago/consumo.
   **Pagos** (nav) → resumen mensual de ingresos + **Exportar CSV** (gestoría).
   *Nunca se emiten facturas.*

8. **Analítica (1 min).** **Analítica**: ocupación semanal, **tasa de no-shows**,
   ingresos por mes, activos vs archivados y **evolución agregada anónima** de
   escalas — la historia de 3 meses del seed.

## Cierre
Recalca: multi-tenant con RLS (cada profesional solo ve lo suyo), escalas opt-in,
sin facturación, sin interpretación clínica, solo datos ficticios.
