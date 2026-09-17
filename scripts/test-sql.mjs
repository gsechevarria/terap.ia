import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFile, readdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { sqlRegressions } from './lib/sql-regressions.mjs';
import { generateDbTypes } from './lib/generate-db-types.mjs';

// PostgreSQL real embebido. Auth/Storage se modelan: no sustituye GoTrue/PostgREST.
const db = new PGlite({ extensions: { pgcrypto } });
try {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth; create schema storage; create schema extensions;
    create table auth.users (id uuid primary key default gen_random_uuid(), email text,
      email_confirmed_at timestamptz, raw_user_meta_data jsonb default '{}', raw_app_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
    create function auth.role() returns text language sql stable as
      $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true),''),'anon') $$;
    create table storage.buckets (id text primary key, name text, public boolean,
      file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (id uuid primary key default gen_random_uuid(),
      bucket_id text references storage.buckets(id), name text, owner uuid);
    alter table storage.objects enable row level security;
    create function storage.foldername(text) returns text[] language sql immutable as
      $$ select (string_to_array($1, '/'))[1:array_length(string_to_array($1, '/'),1)-1] $$;
    grant usage on schema public, auth, storage, extensions to authenticated, anon, service_role;
    grant all on all tables in schema storage to authenticated, service_role;
    -- Sin grants automáticos: las migraciones deben declarar el acceso API.
  `);
  const files = (await readdir('supabase/migrations')).filter(f => f.endsWith('.sql')).sort();
  let legacy;
  for (const f of files) {
    if (f === '20260909190001_security_invariants.sql') {
      const uid='11111111-1111-4111-8111-111111111111';
      await db.query("insert into auth.users(id,email,raw_app_meta_data) values($1,'legacy@example.invalid','{\"role\":\"professional\"}')",[uid]);
      const pro=(await db.query('select id from professionals where user_id=$1',[uid])).rows[0].id;
      const patient=(await db.query("insert into patients(professional_id,full_name) values($1,'Histórico ficticio') returning id",[pro])).rows[0].id;
      const pay=(await db.query("insert into payments(professional_id,patient_id,amount_cents,status) values($1,$2,1234,'paid') returning id",[pro,patient])).rows[0].id;
      const expense=(await db.query("insert into gastos(professional_id,fecha,categoria_deducible,base_cents,total_cents,es_bien_inversion) values($1,'2022-07-01','software',100000,100000,true) returning id",[pro])).rows[0].id;
      const asset=(await db.query("insert into bienes_inversion(professional_id,gasto_id,descripcion,fecha_adquisicion,valor_adquisicion_cents,porcentaje_amortizacion) values($1,$2,'Equipo histórico ficticio','2022-07-01',100000,25) returning id",[pro,expense])).rows[0].id;
      legacy={pay,expense,asset};
    }
    try { await db.exec(await readFile('supabase/migrations/' + f, 'utf8')); }
    catch (e) { throw new Error('Migración ' + f + ': ' + e.message, { cause: e }); }
  }
  assert(legacy);
  const historicalIncome=(await db.query('select * from v_ingresos_fiscales where id=$1',[legacy.pay])).rows[0];
  assert.equal(historicalIncome.total_cents,1234);
  assert.equal(historicalIncome.fiscal_review_required,true);
  assert.equal((await db.query('select iva_recuperable_pct from gastos where id=$1',[legacy.expense])).rows[0].iva_recuperable_pct,null);
  const historicalAsset=(await db.query('select * from bienes_inversion where id=$1',[legacy.asset])).rows[0];
  assert.equal(historicalAsset.valor_adquisicion_cents,100000); assert.equal(historicalAsset.fiscal_review_required,true);
  if(process.argv.includes('--check-types')) await generateDbTypes(db,true);
  if(process.argv.includes('--generate-types')) await generateDbTypes(db);
  const user = '00000000-0000-4000-8000-000000000001';
  await db.query(`insert into auth.users(id,email,raw_user_meta_data) values ($1,'fake@example.invalid','{"role":"professional"}')`,[user]);
  assert.equal((await db.query(`select raw_app_meta_data->>'role' role from auth.users where id=$1`,[user])).rows[0].role,'patient');
  assert.equal((await db.query(`select count(*)::int n from professionals where user_id=$1`,[user])).rows[0].n,0);
  const checks = await sqlRegressions(db);
  await db.exec('create schema supabase_migrations; create table supabase_migrations.schema_migrations(version text)');
  await db.exec(await readFile('supabase/scripts/diagnostico-correcciones-202609.sql','utf8'));

  // El vaciado de la demo, sobre la base que acaban de dejar las 84
  // regresiones: llena de profesionales, organizaciones y expedientes.
  //
  // Se comprueba aquí y no en otro sitio porque este script se ejecuta a mano
  // y BORRA: cualquier tabla nueva que no se añada a la lista quedaría con
  // datos de la etapa anterior, y una llave foránea nueva lo haría fallar a
  // mitad. La primera vez ya falló por el disparador que protege al último
  // propietario; sin esta comprobación se habría descubierto en producción.
  const preservado = 'admin@example.invalid';   // la crea `sqlRegressions`
  const vaciado = (await readFile('supabase/scripts/vaciar-datos-demo.sql','utf8'))
    .replace("'gsechevarria@gmail.com'", `'${preservado}'`);
  const antes = (await db.query('select count(*)::int n from patients')).rows[0].n;
  assert.ok(antes > 0, 'la comprobación del vaciado necesita datos que borrar');

  // Las tres llaves que el orden de borrado tiene que respetar, sembradas a
  // propósito. Sin ellas el vaciado pasaba la prueba y fallaba en producción
  // con un 23503: las regresiones dejan pagos, pero ninguno ligado a una cita
  // ni a un bono, y ninguna factura rectificativa.
  //
  //  · payments → appointments   (`on delete restrict`, clave compuesta)
  //  · payments → session_packs  (`on delete restrict`, clave compuesta)
  //  · facturas → facturas       (`rectifica_a`, RESTRICT sobre su propia tabla)
  const ficha = (await db.query('select id, professional_id from patients limit 1')).rows[0];
  const cita = (await db.query(
    "insert into appointments(professional_id,patient_id,starts_at,ends_at)"
    + " values($1,$2,now(),now()+interval '1 hour') returning id",
    [ficha.professional_id, ficha.id])).rows[0].id;
  await db.query(
    "insert into payments(professional_id,patient_id,appointment_id,amount_cents,status)"
    + " values($1,$2,$3,5000,'paid')", [ficha.professional_id, ficha.id, cita]);
  const bono = (await db.query(
    "insert into session_packs(professional_id,patient_id,total_sessions,price_cents)"
    + " values($1,$2,5,20000) returning id", [ficha.professional_id, ficha.id])).rows[0].id;
  await db.query(
    "insert into payments(professional_id,patient_id,session_pack_id,amount_cents,status)"
    + " values($1,$2,$3,20000,'pending')", [ficha.professional_id, ficha.id, bono]);
  const factura = (await db.query(
    "insert into facturas(professional_id,fecha_emision,base_cents,total_cents)"
    + " values($1,'2026-01-15',10000,10000) returning id", [ficha.professional_id])).rows[0].id;
  const rectificativa = (await db.query(
    "insert into facturas(professional_id,fecha_emision,base_cents,total_cents,tipo,rectifica_a)"
    + " values($1,'2026-02-15',-10000,-10000,'rectificativa',$2) returning id",
    [ficha.professional_id, factura])).rows[0].id;
  // Una cadena de dos saltos: rectificar la rectificativa. Un borrado "por
  // capas" de una sola pasada tampoco bastaría.
  await db.query(
    "insert into facturas(professional_id,fecha_emision,base_cents,total_cents,tipo,rectifica_a)"
    + " values($1,'2026-03-15',5000,5000,'rectificativa',$2)",
    [ficha.professional_id, rectificativa]);
  const retencion = (await db.query(
    "insert into retenciones_pagos_cuenta(professional_id,ejercicio,clase,importe_cents)"
    + " values($1,2026,'soportada_cliente',5000) returning id", [ficha.professional_id])).rows[0].id;
  await db.query(
    "insert into retenciones_pagos_cuenta(professional_id,ejercicio,clase,importe_cents,rectifica_a)"
    + " values($1,2026,'soportada_cliente',-5000,$2)", [ficha.professional_id, retencion]);

  await db.exec(vaciado);
  for (const tabla of ['patients','professionals','organizations','appointments','payments','invitations',
                       'session_packs','facturas','retenciones_pagos_cuenta']) {
    assert.equal((await db.query(`select count(*)::int n from ${tabla}`)).rows[0].n, 0,
      `el vaciado dejó filas en ${tabla}`);
  }
  // Y lo que NO debe llevarse por delante.
  assert.ok((await db.query('select count(*)::int n from scales')).rows[0].n > 0, 'se borró el catálogo de escalas');
  assert.ok((await db.query('select count(*)::int n from emergency_links where professional_id is null')).rows[0].n > 0, 'se borraron los teléfonos de emergencia');
  assert.equal((await db.query('select count(*)::int n from platform_admins')).rows[0].n, 1, 'se perdió el administrador de plataforma');
  assert.equal((await db.query('select count(*)::int n from auth.users')).rows[0].n, 1, 'quedaron cuentas que debían borrarse');

  console.log(`OK: ${checks} regresiones SQL; ${files.length} migraciones, conservación de históricos, alta sin escalada de privilegios y vaciado de la demo`);
} finally { await db.close(); }
