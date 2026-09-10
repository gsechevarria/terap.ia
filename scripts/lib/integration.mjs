import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { assertLocalDatabase } from './local-only.mjs';

// Solo crea datos ficticios en loopback. No realiza borrados ni envía correo.
// CI usa una instancia desechable; una ejecución manual conserva las fixtures.
export async function integration(group = 'all') {
 const url = assertLocalDatabase();
 const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, service = process.env.SUPABASE_SERVICE_ROLE_KEY;
 if (!anon || !service) throw new Error('Faltan claves de Supabase local en .env.test');
 const makeClient = key => createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const admin = makeClient(service);
 const ok = async req => { const r = await req; if(r.error) throw new Error(r.error.message); return r.data; };
 const deny = async req => assert((await req).error, 'La operación debía rechazarse');
 const password = 'Ficticio-Aa9!' + randomUUID();
 async function makeUser(role) {
  const email='integration-'+randomUUID()+'@example.com';
  const {user}=await ok(admin.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{role},user_metadata:{full_name:'Persona ficticia'}}));
  const db=makeClient(anon); await ok(db.auth.signInWithPassword({email,password}));
  return {id:user.id,email,db};
 }
 const pro=await makeUser('professional'), other=await makeUser('professional'), patient=await makeUser('patient');
 const owner=await ok(pro.db.from('professionals').select('id').eq('user_id',pro.id).single());
 const p=await ok(pro.db.from('patients').insert({professional_id:owner.id,full_name:'Paciente ficticio',email:patient.email}).select().single());
 const token=randomUUID();
 await ok(pro.db.rpc('issue_invitation',{p_patient_id:p.id,p_token_hash:createHash('sha256').update(token).digest('hex')}));
 assert.equal(await ok(patient.db.rpc('has_current_consent')),false);
 const c=await ok(patient.db.rpc('get_onboarding_consent',{p_token:token}));
 const consent={p_token:token,p_template_id:c.id,p_content_hash:c.hash};
 await deny(patient.db.rpc('complete_onboarding',{...consent,p_content_hash:'incorrecto'}));
 await ok(patient.db.rpc('complete_onboarding',consent));
 await ok(patient.db.rpc('complete_onboarding',{...consent,p_token:''}));
 assert.equal(await ok(patient.db.rpc('has_current_consent')),true);
 let passed=0;
 const test=async(scope,name,fn)=>{if(group!=='all'&&scope!==group)return;await fn();passed++;console.log('OK: '+name);};
 await test('onboarding','Consentimiento y bloqueo de RPC antigua',async()=>{
  await deny(patient.db.rpc('accept_invitation',{p_token:token}));
  assert.equal((await ok(patient.db.from('consents').select('id'))).length,1);
 });
 await test('rls','JWT y aislamiento de expedientes',async()=>{
  assert.equal((await ok(other.db.from('patients').select('id').eq('id',p.id))).length,0);
  await deny(pro.db.from('patients').update({user_id:null}).eq('id',p.id));
  await ok(patient.db.auth.updateUser({data:{role:'professional'}}));
  assert.equal(await ok(patient.db.rpc('current_professional_id')),null);
 });
 await test('pro','Tarea, aviso y reintento idempotente',async()=>{
  const t=await ok(pro.db.from('tasks').insert({professional_id:owner.id,patient_id:p.id,title:'Tarea ficticia'}).select().single());
  const first=await ok(patient.db.rpc('complete_patient_task',{p_id:t.id,p_response:'Hecha'}));
  assert.equal(await ok(patient.db.rpc('complete_patient_task',{p_id:t.id,p_response:'Reintento'})),first);
  assert.equal((await ok(admin.from('notifications').select('id').eq('dedupe_key','tasks:'+t.id))).length,1);
 });
 await test('scales','Opt-in y escala puntual',async()=>{
  const scales=await ok(admin.from('scales').select('*'));
  const scale=scales.find(s=>s.definition?.flag_item!=null)??scales[0];assert(scale);
  const a=await ok(pro.db.from('scale_assignments').insert({professional_id:owner.id,patient_id:p.id,scale_id:scale.id}).select().single());
  const answers=Object.fromEntries(scale.definition.items.map(i=>[String(i.id),0]));
  const row={assignment_id:a.id,patient_id:p.id,scale_id:scale.id,answers};
  assert.equal((await ok(patient.db.from('scale_responses').insert(row).select().single())).score,0);
  await deny(patient.db.from('scale_responses').insert(row));
 });
 const appointment=await ok(pro.db.from('appointments').insert({professional_id:owner.id,patient_id:p.id,starts_at:new Date(Date.now()+3600000).toISOString(),ends_at:new Date(Date.now()+7200000).toISOString()}).select().single());
 await test('agenda','Confirmación y asistencia protegida',async()=>{
  await ok(patient.db.rpc('patient_respond_appointment',{p_appointment_id:appointment.id,p_action:'confirm'}));
  await deny(pro.db.from('appointments').update({attendance:'attended'}).eq('id',appointment.id));
 });
 await test('payments','Concurrencia real sin duplicar bono ni consumo',async()=>{
  const args={p_patient_id:p.id,p_total_sessions:5,p_price_cents:25000,p_request_id:randomUUID()};
  const ids=await Promise.all([ok(pro.db.rpc('create_session_pack',args)),ok(pro.db.rpc('create_session_pack',args))]);assert.equal(ids[0],ids[1]);
  await Promise.all([1,2].map(()=>ok(pro.db.rpc('change_appointment',{p_id:appointment.id,p_attendance:'attended'}))));
  assert.equal((await ok(pro.db.from('session_packs').select('used_sessions').eq('id',ids[0]).single())).used_sessions,1);
 });
 await test('wellbeing','Diario con una sola entrada por día',async()=>{
  for(const value of [3,4])await ok(patient.db.from('mood_entries').upsert({patient_id:p.id,mood_value:value},{onConflict:'patient_id,entry_date'}));
  assert.equal((await ok(patient.db.from('mood_entries').select('id'))).length,1);
 });
 await test('notifications','Recordatorios y lotes exclusivos',async()=>{
  await deny(patient.db.from('push_subscriptions').insert({user_id:patient.id,endpoint:'https://127.0.0.1/private',p256dh:'a'.repeat(87),auth:'a'.repeat(22)}));
  await ok(admin.rpc('queue_appointment_reminders'));
  const batches=await Promise.all([1,2].map(()=>ok(admin.rpc('claim_notifications',{p_token:randomUUID(),p_limit:20}))));
  assert(batches.flat().length>0);assert(!batches[0].some(x=>batches[1].some(y=>x.id===y.id)));
 });
 await test('contabilidad','Gasto y tratamiento fiscal por operación',async()=>{
  const id=await ok(pro.db.rpc('save_expense',{p_id:null,p_data:{fecha:'2026-09-01',categoria_deducible:'software',base_cents:100000,tipo_iva:21,porcentaje_afectacion:50,es_bien_inversion:true,porcentaje_amortizacion:25,anios_amortizacion:4}}));
  assert.equal((await ok(pro.db.from('bienes_inversion').select('valor_adquisicion_cents').eq('gasto_id',id).single())).valor_adquisicion_cents,60500);
  const pay=await ok(pro.db.from('payments').insert({professional_id:owner.id,patient_id:p.id,amount_cents:12100,status:'paid'}).select().single());
  await ok(pro.db.rpc('set_payment_fiscal',{p_id:pay.id,p_tipo:'sujeta',p_iva:21,p_retencion_cents:1500}));
  const row=await ok(pro.db.from('v_ingresos_fiscales').select().eq('id',pay.id).single());assert.equal(row.base_cents,10000);assert.equal(row.retencion_cents,1500);
 });
 await test('analytics','Relaciones PostgREST y aislamiento económico',async()=>{
  await ok(pro.db.from('payments').select('id,patients(full_name),appointments(starts_at),session_packs(total_sessions)'));
  assert.equal((await ok(other.db.from('v_ingresos_fiscales').select('id').eq('professional_id',owner.id))).length,0);
 });
 await test('rls','Archivo privado y compartición explícita',async()=>{
  const path=p.id+'/'+randomUUID()+'.pdf', body=Buffer.from('%PDF-1.4\n% Ficticio\n');
  await ok(pro.db.from('pending_uploads').insert({path,bucket:'files',professional_id:owner.id,patient_id:p.id,size_bytes:body.length,mime:'application/pdf'}));
  const upload=await ok(pro.db.storage.from('files').createSignedUploadUrl(path));
  await ok(pro.db.storage.from('files').uploadToSignedUrl(path,upload.token,body,{contentType:'application/pdf'}));
  const doc=await ok(pro.db.from('documents').insert({professional_id:owner.id,patient_id:p.id,title:'Ficticio',storage_path:path,shared_with_patient:false}).select().single());
  await deny(patient.db.storage.from('files').createSignedUrl(path,30));
  await ok(pro.db.from('documents').update({shared_with_patient:true}).eq('id',doc.id));
  await ok(patient.db.storage.from('files').createSignedUrl(path,30));
  await deny(other.db.storage.from('files').createSignedUrl(path,30));
 });
 assert(passed>0,'Grupo desconocido');
 console.log(`Integración: ${passed} escenarios (${group}). Fixtures conservadas exclusivamente en Supabase local.`);
}
