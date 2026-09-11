# Guion de demo (8-9 min)

> Entorno de demostración con **datos ficticios**. Prepara dos ventanas:
> portátil (panel del profesional) y móvil (aplicación del paciente). Usa
> ventanas separadas o una en incógnito: comparten sesión.

## Preparación (una vez)

1. `npm run seed:demo` — deja la consulta lista para enseñarse: dos semanas de
   citas, tareas y diario recientes y una solicitud esperando respuesta.
2. Credenciales (ficticias), las dos con contraseña **`Demo-terapia-2026!`**:
   - Profesional: `dra.romero@demo.terapia`
   - Paciente: `ana.nadal@demo.terapia`
3. Entra por `/login` **con correo y contraseña**. Nada de enlace mágico: en
   directo, esperar un correo delante del cliente es un riesgo que no compensa.
4. En el móvil, *Añadir a pantalla de inicio* para enseñarla ya instalada.

## Recorrido (≈9 min)

1. **Acceso (30 s).** Portada → *Acceder* → entra como profesional. Enseña la
   **lista de pacientes** con su resumen (tareas, próxima cita, alertas) y el
   **aviso de demostración** permanente.

2. **La semana de un psicólogo (1 min).** **Agenda**: vista de semana con las
   citas reales de los próximos días. Abre una, enseña el detalle y el registro
   de **asistencia**.

3. **El paciente pide cita (2 min) — el momento fuerte.** En el **móvil**,
   pestaña *Citas* → **Pedir cita** → elige día y franja, añade una nota →
   enviar. En el **portátil**, **Solicitudes** ya marca una más: acepta tal
   cual, o pulsa **Proponer otra hora** y cámbiala. Vuelve al móvil: la cita
   aparece confirmada. Recalca que **nada entra en la agenda sin que el
   profesional lo apruebe** y que el paciente no puede tocar el horario.

4. **Tarea entre sesiones (1 min).** Ficha del paciente → pestaña **Tareas** →
   crea una con fecha límite. En el móvil aparece en el inicio; el paciente la
   **marca como hecha** con una nota. Vuelve al portátil: aparece hecha.

5. **Escala opt-in y alerta (1,5 min).** Ficha → **Escalas** → activa el PHQ-9;
   subraya que **por defecto está apagada**: sin activarla el paciente no ve
   ninguna. Enseña a **Ana Nadal**, cuya respuesta marcó el **ítem de riesgo**:
   alerta destacada en el panel, y al paciente se le ofrecieron **recursos de
   emergencia** (024/112). Abre *Ver evolución*: gráfica, tabla y **CSV**.

6. **Diario emocional (1 min).** En el móvil, pestaña *Diario*: registra el
   ánimo de hoy. En la ficha, pestaña **Diario**: la evolución de los últimos
   días. Di en voz alta que **no interpreta ni recomienda nada**: solo registra.

7. **Pagos (1 min).** Ficha → **Pagos**: precio por sesión, **bono** con
   consumo, deuda. Marca una asistencia en la agenda y enseña cómo se genera el
   pago o se consume el bono. **Pagos** (menú) → resumen mensual y **CSV para la
   gestoría**. *Nunca se emiten facturas.*

8. **Analítica y contabilidad (1 min).** **Analítica**: ocupación, **tasa de
   ausencias**, ingresos por mes, evolución agregada y anónima de escalas.
   **Contabilidad**: estimación orientativa del modelo 130 y libros exportables.

## Cierre

Cada profesional solo ve lo suyo (aislamiento por base de datos, no por
pantalla), escalas opt-in, sin facturación, sin interpretación clínica, y solo
datos ficticios.

## Si algo se tuerce

- **No aparece la solicitud**: recarga el panel; el contador vive en el menú.
- **La app no deja pedir cita**: hay un tope de 3 solicitudes vivas y se exige
  una hora de antelación.
- **Sesión cruzada**: si al abrir el móvil entras como profesional, cierra
  sesión o usa una ventana en incógnito.
