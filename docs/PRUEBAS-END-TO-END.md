# Pruebas completas con cuentas reales

Guion para vaciar los datos de demostración y recorrer el producto entero con
cuentas propias: registro, aprobación, centro, invitaciones, acceso clínico y
las dos direcciones de sincronización.

**Esto no convierte el entorno en uno de producción clínica.** El banner de
demostración se queda: que los datos sean tuyos y no sembrados no los convierte
en datos de pacientes reales, y eso sigue bloqueado por el DPA y la base
jurídica del art. 9 RGPD.

---

## 0. Antes de tocar nada

```bash
npm run copia:datos
npm run copia:datos -- --verificar ../BACKUPS/DATOS-<sello>
```

**Si esa copia no existe, para aquí.** El plan de Supabase no tiene
recuperación a un punto en el tiempo, así que esto es lo único que hay.

Aplica también, desde el editor SQL, la migración
`supabase/migrations/20260917100001_expediente_fiscal_operativo.sql`. No tiene
nada que ver con el vaciado: desbloquea el expediente fiscal, que no admitía ni
una factura. Sin ella, el apartado 3.11 no se puede probar. Es la número **46**.

## 1. Vaciar

`supabase/scripts/vaciar-datos-demo.sql`, desde el editor SQL del panel.

1. Ejecuta el **bloque de diagnóstico**. No borra; solo cuenta.
2. Revisa la lista `cuentas_a_conservar`. Tiene que estar tu correo de
   administrador: el script **aborta** si la lista no contiene ninguno, porque
   vaciar la base y perder el acceso a la vez no tiene arreglo.
3. Ejecuta el **bloque de borrado**. Va en una transacción: o entra entero o no
   entra nada.

```bash
npm run informe:organizaciones -- --verificar
```

Debe decir 0 profesionales, 0 organizaciones y 0 expedientes.

**Tu cuenta sobrevive pero pierde el rol**, a propósito: así te registras por el
asistente como cualquier otro y pruebas el alta de verdad. Sigues siendo
administrador de plataforma, así que `/admin` te funciona desde el principio.

## 2. Las cuentas

Usa **alias de Gmail con `+`**: son cuentas distintas para la aplicación y todas
llegan a tu bandeja.

| Alias | Papel en las pruebas |
|---|---|
| `gsechevarria@gmail.com` | Administrador de plataforma (conservada) |
| `…+psico1@gmail.com` | Profesional, consulta individual |
| `…+centro@gmail.com` | Profesional, propietario de un centro |
| `…+colega@gmail.com` | Profesional invitado al centro |
| `…+rechazo@gmail.com` | Profesional al que rechazarás, para ver ese camino |
| `…+paciente1@gmail.com` | Paciente de `psico1` |
| `…+paciente2@gmail.com` | Paciente del centro **y** de `psico1` |

Ese último es el más interesante: la misma persona en dos centros debe acabar
con **dos expedientes separados**.

### Dos límites de correo que conviene saber antes de empezar

**Confirmación de cuenta** (registro profesional) la manda Supabase, no Resend,
y llega a cualquier dirección. Pero el SMTP por defecto de Supabase tiene un
**límite de unos pocos correos por hora**: si creas seis cuentas seguidas, las
últimas no llegarán. Espacia los registros o configura un SMTP propio en
Supabase → Authentication → Emails.

**Invitaciones de paciente y de equipo** salen por Resend y, mientras
`EMAIL_FROM` sea `onboarding@resend.dev`, **solo se entregan a
`gsechevarria@gmail.com`**. Un alias con `+` probablemente sea rechazado. No
bloquea nada: la invitación se crea igual y el panel te da el enlace para
abrirlo tú. Si quieres probar el correo de verdad, verifica un subdominio
(`terap.darstelecom.es`) en Resend y cambia `EMAIL_FROM`.

Comprueba cada envío con `npm run correos`.

---

## 3. El recorrido

### 3.1 Estado vacío
- [ ] `/` carga y el botón lleva a `/acceso`.
- [ ] Las tres entradas están: profesional, paciente, ya tengo cuenta.
- [ ] «Soy paciente» dice que hace falta invitación y **no ofrece registro**.
- [ ] `/pro` sin sesión redirige al acceso.

### 3.2 Alta profesional (consulta individual) — `+psico1`
- [ ] `/registro` → nombre, correo, contraseña → llega el correo de confirmación.
- [ ] Antes de confirmar, la pantalla dice que confirmar el correo **no**
      acredita la colegiación.
- [ ] Tras confirmar: datos profesionales, elegir **«Por mi cuenta»**, enviar.
- [ ] Queda en `/registro/estado` con «en revisión».
- [ ] **Intenta entrar en `/pro`**: debe rebotar al estado.
- [ ] Recarga `/registro` y vuelve a enviar: **no** debe duplicar organización.

### 3.3 Aprobación y rechazo — administrador
- [ ] `/admin` con tu cuenta de administrador. Con otra cuenta debe dar 404.
- [ ] `+rechazo` registrado → **Rechazar** sin motivo: no debe dejarte.
- [ ] Rechazar con motivo → esa cuenta ve el motivo en su estado y sigue sin
      poder entrar.
- [ ] Aprobar `+psico1` → ya entra en `/pro`.

### 3.4 Centro y equipo — `+centro` y `+colega`
- [ ] `+centro` se registra eligiendo **«En un centro»** con nombre propio.
- [ ] Apruébalo. En `/pro/equipo` debe salir el nombre del centro.
- [ ] Invita a `+colega`. Copia el enlace (o el correo si te llega).
- [ ] `+colega` abre `/unirse/<token>`: **ve el centro y el rol sin consumir el
      token**. Recarga la página: sigue sirviendo.
