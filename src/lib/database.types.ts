// Generado con npm run gen:types:embedded. Validar además contra Supabase aislado.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
export type Database = { __InternalSupabase: { PostgrestVersion: "14.5" }; public: {
Tables: {
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
};
Relationships: [{ foreignKeyName: "invitations_patient_id_fkey"; columns: ["patient_id"]; isOneToOne: false; referencedRelation: "patients"; referencedColumns: ["id"] },{ foreignKeyName: "invitations_professional_id_fkey"; columns: ["professional_id"]; isOneToOne: false; referencedRelation: "professionals"; referencedColumns: ["id"] }];
};
"mood_entries": {
Row: {
"id": string;
"patient_id": string;
"mood_value": number;
"note": string | null;
"entry_date": string;
"created_at": string;
};
Insert: {
"id"?: string;
"patient_id": string;
"mood_value": number;
"note"?: string | null;
"entry_date"?: string;
"created_at"?: string;
};
Update: {
"id"?: string;
"patient_id"?: string;
"mood_value"?: number;
"note"?: string | null;
"entry_date"?: string;
"created_at"?: string;
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
};
Relationships: [{ foreignKeyName: "patients_professional_id_fkey"; columns: ["professional_id"]; isOneToOne: false; referencedRelation: "professionals"; referencedColumns: ["id"] }];
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
"professionals": {
Row: {
"id": string;
"user_id": string;
"full_name": string | null;
"email": string | null;
"created_at": string;
"updated_at": string;
"deleted_at": string | null;
};
Insert: {
"id"?: string;
"user_id": string;
"full_name"?: string | null;
"email"?: string | null;
"created_at"?: string;
"updated_at"?: string;
"deleted_at"?: string | null;
};
Update: {
"id"?: string;
"user_id"?: string;
"full_name"?: string | null;
"email"?: string | null;
"created_at"?: string;
"updated_at"?: string;
"deleted_at"?: string | null;
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
"change_appointment": { Args: {"p_id": string | null;"p_attendance"?: string | null;"p_action"?: string | null}; Returns: string };
"claim_notifications": { Args: {"p_token": string | null;"p_limit"?: number | null}; Returns: (Database["public"]["Tables"]["notifications"]["Row"])[] };
"complete_onboarding": { Args: {"p_token": string | null;"p_template_id": string | null;"p_content_hash": string | null}; Returns: string };
"complete_patient_task": { Args: {"p_id": string | null;"p_response"?: string | null}; Returns: string };
"create_session_pack": { Args: {"p_patient_id": string | null;"p_total_sessions": number | null;"p_price_cents": number | null;"p_request_id": string | null}; Returns: string };
"current_patient_id": { Args: Record<PropertyKey, never>; Returns: string };
"current_patient_professional_id": { Args: Record<PropertyKey, never>; Returns: string };
"current_professional_id": { Args: Record<PropertyKey, never>; Returns: string };
"delete_expense": { Args: {"p_id": string | null}; Returns: string };
"ensure_consent_template": { Args: {"p_professional_id": string | null}; Returns: undefined };
"get_onboarding_consent": { Args: {"p_token"?: string | null}; Returns: Json };
"has_current_consent": { Args: Record<PropertyKey, never>; Returns: boolean };
"invitation_preview": { Args: {"p_token": string | null}; Returns: ({"valid": boolean;"professional_name": string;"expires_at": string})[] };
"issue_invitation": { Args: {"p_patient_id": string | null;"p_token_hash": string | null}; Returns: string };
"mark_notification_read": { Args: {"p_id": string | null}; Returns: undefined };
"patient_accept_consent": { Args: Record<PropertyKey, never>; Returns: string };
"patient_request_appointment": { Args: {"p_kind": string | null;"p_preferred_start"?: string | null;"p_alt_start"?: string | null;"p_duration_min"?: number | null;"p_note"?: string | null;"p_appointment_id"?: string | null}; Returns: string };
"patient_respond_appointment": { Args: {"p_appointment_id": string | null;"p_action": string | null}; Returns: undefined };
"patient_withdraw_request": { Args: {"p_id": string | null}; Returns: undefined };
"professional_owns_patient": { Args: {"p_patient_id": string | null}; Returns: boolean };
"queue_appointment_reminders": { Args: Record<PropertyKey, never>; Returns: number };
"resolve_appointment_request": { Args: {"p_id": string | null;"p_action": string | null;"p_start"?: string | null;"p_end"?: string | null;"p_note"?: string | null}; Returns: string };
"save_expense": { Args: {"p_id": string | null;"p_data": Json | null;"p_replace_receipt"?: boolean | null}; Returns: string };
"set_payment_fiscal": { Args: {"p_id": string | null;"p_tipo": string | null;"p_iva": number | null;"p_retencion_cents": number | null}; Returns: undefined };
"settle_attended_appointment": { Args: {"p_appointment_id": string | null}; Returns: undefined };
"unsettle_appointment": { Args: {"p_appointment_id": string | null}; Returns: string };
"valid_push_endpoint": { Args: {"v": string | null}; Returns: boolean };
}; Enums: {"appointment_request_kind": "new" | "reschedule" | "cancel";"appointment_request_status": "pending" | "accepted" | "declined" | "withdrawn";"appointment_status": "scheduled" | "confirmed" | "cancelled" | "completed";"assignment_type": "one_off" | "recurring";"attendance_status": "pending" | "attended" | "no_show" | "late_cancel";"notification_channel": "push" | "email";"notification_status": "queued" | "sent" | "failed" | "read";"patient_status": "active" | "archived";"payment_status": "pending" | "paid";"recurrence_freq": "none" | "daily" | "weekly" | "biweekly" | "monthly";"resource_kind": "pdf" | "audio" | "link"}; CompositeTypes: Record<never,never>; }; };
type Schema = Database["public"];
export type Tables<T extends keyof (Schema["Tables"] & Schema["Views"])> = (Schema["Tables"] & Schema["Views"])[T]["Row"];
export type TablesInsert<T extends keyof Schema["Tables"]> = Schema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Schema["Tables"]> = Schema["Tables"][T]["Update"];
export type Enums<T extends keyof Schema["Enums"]> = Schema["Enums"][T];
export type CompositeTypes = Record<never,never>;
export const Constants = {"public":{"Enums":{"appointment_request_kind":["new","reschedule","cancel"],"appointment_request_status":["pending","accepted","declined","withdrawn"],"appointment_status":["scheduled","confirmed","cancelled","completed"],"assignment_type":["one_off","recurring"],"attendance_status":["pending","attended","no_show","late_cancel"],"notification_channel":["push","email"],"notification_status":["queued","sent","failed","read"],"patient_status":["active","archived"],"payment_status":["pending","paid"],"recurrence_freq":["none","daily","weekly","biweekly","monthly"],"resource_kind":["pdf","audio","link"]}}} as const;
