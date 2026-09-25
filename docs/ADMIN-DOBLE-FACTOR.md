# Doble factor en la administración de plataforma

Migración `20260925100001_admin_mfa_y_alta_incompleta.sql` (la 49).

## Qué exige

`/admin` pide, además de la contraseña, un código TOTP de una app de
autenticación (Google Authenticator, 1Password, Authy…). Es el MFA propio de
Supabase Auth: no hay dependencia nueva ni secreto guardado por la aplicación.

**Se exige en la base, no solo en la pantalla.** `is_platform_admin()` solo es
verdadera con la sesión en `aal2`, y de esa función cuelgan todas las RPC de
administración (`admin_review_professional`, `admin_set_org_access`) y la
política que deja leer la cola de acreditaciones. Una sesión con solo contraseña
no administra nada aunque llame a la API a mano.

Para saber si hay que pedir el código, la pantalla usa
`is_platform_admin_account()`, que dice si la cuenta es administradora sin
conceder nada.

## Primer uso: hacerlo en cuanto se despliegue

La **primera** vez que una cuenta administradora entra en `/admin/login` con su
contraseña, la pantalla da de alta el segundo factor y enseña el QR. Quien llegue
primero con la contraseña es quien lo vincula a su dispositivo. Por eso:

1. **Cambia la contraseña** de la cuenta administradora antes, o justo después.
2. **Entra en `/admin/login` y da de alta el factor** en cuanto esté desplegado.

A partir de ahí, la contraseña sola ya no abre la administración.

## Requisito en Supabase

Authentication → Multi-Factor → **TOTP activado**. Viene activado por defecto en
los proyectos de Supabase; si no lo estuviera, el alta del factor falla con un
error y `/admin` queda inaccesible, pero no se abre sin él.

## Si se pierde el dispositivo

Desde la aplicación no se puede quitar el factor, a propósito: si se pudiera,
bastaría la contraseña para quitarlo. Se retira fuera de banda, en el editor SQL
de Supabase (o con la `service_role`):

```sql
-- Ver los factores de la cuenta
select id, factor_type, status, created_at
  from auth.mfa_factors
 where user_id = (select id from auth.users where email = '<correo>');

-- Retirarlos: la próxima entrada en /admin/login pedirá dar de alta uno nuevo
delete from auth.mfa_factors
 where user_id = (select id from auth.users where email = '<correo>');
```

Después, entra en `/admin/login` y da de alta el factor en el dispositivo nuevo.

## Alcance

Solo la administración de plataforma. El panel del profesional **no** pide
segundo factor (decisión del 25-sep-2026, aplazado).