- [ ] Si `+colega` no tiene alta profesional, le manda a completarla primero.
- [ ] Acepta → se añade al equipo. **No debe crearse un segundo centro.**
- [ ] Reabre el mismo enlace: ya no sirve.
- [ ] Invita a un correo y acepta con otro: debe rechazarlo.

### 3.5 Expediente y acceso clínico
- [ ] `+centro` crea un paciente. Aparece marcado **«Sin cuenta»**.
- [ ] **`+colega` NO ve ese expediente.** Es la prueba clave: pertenecer al
      centro no da acceso.
- [ ] Desde la ficha → «Dar acceso a un compañero» → `+colega` ya lo ve.
- [ ] `+colega` puede añadir sus propias notas pero **no editar las ajenas**.
- [ ] `/pro/equipo` → «Retirar del equipo» → deja de verlo **al instante**.
- [ ] Intenta retirar al profesional de referencia: no debe dejarte.
- [ ] Intenta quitarte a ti mismo siendo el único propietario: no debe dejarte.

### 3.6 Invitación del paciente — `+paciente1`
- [ ] Ficha → **«Acceso y equipo»** → correo → «Invitar a Terap».
- [ ] La pantalla dice si el correo salió, falló o no hay proveedor, y da el
      enlace. Contrástalo con `npm run correos`.
- [ ] El paciente abre `/invitacion/<token>`: ve **qué centro** le invita y nada
      del expediente. **Recargar no lo consume.**
- [ ] Entrar con otra cuenta: lo explica y ofrece salir, **sin vincular nada**.
- [ ] Con la cuenta correcta → consentimiento → aceptar → entra en `/app`.
- [ ] La ficha pasa a **«Acceso vinculado»** y desaparece «Sin cuenta».
- [ ] Reenviar una invitación **invalida la anterior**.
- [ ] Revocar una pendiente: el enlace deja de servir al momento.

### 3.7 Dos centros, un paciente — `+paciente2`
- [ ] `+centro` crea un expediente para `+paciente2` y le invita. Acepta.
- [ ] `+psico1` crea **otro** expediente para el **mismo correo** e invita.
      Acepta también.
- [ ] Debe haber **dos expedientes separados**. Ninguno de los dos
      profesionales ve el del otro.
- [ ] El paciente firma **dos consentimientos**, uno por centro.

### 3.8 Las dos direcciones de sincronización
Con dos sesiones abiertas: el panel en el ordenador, la app en el móvil.

Del profesional al paciente — crea y comprueba que el paciente lo ve:
- [ ] Una tarea · una cita · una escala activada · un pago (deuda en «Más»).

Del paciente al profesional — haz y comprueba en el panel:
- [ ] Marcar una tarea como hecha → deja de constar pendiente.
- [ ] Registrar el ánimo → aparece en Diario y mueve la última actividad.
- [ ] Responder un cuestionario → aparece en la ficha; con el ítem 9 del PHQ-9
      marcado, **el aviso de riesgo debe salir en el panel**.
- [ ] **Cancelar una cita** → desaparece de la agenda del profesional.
- [ ] Pedir cita → llega a `/pro/solicitudes` con su contador.

> La invalidación refresca **al siguiente acceso a la pantalla**, no empuja
> nada en vivo. Cambia de pestaña y vuelve, o recarga. No hay tiempo real, y
> hoy no está previsto.

### 3.9 Lo que NO debe poder hacerse
- [ ] Registrarse como paciente sin invitación: no hay camino.
- [ ] Un paciente entrando en `/pro`: rebota.
- [ ] Un profesional pendiente creando pacientes o invitando: bloqueado.
- [ ] `/admin` con una cuenta que no es administradora: 404, no 403.
- [ ] Un profesional viendo el expediente de otro centro cambiando el
      identificador en la URL.
- [ ] Un token caducado, revocado o ya usado: ninguno vincula.

### 3.10 En el móvil
- [ ] Las pantallas de entrada salen **en claro** aunque el teléfono esté en
      modo oscuro.
- [ ] La app del paciente a 320, 375, 390 y 430 px.
- [ ] Con el teclado abierto: el campo no queda tapado y la barra inferior no
      flota encima.
- [ ] Instalarla como PWA y abrirla desde el icono.

### 3.11 Expediente fiscal (recién desbloqueado)
Con `+psico1` aprobado, en `/pro/contabilidad/expediente/2026`. Hasta la
migración 46 ninguna de estas tres tablas admitía una fila, así que **esto no
se había probado nunca contra la base real**.

- [ ] Anotar una **factura** en el libro registro: se guarda y aparece listada.
- [ ] Una **rectificativa** sobre ella: exige indicar a cuál rectifica.
- [ ] Una **retención** soportada y una casilla del **checklist personal**.
- [ ] Descargar el ZIP del expediente: se genera y avisa si va incompleto.

---

## 4. Si algo falla

Anota la **referencia para soporte** que aparece bajo «Algo ha fallado»: es el
digest del error y lleva a la traza exacta en los registros de Vercel.

Para lo que no se ve en pantalla:

```bash
npm run correos                               # envíos y su motivo de fallo
npm run informe:organizaciones -- --verificar # integridad de las relaciones
```

## 5. Volver atrás

No hay vuelta atrás del vaciado salvo la copia del paso 0. Restaurarla es
reinsertar los JSON con `service_role`, en el mismo orden de dependencias del
script de vaciado pero al revés, y **las contraseñas de las cuentas no están
ahí**: la Admin API no las expone, así que habría que restablecerlas.

Por eso el paso 0 no es opcional.
