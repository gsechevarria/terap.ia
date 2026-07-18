export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agenda_blocks: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          professional_id: string
          reason: string | null
          starts_at: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          professional_id: string
          reason?: string | null
          starts_at: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          professional_id?: string
          reason?: string | null
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agenda_blocks_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          attendance: Database["public"]["Enums"]["attendance_status"]
          created_at: string
          ends_at: string
          id: string
          notes: string | null
          parent_appointment_id: string | null
          patient_id: string
          professional_id: string
          recurrence_freq: Database["public"]["Enums"]["recurrence_freq"]
          recurrence_until: string | null
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
          video_link: string | null
        }
        Insert: {
          attendance?: Database["public"]["Enums"]["attendance_status"]
          created_at?: string
          ends_at: string
          id?: string
          notes?: string | null
          parent_appointment_id?: string | null
          patient_id: string
          professional_id: string
          recurrence_freq?: Database["public"]["Enums"]["recurrence_freq"]
          recurrence_until?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
          video_link?: string | null
        }
        Update: {
          attendance?: Database["public"]["Enums"]["attendance_status"]
          created_at?: string
          ends_at?: string
          id?: string
          notes?: string | null
          parent_appointment_id?: string | null
          patient_id?: string
          professional_id?: string
          recurrence_freq?: Database["public"]["Enums"]["recurrence_freq"]
          recurrence_until?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
          video_link?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_parent_appointment_id_fkey"
            columns: ["parent_appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_templates: {
        Row: {
          active: boolean
          body: string
          created_at: string
          id: string
          professional_id: string
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          active?: boolean
          body: string
          created_at?: string
          id?: string
          professional_id: string
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          active?: boolean
          body?: string
          created_at?: string
          id?: string
          professional_id?: string
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "consent_templates_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      consents: {
        Row: {
          accepted: boolean
          content_hash: string | null
          created_at: string
          id: string
          patient_id: string
          professional_id: string
          signed_at: string | null
          template_id: string | null
          template_version: number | null
        }
        Insert: {
          accepted?: boolean
          content_hash?: string | null
          created_at?: string
          id?: string
          patient_id: string
          professional_id: string
          signed_at?: string | null
          template_id?: string | null
          template_version?: number | null
        }
        Update: {
          accepted?: boolean
          content_hash?: string | null
          created_at?: string
          id?: string
          patient_id?: string
          professional_id?: string
          signed_at?: string | null
          template_id?: string | null
          template_version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "consents_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consents_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consents_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "consent_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          id: string
          patient_id: string
          professional_id: string
          storage_path: string
          title: string | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          patient_id: string
          professional_id: string
          storage_path: string
          title?: string | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          patient_id?: string
          professional_id?: string
          storage_path?: string
          title?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      emergency_links: {
        Row: {
          created_at: string
          description: string | null
          id: string
          label: string
          phone: string | null
          professional_id: string | null
          sort_order: number
          updated_at: string
          url: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          label: string
          phone?: string | null
          professional_id?: string | null
          sort_order?: number
          updated_at?: string
          url?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          label?: string
          phone?: string | null
          professional_id?: string | null
          sort_order?: number
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "emergency_links_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string | null
          expires_at: string
          id: string
          patient_id: string
          professional_id: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          patient_id: string
          professional_id: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          patient_id?: string
          professional_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      mood_entries: {
        Row: {
          created_at: string
          entry_date: string
          id: string
          mood_value: number
          note: string | null
          patient_id: string
        }
        Insert: {
          created_at?: string
          entry_date?: string
          id?: string
          mood_value: number
          note?: string | null
          patient_id: string
        }
        Update: {
          created_at?: string
          entry_date?: string
          id?: string
          mood_value?: number
          note?: string | null
          patient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mood_entries_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          appointment_reminders: boolean
          email_fallback: boolean
          new_appointment: boolean
          new_scale: boolean
          new_task: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          appointment_reminders?: boolean
          email_fallback?: boolean
          new_appointment?: boolean
          new_scale?: boolean
          new_task?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          appointment_reminders?: boolean
          email_fallback?: boolean
          new_appointment?: boolean
          new_scale?: boolean
          new_task?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          id: string
          patient_id: string | null
          payload: Json | null
          professional_id: string | null
          read_at: string | null
          scheduled_for: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["notification_status"]
          title: string | null
          type: string | null
          user_id: string
        }
        Insert: {
          body?: string | null
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          id?: string
          patient_id?: string | null
          payload?: Json | null
          professional_id?: string | null
          read_at?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          title?: string | null
          type?: string | null
          user_id: string
        }
        Update: {
          body?: string | null
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          id?: string
          patient_id?: string | null
          payload?: Json | null
          professional_id?: string | null
          read_at?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          title?: string | null
          type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_notes: {
        Row: {
          body: string
          created_at: string
          id: string
          patient_id: string
          professional_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          patient_id: string
          professional_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          patient_id?: string
          professional_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_notes_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_notes_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          professional_id: string
          status: Database["public"]["Enums"]["patient_status"]
          tags: string[]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          professional_id: string
          status?: Database["public"]["Enums"]["patient_status"]
          tags?: string[]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          professional_id?: string
          status?: Database["public"]["Enums"]["patient_status"]
          tags?: string[]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patients_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_settings: {
        Row: {
          created_at: string
          currency: string
          id: string
          patient_id: string | null
          price_cents: number
          professional_id: string
          session_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          patient_id?: string | null
          price_cents: number
          professional_id: string
          session_type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          patient_id?: string | null
          price_cents?: number
          professional_id?: string
          session_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_settings_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_settings_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_cents: number
          appointment_id: string | null
          created_at: string
          currency: string
          id: string
          method: string | null
          note: string | null
          paid_at: string | null
          patient_id: string
          professional_id: string
          session_pack_id: string | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
        }
        Insert: {
          amount_cents: number
          appointment_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          method?: string | null
          note?: string | null
          paid_at?: string | null
          patient_id: string
          professional_id: string
          session_pack_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          appointment_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          method?: string | null
          note?: string | null
          paid_at?: string | null
          patient_id?: string
          professional_id?: string
          session_pack_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_session_pack_id_fkey"
            columns: ["session_pack_id"]
            isOneToOne: false
            referencedRelation: "session_packs"
            referencedColumns: ["id"]
          },
        ]
      }
      professionals: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      resources: {
        Row: {
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["resource_kind"]
          patient_id: string | null
          professional_id: string
          storage_path: string | null
          title: string
          updated_at: string
          url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["resource_kind"]
          patient_id?: string | null
          professional_id: string
          storage_path?: string | null
          title: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["resource_kind"]
          patient_id?: string | null
          professional_id?: string
          storage_path?: string | null
          title?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resources_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resources_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      scale_assignments: {
        Row: {
          active: boolean
          assignment_type: Database["public"]["Enums"]["assignment_type"]
          created_at: string
          ends_on: string | null
          id: string
          patient_id: string
          professional_id: string
          recurrence_interval_days: number | null
          scale_id: string
          starts_on: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          assignment_type?: Database["public"]["Enums"]["assignment_type"]
          created_at?: string
          ends_on?: string | null
          id?: string
          patient_id: string
          professional_id: string
          recurrence_interval_days?: number | null
          scale_id: string
          starts_on?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          assignment_type?: Database["public"]["Enums"]["assignment_type"]
          created_at?: string
          ends_on?: string | null
          id?: string
          patient_id?: string
          professional_id?: string
          recurrence_interval_days?: number | null
          scale_id?: string
          starts_on?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scale_assignments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scale_assignments_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scale_assignments_scale_id_fkey"
            columns: ["scale_id"]
            isOneToOne: false
            referencedRelation: "scales"
            referencedColumns: ["id"]
          },
        ]
      }
      scale_responses: {
        Row: {
          answers: Json
          assignment_id: string
          created_at: string
          flagged: boolean
          id: string
          patient_id: string
          scale_id: string
          score: number | null
          severity: string | null
          submitted_at: string
        }
        Insert: {
          answers: Json
          assignment_id: string
          created_at?: string
          flagged?: boolean
          id?: string
          patient_id: string
          scale_id: string
          score?: number | null
          severity?: string | null
          submitted_at?: string
        }
        Update: {
          answers?: Json
          assignment_id?: string
          created_at?: string
          flagged?: boolean
          id?: string
          patient_id?: string
          scale_id?: string
          score?: number | null
          severity?: string | null
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scale_responses_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "scale_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scale_responses_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scale_responses_scale_id_fkey"
            columns: ["scale_id"]
            isOneToOne: false
            referencedRelation: "scales"
            referencedColumns: ["id"]
          },
        ]
      }
      scales: {
        Row: {
          code: string
          created_at: string
          definition: Json
          description: string | null
          id: string
          is_active: boolean
          name: string
          version: number
        }
        Insert: {
          code: string
          created_at?: string
          definition: Json
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          version?: number
        }
        Update: {
          code?: string
          created_at?: string
          definition?: Json
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          version?: number
        }
        Relationships: []
      }
      session_packs: {
        Row: {
          active: boolean
          created_at: string
          currency: string
          id: string
          patient_id: string
          price_cents: number | null
          professional_id: string
          purchased_at: string
          total_sessions: number
          updated_at: string
          used_sessions: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          currency?: string
          id?: string
          patient_id: string
          price_cents?: number | null
          professional_id: string
          purchased_at?: string
          total_sessions: number
          updated_at?: string
          used_sessions?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          currency?: string
          id?: string
          patient_id?: string
          price_cents?: number | null
          professional_id?: string
          purchased_at?: string
          total_sessions?: number
          updated_at?: string
          used_sessions?: number
        }
        Relationships: [
          {
            foreignKeyName: "session_packs_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_packs_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      task_completions: {
        Row: {
          completed_at: string
          created_at: string
          id: string
          patient_id: string
          response_text: string | null
          task_id: string
        }
        Insert: {
          completed_at?: string
          created_at?: string
          id?: string
          patient_id: string
          response_text?: string | null
          task_id: string
        }
        Update: {
          completed_at?: string
          created_at?: string
          id?: string
          patient_id?: string
          response_text?: string | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_completions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_completions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          patient_id: string
          professional_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          patient_id: string
          professional_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          patient_id?: string
          professional_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation: { Args: { p_token: string }; Returns: string }
      current_patient_id: { Args: never; Returns: string }
      current_patient_professional_id: { Args: never; Returns: string }
      current_professional_id: { Args: never; Returns: string }
      invitation_preview: {
        Args: { p_token: string }
        Returns: {
          expires_at: string
          professional_name: string
          valid: boolean
        }[]
      }
      professional_owns_patient: {
        Args: { p_patient_id: string }
        Returns: boolean
      }
    }
    Enums: {
      appointment_status: "scheduled" | "confirmed" | "cancelled" | "completed"
      assignment_type: "one_off" | "recurring"
      attendance_status: "pending" | "attended" | "no_show" | "late_cancel"
      notification_channel: "push" | "email"
      notification_status: "queued" | "sent" | "failed" | "read"
      patient_status: "active" | "archived"
      payment_status: "pending" | "paid"
      recurrence_freq: "none" | "daily" | "weekly" | "biweekly" | "monthly"
      resource_kind: "pdf" | "audio" | "link"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      appointment_status: ["scheduled", "confirmed", "cancelled", "completed"],
      assignment_type: ["one_off", "recurring"],
      attendance_status: ["pending", "attended", "no_show", "late_cancel"],
      notification_channel: ["push", "email"],
      notification_status: ["queued", "sent", "failed", "read"],
      patient_status: ["active", "archived"],
      payment_status: ["pending", "paid"],
      recurrence_freq: ["none", "daily", "weekly", "biweekly", "monthly"],
      resource_kind: ["pdf", "audio", "link"],
    },
  },
} as const
