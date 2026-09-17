import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
export async function sqlRegressions(db) {
 let passed=0;
 const q=async(sql,args=[]) => (await db.query(sql,args)).rows;
 const test=async(name,fn)=>{try{await fn();passed++;}catch(e){throw new Error(name+': '+e.message,{cause:e});}};
 const user=async(id,fn)=>{
  await q("select set_config('request.jwt.claim.sub',$1,false)",[id]);
  await db.exec('set role authenticated');
  try{return await fn();}finally{await db.exec('reset role');await q("select set_config('request.jwt.claim.sub','',false)");}
 };
 await test('Admin API aprovisiona el profesional al asignar app_metadata después del alta',async()=>{
  const id=randomUUID();
  await q("insert into auth.users(id,email) values($1,'admin-provision@example.invalid')",[id]);
  assert.equal((await q('select count(*)::int n from professionals where user_id=$1',[id]))[0].n,0);
  await q(`update auth.users set raw_app_meta_data=raw_app_meta_data||'{"role":"professional"}'::jsonb where id=$1`,[id]);
  await q(`update auth.users set raw_app_meta_data=raw_app_meta_data||'{"provider":"email"}'::jsonb where id=$1`,[id]);
  assert.equal((await q('select count(*)::int n from professionals where user_id=$1',[id]))[0].n,1);
  assert.equal((await q('select count(*)::int n from consent_templates where professional_id=(select id from professionals where user_id=$1)',[id]))[0].n,1);
 });
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
 await test('Factura, retención y checklist admiten alta, y la ruta sigue validada',()=>user(uid1,async()=>{
  // `guard_ruta_justificante` cuelga de las tres tablas y leía `new.<campo>`
  // como campo de un registro: plpgsql planifica la expresión entera, así que
  // resolvía ramas del CASE que no existen en esa tabla y TODA alta moría con
  // 42703. El libro registro de facturas estuvo inservible desde que se
  // desplegó el expediente fiscal. Corregido en 20260917100001.
  const f=(await q("insert into facturas(professional_id,fecha_emision,base_cents,total_cents) values($1,'2026-01-15',10000,10000) returning id",[pro1]))[0].id;
  const r=(await q("insert into retenciones_pagos_cuenta(professional_id,ejercicio,clase,importe_cents) values($1,2026,'soportada_cliente',5000) returning id",[pro1]))[0].id;
  await q("insert into checklist_personal(professional_id,ejercicio,clave) values($1,2026,'certificado_retenciones')",[pro1]);
  // Y la guarda sigue guardando, que es para lo que está.
  await assert.rejects(q('update facturas set documento_path=$2 where id=$1',[f,randomUUID()+'/ajeno.pdf']));
  await assert.rejects(q('update retenciones_pagos_cuenta set justificante_path=$2 where id=$1',[r,randomUUID()+'/ajeno.pdf']));
  await q('update facturas set documento_path=$2 where id=$1',[f,pro1+'/propio.pdf']);
  assert.equal((await q('select documento_path p from facturas where id=$1',[f]))[0].p,pro1+'/propio.pdf');
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
 // ---- Solicitudes de cita (el paciente pide, el profesional aprueba) -------
 let req1;
 await test('Paciente pide cita y el profesional recibe el aviso',async()=>{
  await user(patUid1,async()=>{
   req1=(await q("select patient_request_appointment('new',now()+interval '10 days',null,50,'Mejor por la tarde') id"))[0].id;
   assert.equal((await q('select status from appointment_requests where id=$1',[req1]))[0].status,'pending');
  });
  // El aviso es del profesional: la RLS impide verlo desde la sesión del paciente.
  const avisos=await q('select user_id from notifications where dedupe_key=$1',['apptreq:'+req1]);
  assert.equal(avisos.length,1);
  assert.equal(avisos[0].user_id,uid1);
 });
 await test('Paciente no fabrica solicitudes por API',()=>user(patUid1,()=>assert.rejects(q("insert into appointment_requests(professional_id,patient_id,kind,preferred_start,status) values($1,$2,'new',now()+interval '11 days','accepted')",[pro1,pat1]))));
 await test('Paciente no resuelve su propia solicitud',()=>user(patUid1,()=>assert.rejects(q("select resolve_appointment_request($1,'accept')",[req1]))));
 await test('Otro profesional ni la ve ni la resuelve',()=>user(uid2,async()=>{
  assert.equal((await q('select id from appointment_requests where id=$1',[req1])).length,0);
  await assert.rejects(q("select resolve_appointment_request($1,'accept')",[req1]));
 }));
 await test('Aceptar crea la cita y cierra la solicitud',()=>user(uid1,async()=>{
  const appt=(await q("select resolve_appointment_request($1,'accept') id",[req1]))[0].id;
  const r=(await q('select status,appointment_id from appointment_requests where id=$1',[req1]))[0];
  assert.equal(r.status,'accepted');
  assert.equal(r.appointment_id,appt);
  assert.equal((await q('select count(*)::int n from appointments where id=$1 and patient_id=$2',[appt,pat1]))[0].n,1);
 }));
 await test('Una solicitud resuelta no se resuelve dos veces',()=>user(uid1,()=>assert.rejects(q("select resolve_appointment_request($1,'accept')",[req1]))));
 let req2;
 await test('El solape impide aceptar y la solicitud sigue pendiente',async()=>{
  await user(patUid1,async()=>{req2=(await q("select patient_request_appointment('new',now()+interval '10 days') id"))[0].id;});
  await user(uid1,async()=>{
   await assert.rejects(q("select resolve_appointment_request($1,'accept')",[req2]));
   assert.equal((await q('select status from appointment_requests where id=$1',[req2]))[0].status,'pending');
  });
 });
 await test('Rechazar cierra la solicitud sin crear cita',()=>user(uid1,async()=>{
  const antes=(await q('select count(*)::int n from appointments where patient_id=$1',[pat1]))[0].n;
  await q("select resolve_appointment_request($1,'decline',null,null,'Ese día no puedo')",[req2]);
  assert.equal((await q('select status from appointment_requests where id=$1',[req2]))[0].status,'declined');
  assert.equal((await q('select count(*)::int n from appointments where patient_id=$1',[pat1]))[0].n,antes);
 }));
 await test('Pedir cambio mueve la cita al aceptar',async()=>{
  const appt=randomUUID();
  await q("insert into appointments(id,professional_id,patient_id,starts_at,ends_at) values($1,$2,$3,now()+interval '30 days',now()+interval '30 days'+interval '1 hour')",[appt,pro1,pat1]);
  let req;
  await user(patUid1,async()=>{req=(await q("select patient_request_appointment('reschedule',now()+interval '31 days',null,50,null,$1) id",[appt]))[0].id;});
  await user(uid1,async()=>{await q("select resolve_appointment_request($1,'accept')",[req]);});
  const movida=(await q('select starts_at from appointments where id=$1',[appt]))[0].starts_at;
  assert.ok(new Date(movida).getTime()>Date.now()+30.5*86400000);
 });
 await test('Pedir anulación cancela la cita al aceptar',async()=>{
  const appt=randomUUID();
  await q("insert into appointments(id,professional_id,patient_id,starts_at,ends_at) values($1,$2,$3,now()+interval '40 days',now()+interval '40 days'+interval '1 hour')",[appt,pro1,pat1]);
  let req;
  await user(patUid1,async()=>{req=(await q("select patient_request_appointment('cancel',null,null,50,null,$1) id",[appt]))[0].id;});
  await user(uid1,async()=>{await q("select resolve_appointment_request($1,'accept')",[req]);});
  assert.equal((await q('select status from appointments where id=$1',[appt]))[0].status,'cancelled');
 });
 await test('No se pide hora en el pasado',()=>user(patUid1,()=>assert.rejects(q("select patient_request_appointment('new',now()-interval '1 day')"))));
 await test('No se pide cambio sobre la cita de otro',()=>user(patUid2,()=>assert.rejects(q("select patient_request_appointment('cancel',null,null,50,null,$1)",[appt1]))));
 await test('Tope de tres solicitudes vivas y retirada',()=>user(patUid1,async()=>{
  for(let i=0;i<3;i++) await q('select patient_request_appointment($1,now()+make_interval(days=>$2))',['new',50+i]);
  await assert.rejects(q("select patient_request_appointment('new',now()+interval '90 days')"));
  const viva=(await q("select id from appointment_requests where patient_id=$1 and status='pending' order by created_at limit 1",[pat1]))[0].id;
  await q('select patient_withdraw_request($1)',[viva]);
  assert.equal((await q('select status from appointment_requests where id=$1',[viva]))[0].status,'withdrawn');
  await q("select patient_request_appointment('new',now()+interval '90 days')");
 }));
 // ===========================================================================
 // Organizaciones, registro profesional, invitaciones y aislamiento entre
 // centros. Cubre la lista de comprobaciones del encargo de septiembre.
 // ===========================================================================
 const sha = (t) => createHash('sha256').update(t).digest('hex');
 const tok = () => 'tok-' + randomUUID();
 // El paciente NUNCA llama a `accept_invitation` directamente: esta cerrada a
 // la API a proposito. El unico camino es `complete_onboarding`, que ensena el
 // consentimiento, comprueba que el texto firmado es el que se mostro y vincula
 // en la misma transaccion.
 const aceptarInvitacion = async (token) => {
  const c = (await q('select get_onboarding_consent($1) c', [token]))[0].c;
  return (await q('select complete_onboarding($1,$2,$3) id', [token, c.id, c.hash]))[0].id;
 };
 const nuevaCuenta = async (correo, rol) => {
  const id = randomUUID();
  await q("insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data) values($1,$2,now(),$3)",
    [id, correo, JSON.stringify(rol ? { role: rol } : {})]);
  return id;
 };

 await test('Cada profesional preexistente queda con su consulta y de propietario', async () => {
  const r = (await q(`select o.kind, m.role, m.status from organization_members m
    join organizations o on o.id=m.organization_id where m.professional_id=$1`, [pro1]))[0];
  assert.equal(r.kind, 'solo'); assert.equal(r.role, 'owner'); assert.equal(r.status, 'active');
 });
 await test('Los expedientes existentes conservan el acceso por asignación', async () => {
  const a = (await q('select role from patient_assignments where patient_id=$1 and professional_id=$2 and revoked_at is null', [pat1, pro1]))[0];
  assert.equal(a.role, 'primary');
  await user(uid1, async () => assert.equal((await q('select id from patients where id=$1', [pat1])).length, 1));
 });
 await test('Las cuentas preexistentes NO quedan marcadas como verificadas', async () => {
  assert.equal((await q('select verification_status s from professionals where id=$1', [pro1]))[0].s, 'provisional');
 });

 // --- Registro profesional -------------------------------------------------
 const regUid = await nuevaCuenta('registro@example.invalid', null);
 let regPro;
 await test('El registro crea perfil pendiente sin conceder el rol profesional', () => user(regUid, async () => {
  regPro = (await q("select register_professional('Nueva Psicologa','center','Centro Aurora','COP Madrid','M-1234') id"))[0].id;
  const p = (await q('select verification_status s, practice_kind k from professionals where id=$1', [regPro]))[0];
  assert.equal(p.s, 'pending'); assert.equal(p.k, 'center');
 }));
 await test('El alta deja la cuenta en professional_pending, no en professional', async () => {
  assert.equal((await q("select raw_app_meta_data->>'role' r from auth.users where id=$1", [regUid]))[0].r, 'professional_pending');
 });
 await test('Reintentar el registro no duplica organizacion ni membresia', async () => {
  await user(regUid, async () => {
   await q("select register_professional('Nueva Psicologa','center','Centro Aurora')");
   await q("select register_professional('Nueva Psicologa','center','Centro Aurora')");
  });
  // Fuera de la sesion: un profesional PENDIENTE no tiene identidad para la
  // RLS todavia (`current_professional_id()` exige el rol ya concedido), asi
  // que la integridad del dato se comprueba como propietario del esquema.
  assert.equal((await q('select count(*)::int n from organization_members where professional_id=$1', [regPro]))[0].n, 1);
  assert.equal((await q('select count(*)::int n from organizations where created_by=$1', [regUid]))[0].n, 1);
  const o = (await q('select o.name,o.kind from organizations o join organization_members m on m.organization_id=o.id where m.professional_id=$1', [regPro]))[0];
  assert.equal(o.name, 'Centro Aurora'); assert.equal(o.kind, 'center');
 });
 await test('Un profesional pendiente puede consultar su propio estado', () => user(regUid, async () => {
  const c = (await q('select my_professional_context() c'))[0].c;
  assert.equal(c.verification_status, 'pending');
  assert.equal(c.organization_name, 'Centro Aurora');
 }));
 const regOrg = (await q('select organization_id o from organization_members where professional_id=$1', [regPro]))[0].o;
 await test('Un profesional pendiente no opera clinicamente ni invita', () => user(regUid, async () => {
  assert.equal((await q('select professional_is_operational() b'))[0].b, false);
  assert.equal((await q('select can_invite_patients($1) b', [regOrg]))[0].b, false);
  await assert.rejects(q('insert into patients(professional_id,full_name) values($1,$2)', [regPro, 'X']));
 }));
 await test('Nadie se autoconcede revision ni acceso beta', () => user(regUid, async () => {
  await assert.rejects(q("select admin_review_professional($1,'approved')", [regPro]));
  await assert.rejects(q("select admin_set_org_access($1,'beta')", [regOrg]));
  await assert.rejects(q('insert into platform_admins(user_id) values($1)', [regUid]));
 }));

 // --- Administracion de plataforma -----------------------------------------
 const adminUid = await nuevaCuenta('admin@example.invalid', null);
 await q('insert into platform_admins(user_id,note) values($1,$2)', [adminUid, 'alta fuera de banda']);
 await test('Aprobar concede el rol profesional', () => user(adminUid, async () => {
  await q("select admin_review_professional($1,'approved','Colegiacion comprobada')", [regPro]);
  assert.equal((await q('select verification_status s from professionals where id=$1', [regPro]))[0].s, 'approved');
 }));
 await test('Aprobar asciende la cuenta a professional', async () => {
  assert.equal((await q("select raw_app_meta_data->>'role' r from auth.users where id=$1", [regUid]))[0].r, 'professional');
 });
 await test('Rechazar retira el rol operativo', async () => {
  await user(adminUid, async () => { await q("select admin_review_professional($1,'rejected','Sin acreditar')", [regPro]); });
  assert.equal((await q("select raw_app_meta_data->>'role' r from auth.users where id=$1", [regUid]))[0].r, 'professional_pending');
  await user(adminUid, async () => { await q("select admin_review_professional($1,'approved')", [regPro]); });
  assert.equal((await q("select raw_app_meta_data->>'role' r from auth.users where id=$1", [regUid]))[0].r, 'professional');
 });
 await test('El acceso beta registra quien lo concedio y cuando', () => user(adminUid, async () => {
  await q("select admin_set_org_access($1,'beta',null,'Centro piloto')", [regOrg]);
  const a = (await q('select status,granted_by,granted_at from organization_access where organization_id=$1', [regOrg]))[0];
  assert.equal(a.status, 'beta'); assert.equal(a.granted_by, adminUid); assert.ok(a.granted_at);
 }));

 // --- Invitacion de profesional a un centro --------------------------------
 const colUid = await nuevaCuenta('colega@example.invalid', null);
 let colPro;
 await user(colUid, async () => { colPro = (await q("select register_professional('Colega','solo') id"))[0].id; });
 await user(adminUid, async () => { await q("select admin_review_professional($1,'approved')", [colPro]); });

 await test('Solo quien administra invita al centro', () => user(colUid, () => assert.rejects(
   q("select issue_professional_invitation($1,'x@example.invalid',$2)", [regOrg, sha('otro')]))));

 const orgTok = tok();
 let orgInv;
 await test('La invitacion al centro se emite y se previsualiza sin consumirse', async () => {
  await user(regUid, async () => {
   orgInv = (await q("select issue_professional_invitation($1,'colega@example.invalid',$2,'member') id", [regOrg, sha(orgTok)]))[0].id;
  });
  const p = (await q('select * from professional_invitation_preview($1)', [orgTok]))[0];
  assert.equal(p.organization_name, 'Centro Aurora');
  assert.equal((await q('select accepted_at from professional_invitations where id=$1', [orgInv]))[0].accepted_at, null);
 });
 await test('El unico propietario no puede degradarse a si mismo', () => user(regUid, async () => {
  const miembro = (await q('select id from organization_members where organization_id=$1 and professional_id=$2', [regOrg, regPro]))[0].id;
  await assert.rejects(q("select set_member_permissions($1,'admin',true)", [miembro]));
 }));
 await test('Aceptar anade membresia al centro existente, sin crear otro', async () => {
  // El recuento va fuera de la sesion: dentro, la RLS solo ensena las
  // organizaciones del propio usuario y el numero cambiaria por verse mas, no
  // por haberse creado ninguna.
  const n0 = (await q('select count(*)::int n from organizations'))[0].n;
  await user(colUid, async () => {
   const org = (await q('select accept_professional_invitation($1) o', [orgTok]))[0].o;
   assert.equal(org, regOrg);
  });
  assert.equal((await q('select count(*)::int n from organizations'))[0].n, n0);
  assert.equal((await q("select count(*)::int n from organization_members where organization_id=$1 and professional_id=$2 and status='active'", [regOrg, colPro]))[0].n, 1);
 });
 await test('El token del centro es de un solo uso', () => user(colUid, () => assert.rejects(
   q('select accept_professional_invitation($1)', [orgTok]))));
 await test('Un administrador no puede invitar a nadie como propietario', async () => {
  // El colega ya es miembro: se le asciende a administrador y se comprueba que
  // desde ahi no puede repartir la propiedad del centro.
  await user(regUid, async () => {
   const m = (await q('select id from organization_members where organization_id=$1 and professional_id=$2', [regOrg, colPro]))[0].id;
   await q("select set_member_permissions($1,'admin',true)", [m]);
  });
  await user(colUid, () => assert.rejects(
    q("select issue_professional_invitation($1,'jefe@example.invalid',$2,'owner')", [regOrg, sha('jefe')])));
  // Y como administrador si puede invitar a un miembro normal.
  await user(colUid, async () => {
   await q("select issue_professional_invitation($1,'otromiembro@example.invalid',$2,'member')", [regOrg, sha(tok())]);
  });
 });
 await test('Aceptar con otro correo se rechaza', async () => {
  const t = tok();
  await user(regUid, async () => { await q("select issue_professional_invitation($1,'nadie@example.invalid',$2)", [regOrg, sha(t)]); });
  await user(colUid, () => assert.rejects(q('select accept_professional_invitation($1)', [t])));
 });

 // --- Acceso clinico: pertenecer al centro no basta -------------------------
 let centroPat;
 await user(regUid, async () => {
  centroPat = (await q("insert into patients(professional_id,full_name,email) values($1,'Paciente del centro','pc@example.invalid') returning id", [regPro]))[0].id;
 });
 await test('Pertenecer al centro NO da acceso a sus expedientes', () => user(colUid, async () => {
  assert.equal((await q('select id from patients where id=$1', [centroPat])).length, 0);
 }));
 await test('Asignar concede acceso y revocar la membresia lo retira', async () => {
  await user(regUid, async () => { await q('select assign_patient($1,$2)', [centroPat, colPro]); });
  await user(colUid, async () => assert.equal((await q('select id from patients where id=$1', [centroPat])).length, 1));
  await user(regUid, async () => {
   await q('select revoke_member((select id from organization_members where organization_id=$1 and professional_id=$2))', [regOrg, colPro]);
  });
  await user(colUid, async () => assert.equal((await q('select id from patients where id=$1', [centroPat])).length, 0));
 });
 await test('No se retira al profesional de referencia', () => user(regUid, () => assert.rejects(
   q('select unassign_patient($1,$2)', [centroPat, regPro]))));
 await test('La organizacion no se queda sin propietario', () => user(regUid, () => assert.rejects(
   q('select revoke_member((select id from organization_members where organization_id=$1 and professional_id=$2))', [regOrg, regPro]))));

 // --- Invitacion del paciente ----------------------------------------------
 const patTok = tok();
 let patInv;
 await test('Reemitir revoca los enlaces anteriores que siguieran vivos', () => user(regUid, async () => {
  await q('select * from issue_invitation($1,$2)', [centroPat, sha(tok())]);
  const r = (await q('select * from issue_invitation($1,$2)', [centroPat, sha(patTok)]))[0];
  patInv = r.invitation_id;
  assert.equal((await q('select count(*)::int n from invitations where patient_id=$1 and revoked_at is not null', [centroPat]))[0].n, 1);
  assert.equal(r.recipient, 'pc@example.invalid');
 }));
 await test('La vista previa dice que centro invita y NO consume el token', async () => {
  const p = (await q('select * from invitation_preview($1)', [patTok]))[0];
  assert.equal(p.organization_name, 'Centro Aurora');
  assert.equal(p.professional_name, null);
  assert.equal((await q('select accepted_at from invitations where id=$1', [patInv]))[0].accepted_at, null);
 });
 const pacUid = await nuevaCuenta('pc@example.invalid', 'patient');
 const otroUid = await nuevaCuenta('otro@example.invalid', 'patient');
 await test('No se acepta con un correo distinto al invitado', () => user(otroUid, () => assert.rejects(
   aceptarInvitacion(patTok))));
 await test('Aceptar vincula la cuenta al expediente existente, sin crear otro', async () => {
  const n0 = (await q('select count(*)::int n from patients'))[0].n;
  await user(pacUid, async () => { await aceptarInvitacion(patTok); });
  // Fuera de la sesion: hasta firmar el consentimiento la RLS no le ensena el
  // expediente, asi que el recuento dentro no diria nada util.
  assert.equal((await q('select count(*)::int n from patients'))[0].n, n0);
  assert.equal((await q('select user_id from patients where id=$1', [centroPat]))[0].user_id, pacUid);
 });
 await test('El token del paciente es de un solo uso', () => user(pacUid, async () => {
  // La invitacion ya esta aceptada: la vista previa no la reconoce y el
  // consentimiento ya no se puede obtener con ese token.
  assert.equal((await q('select * from invitation_preview($1)', [patTok])).length, 0);
 }));
 await test('Una invitacion revocada no vincula', async () => {
  const t = tok();
  let id;
  await user(regUid, async () => {
   id = (await q('select * from issue_invitation($1,$2,$3)', [centroPat, sha(t), 'nuevo@example.invalid']))[0].invitation_id;
   await q('select revoke_invitation($1)', [id]);
  });
  const nuevoUid = await nuevaCuenta('nuevo@example.invalid', 'patient');
  await user(nuevoUid, () => assert.rejects(aceptarInvitacion(t)));
 });
 await test('Una invitacion caducada no vincula ni se previsualiza', async () => {
  const t = tok();
  await user(regUid, async () => { await q('select * from issue_invitation($1,$2,$3)', [centroPat, sha(t), 'tarde@example.invalid']); });
  await q("update invitations set expires_at=now()-interval '1 hour' where token_hash=$1", [sha(t)]);
  const tardeUid = await nuevaCuenta('tarde@example.invalid', 'patient');
  await user(tardeUid, () => assert.rejects(aceptarInvitacion(t)));
  assert.equal((await q('select * from invitation_preview($1)', [t])).length, 0);
 });
 await test('Sin invitacion no hay alta publica de pacientes', () => user(otroUid, async () => {
  await assert.rejects(q("insert into patients(professional_id,full_name) values($1,'Yo mismo')", [regPro]));
  assert.equal((await q('select id from patients')).length, 0);
 }));

 // --- Expedientes en centros distintos, separados --------------------------
 await test('La misma persona tiene expedientes separados en dos centros', async () => {
  let otroCentroPat;
  await user(uid1, async () => {
   otroCentroPat = (await q("insert into patients(professional_id,full_name,email) values($1,'Paciente del centro','pc@example.invalid') returning id", [pro1]))[0].id;
  });
  const t = tok();
  await user(uid1, async () => { await q('select * from issue_invitation($1,$2)', [otroCentroPat, sha(t)]); });
  await user(pacUid, async () => { await aceptarInvitacion(t); });
  // Fuera de la sesion: los dos expedientes existen y estan en centros
  // distintos. Sin fusionarse y sin que ninguno pise al otro.
  const orgs = (await q('select distinct organization_id o from patients where user_id=$1', [pacUid])).map((r) => r.o);
  assert.equal(orgs.length, 2);
  assert.equal((await q('select count(*)::int n from consents c join patients p on p.id=c.patient_id where p.user_id=$1', [pacUid]))[0].n, 2);
  // Y ninguno de los dos profesionales ve el expediente del otro centro.
  await user(regUid, async () => assert.equal((await q('select id from patients where id=$1', [otroCentroPat])).length, 0));
  await user(uid1, async () => assert.equal((await q('select id from patients where id=$1', [centroPat])).length, 0));
 });

 return passed;
}
