import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
export async function sqlRegressions(db) {
 let passed=0;
 const q=async(sql,args=[]) => (await db.query(sql,args)).rows;
 const test=async(name,fn)=>{try{await fn();passed++;}catch(e){throw new Error(name+': '+e.message,{cause:e});}};
 const user=async(id,fn)=>{
  await q("select set_config('request.jwt.claim.sub',$1,false)",[id]);
  await db.exec('set role authenticated');
  try{return await fn();}finally{await db.exec('reset role');await q("select set_config('request.jwt.claim.sub','',false)");}
 };
 const uid1=randomUUID(),uid2=randomUUID(),patUid1=randomUUID(),patUid2=randomUUID();
 for(const [id,role] of [[uid1,'professional'],[uid2,'professional'],[patUid1,'patient'],[patUid2,'patient']]) {
  await q(`insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data) values($1,$2,now(),$3)`,[id,id+'@example.invalid',JSON.stringify({role})]);
 }
 const pro1=(await q('select id from professionals where user_id=$1',[uid1]))[0].id;
 const pro2=(await q('select id from professionals where user_id=$1',[uid2]))[0].id;
 const pat1=randomUUID(),pat2=randomUUID();
 await q(`insert into patients(id,professional_id,user_id,email) values($1,$2,$3,$4),($5,$6,$7,$8)`,[pat1,pro1,patUid1,patUid1+'@example.invalid',pat2,pro2,patUid2,patUid2+'@example.invalid']);
 await test('Sin consentimiento no hay identidad clínica',()=>user(patUid1,async()=>assert.equal((await q('select current_patient_id() id'))[0].id,null)));
 for(const id of [patUid1,patUid2]) await user(id,async()=>{
  const c=(await q("select get_onboarding_consent('') c"))[0].c;
  await q("select complete_onboarding('',$1,$2)",[c.id,c.hash]);
 });
 await test('Paciente solo ve su expediente',()=>user(patUid1,async()=>assert.deepEqual((await q('select id from patients')).map(r=>r.id),[pat1])));
 await test('Profesional no vincula una cuenta al insertar',()=>user(uid1,()=>assert.rejects(q('insert into patients(professional_id,user_id) values($1,$2)',[pro1,randomUUID()]))));
 await test('Profesional no cambia la cuenta vinculada',()=>user(uid1,()=>assert.rejects(q('update patients set user_id=null where id=$1',[pat1]))));
 await test('Profesional no borra el paciente',()=>user(uid1,async()=>assert.equal((await q('delete from patients where id=$1 returning id',[pat1])).length,0)));
 await test('Profesional no lee otros pacientes',()=>user(uid1,async()=>assert.equal((await q('select id from patients where id=$1',[pat2])).length,0)));
 await test('RPC antigua no permite saltar el consentimiento',()=>user(patUid1,()=>assert.rejects(q("select patient_accept_consent()"))));
 await test('Consentimiento idempotente',()=>user(patUid1,async()=>{
  const c=(await q("select get_onboarding_consent('') c"))[0].c;
  await q("select complete_onboarding('',$1,$2)",[c.id,c.hash]);
  assert.equal((await q('select count(*)::int n from consents'))[0].n,1);
 }));
 await test('Una nueva versión exige aceptación y conserva la anterior',async()=>{
  await q("insert into consent_templates(professional_id,title,body,version,active) values($1,'Consentimiento','Texto ficticio revisado',2,true)",[pro1]);
  await user(patUid1,async()=>{
   assert.equal((await q('select has_current_consent() ok'))[0].ok,false);
   const c=(await q("select get_onboarding_consent('') c"))[0].c;
   await assert.rejects(q("select complete_onboarding('',$1,'hash-manipulado')",[c.id]));
   await q("select complete_onboarding('',$1,$2)",[c.id,c.hash]);
   assert.equal((await q('select count(*)::int n from consents'))[0].n,2);
  });
 });
 const appt1=randomUUID(),appt2=randomUUID();
 await q("insert into appointments(id,professional_id,patient_id,starts_at,ends_at) values($1,$2,$3,now()+interval '2 hours',now()+interval '3 hours'),($4,$5,$6,now()+interval '2 hours',now()+interval '3 hours')",[appt1,pro1,pat1,appt2,pro2,pat2]);
 await test('Pago no referencia cita ajena',()=>user(uid1,()=>assert.rejects(q('insert into payments(professional_id,patient_id,appointment_id,amount_cents) values($1,$2,$3,100)',[pro1,pat1,appt2]))));
 let pack;
 await test('Bono y pago atómicos e idempotentes',()=>user(uid1,async()=>{
  const request=randomUUID();
  pack=(await q('select create_session_pack($1,5,25000,$2) id',[pat1,request]))[0].id;
  assert.equal((await q('select create_session_pack($1,5,25000,$2) id',[pat1,request]))[0].id,pack);
  assert.equal((await q('select count(*)::int n from payments where session_pack_id=$1',[pack]))[0].n,1);
 }));
 await test('Liquidación repetida consume una sesión',()=>user(uid1,async()=>{
  await q("select change_appointment($1,'attended','attendance')",[appt1]);
  await q("select change_appointment($1,'attended','attendance')",[appt1]);
  assert.equal((await q('select used_sessions from session_packs where id=$1',[pack]))[0].used_sessions,1);
  assert.equal((await q('select count(*)::int n from payments where appointment_id=$1',[appt1]))[0].n,1);
 }));
 await test('No se elimina directamente un consumo de bono',()=>user(uid1,()=>assert.rejects(q('delete from payments where appointment_id=$1',[appt1]))));
 await test('Corregir asistencia devuelve la sesión una sola vez',()=>user(uid1,async()=>{
  await q("select change_appointment($1,'no_show','attendance')",[appt1]);
  await q("select change_appointment($1,'no_show','attendance')",[appt1]);
  assert.equal((await q('select used_sessions from session_packs where id=$1',[pack]))[0].used_sessions,0);
 }));
 await test('Paciente no ejecuta operaciones económicas',()=>user(patUid1,()=>assert.rejects(q("select change_appointment($1,'attended','attendance')",[appt1]))));
 await test('Bono no puede pertenecer a otro paciente',()=>user(uid2,()=>assert.rejects(q('insert into payments(professional_id,patient_id,session_pack_id,amount_cents) values($1,$2,$3,100)',[pro2,pat2,pack]))));
 const payload={fecha:'2026-07-01',categoria_deducible:'software',concepto:'Equipo ficticio',base_cents:100000,tipo_iva:21,porcentaje_afectacion:50,es_bien_inversion:true,porcentaje_amortizacion:25,anios_amortizacion:4};
 let gasto;
 await test('Gasto y bien se guardan juntos con IVA no recuperable y afectación',()=>user(uid1,async()=>{
  gasto=(await q('select save_expense(null,$1,false) id',[payload]))[0].id;
  assert.equal((await q('select valor_adquisicion_cents from bienes_inversion where gasto_id=$1',[gasto]))[0].valor_adquisicion_cents,60500);
 }));
 await test('Editar descripción preserva inversión y amortización',()=>user(uid1,async()=>{
  const edit={...payload,concepto:'Descripción editada'};delete edit.es_bien_inversion;delete edit.porcentaje_amortizacion;delete edit.anios_amortizacion;
  await q('select save_expense($1,$2,false)',[gasto,edit]);
  assert.equal((await q('select es_bien_inversion from gastos where id=$1',[gasto]))[0].es_bien_inversion,true);
  assert.equal((await q('select porcentaje_amortizacion from bienes_inversion where gasto_id=$1',[gasto]))[0].porcentaje_amortizacion,25);
 }));
 await test('Fallo de bien revierte también gasto',()=>user(uid1,async()=>{
  const before=(await q('select count(*)::int n from gastos'))[0].n;
  await assert.rejects(q('select save_expense(null,$1,false)',[{...payload,porcentaje_amortizacion:0}]));
  assert.equal((await q('select count(*)::int n from gastos'))[0].n,before);
 }));
 await test('Fiscalidad confirmada permanece al cambiar configuración',()=>user(uid1,async()=>{
  const pay=(await q("insert into payments(professional_id,patient_id,amount_cents,status) values($1,$2,12100,'paid') returning id",[pro1,pat1]))[0].id;
  await q("select set_payment_fiscal($1,'sujeta',21,1500)",[pay]);
  await q("insert into configuracion_fiscal(professional_id,situacion_iva) values($1,'exenta') on conflict(professional_id) do update set situacion_iva='exenta'",[pro1]);
  const row=(await q('select * from v_ingresos_fiscales where id=$1',[pay]))[0];
  assert.equal(row.base_cents,10000);assert.equal(row.cuota_iva_cents,2100);assert.equal(row.retencion_cents,1500);
  const date=(await q('select paid_at from payments where id=$1',[pay]))[0].paid_at;
  await q("update payments set status='paid',paid_at=now()+interval '1 day' where id=$1",[pay]);
  assert.equal((await q('select paid_at from payments where id=$1',[pay]))[0].paid_at.getTime(),date.getTime());
 }));
 const scales=await q('select id,definition from scales order by code');
 const scale=scales.find(s=>s.definition.flag_item!=null)??scales[0];
 const assignment=(await q('insert into scale_assignments(professional_id,patient_id,scale_id) values($1,$2,$3) returning id',[pro1,pat1,scale.id]))[0].id;
 const answers=Object.fromEntries(scale.definition.items.map(i=>[String(i.id),0]));
 if(scale.definition.flag_item)answers[String(scale.definition.flag_item)]=1;
 let response;
 await test('Escala rechaza null y escala ajena a asignación',()=>user(patUid1,async()=>{
  await assert.rejects(q('insert into scale_responses(assignment_id,patient_id,scale_id,answers) values($1,$2,$3,$4)',[assignment,pat1,scale.id,{...answers,'1':null}]));
  const other=scales.find(s=>s.id!==scale.id);
  await assert.rejects(q('insert into scale_responses(assignment_id,patient_id,scale_id,answers) values($1,$2,$3,$4)',[assignment,pat1,other.id,answers]));
 }));
 await test('Paciente no puede marcar su respuesta como revisada',()=>user(patUid1,async()=>{
  response=(await q('insert into scale_responses(assignment_id,patient_id,scale_id,answers,acknowledged_at,acknowledged_by) values($1,$2,$3,$4,now(),$5) returning *',[assignment,pat1,scale.id,answers,pro1]))[0];
  assert.equal(response.acknowledged_at,null);assert.equal(response.acknowledged_by,null);
 }));
 await test('Escala puntual no se responde dos veces',()=>user(patUid1,()=>assert.rejects(q('insert into scale_responses(assignment_id,patient_id,scale_id,answers) values($1,$2,$3,$4)',[assignment,pat1,scale.id,answers]))));
 await test('Acuse no permite modificar la respuesta',()=>user(uid1,async()=>{
  await q('update scale_responses set acknowledged_at=now() where id=$1',[response.id]);
  await assert.rejects(q('update scale_responses set scale_id=$1 where id=$2',[scales.find(s=>s.id!==scale.id).id,response.id]));
 }));
 await test('Diario permite editar hoy con una sola entrada',()=>user(patUid1,async()=>{
  await q("insert into mood_entries(patient_id,mood_value) values($1,3) on conflict(patient_id,entry_date) do update set mood_value=excluded.mood_value",[pat1]);
  await q("insert into mood_entries(patient_id,mood_value) values($1,4) on conflict(patient_id,entry_date) do update set mood_value=excluded.mood_value",[pat1]);
  assert.equal((await q('select count(*)::int n from mood_entries'))[0].n,1);
  await assert.rejects(q("insert into mood_entries(patient_id,mood_value,entry_date) values($1,3,current_date-1)",[pat1]));
 }));
 await test('Endpoint push local se rechaza incluso por SQL directo',()=>user(patUid1,()=>assert.rejects(q("insert into push_subscriptions(user_id,endpoint,p256dh,auth) values($1,'https://127.0.0.1/private',$2,$3)",[patUid1,'a'.repeat(87),'a'.repeat(22)]))));
 await test('No se notifican destinatarios ajenos',()=>user(uid1,()=>assert.rejects(q("insert into notifications(user_id,professional_id,patient_id,type) values($1,$2,$3,'new_task')",[patUid2,pro1,pat1]))));
 await test('Paciente no fabrica notificaciones',()=>user(patUid1,()=>assert.rejects(q("insert into notifications(user_id,type) values($1,'new_task')",[patUid1]))));
 await test('Trabajadores no reclaman el mismo lote',async()=>{
  const first=await q('select id from claim_notifications($1,20)',[randomUUID()]);
  const second=await q('select id from claim_notifications($1,20)',[randomUUID()]);
  assert(first.length>0);assert(!first.some(a=>second.some(b=>a.id===b.id)));
 });
 await test('Una referencia histórica manipulada no abre Storage ajeno',async()=>{
  const path=pat2+'/'+randomUUID();
  await q("insert into storage.objects(bucket_id,name) values('files',$1)",[path]);
  // El caso previo se modela retirando SOLO el trigger de validación de metadatos.
  await db.exec('alter table documents disable trigger documents_file_reference');
  try { await q("insert into documents(professional_id,patient_id,title,storage_path,shared_with_patient) values($1,$2,'Ficticio',$3,true)",[pro1,pat1,path]); }
  finally { await db.exec('alter table documents enable trigger documents_file_reference'); }
  await user(patUid1,async()=>assert.equal((await q('select name from storage.objects where name=$1',[path])).length,0));
 });
 await test('Confirmación de subida y limpieza son transaccionales',()=>user(uid1,async()=>{
  const path=pat1+'/'+randomUUID();
  await q("insert into pending_uploads(path,bucket,professional_id,patient_id,size_bytes,mime) values($1,'files',$2,$3,10,'application/pdf')",[path,pro1,pat1]);
  const doc=(await q("insert into documents(professional_id,patient_id,title,storage_path) values($1,$2,'Ficticio',$3) returning id",[pro1,pat1,path]))[0].id;
  assert.equal((await q('select * from pending_uploads where path=$1',[path])).length,0);
  await q('delete from documents where id=$1',[doc]);
 }));
 await test('Escrituras directas no desajustan la contabilidad',()=>user(uid1,async()=>{
  await assert.rejects(q("update appointments set attendance='attended' where id=$1",[appt1]));
  await assert.rejects(q('delete from appointments where id=$1',[appt1]));
  await assert.rejects(q('update session_packs set used_sessions=4 where id=$1',[pack]));
  await assert.rejects(q('delete from gastos where id=$1',[gasto]));
  await assert.rejects(q('update bienes_inversion set valor_adquisicion_cents=1 where gasto_id=$1',[gasto]));
  await assert.rejects(q("update payments set fiscal_snapshot='{}' where session_pack_id=$1",[pack]));
 }));
 await test('Tarea completada con reintentos idempotentes y sin escritura directa',async()=>{
  const task=(await q("insert into tasks(professional_id,patient_id,title) values($1,$2,'Ficticia') returning id",[pro1,pat1]))[0].id;
  await user(patUid1,async()=>{
   const first=(await q("select complete_patient_task($1,'Hecha') id",[task]))[0].id;
   assert.equal((await q("select complete_patient_task($1,'Reintento') id",[task]))[0].id,first);
   await assert.rejects(q('insert into task_completions(task_id,patient_id) values($1,$2)',[task,pat1]));
  });
  await user(patUid2,()=>assert.rejects(q('select complete_patient_task($1,null)',[task])));
 });
 await test('Gasto conserva IVA histórico y permite confirmación explícita',()=>user(uid1,async()=>{
  await q("update configuracion_fiscal set situacion_iva='sujeta' where professional_id=$1",[pro1]);
  await q('select save_expense($1,$2,false)',[gasto,payload]);
  assert.equal((await q('select iva_recuperable_pct from gastos where id=$1',[gasto]))[0].iva_recuperable_pct,0);
  assert.equal((await q('select valor_adquisicion_cents from bienes_inversion where gasto_id=$1',[gasto]))[0].valor_adquisicion_cents,60500);
  await q('select save_expense($1,$2,false)',[gasto,{...payload,iva_recuperable_pct:100}]);
  assert.equal((await q('select valor_adquisicion_cents from bienes_inversion where gasto_id=$1',[gasto]))[0].valor_adquisicion_cents,50000);
 }));
 await test('El contenido firmado no se reescribe en la misma versión',()=>user(uid1,()=>assert.rejects(q("update consent_templates set body='Texto sustituido' where professional_id=$1",[pro1]))));
 await test('Un hash histórico incorrecto no sirve como consentimiento',async()=>{
  const template=(await q('select id from consent_templates where professional_id=$1 order by version desc limit 1',[pro1]))[0].id;
  const original=(await q('select content_hash from consents where patient_id=$1 and template_id=$2',[pat1,template]))[0].content_hash;
  await q("update consents set content_hash='invalido' where patient_id=$1 and template_id=$2",[pat1,template]);
  await user(patUid1,async()=>assert.equal((await q('select has_current_consent() ok'))[0].ok,false));
  await q('update consents set content_hash=$1 where patient_id=$2 and template_id=$3',[original,pat1,template]);
 });
 await test('Profesional desactivado pierde su ámbito',async()=>{
  await q('update professionals set deleted_at=now() where id=$1',[pro1]);
  await user(uid1,async()=>{
   assert.equal((await q('select current_professional_id() id'))[0].id,null);
   assert.equal((await q('select id from patients')).length,0);
   await assert.rejects(q('update professionals set deleted_at=null where id=$1',[pro1]));
  });
  await q('update professionals set deleted_at=null where id=$1',[pro1]);
 });
 return passed;
}
