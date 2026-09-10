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
    alter default privileges in schema public grant all on tables to authenticated, service_role;
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
  console.log(`OK: ${checks} regresiones SQL; ${files.length} migraciones, conservación de históricos y alta sin escalada de privilegios`);
} finally { await db.close(); }
