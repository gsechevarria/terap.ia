// Generado con npm run gen:types:embedded. Validar además contra Supabase aislado.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
export type Database = { __InternalSupabase: { PostgrestVersion: "14.5" }; public: {
Tables: {
"actividades_fiscales": {
Row: {
"id": string;
"professional_id": string;
"epigrafe_iae": string;
"descripcion": string | null;
"situacion_iva": string | null;
"fecha_alta": string | null;
"fecha_baja": string | null;
"censal_path": string | null;
"principal": boolean;
"created_at": string;
};
Insert: {
"id"?: string;
"professional_id": string;
"epigrafe_iae": string;
"descripcion"?: string | null;
"situacion_iva"?: string | null;
"fecha_alta"?: string | null;
"fecha_baja"?: string | null;
"censal_path"?: string | null;
"principal"?: boolean;
"created_at"?: string;
};
Update: {
"id"?: string;
"professional_id"?: string;
"epigrafe_iae"?: string;
"descripcion"?: string | null;
"situacion_iva"?: string | null;
"fecha_alta"?: string | null;
"fecha_baja"?: string | null;
"censal_path"?: string | null;
"principal"?: boolean;
"created_at"?: string;
};
Relationships: [{ foreignKeyName: "actividades_fiscales_professional_id_fkey"; columns: ["professional_id"]; isOneToOne: false; referencedRelation: "professionals"; referencedColumns: ["id"] }];
};
"agenda_blocks": {
Row: {
"id": string;
"professional_id": string;
"starts_at": string;
"ends_at": string;
"reason": string | null;
"created_at": string;
};
Insert: {
"id"?: string;
"professional_id": string;
"starts_at": string;
"ends_at": string;
"reason"?: string | null;
"created_at"?: string;
};
Update: {
"id"?: string;
"professional_id"?: string;
"starts_at"?: string;
"ends_at"?: string;
"reason"?: string | null;
"created_at"?: string;
};
Relationships: [{ foreignKeyName: "agenda_blocks_professional_id_fkey"; columns: ["professional_id"]; isOneToOne: false; referencedRelation: "professionals"; referencedColumns: ["id"] }];
};
"appointment_requests": {
Row: {
"id": string;
"professional_id": string;
"patient_id": string;
"appointment_id": string | null;
"kind": Database["public"]["Enums"]["appointment_request_kind"];
"preferred_start": string | null;
"alt_start": string | null;
"duration_min": number;
"note": string | null;
"status": Database["public"]["Enums"]["appointment_request_status"];
"resolution_note": string | null;
"resolved_at": string | null;
"created_at": string;
};
Insert: {
"id"?: string;
"professional_id": string;
"patient_id": string;
"appointment_id"?: string | null;
"kind": Database["public"]["Enums"]["appointment_request_kind"];
"preferred_start"?: string | null;
"alt_start"?: string | null;
"duration_min"?: number;
"note"?: string | null;
"status"?: Database["public"]["Enums"]["appointment_request_status"];
"resolution_note"?: string | null;
"resolved_at"?: string | null;
"created_at"?: string;
};
Update: {
"id"?: string;
"professional_id"?: string;
"patient_id"?: string;
"appointment_id"?: string | null;
"kind"?: Database["public"]["Enums"]["appointment_request_kind"];
"preferred_start"?: string | null;
"alt_start"?: string | null;
"duration_min"?: number;
"note"?: string | null;
"status"?: Database["public"]["Enums"]["appointment_request_status"];
"resolution_note"?: string | null;
"resolved_at"?: string | null;
"created_at"?: string;
};
Relationships: [{ foreignKeyName: "appointment_requests_appointment_id_fkey"; columns: ["appointment_id"]; isOneToOne: false; referencedRelation: "appointments"; referencedColumns: ["id"] },{ foreignKeyName: "appointment_requests_patient_id_fkey"; columns: ["patient_id"]; isOneToOne: false; referencedRelation: "patients"; referencedColumns: ["id"] },{ foreignKeyName: "appointment_requests_professional_id_fkey"; columns: ["professional_id"]; isOneToOne: false; referencedRelation: "professionals"; referencedColumns: ["id"] }];
};
"appointments": {
Row: {
"id": string;
"professional_id": string;
"patient_id": string;
"starts_at": string;
"ends_at": string;
"status": Database["public"]["Enums"]["appointment_status"];
"attendance": Database["public"]["Enums"]["attendance_status"];
"video_link": string | null;
"recurrence_freq": Database["public"]["Enums"]["recurrence_freq"];
"recurrence_until": string | null;
"parent_appointment_id": string | null;
"notes": string | null;
"created_at": string;
"updated_at": string;
};
Insert: {
"id"?: string;
"professional_id": string;
"patient_id": string;
"starts_at": string;
"ends_at": string;
"status"?: Database["public"]["Enums"]["appointment_status"];
"attendance"?: Database["public"]["Enums"]["attendance_status"];
"video_link"?: string | null;
"recurrence_freq"?: Database["public"]["Enums"]["recurrence_freq"];
"recurrence_until"?: string | null;
"parent_appointment_id"?: string | null;
"notes"?: string | null;
"created_at"?: string;
"updated_at"?: string;
};
Update: {
"id"?: string;
"professional_id"?: string;
"patient_id"?: string;
"starts_at"?: string;
"ends_at"?: string;
"status"?: Database["public"]["Enums"]["appointment_status"];
"attendance"?: Database["public"]["Enums"]["attendance_status"];
"video_link"?: string | null;
"recurrence_freq"?: Database["public"]["Enums"]["recurrence_freq"];
"recurrence_until"?: string | null;
"parent_appointment_id"?: string | null;
"notes"?: string | null;
"created_at"?: string;
"updated_at"?: string;
};
Relationships: [{ foreignKeyName: "appointments_parent_appointment_id_fkey"; columns: ["parent_appointment_id"]; isOneToOne: false; referencedRelation: "appointments"; referencedColumns: ["id"] },{ foreignKeyName: "appointments_patient_id_fkey"; columns: ["patient_id"]; isOneToOne: false; referencedRelation: "patients"; referencedColumns: ["id"] },{ foreignKeyName: "appointments_professional_id_fkey"; columns: ["professional_id"]; isOneToOne: false; referencedRelation: "professionals"; referencedColumns: ["id"] }];
};
"audit_log": {
Row: {
"id": number;
"occurred_at": string;
"actor_user_id": string | null;
"organization_id": string | null;
"action": string;
"subject_type": string | null;
"subject_id": string | null;
"metadata": Json;
};
Insert: {
"id": number;
"occurred_at"?: string;
"actor_user_id"?: string | null;
"organization_id"?: string | null;
"action": string;
"subject_type"?: string | null;
"subject_id"?: string | null;
"metadata"?: Json;
};
Update: {
"id"?: number;
"occurred_at"?: string;
"actor_user_id"?: string | null;
"organization_id"?: string | null;
"action"?: string;
"subject_type"?: string | null;
"subject_id"?: string | null;
"metadata"?: Json;
};
Relationships: [];
};
"bienes_inversion": {
Row: {
"id": string;
"professional_id": string;
"gasto_id": string | null;
"descripcion": string;
"fecha_adquisicion": string;
"valor_adquisicion_cents": number;
"porcentaje_amortizacion": number;
"anios_amortizacion": number | null;
"created_at": string;
"fiscal_review_required": boolean;
};
Insert: {
"id"?: string;
"professional_id": string;
"gasto_id"?: string | null;
"descripcion": string;
"fecha_adquisicion": string;
"valor_adquisicion_cents": number;
"porcentaje_amortizacion": number;
"anios_amortizacion"?: number | null;
"created_at"?: string;
"fiscal_review_required"?: boolean;
};
Update: {
"id"?: string;
"professional_id"?: string;
"gasto_id"?: string | null;
"descripcion"?: string;
"fecha_adquisicion"?: string;
"valor_adquisicion_cents"?: number;
"porcentaje_amortizacion"?: number;
"anios_amortizacion"?: number | null;
"created_at"?: string;
"fiscal_review_required"?: boolean;
};
Relationships: [{ foreignKeyName: "bienes_gasto_owner_fk"; columns: ["gasto_id","professional_id"]; isOneToOne: false; referencedRelation: "gastos"; referencedColumns: ["id","professional_id"] },{ foreignKeyName: "bienes_inversion_gasto_id_fkey"; columns: ["gasto_id"]; isOneToOne: false; referencedRelation: "gastos"; referencedColumns: ["id"] },{ foreignKeyName: "bienes_inversion_professional_id_fkey"; columns: ["professional_id"]; isOneToOne: false; referencedRelation: "professionals"; referencedColumns: ["id"] }];
};
"checklist_personal": {
Row: {
"id": string;
"professional_id": string;
"ejercicio": number;
"clave": string;
"aplica": boolean | null;
"aportado": boolean;
"documento_path": string | null;
"notas": string | null;
"updated_at": string;
};
Insert: {
"id"?: string;
"professional_id": string;
"ejercicio": number;
"clave": string;
"aplica"?: boolean | null;
"aportado"?: boolean;
"documento_path"?: string | null;
"notas"?: string | null;
"updated_at"?: string;
};
Update: {
"id"?: string;
"professional_id"?: string;
"ejercicio"?: number;
"clave"?: string;
"aplica"?: boolean | null;
"aportado"?: boolean;
"documento_path"?: string | null;
"notas"?: string | null;
"updated_at"?: string;
};
Relationships: [{ foreignKeyName: "checklist_personal_professional_id_fkey"; columns: ["professional_id"]; isOneToOne: false; referencedRelation: "professionals"; referencedColumns: ["id"] }];
};
"configuracion_fiscal": {
Row: {
"id": string;
"professional_id": string;
"regimen": string;
"situacion_iva": string;
"epigrafe_iae": string | null;
"fecha_alta_actividad": string | null;
"aplica_retencion_default": boolean;
"created_at": string;
"updated_at": string;
"tipo_iva_repercutido": number;
"prorrata_iva_pct": number | null;
"territorio": Database["public"]["Enums"]["territorio_fiscal"];
"territorio_confirmado": boolean;
"comunidad_autonoma": string | null;
"criterio_imputacion": Database["public"]["Enums"]["criterio_imputacion"] | null;
"criterio_evidencia_path": string | null;
"fecha_baja_actividad": string | null;
"tiene_empleados": boolean | null;
"tiene_colaboradores": boolean | null;
"tiene_alquileres": boolean | null;
"operaciones_internacionales": boolean | null;
"tipo_consulta": string | null;
"vivienda_m2_totales": number | null;
"vivienda_m2_afectos": number | null;
};
Insert: {
"id"?: string;
"professional_id": string;
"regimen"?: string;
"situacion_iva"?: string;
"epigrafe_iae"?: string | null;
"fecha_alta_actividad"?: string | null;
"aplica_retencion_default"?: boolean;
"created_at"?: string;
"updated_at"?: string;
"tipo_iva_repercutido"?: number;
"prorrata_iva_pct"?: number | null;
"territorio"?: Database["public"]["Enums"]["territorio_fiscal"];
"territorio_confirmado"?: boolean;
"comunidad_autonoma"?: string | null;
"criterio_imputacion"?: Database["public"]["Enums"]["criterio_imputacion"] | null;
"criterio_evidencia_path"?: string | null;
"fecha_baja_actividad"?: string | null;
"tiene_empleados"?: boolean | null;
"tiene_colaboradores"?: boolean | null;
"tiene_alquileres"?: boolean | null;
"operaciones_internacionales"?: boolean | null;
"tipo_consulta"?: string | null;
"vivienda_m2_totales"?: number | null;
"vivienda_m2_afectos"?: number | null;
};
Update: {
"id"?: string;
"professional_id"?: string;
"regimen"?: string;
"situacion_iva"?: string;
"epigrafe_iae"?: string | null;
"fecha_alta_actividad"?: string | null;
"aplica_retencion_default"?: boolean;
"created_at"?: string;
"updated_at"?: string;
"tipo_iva_repercutido"?: number;
"prorrata_iva_pct"?: number | null;
"territorio"?: Database["public"]["Enums"]["territorio_fiscal"];
"territorio_confirmado"?: boolean;
"comunidad_autonoma"?: string | null;
"criterio_imputacion"?: Database["public"]["Enums"]["criterio_imputacion"] | null;
"criterio_evidencia_path"?: string | null;
"fecha_baja_actividad"?: string | null;
"tiene_empleados"?: boolean | null;
"tiene_colaboradores"?: boolean | null;
"tiene_alquileres"?: boolean | null;
"operaciones_internacionales"?: boolean | null;
"tipo_consulta"?: string | null;
"vivienda_m2_totales"?: number | null;
"vivienda_m2_afectos"?: number | null;
};
Relationships: [{ foreignKeyName: "configuracion_fiscal_professional_id_fkey"; columns: ["professional_id"]; isOneToOne: false; referencedRelation: "professionals"; referencedColumns: ["id"] }];
};
"consent_templates": {
Row: {
"id": string;
"professional_id": string;
"title": string;
"body": string;
"version": number;
"active": boolean;
"created_at": string;
"updated_at": string;
};
Insert: {
"id"?: string;
"professional_id": string;
"title": string;
"body": string;
"version"?: number;
"active"?: boolean;
"created_at"?: string;
"updated_at"?: string;
};
Update: {
"id"?: string;
"professional_id"?: string;
"title"?: string;
"body"?: string;
"version"?: number;
"active"?: boolean;
"created_at"?: string;
"updated_at"?: string;
};
Relationships: [{ foreignKeyName: "consent_templates_professional_id_fkey"; columns: ["professional_id"]; isOneToOne: false; referencedRelation: "professionals"; referencedColumns: ["id"] }];
};
"consents": {
Row: {
"id": string;
"professional_id": string;
"patient_id": string;
"template_id": string | null;
"template_version": number | null;
"accepted": boolean;
"content_hash": string | null;
"signed_at": string | null;
"created_at": string;
"content_body": string | null;
};
Insert: {
"id"?: string;
"professional_id": string;
"patient_id": string;
"template_id"?: string | null;
"template_version"?: number | null;
"accepted"?: boolean;
"content_hash"?: string | null;
"signed_at"?: string | null;
"created_at"?: string;
"content_body"?: string | null;
};
Update: {
"id"?: string;
"professional_id"?: string;
"patient_id"?: string;
"template_id"?: string | null;
"template_version"?: number | null;
"accepted"?: boolean;
"content_hash"?: string | null;
"signed_at"?: string | null;
"created_at"?: string;
"content_body"?: string | null;
};
Relationships: [{ foreignKeyName: "consents_patient_id_fkey"; columns: ["patient_id"]; isOneToOne: false; referencedRelation: "patients"; referencedColumns: ["id"] },{ foreignKeyName: "consents_professional_id_fkey"; columns: ["professional_id"]; isOneToOne: false; referencedRelation: "professionals"; referencedColumns: ["id"] },{ foreignKeyName: "consents_template_id_fkey"; columns: ["template_id"]; isOneToOne: false; referencedRelation: "consent_templates"; referencedColumns: ["id"] }];
};
"device_push_tokens": {
Row: {
"id": string;
"user_id": string;
"platform": string;
"token": string;
"created_at": string;
};
Insert: {
"id"?: string;
"user_id": string;
"platform": string;
"token": string;
"created_at"?: string;
};
Update: {
"id"?: string;
"user_id"?: string;
"platform"?: string;
"token"?: string;
"created_at"?: string;
};
Relationships: [];
};
"documents": {
Row: {
"id": string;
"professional_id": string;
"patient_id": string;
"title": string | null;
"storage_path": string;
"uploaded_by": string | null;
"created_at": string;
"shared_with_patient": boolean;
};
Insert: {
"id"?: string;
"professional_id": string;
"patient_id": string;
"title"?: string | null;
"storage_path": string;
"uploaded_by"?: string | null;
"created_at"?: string;
"shared_with_patient"?: boolean;
};
Update: {
"id"?: string;
"professional_id"?: string;
"patient_id"?: string;
"title"?: string | null;
"storage_path"?: string;
"uploaded_by"?: string | null;
"created_at"?: string;
"shared_with_patient"?: boolean;
};
Relationships: [{ foreignKeyName: "documents_patient_id_fkey"; columns: ["patient_id"]; isOneToOne: false; referencedRelation: "patients"; referencedColumns: ["id"] },{ foreignKeyName: "documents_professional_id_fkey"; columns: ["professional_id"]; isOneToOne: false; referencedRelation: "professionals"; referencedColumns: ["id"] }];
};
"email_deliveries": {
Row: {
"id": string;
"to_email": string;
"template": string;
"subject_type": string | null;
"subject_id": string | null;
"organization_id": string | null;
"status": Database["public"]["Enums"]["email_delivery_status"];
"provider_id": string | null;
"error": string | null;
"attempts": number;
"payload": Json;
"created_at": string;
"sent_at": string | null;
};
Insert: {
"id"?: string;
"to_email": string;
"template": string;
"subject_type"?: string | null;
"subject_id"?: string | null;
"organization_id"?: string | null;
"status"?: Database["public"]["Enums"]["email_delivery_status"];
"provider_id"?: string | null;
"error"?: string | null;
"attempts"?: number;
"payload"?: Json;
"created_at"?: string;
"sent_at"?: string | null;
};
Update: {
"id"?: string;
"to_email"?: string;
"template"?: string;
"subject_type"?: string | null;
"subject_id"?: string | null;
"organization_id"?: string | null;
"status"?: Database["public"]["Enums"]["email_delivery_status"];
"provider_id"?: string | null;
"error"?: string | null;
"attempts"?: number;
"payload"?: Json;
"created_at"?: string;
"sent_at"?: string | null;
};
Relationships: [{ foreignKeyName: "email_deliveries_organization_id_fkey"; columns: ["organization_id"]; isOneToOne: false; referencedRelation: "organizations"; referencedColumns: ["id"] }];
};
"emergency_links": {
Row: {
"id": string;
"professional_id": string | null;
"label": string;
"phone": string | null;
"url": string | null;
"description": string | null;
"sort_order": number;
"created_at": string;
"updated_at": string;
};
Insert: {
"id"?: string;
"professional_id"?: string | null;
"label": string;
"phone"?: string | null;
"url"?: string | null;
"description"?: string | null;
"sort_order"?: number;
"created_at"?: string;
"updated_at"?: string;
};
Update: {
"id"?: string;
"professional_id"?: string | null;
"label"?: string;
"phone"?: string | null;
"url"?: string | null;
"description"?: string | null;
"sort_order"?: number;
"created_at"?: string;
"updated_at"?: string;
};
Relationships: [{ foreignKeyName: "emergency_links_professional_id_fkey"; columns: ["professional_id"]; isOneToOne: false; referencedRelation: "professionals"; referencedColumns: ["id"] }];
};
"expediente_documentos": {
Row: {
"id": string;
"expediente_id": string;
"bucket": string;
"path": string;
"titulo": string | null;
"referencia_tipo": string | null;
"referencia_id": string | null;
"created_at": string;
};
Insert: {
"id"?: string;
"expediente_id": string;
"bucket"?: string;
"path": string;
"titulo"?: string | null;
"referencia_tipo"?: string | null;
"referencia_id"?: string | null;
"created_at"?: string;
};
Update: {
"id"?: string;
"expediente_id"?: string;
"bucket"?: string;
"path"?: string;
"titulo"?: string | null;
"referencia_tipo"?: string | null;
"referencia_id"?: string | null;
"created_at"?: string;
};
Relationships: [{ foreignKeyName: "expediente_documentos_expediente_id_fkey"; columns: ["expediente_id"]; isOneToOne: false; referencedRelation: "expedientes_fiscales"; referencedColumns: ["id"] }];
};
"expedientes_fiscales": {
Row: {
"id": string;
"professional_id": string;
"ejercicio": number;
"estado": Database["public"]["Enums"]["estado_expediente"];
"territorio": Database["public"]["Enums"]["territorio_fiscal"] | null;
"revisado_por": string | null;
"revisado_at": string | null;
"nota_gestor": string | null;
"created_at": string;
"updated_at": string;
};
Insert: {
"id"?: string;
"professional_id": string;
"ejercicio": number;
"estado"?: Database["public"]["Enums"]["estado_expediente"];
"territorio"?: Database["public"]["Enums"]["territorio_fiscal"] | null;
"revisado_por"?: string | null;
"revisado_at"?: string | null;
"nota_gestor"?: string | null;
"created_at"?: string;
"updated_at"?: string;
};
Update: {
"id"?: string;
"professional_id"?: string;
"ejercicio"?: number;
"estado"?: Database["public"]["Enums"]["estado_expediente"];
"territorio"?: Database["public"]["Enums"]["territorio_fiscal"] | null;
"revisado_por"?: string | null;
"revisado_at"?: string | null;
"nota_gestor"?: string | null;
"created_at"?: string;
"updated_at"?: string;
};
Relationships: [{ foreignKeyName: "expedientes_fiscales_professional_id_fkey"; columns: ["professional_id"]; isOneToOne: false; referencedRelation: "professionals"; referencedColumns: ["id"] }];
};
"factura_cobros": {
Row: {
"id": string;
"factura_id": string;
"payment_id": string | null;
"fecha": string;
"importe_cents": number;
"created_at": string;
};
Insert: {
"id"?: string;
"factura_id": string;
"payment_id"?: string | null;
"fecha": string;
"importe_cents": number;
"created_at"?: string;
};
Update: {
"id"?: string;
"factura_id"?: string;
"payment_id"?: string | null;
"fecha"?: string;
"importe_cents"?: number;
"created_at"?: string;
};
Relationships: [{ foreignKeyName: "factura_cobros_factura_id_fkey"; columns: ["factura_id"]; isOneToOne: false; referencedRelation: "facturas"; referencedColumns: ["id"] },{ foreignKeyName: "factura_cobros_payment_id_fkey"; columns: ["payment_id"]; isOneToOne: false; referencedRelation: "payments"; referencedColumns: ["id"] }];
};
"facturas": {
Row: {
"id": string;
"professional_id": string;
"serie": string | null;
"numero": string | null;
"tipo": Database["public"]["Enums"]["tipo_factura"];
"rectifica_a": string | null;
"fecha_emision": string;
"fecha_operacion": string | null;
"ejercicio_imputacion": number | null;
"criterio_imputacion": Database["public"]["Enums"]["criterio_imputacion"] | null;
"patient_id": string | null;
"destinatario_nombre": string | null;
"destinatario_nif": string | null;
"destinatario_tipo": Database["public"]["Enums"]["tipo_destinatario"] | null;
"categoria_servicio": Database["public"]["Enums"]["categoria_servicio"] | null;
"actividad_id": string | null;
"base_cents": number;
"tratamiento_iva": Database["public"]["Enums"]["tratamiento_iva"];
"tipo_iva": number | null;
"cuota_iva_cents": number | null;
"retencion_pct": number | null;
"retencion_cents": number | null;
"total_cents": number;
"documento_path": string | null;
"origen": string;
"import_hash": string | null;
"estado": Database["public"]["Enums"]["estado_registro_fiscal"];
"motivo_exclusion": string | null;
"notas": string | null;
"created_at": string;
"updated_at": string;
};
Insert: {
"id"?: string;
"professional_id": string;
"serie"?: string | null;
"numero"?: string | null;
"tipo"?: Database["public"]["Enums"]["tipo_factura"];
"rectifica_a"?: string | null;
"fecha_emision": string;
"fecha_operacion"?: string | null;
"ejercicio_imputacion"?: number | null;
"criterio_imputacion"?: Database["public"]["Enums"]["criterio_imputacion"] | null;
"patient_id"?: string | null;
"destinatario_nombre"?: string | null;
"destinatario_nif"?: string | null;
"destinatario_tipo"?: Database["public"]["Enums"]["tipo_destinatario"] | null;
"categoria_servicio"?: Database["public"]["Enums"]["categoria_servicio"] | null;
"actividad_id"?: string | null;
"base_cents": number;
"tratamiento_iva"?: Database["public"]["Enums"]["tratamiento_iva"];
"tipo_iva"?: number | null;
"cuota_iva_cents"?: number | null;
"retencion_pct"?: number | null;
"retencion_cents"?: number | null;
"total_cents": number;
"documento_path"?: string | null;
"origen"?: string;
"import_hash"?: string | null;
"estado"?: Database["public"]["Enums"]["estado_registro_fiscal"];
"motivo_exclusion"?: string | null;
"notas"?: string | null;
"created_at"?: string;
"updated_at"?: string;
};
Update: {
"id"?: string;
"professional_id"?: string;
"serie"?: string | null;
"numero"?: string | null;
"tipo"?: Database["public"]["Enums"]["tipo_factura"];
"rectifica_a"?: string | null;
"fecha_emision"?: string;
"fecha_operacion"?: string | null;
"ejercicio_imputacion"?: number | null;
"criterio_imputacion"?: Database["public"]["Enums"]["criterio_imputacion"] | null;
"patient_id"?: string | null;
"destinatario_nombre"?: string | null;
"destinatario_nif"?: string | null;
"destinatario_tipo"?: Database["public"]["Enums"]["tipo_destinatario"] | null;
"categoria_servicio"?: Database["public"]["Enums"]["categoria_servicio"] | null;
"actividad_id"?: string | null;
"base_cents"?: number;
"tratamiento_iva"?: Database["public"]["Enums"]["tratamiento_iva"];
"tipo_iva"?: number | null;
"cuota_iva_cents"?: number | null;
"retencion_pct"?: number | null;
"retencion_cents"?: number | null;
"total_cents"?: number;
"documento_path"?: string | null;
"origen"?: string;
"import_hash"?: string | null;
"estado"?: Database["public"]["Enums"]["estado_registro_fiscal"];
"motivo_exclusion"?: string | null;
"notas"?: string | null;
"created_at"?: string;
"updated_at"?: string;
};
Relationships: [{ foreignKeyName: "facturas_actividad_id_fkey"; columns: ["actividad_id"]; isOneToOne: false; referencedRelation: "actividades_fiscales"; referencedColumns: ["id"] },{ foreignKeyName: "facturas_patient_id_fkey"; columns: ["patient_id"]; isOneToOne: false; referencedRelation: "patients"; referencedColumns: ["id"] },{ foreignKeyName: "facturas_professional_id_fkey"; columns: ["professional_id"]; isOneToOne: false; referencedRelation: "professionals"; referencedColumns: ["id"] },{ foreignKeyName: "facturas_rectifica_a_fkey"; columns: ["rectifica_a"]; isOneToOne: false; referencedRelation: "facturas"; referencedColumns: ["id"] }];
};
"gastos": {
Row: {
"id": string;
"professional_id": string;
"fecha": string;
"proveedor_nombre": string | null;
"proveedor_nif": string | null;
"categoria_deducible": string;
"concepto": string | null;
"base_cents": number;
"tipo_iva": number;
"cuota_iva_cents": number;
"total_cents": number;
"porcentaje_afectacion": number;
"es_bien_inversion": boolean;
"adjunto_path": string | null;
"created_at": string;
"updated_at": string;
"iva_recuperable_pct": number | null;
};
Insert: {
"id"?: string;
"professional_id": string;
"fecha": string;
"proveedor_nombre"?: string | null;
"proveedor_nif"?: string | null;
"categoria_deducible": string;
"concepto"?: string | null;
"base_cents": number;
"tipo_iva"?: number;
"cuota_iva_cents"?: number;
"total_cents": number;
"porcentaje_afectacion"?: number;
"es_bien_inversion"?: boolean;
"adjunto_path"?: string | null;
"created_at"?: string;
"updated_at"?: string;
"iva_recuperable_pct"?: number | null;
};
Update: {
"id"?: string;
"professional_id"?: string;
"fecha"?: string;
"proveedor_nombre"?: string | null;
"proveedor_nif"?: string | null;
"categoria_deducible"?: string;
"concepto"?: string | null;
"base_cents"?: number;
"tipo_iva"?: number;
"cuota_iva_cents"?: number;
"total_cents"?: number;
"porcentaje_afectacion"?: number;
"es_bien_inversion"?: boolean;
"adjunto_path"?: string | null;
"created_at"?: string;
"updated_at"?: string;
"iva_recuperable_pct"?: number | null;
};
Relationships: [{ foreignKeyName: "gastos_professional_id_fkey"; columns: ["professional_id"]; isOneToOne: false; referencedRelation: "professionals"; referencedColumns: ["id"] }];
};
"invitations": {
Row: {
"id": string;
"professional_id": string;
"patient_id": string;
"email": string | null;
"expires_at": string;
"accepted_at": string | null;
"created_at": string;
"token_hash": string;
"organization_id": string;
"invited_by": string | null;
"revoked_at": string | null;
"kind": Database["public"]["Enums"]["invite_target"];
};
Insert: {
"id"?: string;
"professional_id": string;
"patient_id": string;
"email"?: string | null;
"expires_at"?: string;
"accepted_at"?: string | null;
"created_at"?: string;
"token_hash": string;
"organization_id": string;
"invited_by"?: string | null;
"revoked_at"?: string | null;
"kind"?: Database["public"]["Enums"]["invite_target"];
};
Update: {
"id"?: string;
"professional_id"?: string;
"patient_id"?: string;
"email"?: string | null;
"expires_at"?: string;
"accepted_at"?: string | null;
"created_at"?: string;
"token_hash"?: string;
"organization_id"?: string;
"invited_by"?: string | null;
"revoked_at"?: string | null;
"kind"?: Database["public"]["Enums"]["invite_target"];
};
Relationships: [{ foreignKeyName: "invitations_invited_by_fkey"; columns: ["invited_by"]; isOneToOne: false; referencedRelation: "professionals"; referencedColumns: ["id"] },{ foreignKeyName: "invitations_organization_id_fkey"; columns: ["organization_id"]; isOneToOne: false; referencedRelation: "organizations"; referencedColumns: ["id"] },{ foreignKeyName: "invitations_patient_id_fkey"; columns: ["patient_id"]; isOneToOne: false; referencedRelation: "patients"; referencedColumns: ["id"] },{ foreignKeyName: "invitations_professional_id_fkey"; columns: ["professional_id"]; isOneToOne: false; referencedRelation: "professionals"; referencedColumns: ["id"] }];
};
"mood_entries": {
Row: {
"id": string;
"patient_id": string;
"mood_value": number;
"note": string | null;
"entry_date": string;
"created_at": string;
"mood_scale": number;
};
Insert: {
"id"?: string;
"patient_id": string;
"mood_value": number;
"note"?: string | null;
"entry_date"?: string;
"created_at"?: string;
"mood_scale"?: number;
};
Update: {
"id"?: string;
"patient_id"?: string;
"mood_value"?: number;
"note"?: string | null;
"entry_date"?: string;
"created_at"?: string;
"mood_scale"?: number;
};
Relationships: [{ foreignKeyName: "mood_entries_patient_id_fkey"; columns: ["patient_id"]; isOneToOne: false; referencedRelation: "patients"; referencedColumns: ["id"] }];
};
"notification_deliveries": {
Row: {
"notification_id": string;
"subscription_id": string;
"sent_at": string;
};
Insert: {
"notification_id": string;
"subscription_id": string;
"sent_at"?: string;
};
Update: {
"notification_id"?: string;
"subscription_id"?: string;
"sent_at"?: string;
};
Relationships: [{ foreignKeyName: "notification_deliveries_notification_id_fkey"; columns: ["notification_id"]; isOneToOne: false; referencedRelation: "notifications"; referencedColumns: ["id"] },{ foreignKeyName: "notification_deliveries_subscription_id_fkey"; columns: ["subscription_id"]; isOneToOne: false; referencedRelation: "push_subscriptions"; referencedColumns: ["id"] }];
};
"notification_preferences": {
Row: {
"user_id": string;
"appointment_reminders": boolean;
"new_appointment": boolean;
"new_task": boolean;
"new_scale": boolean;
"email_fallback": boolean;
"updated_at": string;
};
Insert: {
"user_id": string;
"appointment_reminders"?: boolean;
"new_appointment"?: boolean;
"new_task"?: boolean;
"new_scale"?: boolean;
"email_fallback"?: boolean;
"updated_at"?: string;
};
Update: {
"user_id"?: string;
"appointment_reminders"?: boolean;
"new_appointment"?: boolean;
"new_task"?: boolean;
"new_scale"?: boolean;
"email_fallback"?: boolean;
"updated_at"?: string;
};
Relationships: [];
};
"notifications": {
Row: {
"id": string;
"user_id": string;
"professional_id": string | null;
"patient_id": string | null;
"channel": Database["public"]["Enums"]["notification_channel"];
"type": string | null;
"title": string | null;
"body": string | null;
"payload": Json | null;
"status": Database["public"]["Enums"]["notification_status"];
"scheduled_for": string | null;
"sent_at": string | null;
"read_at": string | null;
"created_at": string;
"retry_count": number;
"next_attempt_at": string | null;
"lock_token": string | null;
"locked_until": string | null;
"dedupe_key": string | null;
};
Insert: {
"id"?: string;
"user_id": string;
"professional_id"?: string | null;
"patient_id"?: string | null;
"channel"?: Database["public"]["Enums"]["notification_channel"];
"type"?: string | null;
"title"?: string | null;
"body"?: string | null;
"payload"?: Json | null;
"status"?: Database["public"]["Enums"]["notification_status"];
"scheduled_for"?: string | null;
"sent_at"?: string | null;
"read_at"?: string | null;
"created_at"?: string;
"retry_count"?: number;
"next_attempt_at"?: string | null;
"lock_token"?: string | null;
"locked_until"?: string | null;
"dedupe_key"?: string | null;
};
Update: {
"id"?: string;
"user_id"?: string;
"professional_id"?: string | null;
"patient_id"?: string | null;
"channel"?: Database["public"]["Enums"]["notification_channel"];
"type"?: string | null;
"title"?: string | null;
"body"?: string | null;
"payload"?: Json | null;
"status"?: Database["public"]["Enums"]["notification_status"];
"scheduled_for"?: string | null;
"sent_at"?: string | null;
"read_at"?: string | null;
"created_at"?: string;
"retry_count"?: number;
"next_attempt_at"?: string | null;
"lock_token"?: string | null;
"locked_until"?: string | null;
"dedupe_key"?: string | null;
};
Relationships: [{ foreignKeyName: "notifications_patient_id_fkey"; columns: ["patient_id"]; isOneToOne: false; referencedRelation: "patients"; referencedColumns: ["id"] },{ foreignKeyName: "notifications_professional_id_fkey"; columns: ["professional_id"]; isOneToOne: false; referencedRelation: "professionals"; referencedColumns: ["id"] }];
};
"organization_access": {
Row: {
"organization_id": string;
"status": Database["public"]["Enums"]["org_access_status"];
"granted_by": string | null;
"granted_at": string | null;
"expires_at": string | null;
"note": string | null;
"stripe_customer_id": string | null;
"stripe_subscription_id": string | null;
"updated_at": string;
};
Insert: {
"organization_id": string;
"status"?: Database["public"]["Enums"]["org_access_status"];
"granted_by"?: string | null;
"granted_at"?: string | null;
"expires_at"?: string | null;
"note"?: string | null;
"stripe_customer_id"?: string | null;
"stripe_subscription_id"?: string | null;
"updated_at"?: string;
};
Update: {
"organization_id"?: string;
"status"?: Database["public"]["Enums"]["org_access_status"];
"granted_by"?: string | null;
"granted_at"?: string | null;
"expires_at"?: string | null;
"note"?: string | null;
"stripe_customer_id"?: string | null;
"stripe_subscription_id"?: string | null;
"updated_at"?: string;
};
Relationships: [{ foreignKeyName: "organization_access_organization_id_fkey"; columns: ["organization_id"]; isOneToOne: false; referencedRelation: "organizations"; referencedColumns: ["id"] }];
};
"organization_members": {
Row: {
"id": string;
"organization_id": string;
"professional_id": string;
"role": Database["public"]["Enums"]["org_member_role"];
"status": Database["public"]["Enums"]["member_status"];
"can_invite_patients": boolean;
"invited_by": string | null;
"created_at": string;
"revoked_at": string | null;
};
Insert: {
"id"?: string;
"organization_id": string;
"professional_id": string;
"role"?: Database["public"]["Enums"]["org_member_role"];
"status"?: Database["public"]["Enums"]["member_status"];
"can_invite_patients"?: boolean;
"invited_by"?: string | null;
"created_at"?: string;
"revoked_at"?: string | null;
};
Update: {
"id"?: string;
"organization_id"?: string;
"professional_id"?: string;
"role"?: Database["public"]["Enums"]["org_member_role"];
"status"?: Database["public"]["Enums"]["member_status"];
"can_invite_patients"?: boolean;
"invited_by"?: string | null;
"created_at"?: string;
"revoked_at"?: string | null;
};
Relationships: [{ foreignKeyName: "organization_members_invited_by_fkey"; columns: ["invited_by"]; isOneToOne: false; referencedRelation: "professionals"; referencedColumns: ["id"] },{ foreignKeyName: "organization_members_organization_id_fkey"; columns: ["organization_id"]; isOneToOne: false; referencedRelation: "organizations"; referencedColumns: ["id"] },{ foreignKeyName: "organization_members_professional_id_fkey"; columns: ["professional_id"]; isOneToOne: false; referencedRelation: "professionals"; referencedColumns: ["id"] }];
};
"organizations": {
Row: {
"id": string;
"name": string;
"kind": Database["public"]["Enums"]["organization_kind"];
"created_by": string | null;
"created_at": string;
"updated_at": string;
};
Insert: {
"id"?: string;
"name": string;
"kind"?: Database["public"]["Enums"]["organization_kind"];
"created_by"?: string | null;
"created_at"?: string;
"updated_at"?: string;
};
Update: {
"id"?: string;
"name"?: string;
"kind"?: Database["public"]["Enums"]["organization_kind"];
"created_by"?: string | null;
"created_at"?: string;
"updated_at"?: string;
};
Relationships: [];
};
"patient_assignments": {
Row: {
"id": string;
"patient_id": string;
"professional_id": string;
"organization_id": string;
"role": Database["public"]["Enums"]["assignment_role"];
"created_by": string | null;
"created_at": string;
"revoked_at": string | null;
};
Insert: {
"id"?: string;
"patient_id": string;
"professional_id": string;
"organization_id": string;
"role"?: Database["public"]["Enums"]["assignment_role"];
"created_by"?: string | null;
"created_at"?: string;
"revoked_at"?: string | null;
};
Update: {
"id"?: string;
"patient_id"?: string;
"professional_id"?: string;
"organization_id"?: string;
"role"?: Database["public"]["Enums"]["assignment_role"];
"created_by"?: string | null;
"created_at"?: string;
"revoked_at"?: string | null;
};
Relationships: [{ foreignKeyName: "patient_assignments_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "professionals"; referencedColumns: ["id"] },{ foreignKeyName: "patient_assignments_organization_id_fkey"; columns: ["organization_id"]; isOneToOne: false; referencedRelation: "organizations"; referencedColumns: ["id"] },{ foreignKeyName: "patient_assignments_patient_id_fkey"; columns: ["patient_id"]; isOneToOne: false; referencedRelation: "patients"; referencedColumns: ["id"] },{ foreignKeyName: "patient_assignments_professional_id_fkey"; columns: ["professional_id"]; isOneToOne: false; referencedRelation: "professionals"; referencedColumns: ["id"] }];
};
"patient_notes": {
Row: {
"id": string;
"professional_id": string;
"patient_id": string;
"body": string;
"created_at": string;
};
Insert: {
"id"?: string;
"professional_id": string;
"patient_id": string;
"body": string;
"created_at"?: string;
};
Update: {
"id"?: string;
"professional_id"?: string;
"patient_id"?: string;
"body"?: string;
"created_at"?: string;
};
Relationships: [{ foreignKeyName: "patient_notes_patient_id_fkey"; columns: ["patient_id"]; isOneToOne: false; referencedRelation: "patients"; referencedColumns: ["id"] },{ foreignKeyName: "patient_notes_professional_id_fkey"; columns: ["professional_id"]; isOneToOne: false; referencedRelation: "professionals"; referencedColumns: ["id"] }];
};
"patients": {
Row: {
"id": string;
"professional_id": string;
"user_id": string | null;
"full_name": string | null;
"email": string | null;
"status": Database["public"]["Enums"]["patient_status"];
"tags": (string)[];
"created_at": string;
"updated_at": string;
"phone": string | null;
"birth_date": string | null;
"address": string | null;
"profession": string | null;
"emergency_contact": string | null;
"organization_id": string;
};
Insert: {
"id"?: string;
"professional_id": string;
"user_id"?: string | null;
"full_name"?: string | null;
"email"?: string | null;
"status"?: Database["public"]["Enums"]["patient_status"];
"tags"?: (string)[];
"created_at"?: string;
"updated_at"?: string;
"phone"?: string | null;
"birth_date"?: string | null;
"address"?: string | null;
"profession"?: string | null;
"emergency_contact"?: string | null;
"organization_id": string;
};
Update: {
"id"?: string;
"professional_id"?: string;
"user_id"?: string | null;
"full_name"?: string | null;
"email"?: string | null;
"status"?: Database["public"]["Enums"]["patient_status"];
"tags"?: (string)[];
"created_at"?: string;
"updated_at"?: string;
"phone"?: string | null;
"birth_date"?: string | null;
"address"?: string | null;
"profession"?: string | null;
"emergency_contact"?: string | null;
"organization_id"?: string;
};
Relationships: [{ foreignKeyName: "patients_organization_id_fkey"; columns: ["organization_id"]; isOneToOne: false; referencedRelation: "organizations"; referencedColumns: ["id"] },{ foreignKeyName: "patients_professional_id_fkey"; columns: ["professional_id"]; isOneToOne: false; referencedRelation: "professionals"; referencedColumns: ["id"] }];
};
"payment_settings": {
Row: {
"id": string;
"professional_id": string;
"patient_id": string | null;
"session_type": string;
"price_cents": number;
"currency": string;
"created_at": string;
"updated_at": string;
};
Insert: {
"id"?: string;
"professional_id": string;
"patient_id"?: string | null;
"session_type"?: string;
"price_cents": number;
"currency"?: string;
"created_at"?: string;
"updated_at"?: string;
};
Update: {
"id"?: string;
"professional_id"?: string;
"patient_id"?: string | null;
"session_type"?: string;
"price_cents"?: number;
"currency"?: string;
"created_at"?: string;
"updated_at"?: string;
};
Relationships: [{ foreignKeyName: "payment_settings_patient_id_fkey"; columns: ["patient_id"]; isOneToOne: false; referencedRelation: "patients"; referencedColumns: ["id"] },{ foreignKeyName: "payment_settings_professional_id_fkey"; columns: ["professional_id"]; isOneToOne: false; referencedRelation: "professionals"; referencedColumns: ["id"] }];
};
"payments": {
Row: {
"id": string;
"professional_id": string;
"patient_id": string;
"appointment_id": string | null;
"session_pack_id": string | null;
"amount_cents": number;
"currency": string;
"status": Database["public"]["Enums"]["payment_status"];
"method": string | null;
"paid_at": string | null;
"note": string | null;
"created_at": string;
"updated_at": string;
"fecha_efectiva": string | null;
"fiscal_snapshot": Json | null;
};
Insert: {
"id"?: string;
"professional_id": string;
"patient_id": string;
"appointment_id"?: string | null;
"session_pack_id"?: string | null;
"amount_cents": number;
"currency"?: string;
"status"?: Database["public"]["Enums"]["payment_status"];
"method"?: string | null;
"paid_at"?: string | null;
"note"?: string | null;
"created_at"?: string;
"updated_at"?: string;
"fecha_efectiva"?: never;
"fiscal_snapshot"?: Json | null;
};
Update: {
"id"?: string;
"professional_id"?: string;
"patient_id"?: string;
"appointment_id"?: string | null;
"session_pack_id"?: string | null;
"amount_cents"?: number;
"currency"?: string;
"status"?: Database["public"]["Enums"]["payment_status"];
"method"?: string | null;
"paid_at"?: string | null;
"note"?: string | null;
"created_at"?: string;
"updated_at"?: string;
"fecha_efectiva"?: never;
"fiscal_snapshot"?: Json | null;
};
Relationships: [{ foreignKeyName: "payments_appointment_owner_fk"; columns: ["appointment_id","professional_id","patient_id"]; isOneToOne: false; referencedRelation: "appointments"; referencedColumns: ["id","professional_id","patient_id"] },{ foreignKeyName: "payments_pack_owner_fk"; columns: ["session_pack_id","professional_id","patient_id"]; isOneToOne: false; referencedRelation: "session_packs"; referencedColumns: ["id","professional_id","patient_id"] },{ foreignKeyName: "payments_patient_owner_fk"; columns: ["patient_id","professional_id"]; isOneToOne: false; referencedRelation: "patients"; referencedColumns: ["id","professional_id"] },{ foreignKeyName: "payments_professional_id_fkey"; columns: ["professional_id"]; isOneToOne: false; referencedRelation: "professionals"; referencedColumns: ["id"] }];
};
"pending_uploads": {
Row: {
"path": string;
"bucket": string;
"professional_id": string;
"patient_id": string | null;
"size_bytes": number;
"mime": string;
"created_at": string;
};
Insert: {
"path": string;
"bucket": string;
"professional_id": string;
"patient_id"?: string | null;
"size_bytes": number;
"mime": string;
"created_at"?: string;
};
Update: {
"path"?: string;
"bucket"?: string;
"professional_id"?: string;
"patient_id"?: string | null;
"size_bytes"?: number;
"mime"?: string;
"created_at"?: string;
};
Relationships: [{ foreignKeyName: "pending_uploads_patient_id_fkey"; columns: ["patient_id"]; isOneToOne: false; referencedRelation: "patients"; referencedColumns: ["id"] },{ foreignKeyName: "pending_uploads_professional_id_fkey"; columns: ["professional_id"]; isOneToOne: false; referencedRelation: "professionals"; referencedColumns: ["id"] }];
};
"platform_admins": {
Row: {
"user_id": string;
"note": string | null;
"created_at": string;
};
Insert: {
"user_id": string;
"note"?: string | null;
"created_at"?: string;
};
Update: {
"user_id"?: string;
"note"?: string | null;
"created_at"?: string;
};
Relationships: [];
};
"professional_invitations": {
Row: {
"id": string;
"organization_id": string;
"email": string;
"token_hash": string;
"role": Database["public"]["Enums"]["org_member_role"];
"can_invite_patients": boolean;
"invited_by": string;
"expires_at": string;
"accepted_at": string | null;
"accepted_by": string | null;
"revoked_at": string | null;
"created_at": string;
};
Insert: {
"id"?: string;
"organization_id": string;
"email": string;
"token_hash": string;
"role"?: Database["public"]["Enums"]["org_member_role"];
"can_invite_patients"?: boolean;
"invited_by": string;
"expires_at"?: string;
"accepted_at"?: string | null;
"accepted_by"?: string | null;
"revoked_at"?: string | null;
"created_at"?: string;
};
Update: {
"id"?: string;
"organization_id"?: string;
"email"?: string;
"token_hash"?: string;
"role"?: Database["public"]["Enums"]["org_member_role"];
"can_invite_patients"?: boolean;
"invited_by"?: string;
"expires_at"?: string;
"accepted_at"?: string | null;
"accepted_by"?: string | null;
"revoked_at"?: string | null;
"created_at"?: string;
};
Relationships: [{ foreignKeyName: "professional_invitations_accepted_by_fkey"; columns: ["accepted_by"]; isOneToOne: false; referencedRelation: "professionals"; referencedColumns: ["id"] },{ foreignKeyName: "professional_invitations_invited_by_fkey"; columns: ["invited_by"]; isOneToOne: false; referencedRelation: "professionals"; referencedColumns: ["id"] },{ foreignKeyName: "professional_invitations_organization_id_fkey"; columns: ["organization_id"]; isOneToOne: false; referencedRelation: "organizations"; referencedColumns: ["id"] }];
};
"professionals": {
Row: {
"id": string;
"user_id": string;
"full_name": string | null;
"email": string | null;
"created_at": string;
"updated_at": string;
"deleted_at": string | null;
"verification_status": Database["public"]["Enums"]["verification_status"];
"colegio": string | null;
"numero_colegiado": string | null;
"practice_kind": Database["public"]["Enums"]["organization_kind"] | null;
"verification_note": string | null;
"verification_reviewed_by": string | null;
"verification_reviewed_at": string | null;
"onboarding_completed_at": string | null;
"verification_source": string | null;
"verification_evidence": Json | null;
"verification_checked_at": string | null;
};
Insert: {
"id"?: string;
"user_id": string;
"full_name"?: string | null;
"email"?: string | null;
"created_at"?: string;
"updated_at"?: string;
"deleted_at"?: string | null;
"verification_status"?: Database["public"]["Enums"]["verification_status"];
"colegio"?: string | null;
"numero_colegiado"?: string | null;
"practice_kind"?: Database["public"]["Enums"]["organization_kind"] | null;
"verification_note"?: string | null;
"verification_reviewed_by"?: string | null;
"verification_reviewed_at"?: string | null;
"onboarding_completed_at"?: string | null;
"verification_source"?: string | null;
"verification_evidence"?: Json | null;
"verification_checked_at"?: string | null;
};
Update: {
"id"?: string;
"user_id"?: string;
"full_name"?: string | null;
"email"?: string | null;
"created_at"?: string;
"updated_at"?: string;
"deleted_at"?: string | null;
"verification_status"?: Database["public"]["Enums"]["verification_status"];
"colegio"?: string | null;
"numero_colegiado"?: string | null;
"practice_kind"?: Database["public"]["Enums"]["organization_kind"] | null;
"verification_note"?: string | null;
"verification_reviewed_by"?: string | null;
"verification_reviewed_at"?: string | null;
"onboarding_completed_at"?: string | null;
"verification_source"?: string | null;
"verification_evidence"?: Json | null;
"verification_checked_at"?: string | null;
};
Relationships: [];
};
"push_subscriptions": {
Row: {
"id": string;
"user_id": string;
"endpoint": string;
"p256dh": string;
"auth": string;
"created_at": string;
};
Insert: {
"id"?: string;
"user_id": string;
"endpoint": string;
"p256dh": string;
"auth": string;
"created_at"?: string;
};
Update: {
"id"?: string;
"user_id"?: string;
"endpoint"?: string;
"p256dh"?: string;
"auth"?: string;
"created_at"?: string;
};
Relationships: [];
};
"resources": {
Row: {
"id": string;
"professional_id": string;
"patient_id": string | null;
"title": string;
"kind": Database["public"]["Enums"]["resource_kind"];
"url": string | null;
"storage_path": string | null;
"created_at": string;
"updated_at": string;
};
Insert: {
"id"?: string;
"professional_id": string;
"patient_id"?: string | null;
"title": string;
"kind"?: Database["public"]["Enums"]["resource_kind"];
"url"?: string | null;
"storage_path"?: string | null;
"created_at"?: string;
"updated_at"?: string;
};
Update: {
"id"?: string;
"professional_id"?: string;
"patient_id"?: string | null;
"title"?: string;
"kind"?: Database["public"]["Enums"]["resource_kind"];
"url"?: string | null;
"storage_path"?: string | null;
"created_at"?: string;
"updated_at"?: string;
};
Relationships: [{ foreignKeyName: "resources_patient_id_fkey"; columns: ["patient_id"]; isOneToOne: false; referencedRelation: "patients"; referencedColumns: ["id"] },{ foreignKeyName: "resources_professional_id_fkey"; columns: ["professional_id"]; isOneToOne: false; referencedRelation: "professionals"; referencedColumns: ["id"] }];
};
"retenciones_pagos_cuenta": {
Row: {
"id": string;
"professional_id": string;
"ejercicio": number;
"clase": Database["public"]["Enums"]["clase_retencion"];
"periodo": string | null;
"modelo": string | null;
"importe_cents": number;
"fecha": string | null;
"justificante_path": string | null;
"rectifica_a": string | null;
"estado": Database["public"]["Enums"]["estado_registro_fiscal"];
"notas": string | null;
"created_at": string;
};
Insert: {
"id"?: string;
"professional_id": string;
"ejercicio": number;
"clase": Database["public"]["Enums"]["clase_retencion"];
"periodo"?: string | null;
"modelo"?: string | null;
"importe_cents": number;
"fecha"?: string | null;
"justificante_path"?: string | null;
"rectifica_a"?: string | null;
"estado"?: Database["public"]["Enums"]["estado_registro_fiscal"];
"notas"?: string | null;
"created_at"?: string;
};
Update: {
"id"?: string;
"professional_id"?: string;
"ejercicio"?: number;
"clase"?: Database["public"]["Enums"]["clase_retencion"];
"periodo"?: string | null;
"modelo"?: string | null;
"importe_cents"?: number;
"fecha"?: string | null;
"justificante_path"?: string | null;
"rectifica_a"?: string | null;
"estado"?: Database["public"]["Enums"]["estado_registro_fiscal"];
"notas"?: string | null;
"created_at"?: string;
};
Relationships: [{ foreignKeyName: "retenciones_pagos_cuenta_professional_id_fkey"; columns: ["professional_id"]; isOneToOne: false; referencedRelation: "professionals"; referencedColumns: ["id"] },{ foreignKeyName: "retenciones_pagos_cuenta_rectifica_a_fkey"; columns: ["rectifica_a"]; isOneToOne: false; referencedRelation: "retenciones_pagos_cuenta"; referencedColumns: ["id"] }];
};
"scale_assignments": {
Row: {
"id": string;
"professional_id": string;
"patient_id": string;
"scale_id": string;
"assignment_type": Database["public"]["Enums"]["assignment_type"];
"recurrence_interval_days": number | null;
"starts_on": string;
"ends_on": string | null;
"active": boolean;
"created_at": string;
"updated_at": string;
};
Insert: {
"id"?: string;
"professional_id": string;
"patient_id": string;
"scale_id": string;
"assignment_type"?: Database["public"]["Enums"]["assignment_type"];
"recurrence_interval_days"?: number | null;
"starts_on"?: string;
"ends_on"?: string | null;
"active"?: boolean;
"created_at"?: string;
"updated_at"?: string;
};
Update: {
"id"?: string;
"professional_id"?: string;
"patient_id"?: string;
"scale_id"?: string;
"assignment_type"?: Database["public"]["Enums"]["assignment_type"];
"recurrence_interval_days"?: number | null;
"starts_on"?: string;
"ends_on"?: string | null;
"active"?: boolean;
"created_at"?: string;
"updated_at"?: string;
};
Relationships: [{ foreignKeyName: "scale_assignments_patient_id_fkey"; columns: ["patient_id"]; isOneToOne: false; referencedRelation: "patients"; referencedColumns: ["id"] },{ foreignKeyName: "scale_assignments_professional_id_fkey"; columns: ["professional_id"]; isOneToOne: false; referencedRelation: "professionals"; referencedColumns: ["id"] },{ foreignKeyName: "scale_assignments_scale_id_fkey"; columns: ["scale_id"]; isOneToOne: false; referencedRelation: "scales"; referencedColumns: ["id"] }];
};
"scale_responses": {
Row: {
"id": string;
"assignment_id": string;
"patient_id": string;
"scale_id": string;
"answers": Json;
"score": number | null;
"severity": string | null;
"flagged": boolean;
"submitted_at": string;
"created_at": string;
"acknowledged_at": string | null;
"acknowledged_by": string | null;
};
Insert: {
"id"?: string;
"assignment_id": string;
"patient_id": string;
"scale_id": string;
"answers": Json;
"score"?: number | null;
"severity"?: string | null;
"flagged"?: boolean;
"submitted_at"?: string;
"created_at"?: string;
"acknowledged_at"?: string | null;
"acknowledged_by"?: string | null;
};
Update: {
"id"?: string;
"assignment_id"?: string;
"patient_id"?: string;
"scale_id"?: string;
"answers"?: Json;
"score"?: number | null;
"severity"?: string | null;
"flagged"?: boolean;
"submitted_at"?: string;
"created_at"?: string;
"acknowledged_at"?: string | null;
"acknowledged_by"?: string | null;
};
Relationships: [{ foreignKeyName: "scale_responses_acknowledged_by_fkey"; columns: ["acknowledged_by"]; isOneToOne: false; referencedRelation: "professionals"; referencedColumns: ["id"] },{ foreignKeyName: "scale_responses_assignment_id_fkey"; columns: ["assignment_id"]; isOneToOne: false; referencedRelation: "scale_assignments"; referencedColumns: ["id"] },{ foreignKeyName: "scale_responses_patient_id_fkey"; columns: ["patient_id"]; isOneToOne: false; referencedRelation: "patients"; referencedColumns: ["id"] },{ foreignKeyName: "scale_responses_scale_id_fkey"; columns: ["scale_id"]; isOneToOne: false; referencedRelation: "scales"; referencedColumns: ["id"] }];
};
"scales": {
Row: {
"id": string;
"code": string;
"version": number;
"name": string;
"description": string | null;
"definition": Json;
"is_active": boolean;
"created_at": string;
};
Insert: {
"id"?: string;
"code": string;
"version"?: number;
"name": string;
"description"?: string | null;
"definition": Json;
"is_active"?: boolean;
"created_at"?: string;
};
Update: {
"id"?: string;
"code"?: string;
"version"?: number;
"name"?: string;
"description"?: string | null;
"definition"?: Json;
"is_active"?: boolean;
"created_at"?: string;
};
Relationships: [];
};
"session_packs": {
Row: {
"id": string;
"professional_id": string;
"patient_id": string;
"total_sessions": number;
"used_sessions": number;
"price_cents": number | null;
"currency": string;
"active": boolean;
"purchased_at": string;
"created_at": string;
"updated_at": string;
"request_id": string | null;
};
Insert: {
"id"?: string;
"professional_id": string;
"patient_id": string;
"total_sessions": number;
"used_sessions"?: number;
"price_cents"?: number | null;
"currency"?: string;
"active"?: boolean;
"purchased_at"?: string;
"created_at"?: string;
"updated_at"?: string;
"request_id"?: string | null;
};
Update: {
"id"?: string;
"professional_id"?: string;
"patient_id"?: string;
"total_sessions"?: number;
"used_sessions"?: number;
"price_cents"?: number | null;
"currency"?: string;
"active"?: boolean;
"purchased_at"?: string;
"created_at"?: string;
"updated_at"?: string;
"request_id"?: string | null;
};
Relationships: [{ foreignKeyName: "session_packs_patient_id_fkey"; columns: ["patient_id"]; isOneToOne: false; referencedRelation: "patients"; referencedColumns: ["id"] },{ foreignKeyName: "session_packs_professional_id_fkey"; columns: ["professional_id"]; isOneToOne: false; referencedRelation: "professionals"; referencedColumns: ["id"] }];
};
"storage_cleanup_jobs": {
Row: {
"id": string;
"bucket": string;
"path": string;
"created_at": string;
"available_at": string;
};
Insert: {
"id"?: string;
"bucket": string;
"path": string;
"created_at"?: string;
"available_at"?: string;
};
Update: {
"id"?: string;
"bucket"?: string;
"path"?: string;
"created_at"?: string;
"available_at"?: string;
};
Relationships: [];
};
"task_completions": {
Row: {
"id": string;
"task_id": string;
"patient_id": string;
"response_text": string | null;
"completed_at": string;
"created_at": string;
};
Insert: {
"id"?: string;
"task_id": string;
"patient_id": string;
"response_text"?: string | null;
"completed_at"?: string;
"created_at"?: string;
};
Update: {
"id"?: string;
"task_id"?: string;
"patient_id"?: string;
"response_text"?: string | null;
"completed_at"?: string;
"created_at"?: string;
};
Relationships: [{ foreignKeyName: "task_completions_patient_id_fkey"; columns: ["patient_id"]; isOneToOne: false; referencedRelation: "patients"; referencedColumns: ["id"] },{ foreignKeyName: "task_completions_task_id_fkey"; columns: ["task_id"]; isOneToOne: false; referencedRelation: "tasks"; referencedColumns: ["id"] }];
};
"tasks": {
Row: {
"id": string;
"professional_id": string;
"patient_id": string;
"title": string;
"description": string | null;
"due_date": string | null;
"created_at": string;
"updated_at": string;
};
Insert: {
"id"?: string;
"professional_id": string;
"patient_id": string;
"title": string;
"description"?: string | null;
"due_date"?: string | null;
"created_at"?: string;
"updated_at"?: string;
};
Update: {
"id"?: string;
"professional_id"?: string;
"patient_id"?: string;
"title"?: string;
"description"?: string | null;
"due_date"?: string | null;
"created_at"?: string;
"updated_at"?: string;
};
Relationships: [{ foreignKeyName: "tasks_patient_id_fkey"; columns: ["patient_id"]; isOneToOne: false; referencedRelation: "patients"; referencedColumns: ["id"] },{ foreignKeyName: "tasks_professional_id_fkey"; columns: ["professional_id"]; isOneToOne: false; referencedRelation: "professionals"; referencedColumns: ["id"] }];
};
};
Views: {
"v_ingresos_fiscales": {
Row: {
"id": string | null;
"professional_id": string | null;
"fecha": string | null;
"total_cents": number | null;
"tipo_operacion": string | null;
"base_cents": number | null;
"cuota_iva_cents": number | null;
"retencion_aplicable": boolean | null;
"retencion_cents": number | null;
"nombre_pagador": string | null;
"fiscal_review_required": boolean | null;
};
Relationships: [];
};
};
Functions: {
"accept_invitation": { Args: {"p_token": string | null}; Returns: string };
"accept_professional_invitation": { Args: {"p_token": string | null}; Returns: string };
"admin_review_professional": { Args: {"p_professional_id": string | null;"p_status": Database["public"]["Enums"]["verification_status"] | null;"p_note"?: string | null}; Returns: undefined };
"admin_set_org_access": { Args: {"p_org": string | null;"p_status": Database["public"]["Enums"]["org_access_status"] | null;"p_expires_at"?: string | null;"p_note"?: string | null}; Returns: undefined };
"assign_patient": { Args: {"p_patient_id": string | null;"p_professional_id": string | null}; Returns: undefined };
"can_invite_patients": { Args: {"p_org": string | null}; Returns: boolean };
"can_manage_org": { Args: {"p_org": string | null}; Returns: boolean };
"change_appointment": { Args: {"p_id": string | null;"p_attendance"?: string | null;"p_action"?: string | null}; Returns: string };
"claim_notifications": { Args: {"p_token": string | null;"p_limit"?: number | null}; Returns: (Database["public"]["Tables"]["notifications"]["Row"])[] };
"complete_onboarding": { Args: {"p_token": string | null;"p_template_id": string | null;"p_content_hash": string | null}; Returns: string };
"complete_patient_task": { Args: {"p_id": string | null;"p_response"?: string | null}; Returns: string };
"create_session_pack": { Args: {"p_patient_id": string | null;"p_total_sessions": number | null;"p_price_cents": number | null;"p_request_id": string | null}; Returns: string };
"current_clinical_patient_ids": { Args: Record<PropertyKey, never>; Returns: (string)[] };
"current_org_ids": { Args: Record<PropertyKey, never>; Returns: (string)[] };
"current_patient_id": { Args: Record<PropertyKey, never>; Returns: string };
"current_patient_ids": { Args: Record<PropertyKey, never>; Returns: (string)[] };
"current_patient_org_ids": { Args: Record<PropertyKey, never>; Returns: (string)[] };
"current_patient_professional_id": { Args: Record<PropertyKey, never>; Returns: string };
"current_patient_professional_ids": { Args: Record<PropertyKey, never>; Returns: (string)[] };
"current_professional_id": { Args: Record<PropertyKey, never>; Returns: string };
"delete_expense": { Args: {"p_id": string | null}; Returns: string };
"ensure_consent_template": { Args: {"p_professional_id": string | null}; Returns: undefined };
"get_onboarding_consent": { Args: {"p_token"?: string | null}; Returns: Json };
"has_consent_for_record": { Args: {"p_patient_id": string | null}; Returns: boolean };
"has_current_consent": { Args: Record<PropertyKey, never>; Returns: boolean };
"incomplete_signup_user_id": { Args: {"p_email": string | null}; Returns: string };
"invitation_preview": { Args: {"p_token": string | null}; Returns: ({"valid": boolean;"professional_name": string;"expires_at": string;"organization_name": string;"email": string})[] };
"is_org_member": { Args: {"p_org": string | null}; Returns: boolean };
"is_platform_admin": { Args: Record<PropertyKey, never>; Returns: boolean };
"is_platform_admin_account": { Args: Record<PropertyKey, never>; Returns: boolean };
"issue_invitation": { Args: {"p_patient_id": string | null;"p_token_hash": string | null;"p_email"?: string | null;"p_ttl_hours"?: number | null}; Returns: ({"invitation_id": string;"expires_at": string;"recipient": string})[] };
"issue_professional_invitation": { Args: {"p_org": string | null;"p_email": string | null;"p_token_hash": string | null;"p_role"?: Database["public"]["Enums"]["org_member_role"] | null;"p_can_invite"?: boolean | null;"p_ttl_hours"?: number | null}; Returns: string };
"mark_notification_read": { Args: {"p_id": string | null}; Returns: undefined };
"my_professional_context": { Args: Record<PropertyKey, never>; Returns: Json };
"patient_accept_consent": { Args: Record<PropertyKey, never>; Returns: string };
"patient_request_appointment": { Args: {"p_kind": string | null;"p_preferred_start"?: string | null;"p_alt_start"?: string | null;"p_duration_min"?: number | null;"p_note"?: string | null;"p_appointment_id"?: string | null}; Returns: string };
"patient_respond_appointment": { Args: {"p_appointment_id": string | null;"p_action": string | null}; Returns: undefined };
"patient_withdraw_request": { Args: {"p_id": string | null}; Returns: undefined };
"professional_invitation_preview": { Args: {"p_token": string | null}; Returns: ({"organization_name": string;"role": Database["public"]["Enums"]["org_member_role"];"expires_at": string;"email": string})[] };
"professional_is_operational": { Args: Record<PropertyKey, never>; Returns: boolean };
"professional_owns_patient": { Args: {"p_patient_id": string | null}; Returns: boolean };
"queue_appointment_reminders": { Args: Record<PropertyKey, never>; Returns: number };
"register_professional": { Args: {"p_full_name": string | null;"p_practice_kind": Database["public"]["Enums"]["organization_kind"] | null;"p_org_name"?: string | null;"p_colegio"?: string | null;"p_numero_colegiado"?: string | null}; Returns: string };
"registry_verify_professional": { Args: {"p_professional_id": string | null;"p_evidence": Json | null;"p_approve": boolean | null}; Returns: string };
"resolve_appointment_request": { Args: {"p_id": string | null;"p_action": string | null;"p_start"?: string | null;"p_end"?: string | null;"p_note"?: string | null}; Returns: string };
"revoke_invitation": { Args: {"p_id": string | null}; Returns: undefined };
"revoke_member": { Args: {"p_member_id": string | null}; Returns: undefined };
"revoke_professional_invitation": { Args: {"p_id": string | null}; Returns: undefined };
"save_expense": { Args: {"p_id": string | null;"p_data": Json | null;"p_replace_receipt"?: boolean | null}; Returns: string };
"set_member_permissions": { Args: {"p_member_id": string | null;"p_role": Database["public"]["Enums"]["org_member_role"] | null;"p_can_invite": boolean | null}; Returns: undefined };
"set_payment_fiscal": { Args: {"p_id": string | null;"p_tipo": string | null;"p_iva": number | null;"p_retencion_cents": number | null}; Returns: undefined };
"settle_attended_appointment": { Args: {"p_appointment_id": string | null}; Returns: undefined };
"unassign_patient": { Args: {"p_patient_id": string | null;"p_professional_id": string | null}; Returns: undefined };
"unsettle_appointment": { Args: {"p_appointment_id": string | null}; Returns: string };
"valid_push_endpoint": { Args: {"v": string | null}; Returns: boolean };
"write_audit": { Args: {"p_action": string | null;"p_subject_type": string | null;"p_subject_id": string | null;"p_org"?: string | null;"p_metadata"?: Json | null}; Returns: undefined };
}; Enums: {"appointment_request_kind": "new" | "reschedule" | "cancel";"appointment_request_status": "pending" | "accepted" | "declined" | "withdrawn";"appointment_status": "scheduled" | "confirmed" | "cancelled" | "completed";"assignment_role": "primary" | "collaborator";"assignment_type": "one_off" | "recurring";"attendance_status": "pending" | "attended" | "no_show" | "late_cancel";"categoria_servicio": "asistencia_sanitaria" | "formacion" | "peritaje" | "consultoria" | "seleccion_personal" | "coaching" | "otro";"clase_retencion": "soportada_cliente" | "practicada_colaborador" | "pago_fraccionado_irpf" | "liquidacion_iva";"criterio_imputacion": "devengo" | "cobros_pagos" | "desconocido";"email_delivery_status": "pending" | "sent" | "failed" | "no_provider";"estado_expediente": "borrador" | "pendiente_informacion" | "preparado_revision" | "revisado";"estado_registro_fiscal": "propuesto" | "confirmado" | "pendiente" | "excluido";"invite_target": "patient_access" | "org_membership";"member_status": "active" | "revoked";"notification_channel": "push" | "email";"notification_status": "queued" | "sent" | "failed" | "read";"org_access_status": "pending" | "beta" | "suspended";"org_member_role": "owner" | "admin" | "member";"organization_kind": "solo" | "center";"patient_status": "active" | "archived";"payment_status": "pending" | "paid";"recurrence_freq": "none" | "daily" | "weekly" | "biweekly" | "monthly";"resource_kind": "pdf" | "audio" | "link";"territorio_fiscal": "comun" | "alava" | "bizkaia" | "gipuzkoa" | "navarra" | "canarias" | "ceuta" | "melilla";"tipo_destinatario": "particular" | "clinica" | "aseguradora" | "empresa" | "profesional" | "otro";"tipo_factura": "ordinaria" | "rectificativa" | "anticipo";"tratamiento_iva": "sujeta" | "exenta" | "no_sujeta" | "pendiente";"verification_status": "pending" | "approved" | "rejected" | "provisional"}; CompositeTypes: Record<never,never>; }; };
type Schema = Database["public"];
export type Tables<T extends keyof (Schema["Tables"] & Schema["Views"])> = (Schema["Tables"] & Schema["Views"])[T]["Row"];
export type TablesInsert<T extends keyof Schema["Tables"]> = Schema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Schema["Tables"]> = Schema["Tables"][T]["Update"];
export type Enums<T extends keyof Schema["Enums"]> = Schema["Enums"][T];
export type CompositeTypes = Record<never,never>;
export const Constants = {"public":{"Enums":{"appointment_request_kind":["new","reschedule","cancel"],"appointment_request_status":["pending","accepted","declined","withdrawn"],"appointment_status":["scheduled","confirmed","cancelled","completed"],"assignment_role":["primary","collaborator"],"assignment_type":["one_off","recurring"],"attendance_status":["pending","attended","no_show","late_cancel"],"categoria_servicio":["asistencia_sanitaria","formacion","peritaje","consultoria","seleccion_personal","coaching","otro"],"clase_retencion":["soportada_cliente","practicada_colaborador","pago_fraccionado_irpf","liquidacion_iva"],"criterio_imputacion":["devengo","cobros_pagos","desconocido"],"email_delivery_status":["pending","sent","failed","no_provider"],"estado_expediente":["borrador","pendiente_informacion","preparado_revision","revisado"],"estado_registro_fiscal":["propuesto","confirmado","pendiente","excluido"],"invite_target":["patient_access","org_membership"],"member_status":["active","revoked"],"notification_channel":["push","email"],"notification_status":["queued","sent","failed","read"],"org_access_status":["pending","beta","suspended"],"org_member_role":["owner","admin","member"],"organization_kind":["solo","center"],"patient_status":["active","archived"],"payment_status":["pending","paid"],"recurrence_freq":["none","daily","weekly","biweekly","monthly"],"resource_kind":["pdf","audio","link"],"territorio_fiscal":["comun","alava","bizkaia","gipuzkoa","navarra","canarias","ceuta","melilla"],"tipo_destinatario":["particular","clinica","aseguradora","empresa","profesional","otro"],"tipo_factura":["ordinaria","rectificativa","anticipo"],"tratamiento_iva":["sujeta","exenta","no_sujeta","pendiente"],"verification_status":["pending","approved","rejected","provisional"]}}} as const;
