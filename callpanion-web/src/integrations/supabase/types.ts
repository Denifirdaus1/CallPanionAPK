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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      ai_call_sessions: {
        Row: {
          conversation_summary: string | null
          duration_seconds: number | null
          emergency_detected: boolean | null
          ended_at: string | null
          follow_up_scheduled: boolean | null
          id: string
          next_call_scheduled_for: string | null
          relative_id: string
          session_status: string | null
          started_at: string | null
          wellbeing_extracted: Json | null
        }
        Insert: {
          conversation_summary?: string | null
          duration_seconds?: number | null
          emergency_detected?: boolean | null
          ended_at?: string | null
          follow_up_scheduled?: boolean | null
          id?: string
          next_call_scheduled_for?: string | null
          relative_id: string
          session_status?: string | null
          started_at?: string | null
          wellbeing_extracted?: Json | null
        }
        Update: {
          conversation_summary?: string | null
          duration_seconds?: number | null
          emergency_detected?: boolean | null
          ended_at?: string | null
          follow_up_scheduled?: boolean | null
          id?: string
          next_call_scheduled_for?: string | null
          relative_id?: string
          session_status?: string | null
          started_at?: string | null
          wellbeing_extracted?: Json | null
        }
        Relationships: []
      }
      ai_companion_profiles: {
        Row: {
          consent_ts: string | null
          created_at: string | null
          dob: string | null
          full_name: string
          guardian_user_id: string | null
          id: string
          locale: string | null
          user_id: string | null
        }
        Insert: {
          consent_ts?: string | null
          created_at?: string | null
          dob?: string | null
          full_name: string
          guardian_user_id?: string | null
          id?: string
          locale?: string | null
          user_id?: string | null
        }
        Update: {
          consent_ts?: string | null
          created_at?: string | null
          dob?: string | null
          full_name?: string
          guardian_user_id?: string | null
          id?: string
          locale?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      alert_rules: {
        Row: {
          actions: Json
          conditions: Json
          created_at: string
          created_by: string
          household_id: string
          id: string
          is_active: boolean
          rule_name: string
          rule_type: string
          updated_at: string
        }
        Insert: {
          actions: Json
          conditions: Json
          created_at?: string
          created_by: string
          household_id: string
          id?: string
          is_active?: boolean
          rule_name: string
          rule_type: string
          updated_at?: string
        }
        Update: {
          actions?: Json
          conditions?: Json
          created_at?: string
          created_by?: string
          household_id?: string
          id?: string
          is_active?: boolean
          rule_name?: string
          rule_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      alerts: {
        Row: {
          acknowledged: boolean | null
          acknowledged_at: string | null
          acknowledged_by: string | null
          created_at: string
          customer_id: string
          data: Json | null
          household_id: string | null
          id: string
          message: string | null
          opened_at: string
          severity: Database["public"]["Enums"]["alert_severity"]
          status: Database["public"]["Enums"]["alert_status"]
          title: string | null
          type: string
          updated_at: string
        }
        Insert: {
          acknowledged?: boolean | null
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          customer_id: string
          data?: Json | null
          household_id?: string | null
          id?: string
          message?: string | null
          opened_at?: string
          severity: Database["public"]["Enums"]["alert_severity"]
          status?: Database["public"]["Enums"]["alert_status"]
          title?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          acknowledged?: boolean | null
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          customer_id?: string
          data?: Json | null
          household_id?: string | null
          id?: string
          message?: string | null
          opened_at?: string
          severity?: Database["public"]["Enums"]["alert_severity"]
          status?: Database["public"]["Enums"]["alert_status"]
          title?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          created_at: string
          id: string
          is_encrypted: boolean
          setting_key: string
          setting_value: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_encrypted?: boolean
          setting_key: string
          setting_value: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_encrypted?: boolean
          setting_key?: string
          setting_value?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_user_id: string | null
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string | null
          id: string
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_user_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_user_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
        }
        Relationships: []
      }
      batch_call_mappings: {
        Row: {
          batch_id: string
          batch_name: string | null
          created_at: string
          household_id: string
          id: string
          phone_number: string
          provider_call_id: string | null
          relative_id: string
          resolved_at: string | null
          scheduled_time_unix: number
        }
        Insert: {
          batch_id: string
          batch_name?: string | null
          created_at?: string
          household_id: string
          id?: string
          phone_number: string
          provider_call_id?: string | null
          relative_id: string
          resolved_at?: string | null
          scheduled_time_unix: number
        }
        Update: {
          batch_id?: string
          batch_name?: string | null
          created_at?: string
          household_id?: string
          id?: string
          phone_number?: string
          provider_call_id?: string | null
          relative_id?: string
          resolved_at?: string | null
          scheduled_time_unix?: number
        }
        Relationships: [
          {
            foreignKeyName: "batch_call_mappings_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_call_mappings_relative_id_fkey"
            columns: ["relative_id"]
            isOneToOne: false
            referencedRelation: "relatives"
            referencedColumns: ["id"]
          },
        ]
      }
      call_analysis: {
        Row: {
          call_log_id: string | null
          created_at: string
          health_flag: boolean
          id: string
          mood_score: number | null
          summary: string | null
          timestamp: string
          transcript: string | null
          updated_at: string
          urgent_flag: boolean
          user_id: string
        }
        Insert: {
          call_log_id?: string | null
          created_at?: string
          health_flag?: boolean
          id?: string
          mood_score?: number | null
          summary?: string | null
          timestamp?: string
          transcript?: string | null
          updated_at?: string
          urgent_flag?: boolean
          user_id: string
        }
        Update: {
          call_log_id?: string | null
          created_at?: string
          health_flag?: boolean
          id?: string
          mood_score?: number | null
          summary?: string | null
          timestamp?: string
          transcript?: string | null
          updated_at?: string
          urgent_flag?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_analysis_call_log_id_fkey"
            columns: ["call_log_id"]
            isOneToOne: false
            referencedRelation: "call_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      call_audit: {
        Row: {
          elder_profile_id: string
          ended_at: string | null
          error_detail: string | null
          id: string
          outcome: string | null
          session_kind: string
          started_at: string
          started_by: string | null
        }
        Insert: {
          elder_profile_id: string
          ended_at?: string | null
          error_detail?: string | null
          id?: string
          outcome?: string | null
          session_kind: string
          started_at?: string
          started_by?: string | null
        }
        Update: {
          elder_profile_id?: string
          ended_at?: string | null
          error_detail?: string | null
          id?: string
          outcome?: string | null
          session_kind?: string
          started_at?: string
          started_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_audit_elder_profile_id_fkey"
            columns: ["elder_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_audit_started_by_fkey"
            columns: ["started_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      call_logs: {
        Row: {
          ai_conversation_state: Json | null
          audio_recording_url: string | null
          call_duration: number | null
          call_outcome: string
          call_type: string | null
          conversation_summary: string | null
          created_at: string
          daily_api_room_id: string | null
          emergency_flag: boolean | null
          health_concerns_detected: boolean | null
          household_id: string | null
          id: string
          mood_assessment: string | null
          provider: string | null
          provider_call_id: string | null
          relative_id: string | null
          session_id: string | null
          timestamp: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_conversation_state?: Json | null
          audio_recording_url?: string | null
          call_duration?: number | null
          call_outcome: string
          call_type?: string | null
          conversation_summary?: string | null
          created_at?: string
          daily_api_room_id?: string | null
          emergency_flag?: boolean | null
          health_concerns_detected?: boolean | null
          household_id?: string | null
          id?: string
          mood_assessment?: string | null
          provider?: string | null
          provider_call_id?: string | null
          relative_id?: string | null
          session_id?: string | null
          timestamp?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_conversation_state?: Json | null
          audio_recording_url?: string | null
          call_duration?: number | null
          call_outcome?: string
          call_type?: string | null
          conversation_summary?: string | null
          created_at?: string
          daily_api_room_id?: string | null
          emergency_flag?: boolean | null
          health_concerns_detected?: boolean | null
          household_id?: string | null
          id?: string
          mood_assessment?: string | null
          provider?: string | null
          provider_call_id?: string | null
          relative_id?: string | null
          session_id?: string | null
          timestamp?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_logs_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_relative_id_fkey"
            columns: ["relative_id"]
            isOneToOne: false
            referencedRelation: "relatives"
            referencedColumns: ["id"]
          },
        ]
      }
      call_permissions: {
        Row: {
          allowed: boolean
          contact_name: string
          contact_type: string
          created_at: string | null
          destination: string | null
          elder_profile_id: string
          id: string
        }
        Insert: {
          allowed?: boolean
          contact_name: string
          contact_type?: string
          created_at?: string | null
          destination?: string | null
          elder_profile_id: string
          id?: string
        }
        Update: {
          allowed?: boolean
          contact_name?: string
          contact_type?: string
          created_at?: string | null
          destination?: string | null
          elder_profile_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_permissions_elder_profile_id_fkey"
            columns: ["elder_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      call_rooms: {
        Row: {
          created_at: string
          ended_at: string | null
          household_id: string
          id: string
          participants: Json | null
          relative_id: string
          room_name: string
          room_url: string
          scheduled_time: string
          started_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          household_id: string
          id?: string
          participants?: Json | null
          relative_id: string
          room_name: string
          room_url: string
          scheduled_time: string
          started_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          household_id?: string
          id?: string
          participants?: Json | null
          relative_id?: string
          room_name?: string
          room_url?: string
          scheduled_time?: string
          started_at?: string | null
          status?: string
        }
        Relationships: []
      }
      call_sessions: {
        Row: {
          call_log_id: string | null
          call_type: string
          call_uuid: string | null
          created_at: string
          duration_seconds: number | null
          ended_at: string | null
          household_id: string
          id: string
          participant_count: number | null
          provider: string
          relative_id: string
          room_id: string | null
          room_url: string | null
          scheduled_time: string
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          call_log_id?: string | null
          call_type?: string
          call_uuid?: string | null
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          household_id: string
          id?: string
          participant_count?: number | null
          provider?: string
          relative_id: string
          room_id?: string | null
          room_url?: string | null
          scheduled_time: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          call_log_id?: string | null
          call_type?: string
          call_uuid?: string | null
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          household_id?: string
          id?: string
          participant_count?: number | null
          provider?: string
          relative_id?: string
          room_id?: string | null
          room_url?: string | null
          scheduled_time?: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_call_sessions_call_log"
            columns: ["call_log_id"]
            isOneToOne: false
            referencedRelation: "call_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_call_sessions_household"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_call_sessions_relative"
            columns: ["relative_id"]
            isOneToOne: false
            referencedRelation: "relatives"
            referencedColumns: ["id"]
          },
        ]
      }
      call_summaries: {
        Row: {
          call_log_id: string | null
          created_at: string
          household_id: string
          id: string
          key_points: Json | null
          mood: string | null
          mood_score: number | null
          provider: string
          provider_call_id: string | null
          relative_id: string
          tl_dr: string | null
          transcript_url: string | null
        }
        Insert: {
          call_log_id?: string | null
          created_at?: string
          household_id: string
          id?: string
          key_points?: Json | null
          mood?: string | null
          mood_score?: number | null
          provider?: string
          provider_call_id?: string | null
          relative_id: string
          tl_dr?: string | null
          transcript_url?: string | null
        }
        Update: {
          call_log_id?: string | null
          created_at?: string
          household_id?: string
          id?: string
          key_points?: Json | null
          mood?: string | null
          mood_score?: number | null
          provider?: string
          provider_call_id?: string | null
          relative_id?: string
          tl_dr?: string | null
          transcript_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_summaries_call_log_id_fkey"
            columns: ["call_log_id"]
            isOneToOne: false
            referencedRelation: "call_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_summaries_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_summaries_relative_id_fkey"
            columns: ["relative_id"]
            isOneToOne: false
            referencedRelation: "relatives"
            referencedColumns: ["id"]
          },
        ]
      }
      case_notes: {
        Row: {
          author_user_id: string | null
          content: string
          created_at: string
          customer_id: string
          id: string
        }
        Insert: {
          author_user_id?: string | null
          content: string
          created_at?: string
          customer_id: string
          id?: string
        }
        Update: {
          author_user_id?: string | null
          content?: string
          created_at?: string
          customer_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          household_id: string
          id: string
          image_url: string | null
          message: string | null
          message_type: string
          read_at: string | null
          sender_id: string
          sender_type: string
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          household_id: string
          id?: string
          image_url?: string | null
          message?: string | null
          message_type?: string
          read_at?: string | null
          sender_id: string
          sender_type: string
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          household_id?: string
          id?: string
          image_url?: string | null
          message?: string | null
          message_type?: string
          read_at?: string | null
          sender_id?: string
          sender_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      check_ins: {
        Row: {
          created_at: string
          elder_id: string
          id: string
          notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          elder_id: string
          id?: string
          notes?: string | null
          status: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          elder_id?: string
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      checkin_alerts: {
        Row: {
          check_in_id: string
          created_at: string
          elder_id: string
          id: string
          message: string
          resolved: boolean
          resolved_at: string | null
        }
        Insert: {
          check_in_id: string
          created_at?: string
          elder_id: string
          id?: string
          message: string
          resolved?: boolean
          resolved_at?: string | null
        }
        Update: {
          check_in_id?: string
          created_at?: string
          elder_id?: string
          id?: string
          message?: string
          resolved?: boolean
          resolved_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checkin_alerts_check_in_id_fkey"
            columns: ["check_in_id"]
            isOneToOne: false
            referencedRelation: "check_ins"
            referencedColumns: ["id"]
          },
        ]
      }
      companion_agent_memory: {
        Row: {
          fact_text: string
          id: string
          last_used_at: string | null
          profile_id: string
        }
        Insert: {
          fact_text: string
          id?: string
          last_used_at?: string | null
          profile_id: string
        }
        Update: {
          fact_text?: string
          id?: string
          last_used_at?: string | null
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "companion_agent_memory_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "ai_companion_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      companion_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          id: string
          level: Database["public"]["Enums"]["companion_signal_severity"]
          message: string
          profile_id: string
          ts: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          id?: string
          level: Database["public"]["Enums"]["companion_signal_severity"]
          message: string
          profile_id: string
          ts?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          id?: string
          level?: Database["public"]["Enums"]["companion_signal_severity"]
          message?: string
          profile_id?: string
          ts?: string
        }
        Relationships: [
          {
            foreignKeyName: "companion_alerts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "ai_companion_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      companion_family_links: {
        Row: {
          id: string
          profile_id: string
          role: Database["public"]["Enums"]["companion_family_role"]
          user_id: string
        }
        Insert: {
          id?: string
          profile_id: string
          role: Database["public"]["Enums"]["companion_family_role"]
          user_id: string
        }
        Update: {
          id?: string
          profile_id?: string
          role?: Database["public"]["Enums"]["companion_family_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "companion_family_links_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "ai_companion_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      companion_game_sessions: {
        Row: {
          duration_seconds: number | null
          game_id: string
          id: string
          notes: string | null
          profile_id: string
          score: number | null
          ts: string
        }
        Insert: {
          duration_seconds?: number | null
          game_id: string
          id?: string
          notes?: string | null
          profile_id: string
          score?: number | null
          ts?: string
        }
        Update: {
          duration_seconds?: number | null
          game_id?: string
          id?: string
          notes?: string | null
          profile_id?: string
          score?: number | null
          ts?: string
        }
        Relationships: [
          {
            foreignKeyName: "companion_game_sessions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "ai_companion_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      companion_interests: {
        Row: {
          created_at: string | null
          id: string
          notes: string | null
          profile_id: string
          source: string | null
          topic: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          notes?: string | null
          profile_id: string
          source?: string | null
          topic: string
        }
        Update: {
          created_at?: string | null
          id?: string
          notes?: string | null
          profile_id?: string
          source?: string | null
          topic?: string
        }
        Relationships: [
          {
            foreignKeyName: "companion_interests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "ai_companion_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      companion_mood_checkins: {
        Row: {
          energy: number | null
          id: string
          loneliness: number | null
          notes: string | null
          orientation: boolean | null
          overall_score: number | null
          phq2: number[] | null
          profile_id: string
          recall2: number | null
          session_id: string | null
          ts: string
        }
        Insert: {
          energy?: number | null
          id?: string
          loneliness?: number | null
          notes?: string | null
          orientation?: boolean | null
          overall_score?: number | null
          phq2?: number[] | null
          profile_id: string
          recall2?: number | null
          session_id?: string | null
          ts?: string
        }
        Update: {
          energy?: number | null
          id?: string
          loneliness?: number | null
          notes?: string | null
          orientation?: boolean | null
          overall_score?: number | null
          phq2?: number[] | null
          profile_id?: string
          recall2?: number | null
          session_id?: string | null
          ts?: string
        }
        Relationships: [
          {
            foreignKeyName: "companion_mood_checkins_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "ai_companion_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companion_mood_checkins_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "companion_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      companion_news_prefs: {
        Row: {
          profile_id: string
          sources: string[] | null
          topics: string[] | null
        }
        Insert: {
          profile_id: string
          sources?: string[] | null
          topics?: string[] | null
        }
        Update: {
          profile_id?: string
          sources?: string[] | null
          topics?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "companion_news_prefs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "ai_companion_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      companion_sessions: {
        Row: {
          ended_at: string | null
          id: string
          profile_id: string
          started_at: string
        }
        Insert: {
          ended_at?: string | null
          id?: string
          profile_id: string
          started_at?: string
        }
        Update: {
          ended_at?: string | null
          id?: string
          profile_id?: string
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "companion_sessions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "ai_companion_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      companion_transcripts: {
        Row: {
          id: string
          pii_masked_text: string | null
          session_id: string
          speaker: string | null
          text: string
          ts: string
        }
        Insert: {
          id?: string
          pii_masked_text?: string | null
          session_id: string
          speaker?: string | null
          text: string
          ts?: string
        }
        Update: {
          id?: string
          pii_masked_text?: string | null
          session_id?: string
          speaker?: string | null
          text?: string
          ts?: string
        }
        Relationships: [
          {
            foreignKeyName: "companion_transcripts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "companion_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      companion_wellbeing_signals: {
        Row: {
          id: string
          profile_id: string
          rationale: string | null
          severity: Database["public"]["Enums"]["companion_signal_severity"]
          signal_type: string
          ts: string
          value: string | null
        }
        Insert: {
          id?: string
          profile_id: string
          rationale?: string | null
          severity: Database["public"]["Enums"]["companion_signal_severity"]
          signal_type: string
          ts?: string
          value?: string | null
        }
        Update: {
          id?: string
          profile_id?: string
          rationale?: string | null
          severity?: Database["public"]["Enums"]["companion_signal_severity"]
          signal_type?: string
          ts?: string
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companion_wellbeing_signals_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "ai_companion_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      consents: {
        Row: {
          captured_by: string | null
          created_at: string
          customer_id: string
          evidence_url: string | null
          id: string
          status: Database["public"]["Enums"]["consent_status"]
          type: Database["public"]["Enums"]["consent_type"]
          updated_at: string
        }
        Insert: {
          captured_by?: string | null
          created_at?: string
          customer_id: string
          evidence_url?: string | null
          id?: string
          status: Database["public"]["Enums"]["consent_status"]
          type: Database["public"]["Enums"]["consent_type"]
          updated_at?: string
        }
        Update: {
          captured_by?: string | null
          created_at?: string
          customer_id?: string
          evidence_url?: string | null
          id?: string
          status?: Database["public"]["Enums"]["consent_status"]
          type?: Database["public"]["Enums"]["consent_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consents_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_insights: {
        Row: {
          alerts: string[] | null
          analysis_type: string
          created_at: string | null
          health_concerns: string[] | null
          id: string
          key_topics: string[] | null
          mood_score: number | null
          raw_analysis: Json | null
          relative_id: string | null
          session_id: string | null
          transcript_summary: string | null
          updated_at: string | null
          wellbeing_indicators: Json | null
        }
        Insert: {
          alerts?: string[] | null
          analysis_type?: string
          created_at?: string | null
          health_concerns?: string[] | null
          id?: string
          key_topics?: string[] | null
          mood_score?: number | null
          raw_analysis?: Json | null
          relative_id?: string | null
          session_id?: string | null
          transcript_summary?: string | null
          updated_at?: string | null
          wellbeing_indicators?: Json | null
        }
        Update: {
          alerts?: string[] | null
          analysis_type?: string
          created_at?: string | null
          health_concerns?: string[] | null
          id?: string
          key_topics?: string[] | null
          mood_score?: number | null
          raw_analysis?: Json | null
          relative_id?: string | null
          session_id?: string | null
          transcript_summary?: string | null
          updated_at?: string | null
          wellbeing_indicators?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_insights_relative_id_fkey"
            columns: ["relative_id"]
            isOneToOne: false
            referencedRelation: "relatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_insights_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "call_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      cron_heartbeat: {
        Row: {
          details: Json | null
          id: string
          job_name: string
          last_run: string
          status: string
        }
        Insert: {
          details?: Json | null
          id?: string
          job_name: string
          last_run?: string
          status?: string
        }
        Update: {
          details?: Json | null
          id?: string
          job_name?: string
          last_run?: string
          status?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          address_line: string | null
          city: string | null
          country: string | null
          created_at: string
          created_by: string | null
          device_status: string | null
          email: string | null
          full_name: string
          id: string
          phone: string | null
          plan: string | null
          postcode: string | null
          preferences: Json | null
          preferred_name: string | null
          risk_flag: boolean
          status: string | null
          timezone: string | null
          updated_at: string
        }
        Insert: {
          address_line?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          device_status?: string | null
          email?: string | null
          full_name: string
          id?: string
          phone?: string | null
          plan?: string | null
          postcode?: string | null
          preferences?: Json | null
          preferred_name?: string | null
          risk_flag?: boolean
          status?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          address_line?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          device_status?: string | null
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          plan?: string | null
          postcode?: string | null
          preferences?: Json | null
          preferred_name?: string | null
          risk_flag?: boolean
          status?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      daily_call_tracking: {
        Row: {
          afternoon_called: boolean | null
          call_date: string
          created_at: string | null
          evening_called: boolean | null
          household_id: string
          id: string
          morning_called: boolean | null
          relative_id: string
          updated_at: string | null
        }
        Insert: {
          afternoon_called?: boolean | null
          call_date?: string
          created_at?: string | null
          evening_called?: boolean | null
          household_id: string
          id?: string
          morning_called?: boolean | null
          relative_id: string
          updated_at?: string | null
        }
        Update: {
          afternoon_called?: boolean | null
          call_date?: string
          created_at?: string | null
          evening_called?: boolean | null
          household_id?: string
          id?: string
          morning_called?: boolean | null
          relative_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      device_pairs: {
        Row: {
          claimed_at: string | null
          claimed_by: string | null
          code_6: string
          created_at: string
          created_by: string
          device_info: Json | null
          device_label: string | null
          expires_at: string
          household_id: string
          id: string
          pair_token: string
          relative_id: string | null
          updated_at: string
        }
        Insert: {
          claimed_at?: string | null
          claimed_by?: string | null
          code_6: string
          created_at?: string
          created_by: string
          device_info?: Json | null
          device_label?: string | null
          expires_at: string
          household_id: string
          id?: string
          pair_token: string
          relative_id?: string | null
          updated_at?: string
        }
        Update: {
          claimed_at?: string | null
          claimed_by?: string | null
          code_6?: string
          created_at?: string
          created_by?: string
          device_info?: Json | null
          device_label?: string | null
          expires_at?: string
          household_id?: string
          id?: string
          pair_token?: string
          relative_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_pairs_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_pairs_relative_id_fkey"
            columns: ["relative_id"]
            isOneToOne: false
            referencedRelation: "relatives"
            referencedColumns: ["id"]
          },
        ]
      }
      devices: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          last_sync: string | null
          metadata: Json | null
          platform: string | null
          push_token: string | null
          push_token_updated_at: string | null
          serial: string | null
          status: Database["public"]["Enums"]["device_status"]
          type: Database["public"]["Enums"]["device_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          last_sync?: string | null
          metadata?: Json | null
          platform?: string | null
          push_token?: string | null
          push_token_updated_at?: string | null
          serial?: string | null
          status?: Database["public"]["Enums"]["device_status"]
          type: Database["public"]["Enums"]["device_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          last_sync?: string | null
          metadata?: Json | null
          platform?: string | null
          push_token?: string | null
          push_token_updated_at?: string | null
          serial?: string | null
          status?: Database["public"]["Enums"]["device_status"]
          type?: Database["public"]["Enums"]["device_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "devices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      elder_access: {
        Row: {
          can_view_health: boolean
          elder_id: string
          user_id: string
        }
        Insert: {
          can_view_health?: boolean
          elder_id: string
          user_id: string
        }
        Update: {
          can_view_health?: boolean
          elder_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "elder_access_elder_id_fkey"
            columns: ["elder_id"]
            isOneToOne: false
            referencedRelation: "elders"
            referencedColumns: ["id"]
          },
        ]
      }
      elderly_household_connections: {
        Row: {
          connected_at: string
          created_at: string
          elderly_user_id: string
          household_id: string
          id: string
          relative_id: string
          updated_at: string
        }
        Insert: {
          connected_at?: string
          created_at?: string
          elderly_user_id: string
          household_id: string
          id?: string
          relative_id: string
          updated_at?: string
        }
        Update: {
          connected_at?: string
          created_at?: string
          elderly_user_id?: string
          household_id?: string
          id?: string
          relative_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "elderly_household_connections_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "elderly_household_connections_relative_id_fkey"
            columns: ["relative_id"]
            isOneToOne: false
            referencedRelation: "relatives"
            referencedColumns: ["id"]
          },
        ]
      }
      elders: {
        Row: {
          allowed_contacts: Json
          can_make_calls: boolean
          can_receive_calls: boolean
          created_at: string | null
          dob: string | null
          family_id: string
          full_name: string
          id: string
          notes: string | null
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          relative_id: string | null
          status: string
        }
        Insert: {
          allowed_contacts?: Json
          can_make_calls?: boolean
          can_receive_calls?: boolean
          created_at?: string | null
          dob?: string | null
          family_id: string
          full_name: string
          id?: string
          notes?: string | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          relative_id?: string | null
          status?: string
        }
        Update: {
          allowed_contacts?: Json
          can_make_calls?: boolean
          can_receive_calls?: boolean
          created_at?: string | null
          dob?: string | null
          family_id?: string
          full_name?: string
          id?: string
          notes?: string | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          relative_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "elders_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "elders_relative_id_fkey"
            columns: ["relative_id"]
            isOneToOne: false
            referencedRelation: "relatives"
            referencedColumns: ["id"]
          },
        ]
      }
      endpoint_access_logs: {
        Row: {
          block_reason: string | null
          blocked: boolean | null
          created_at: string | null
          endpoint: string
          id: string
          ip_address: string | null
          origin: string | null
          request_data: Json | null
          response_status: number | null
          user_agent: string | null
        }
        Insert: {
          block_reason?: string | null
          blocked?: boolean | null
          created_at?: string | null
          endpoint: string
          id?: string
          ip_address?: string | null
          origin?: string | null
          request_data?: Json | null
          response_status?: number | null
          user_agent?: string | null
        }
        Update: {
          block_reason?: string | null
          blocked?: boolean | null
          created_at?: string | null
          endpoint?: string
          id?: string
          ip_address?: string | null
          origin?: string | null
          request_data?: Json | null
          response_status?: number | null
          user_agent?: string | null
        }
        Relationships: []
      }
      events: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          elder_id: string | null
          ends_at: string | null
          family_id: string
          id: string
          starts_at: string
          title: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          elder_id?: string | null
          ends_at?: string | null
          family_id: string
          id?: string
          starts_at: string
          title: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          elder_id?: string | null
          ends_at?: string | null
          family_id?: string
          id?: string
          starts_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_elder_id_fkey"
            columns: ["elder_id"]
            isOneToOne: false
            referencedRelation: "elders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      families: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      family_invites: {
        Row: {
          accepted_by: string | null
          can_view_family_health: boolean
          created_at: string | null
          email: string
          expires_at: string
          family_id: string
          id: string
          role: Database["public"]["Enums"]["member_role"]
          token: string
        }
        Insert: {
          accepted_by?: string | null
          can_view_family_health?: boolean
          created_at?: string | null
          email: string
          expires_at: string
          family_id: string
          id?: string
          role?: Database["public"]["Enums"]["member_role"]
          token: string
        }
        Update: {
          accepted_by?: string | null
          can_view_family_health?: boolean
          created_at?: string | null
          email?: string
          expires_at?: string
          family_id?: string
          id?: string
          role?: Database["public"]["Enums"]["member_role"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_invites_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      family_links: {
        Row: {
          created_at: string
          elder_id: string
          family_id: string
          id: string
          relationship: string | null
        }
        Insert: {
          created_at?: string
          elder_id: string
          family_id: string
          id?: string
          relationship?: string | null
        }
        Update: {
          created_at?: string
          elder_id?: string
          family_id?: string
          id?: string
          relationship?: string | null
        }
        Relationships: []
      }
      family_members: {
        Row: {
          can_view_family_health: boolean
          created_at: string | null
          family_id: string
          id: string
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Insert: {
          can_view_family_health?: boolean
          created_at?: string | null
          family_id: string
          id?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Update: {
          can_view_family_health?: boolean
          created_at?: string | null
          family_id?: string
          id?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_members_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      family_messages: {
        Row: {
          content: string
          created_at: string
          household_id: string | null
          id: string
          message_type: string
          scheduled_for: string | null
          sender_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          household_id?: string | null
          id?: string
          message_type?: string
          scheduled_for?: string | null
          sender_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          household_id?: string | null
          id?: string
          message_type?: string
          scheduled_for?: string | null
          sender_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_messages_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      family_notifications: {
        Row: {
          created_at: string | null
          household_id: string
          id: string
          message: string
          notification_type: string | null
          priority: string | null
          read_by: Json | null
          relative_id: string | null
          resolved_at: string | null
          sent_to_user_ids: string[] | null
          title: string
        }
        Insert: {
          created_at?: string | null
          household_id: string
          id?: string
          message: string
          notification_type?: string | null
          priority?: string | null
          read_by?: Json | null
          relative_id?: string | null
          resolved_at?: string | null
          sent_to_user_ids?: string[] | null
          title: string
        }
        Update: {
          created_at?: string | null
          household_id?: string
          id?: string
          message?: string
          notification_type?: string | null
          priority?: string | null
          read_by?: Json | null
          relative_id?: string | null
          resolved_at?: string | null
          sent_to_user_ids?: string[] | null
          title?: string
        }
        Relationships: []
      }
      family_photos: {
        Row: {
          alt: string | null
          caption: string | null
          household_id: string | null
          id: string
          likes: number
          storage_path: string | null
          uploaded_at: string
          uploaded_by: string | null
          url: string
          user_id: string | null
        }
        Insert: {
          alt?: string | null
          caption?: string | null
          household_id?: string | null
          id?: string
          likes?: number
          storage_path?: string | null
          uploaded_at?: string
          uploaded_by?: string | null
          url: string
          user_id?: string | null
        }
        Update: {
          alt?: string | null
          caption?: string | null
          household_id?: string | null
          id?: string
          likes?: number
          storage_path?: string | null
          uploaded_at?: string
          uploaded_by?: string | null
          url?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "family_photos_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      faqs: {
        Row: {
          answer: string
          created_at: string
          display_order: number | null
          id: string
          is_active: boolean | null
          question: string
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          answer: string
          created_at?: string
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          question: string
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          answer?: string
          created_at?: string
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          question?: string
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      health_consents: {
        Row: {
          can_view_call_recordings: boolean
          can_view_detailed_health: boolean
          can_view_transcripts: boolean
          created_at: string
          granted_at: string | null
          granted_to_user_id: string
          id: string
          relative_id: string
          revoked_at: string | null
          updated_at: string
        }
        Insert: {
          can_view_call_recordings?: boolean
          can_view_detailed_health?: boolean
          can_view_transcripts?: boolean
          created_at?: string
          granted_at?: string | null
          granted_to_user_id: string
          id?: string
          relative_id: string
          revoked_at?: string | null
          updated_at?: string
        }
        Update: {
          can_view_call_recordings?: boolean
          can_view_detailed_health?: boolean
          can_view_transcripts?: boolean
          created_at?: string
          granted_at?: string | null
          granted_to_user_id?: string
          id?: string
          relative_id?: string
          revoked_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_consents_relative_id_fkey"
            columns: ["relative_id"]
            isOneToOne: false
            referencedRelation: "relatives"
            referencedColumns: ["id"]
          },
        ]
      }
      health_data_access_log: {
        Row: {
          access_level: string
          accessor_user_id: string
          consent_verified: boolean
          created_at: string
          data_type: string
          id: string
          ip_address: string | null
          relative_id: string
          user_agent: string | null
        }
        Insert: {
          access_level: string
          accessor_user_id: string
          consent_verified?: boolean
          created_at?: string
          data_type: string
          id?: string
          ip_address?: string | null
          relative_id: string
          user_agent?: string | null
        }
        Update: {
          access_level?: string
          accessor_user_id?: string
          consent_verified?: boolean
          created_at?: string
          data_type?: string
          id?: string
          ip_address?: string | null
          relative_id?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      health_data_consents: {
        Row: {
          consent_type: Database["public"]["Enums"]["consent_type"]
          created_at: string
          granted: boolean
          granted_at: string | null
          granted_to_user_id: string
          id: string
          relative_id: string
          revoked_at: string | null
          updated_at: string
        }
        Insert: {
          consent_type: Database["public"]["Enums"]["consent_type"]
          created_at?: string
          granted?: boolean
          granted_at?: string | null
          granted_to_user_id: string
          id?: string
          relative_id: string
          revoked_at?: string | null
          updated_at?: string
        }
        Update: {
          consent_type?: Database["public"]["Enums"]["consent_type"]
          created_at?: string
          granted?: boolean
          granted_at?: string | null
          granted_to_user_id?: string
          id?: string
          relative_id?: string
          revoked_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_data_consents_relative_id_fkey"
            columns: ["relative_id"]
            isOneToOne: false
            referencedRelation: "relatives"
            referencedColumns: ["id"]
          },
        ]
      }
      health_insights: {
        Row: {
          elder_id: string
          id: string
          measured_at: string
          payload: Json
        }
        Insert: {
          elder_id: string
          id?: string
          measured_at?: string
          payload: Json
        }
        Update: {
          elder_id?: string
          id?: string
          measured_at?: string
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "health_insights_elder_id_fkey"
            columns: ["elder_id"]
            isOneToOne: false
            referencedRelation: "elders"
            referencedColumns: ["id"]
          },
        ]
      }
      household_members: {
        Row: {
          added_by: string | null
          can_post_updates: boolean
          can_view_calendar: boolean
          created_at: string
          customer_id: string | null
          health_access_level:
            | Database["public"]["Enums"]["health_access_level"]
            | null
          household_id: string
          id: string
          role: Database["public"]["Enums"]["household_member_role"]
          user_id: string | null
        }
        Insert: {
          added_by?: string | null
          can_post_updates?: boolean
          can_view_calendar?: boolean
          created_at?: string
          customer_id?: string | null
          health_access_level?:
            | Database["public"]["Enums"]["health_access_level"]
            | null
          household_id: string
          id?: string
          role: Database["public"]["Enums"]["household_member_role"]
          user_id?: string | null
        }
        Update: {
          added_by?: string | null
          can_post_updates?: boolean
          can_view_calendar?: boolean
          created_at?: string
          customer_id?: string | null
          health_access_level?:
            | Database["public"]["Enums"]["health_access_level"]
            | null
          household_id?: string
          id?: string
          role?: Database["public"]["Enums"]["household_member_role"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "household_members_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "household_members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      households: {
        Row: {
          address_line: string | null
          call_method_preference: string
          city: string | null
          country: string | null
          created_at: string
          created_by: string | null
          gdpr_consent_status: boolean | null
          gdpr_consent_timestamp: string | null
          id: string
          name: string | null
          postcode: string | null
          timezone: string | null
          updated_at: string
        }
        Insert: {
          address_line?: string | null
          call_method_preference?: string
          city?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          gdpr_consent_status?: boolean | null
          gdpr_consent_timestamp?: string | null
          id?: string
          name?: string | null
          postcode?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          address_line?: string | null
          call_method_preference?: string
          city?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          gdpr_consent_status?: boolean | null
          gdpr_consent_timestamp?: string | null
          id?: string
          name?: string | null
          postcode?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      invite_rate_limiter: {
        Row: {
          email: string
          last_ip: unknown | null
          last_sent_at: string
        }
        Insert: {
          email: string
          last_ip?: unknown | null
          last_sent_at?: string
        }
        Update: {
          email?: string
          last_ip?: unknown | null
          last_sent_at?: string
        }
        Relationships: []
      }
      invites: {
        Row: {
          accepted_at: string | null
          display_name: string | null
          email: string
          expires_at: string
          gdpr_consent_status: boolean | null
          gdpr_consent_timestamp: string | null
          household_id: string
          id: string
          invited_by: string
          metadata: Json | null
          permissions_metadata: Json | null
          relationship_type: string | null
          role: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          display_name?: string | null
          email: string
          expires_at?: string
          gdpr_consent_status?: boolean | null
          gdpr_consent_timestamp?: string | null
          household_id: string
          id?: string
          invited_by: string
          metadata?: Json | null
          permissions_metadata?: Json | null
          relationship_type?: string | null
          role?: string
          token: string
        }
        Update: {
          accepted_at?: string | null
          display_name?: string | null
          email?: string
          expires_at?: string
          gdpr_consent_status?: boolean | null
          gdpr_consent_timestamp?: string | null
          household_id?: string
          id?: string
          invited_by?: string
          metadata?: Json | null
          permissions_metadata?: Json | null
          relationship_type?: string | null
          role?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invites_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_acceptances: {
        Row: {
          accepted_at: string
          created_at: string
          document_type: string
          document_version: string
          id: string
          ip_address: string | null
          subscription_id: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          accepted_at?: string
          created_at?: string
          document_type: string
          document_version: string
          id?: string
          ip_address?: string | null
          subscription_id?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          accepted_at?: string
          created_at?: string
          document_type?: string
          document_version?: string
          id?: string
          ip_address?: string | null
          subscription_id?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      media: {
        Row: {
          created_at: string
          description: string | null
          household_id: string | null
          id: string
          media_type: string
          title: string
          uploaded_by: string | null
          url: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          household_id?: string | null
          id?: string
          media_type: string
          title: string
          uploaded_by?: string | null
          url: string
        }
        Update: {
          created_at?: string
          description?: string | null
          household_id?: string | null
          id?: string
          media_type?: string
          title?: string
          uploaded_by?: string | null
          url?: string
        }
        Relationships: []
      }
      media_uploads: {
        Row: {
          created_at: string
          delivered_to: Json | null
          delivery_status: string
          file_size: number
          filename: string
          household_id: string
          id: string
          mime_type: string
          original_filename: string
          storage_path: string
          updated_at: string
          upload_status: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          delivered_to?: Json | null
          delivery_status?: string
          file_size: number
          filename: string
          household_id: string
          id?: string
          mime_type: string
          original_filename: string
          storage_path: string
          updated_at?: string
          upload_status?: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          delivered_to?: Json | null
          delivery_status?: string
          file_size?: number
          filename?: string
          household_id?: string
          id?: string
          mime_type?: string
          original_filename?: string
          storage_path?: string
          updated_at?: string
          upload_status?: string
          uploaded_by?: string
        }
        Relationships: []
      }
      notification_history: {
        Row: {
          body: string
          created_at: string
          data: Json | null
          delivered_at: string | null
          error_message: string | null
          id: string
          sent_at: string | null
          status: string
          title: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          data?: Json | null
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          sent_at?: string | null
          status?: string
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          data?: Json | null
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          sent_at?: string | null
          status?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_queue: {
        Row: {
          created_at: string | null
          device_token: string | null
          error_details: Json | null
          household_id: string
          id: string
          last_error: string | null
          max_retries: number | null
          notification_type: string
          platform: string | null
          processed_at: string | null
          queue_time: string
          relative_id: string
          retry_count: number | null
          schedule_id: string | null
          scheduled_time: string
          slot_type: string
          status: string
          updated_at: string | null
          voip_token: string | null
        }
        Insert: {
          created_at?: string | null
          device_token?: string | null
          error_details?: Json | null
          household_id: string
          id?: string
          last_error?: string | null
          max_retries?: number | null
          notification_type?: string
          platform?: string | null
          processed_at?: string | null
          queue_time: string
          relative_id: string
          retry_count?: number | null
          schedule_id?: string | null
          scheduled_time: string
          slot_type: string
          status?: string
          updated_at?: string | null
          voip_token?: string | null
        }
        Update: {
          created_at?: string | null
          device_token?: string | null
          error_details?: Json | null
          household_id?: string
          id?: string
          last_error?: string | null
          max_retries?: number | null
          notification_type?: string
          platform?: string | null
          processed_at?: string | null
          queue_time?: string
          relative_id?: string
          retry_count?: number | null
          schedule_id?: string | null
          scheduled_time?: string
          slot_type?: string
          status?: string
          updated_at?: string | null
          voip_token?: string | null
        }
        Relationships: []
      }
      org_users: {
        Row: {
          created_at: string
          email: string
          id: string
          last_login: string | null
          mfa_enabled: boolean
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["user_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          last_login?: string | null
          mfa_enabled?: boolean
          role: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          last_login?: string | null
          mfa_enabled?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      pairing_tokens: {
        Row: {
          created_at: string
          created_by: string
          device_info: Json | null
          expires_at: string
          household_id: string
          id: string
          relative_id: string | null
          status: string
          token_6_digit: string
          used_at: string | null
          used_by_device_id: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          device_info?: Json | null
          expires_at?: string
          household_id: string
          id?: string
          relative_id?: string | null
          status?: string
          token_6_digit: string
          used_at?: string | null
          used_by_device_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          device_info?: Json | null
          expires_at?: string
          household_id?: string
          id?: string
          relative_id?: string | null
          status?: string
          token_6_digit?: string
          used_at?: string | null
          used_by_device_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_pairing_tokens_household"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_pairing_tokens_relative"
            columns: ["relative_id"]
            isOneToOne: false
            referencedRelation: "relatives"
            referencedColumns: ["id"]
          },
        ]
      }
      photo_comments: {
        Row: {
          author: string | null
          created_at: string
          id: string
          photo_id: string
          text: string
          user_id: string | null
        }
        Insert: {
          author?: string | null
          created_at?: string
          id?: string
          photo_id: string
          text: string
          user_id?: string | null
        }
        Update: {
          author?: string | null
          created_at?: string
          id?: string
          photo_id?: string
          text?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "photo_comments_photo_id_fkey"
            columns: ["photo_id"]
            isOneToOne: false
            referencedRelation: "family_photos"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          mfa_enabled: boolean | null
          preferred_call_times: string[] | null
          role: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          mfa_enabled?: boolean | null
          preferred_call_times?: string[] | null
          role?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          mfa_enabled?: boolean | null
          preferred_call_times?: string[] | null
          role?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      push_notification_tokens: {
        Row: {
          created_at: string
          device_info: Json | null
          id: string
          is_active: boolean
          platform: string
          token: string
          updated_at: string
          user_id: string
          voip_token: string | null
        }
        Insert: {
          created_at?: string
          device_info?: Json | null
          id?: string
          is_active?: boolean
          platform: string
          token: string
          updated_at?: string
          user_id: string
          voip_token?: string | null
        }
        Update: {
          created_at?: string
          device_info?: Json | null
          id?: string
          is_active?: boolean
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
          voip_token?: string | null
        }
        Relationships: []
      }
      push_notifications: {
        Row: {
          body: string
          created_at: string | null
          data: Json | null
          device_id: string
          id: string
          sent_at: string | null
          title: string
        }
        Insert: {
          body: string
          created_at?: string | null
          data?: Json | null
          device_id: string
          id?: string
          sent_at?: string | null
          title: string
        }
        Update: {
          body?: string
          created_at?: string | null
          data?: Json | null
          device_id?: string
          id?: string
          sent_at?: string | null
          title?: string
        }
        Relationships: []
      }
      quotas: {
        Row: {
          calls_today: number
          daily_call_cap: number
          household_id: string
          last_reset: string | null
          monthly_call_cap: number
        }
        Insert: {
          calls_today?: number
          daily_call_cap?: number
          household_id: string
          last_reset?: string | null
          monthly_call_cap?: number
        }
        Update: {
          calls_today?: number
          daily_call_cap?: number
          household_id?: string
          last_reset?: string | null
          monthly_call_cap?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotas_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: true
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          created_at: string | null
          endpoint: string
          id: string
          identifier: string
          request_count: number | null
          window_start: string | null
        }
        Insert: {
          created_at?: string | null
          endpoint: string
          id?: string
          identifier: string
          request_count?: number | null
          window_start?: string | null
        }
        Update: {
          created_at?: string | null
          endpoint?: string
          id?: string
          identifier?: string
          request_count?: number | null
          window_start?: string | null
        }
        Relationships: []
      }
      relatives: {
        Row: {
          app_version: string | null
          call_cadence: string | null
          call_method: string | null
          country: string
          county: string | null
          created_at: string | null
          device_paired_at: string | null
          device_token: string | null
          elderly_user_id: string | null
          escalation_contact_email: string | null
          escalation_contact_name: string | null
          first_name: string | null
          household_id: string
          id: string
          inactive_since: string | null
          last_active_at: string | null
          last_call_answered_at: string | null
          last_name: string | null
          phone_e164: string | null
          phone_number: string | null
          platform: string | null
          postcode: string | null
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          timezone: string | null
          town: string
        }
        Insert: {
          app_version?: string | null
          call_cadence?: string | null
          call_method?: string | null
          country?: string
          county?: string | null
          created_at?: string | null
          device_paired_at?: string | null
          device_token?: string | null
          elderly_user_id?: string | null
          escalation_contact_email?: string | null
          escalation_contact_name?: string | null
          first_name?: string | null
          household_id: string
          id?: string
          inactive_since?: string | null
          last_active_at?: string | null
          last_call_answered_at?: string | null
          last_name?: string | null
          phone_e164?: string | null
          phone_number?: string | null
          platform?: string | null
          postcode?: string | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          timezone?: string | null
          town: string
        }
        Update: {
          app_version?: string | null
          call_cadence?: string | null
          call_method?: string | null
          country?: string
          county?: string | null
          created_at?: string | null
          device_paired_at?: string | null
          device_token?: string | null
          elderly_user_id?: string | null
          escalation_contact_email?: string | null
          escalation_contact_name?: string | null
          first_name?: string | null
          household_id?: string
          id?: string
          inactive_since?: string | null
          last_active_at?: string | null
          last_call_answered_at?: string | null
          last_name?: string | null
          phone_e164?: string | null
          phone_number?: string | null
          platform?: string | null
          postcode?: string | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          timezone?: string | null
          town?: string
        }
        Relationships: [
          {
            foreignKeyName: "relatives_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_notifications: {
        Row: {
          created_at: string
          device_token: string | null
          executed_at: string | null
          household_id: string
          id: string
          last_error: string | null
          platform: string | null
          relative_id: string
          retry_count: number | null
          schedule_id: string
          scheduled_for: string
          slot_type: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          device_token?: string | null
          executed_at?: string | null
          household_id: string
          id?: string
          last_error?: string | null
          platform?: string | null
          relative_id: string
          retry_count?: number | null
          schedule_id: string
          scheduled_for: string
          slot_type: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          device_token?: string | null
          executed_at?: string | null
          household_id?: string
          id?: string
          last_error?: string | null
          platform?: string | null
          relative_id?: string
          retry_count?: number | null
          schedule_id?: string
          scheduled_for?: string
          slot_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      schedules: {
        Row: {
          active: boolean
          afternoon_time: string
          call_type: string
          created_at: string
          evening_time: string
          household_id: string
          id: string
          morning_time: string
          relative_id: string
          timezone: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          afternoon_time?: string
          call_type?: string
          created_at?: string
          evening_time?: string
          household_id: string
          id?: string
          morning_time?: string
          relative_id: string
          timezone: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          afternoon_time?: string
          call_type?: string
          created_at?: string
          evening_time?: string
          household_id?: string
          id?: string
          morning_time?: string
          relative_id?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedules_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_relative_id_fkey"
            columns: ["relative_id"]
            isOneToOne: false
            referencedRelation: "relatives"
            referencedColumns: ["id"]
          },
        ]
      }
      security_events: {
        Row: {
          created_at: string | null
          details: Json | null
          event_type: string
          id: string
          ip_address: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          details?: Json | null
          event_type: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          details?: Json | null
          event_type?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      site_content: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      subscribers: {
        Row: {
          created_at: string
          email: string
          id: string
          stripe_customer_id: string | null
          subscribed: boolean
          subscription_end: string | null
          subscription_tier: string | null
          trial_end: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          stripe_customer_id?: string | null
          subscribed?: boolean
          subscription_end?: string | null
          subscription_tier?: string | null
          trial_end?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          stripe_customer_id?: string | null
          subscribed?: boolean
          subscription_end?: string | null
          subscription_tier?: string | null
          trial_end?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          household_id: string | null
          id: string
          plan_id: string | null
          provider: string
          provider_subscription_id: string | null
          status: string | null
          trial_end: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          household_id?: string | null
          id?: string
          plan_id?: string | null
          provider?: string
          provider_subscription_id?: string | null
          status?: string | null
          trial_end?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          household_id?: string | null
          id?: string
          plan_id?: string | null
          provider?: string
          provider_subscription_id?: string | null
          status?: string | null
          trial_end?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          created_at: string
          id: string
          is_internal: boolean
          message: string
          sender_id: string | null
          sender_type: string
          ticket_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_internal?: boolean
          message: string
          sender_id?: string | null
          sender_type?: string
          ticket_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_internal?: boolean
          message?: string
          sender_id?: string | null
          sender_type?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_oncall: {
        Row: {
          contact_details: string
          contact_method: string
          created_at: string
          end_time: string
          id: string
          is_primary: boolean
          start_time: string
          user_id: string
        }
        Insert: {
          contact_details: string
          contact_method?: string
          created_at?: string
          end_time: string
          id?: string
          is_primary?: boolean
          start_time: string
          user_id: string
        }
        Update: {
          contact_details?: string
          contact_method?: string
          created_at?: string
          end_time?: string
          id?: string
          is_primary?: boolean
          start_time?: string
          user_id?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          channel: Database["public"]["Enums"]["support_channel"]
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          description: string
          household_id: string | null
          id: string
          priority: Database["public"]["Enums"]["support_priority"]
          resolved_at: string | null
          status: Database["public"]["Enums"]["support_status"]
          subject: string
          ticket_number: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          channel?: Database["public"]["Enums"]["support_channel"]
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          description: string
          household_id?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["support_priority"]
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["support_status"]
          subject: string
          ticket_number: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          channel?: Database["public"]["Enums"]["support_channel"]
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string
          household_id?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["support_priority"]
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["support_status"]
          subject?: string
          ticket_number?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      trial_activations: {
        Row: {
          activated_at: string | null
          expires_at: string
          id: string
          is_active: boolean | null
          trial_code_id: string
          user_id: string
        }
        Insert: {
          activated_at?: string | null
          expires_at: string
          id?: string
          is_active?: boolean | null
          trial_code_id: string
          user_id: string
        }
        Update: {
          activated_at?: string | null
          expires_at?: string
          id?: string
          is_active?: boolean | null
          trial_code_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trial_activations_trial_code_id_fkey"
            columns: ["trial_code_id"]
            isOneToOne: false
            referencedRelation: "trial_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      trial_codes: {
        Row: {
          code: string
          created_at: string | null
          created_by: string | null
          current_uses: number | null
          description: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          max_uses: number | null
          trial_duration_days: number | null
          updated_at: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          created_by?: string | null
          current_uses?: number | null
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          trial_duration_days?: number | null
          updated_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          created_by?: string | null
          current_uses?: number | null
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          trial_duration_days?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      waitlist: {
        Row: {
          confirm_token: string | null
          confirmed_at: string | null
          consent: boolean
          consent_text: string | null
          created_at: string
          email: string
          id: string
          ip_hash: string | null
          unsubscribed_at: string | null
          user_agent: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          confirm_token?: string | null
          confirmed_at?: string | null
          consent?: boolean
          consent_text?: string | null
          created_at?: string
          email: string
          id?: string
          ip_hash?: string | null
          unsubscribed_at?: string | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          confirm_token?: string | null
          confirmed_at?: string | null
          consent?: boolean
          consent_text?: string | null
          created_at?: string
          email?: string
          id?: string
          ip_hash?: string | null
          unsubscribed_at?: string | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          household_id: string | null
          id: string
          payload: Json
          provider: string
          provider_call_id: string | null
          received_at: string
          signature: string | null
        }
        Insert: {
          household_id?: string | null
          id?: string
          payload: Json
          provider: string
          provider_call_id?: string | null
          received_at?: string
          signature?: string | null
        }
        Update: {
          household_id?: string | null
          id?: string
          payload?: Json
          provider?: string
          provider_call_id?: string | null
          received_at?: string
          signature?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_events_household_fk"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      wellbeing_logs: {
        Row: {
          created_at: string | null
          energy_level: number | null
          id: string
          logged_at: string | null
          mood_rating: number | null
          notes: string | null
          pain_level: number | null
          relative_id: string
          sleep_quality: number | null
        }
        Insert: {
          created_at?: string | null
          energy_level?: number | null
          id?: string
          logged_at?: string | null
          mood_rating?: number | null
          notes?: string | null
          pain_level?: number | null
          relative_id: string
          sleep_quality?: number | null
        }
        Update: {
          created_at?: string | null
          energy_level?: number | null
          id?: string
          logged_at?: string | null
          mood_rating?: number | null
          notes?: string | null
          pain_level?: number | null
          relative_id?: string
          sleep_quality?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      v_call_last_10: {
        Row: {
          call_duration: number | null
          call_log_id: string | null
          call_outcome: string | null
          emergency_flag: boolean | null
          health_concerns_detected: boolean | null
          key_points: Json | null
          mood: string | null
          mood_score: number | null
          occurred_at: string | null
          provider_call_id: string | null
          tl_dr: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_invite_secure: {
        Args: { gdpr_consent?: boolean; invite_token: string }
        Returns: Json
      }
      accept_invite_secure_v2: {
        Args: { gdpr_consent?: boolean; invite_token: string }
        Returns: Json
      }
      activate_trial_code: {
        Args: { trial_code_text: string }
        Returns: Json
      }
      add_relative_secure: {
        Args: {
          call_cadence_param?: string
          country_param?: string
          county_param?: string
          first_name_param: string
          gdpr_consent_param?: boolean
          household_id_param: string
          invite_email_param?: string
          last_name_param: string
          quiet_hours_end_param?: string
          quiet_hours_start_param?: string
          timezone_param?: string
          town_param?: string
        }
        Returns: {
          error: string
          invite_token: string
          relative_id: string
          success: boolean
        }[]
      }
      add_relative_simple: {
        Args: {
          call_cadence_param?: string
          country_param?: string
          county_param?: string
          first_name_param: string
          gdpr_consent_param?: boolean
          household_id_param: string
          invite_email_param?: string
          last_name_param: string
          quiet_hours_end_param?: string
          quiet_hours_start_param?: string
          timezone_param?: string
          town_param?: string
        }
        Returns: {
          error: string
          invite_token: string
          relative_id: string
          success: boolean
        }[]
      }
      anonymize_sensitive_data: {
        Args: { record_id: string; table_name: string }
        Returns: boolean
      }
      app_is_household_admin: {
        Args: { _household_id: string }
        Returns: boolean
      }
      app_is_household_creator: {
        Args: { _household_id: string }
        Returns: boolean
      }
      app_is_household_member: {
        Args: { _household_id: string }
        Returns: boolean
      }
      can_manage_customer: {
        Args: { _customer_id: string; _uid: string }
        Returns: boolean
      }
      can_manage_household: {
        Args: { _household_id: string; _uid: string }
        Returns: boolean
      }
      can_self_seed_household: {
        Args: { _household_id: string; _uid: string }
        Returns: boolean
      }
      check_rate_limit: {
        Args: {
          _endpoint: string
          _identifier: string
          _max_requests?: number
          _window_minutes?: number
        }
        Returns: boolean
      }
      cleanup_inactive_relatives: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_notification_queue: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      create_household_and_relative_simple: {
        Args: {
          call_cadence_param?: string
          country_param?: string
          county_param?: string
          first_name_param: string
          gdpr_consent_param?: boolean
          household_name_param: string
          invite_email_param?: string
          last_name_param: string
          quiet_hours_end_param?: string
          quiet_hours_start_param?: string
          timezone_param?: string
          town_param?: string
        }
        Returns: {
          error: string
          household_id: string
          invite_token: string
          relative_id: string
          success: boolean
        }[]
      }
      create_invite_admin: {
        Args: {
          invite_email: string
          invite_household_id?: string
          invite_role: string
        }
        Returns: {
          invite_id: string
          invite_token: string
        }[]
      }
      current_user_email: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      ensure_family_admin_for_current_user: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      fix_auth_rls_initplan: {
        Args: { p_policy: string; p_schema: string; p_table: string }
        Returns: string
      }
      generate_all_rls_fixes: {
        Args: Record<PropertyKey, never>
        Returns: {
          fix_sql: string
        }[]
      }
      generate_ticket_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_unsubscribe_token: {
        Args: { user_email: string }
        Returns: string
      }
      get_call_data_secure: {
        Args: { date_range_start?: string; user_id_param: string }
        Returns: {
          call_duration: number
          call_id: string
          call_outcome: string
          call_timestamp: string
          health_flag: boolean
          mood_score: number
        }[]
      }
      get_call_summary_secure: {
        Args: { user_id_param: string }
        Returns: {
          average_duration: number
          completed_calls: number
          last_call_date: string
          missed_calls: number
          total_calls: number
        }[]
      }
      get_call_summary_with_consent: {
        Args: { relative_id_param: string }
        Returns: {
          average_duration: number
          completed_calls: number
          last_call_date: string
          missed_calls: number
          mood_trend: string
          total_calls: number
        }[]
      }
      get_current_oncall: {
        Args: Record<PropertyKey, never>
        Returns: {
          contact_details: string
          contact_method: string
          user_id: string
        }[]
      }
      get_current_user_role: {
        Args: { _uid: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_customer_data_secure: {
        Args: { customer_id: string }
        Returns: {
          city: string
          country: string
          created_at: string
          device_status: string
          full_name: string
          id: string
          plan: string
          preferred_name: string
          risk_flag: boolean
          status: string
          timezone: string
        }[]
      }
      get_customer_sensitive_data: {
        Args: { customer_id: string }
        Returns: {
          address_line: string
          email: string
          full_name: string
          id: string
          phone: string
          postcode: string
        }[]
      }
      get_customers_list_masked: {
        Args: Record<PropertyKey, never>
        Returns: {
          created_at: string
          device_status: string
          email_masked: string
          full_name: string
          id: string
          phone_masked: string
          plan: string
          risk_flag: boolean
          status: string
        }[]
      }
      get_household_safe: {
        Args: { household_id_param: string }
        Returns: {
          created_at: string
          gdpr_consent_status: boolean
          id: string
          name: string
          timezone: string
        }[]
      }
      get_org_users_secure: {
        Args: Record<PropertyKey, never>
        Returns: {
          created_at: string
          email: string
          id: string
          last_login: string
          mfa_enabled: boolean
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["user_status"]
        }[]
      }
      get_profiles_admin: {
        Args: Record<PropertyKey, never>
        Returns: {
          created_at: string
          display_name: string
          id: string
          role: string
        }[]
      }
      get_relative_escalation_contacts: {
        Args: { relative_id_param: string }
        Returns: {
          escalation_contact_email: string
          escalation_contact_name: string
        }[]
      }
      get_relative_household_secure: {
        Args: { _relative_id: string; _user_id: string }
        Returns: string
      }
      get_relatives_for_household: {
        Args: { _household_id: string }
        Returns: {
          call_cadence: string
          country: string
          county: string
          created_at: string
          first_name: string
          id: string
          last_active_at: string
          last_name: string
          quiet_hours_end: string
          quiet_hours_start: string
          timezone: string
          town: string
        }[]
      }
      get_relatives_secure: {
        Args: { household_id_param: string }
        Returns: {
          call_cadence: string
          country: string
          county: string
          created_at: string
          first_name: string
          id: string
          last_active_at: string
          last_name: string
          quiet_hours_end: string
          quiet_hours_start: string
          timezone: string
          town: string
        }[]
      }
      get_user_health_access_level: {
        Args: { _household_id: string; _user_id: string }
        Returns: Database["public"]["Enums"]["health_access_level"]
      }
      get_user_onboarding_status: {
        Args: Record<PropertyKey, never>
        Returns: {
          email: string
          households: number
          ready_for_calls: boolean
          relatives_ready: number
          relatives_with_active_schedule: number
          signed_up_at: string
          user_id: string
        }[]
      }
      has_access_to_customer: {
        Args: { _customer_id: string; _uid: string }
        Returns: boolean
      }
      has_admin_access: {
        Args: { _uid: string }
        Returns: boolean
      }
      has_admin_access_with_mfa: {
        Args: { _uid: string }
        Returns: boolean
      }
      has_health_data_consent: {
        Args: {
          _consent_type: Database["public"]["Enums"]["consent_type"]
          _relative_id: string
          _user_id: string
        }
        Returns: boolean
      }
      increment_photo_likes: {
        Args: { photo_id: string }
        Returns: {
          alt: string | null
          caption: string | null
          household_id: string | null
          id: string
          likes: number
          storage_path: string | null
          uploaded_at: string
          uploaded_by: string | null
          url: string
          user_id: string | null
        }
      }
      is_admin: {
        Args: { _family: string }
        Returns: boolean
      }
      is_edge_function_request: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_member: {
        Args: { _family: string }
        Returns: boolean
      }
      is_primary_family_member: {
        Args: { _customer_id: string; _uid: string }
        Returns: boolean
      }
      is_service_role: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_super_admin: {
        Args: { _uid: string }
        Returns: boolean
      }
      log_audit: {
        Args: {
          _action: string
          _actor_email: string
          _actor_user_id: string
          _details: Json
          _entity_id: string
          _entity_type: string
        }
        Returns: undefined
      }
      log_failed_access_attempt: {
        Args: { resource_id: string; resource_name: string; user_id: string }
        Returns: undefined
      }
      log_health_data_access: {
        Args: {
          _access_level: string
          _consent_verified?: boolean
          _data_type: string
          _relative_id: string
        }
        Returns: undefined
      }
      log_security_event: {
        Args: { details_param?: Json; event_type_param: string }
        Returns: undefined
      }
      log_sensitive_data_access: {
        Args: {
          _accessed_fields: string[]
          _operation: string
          _record_id: string
          _table_name: string
        }
        Returns: undefined
      }
      manage_health_consent: {
        Args: {
          _can_view_call_recordings?: boolean
          _can_view_detailed_health?: boolean
          _can_view_transcripts?: boolean
          _granted_to_user_id: string
          _relative_id: string
        }
        Returns: undefined
      }
      manual_hubspot_sync: {
        Args: { household_id_param: string }
        Returns: string
      }
      notify_incoming_call: {
        Args: {
          caller_name: string
          session_id: string
          target_device_id: string
        }
        Returns: undefined
      }
      pair_flutter_device: {
        Args: {
          code_6_param: string
          device_info_param?: Json
          device_token_param: string
          platform_param: string
        }
        Returns: Json
      }
      rpc_find_due_schedules_next_min: {
        Args: Record<PropertyKey, never>
        Returns: {
          execution_mode: string
          household_id: string
          phone_number: string
          relative_id: string
          run_at_unix: number
          schedule_id: string
          slot_type: string
        }[]
      }
      rpc_find_ready_notifications: {
        Args: Record<PropertyKey, never>
        Returns: {
          device_token: string
          household_id: string
          platform: string
          queue_id: string
          relative_id: string
          retry_count: number
          schedule_id: string
          scheduled_time: string
          slot_type: string
          voip_token: string
        }[]
      }
      rpc_find_schedules_to_queue: {
        Args: Record<PropertyKey, never>
        Returns: {
          household_id: string
          relative_id: string
          schedule_id: string
          scheduled_time: string
          slot_type: string
          timezone: string
        }[]
      }
      test_callpanion_setup: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      update_device_token: {
        Args: { device_token_param: string; relative_id_param: string }
        Returns: Json
      }
      user_is_household_member: {
        Args: { _household_id: string; _uid: string }
        Returns: boolean
      }
      validate_fcm_token_household: {
        Args: {
          _device_token: string
          _household_id: string
          _relative_id?: string
        }
        Returns: boolean
      }
      validate_household_access: {
        Args: { _household_id: string; _user_id: string }
        Returns: boolean
      }
      validate_invite_token: {
        Args: { token_param: string }
        Returns: {
          expires_at: string
          household_id: string
          id: string
          is_valid: boolean
          role: string
        }[]
      }
      validate_invite_token_public: {
        Args: { token_param: string }
        Returns: {
          email: string
          expires_at: string
          household_id: string
          id: string
          is_valid: boolean
          role: string
        }[]
      }
      validate_origin_and_log: {
        Args: {
          _endpoint: string
          _ip_address: string
          _origin: string
          _request_data?: Json
          _user_agent: string
        }
        Returns: boolean
      }
      validate_unsubscribe_token: {
        Args: { token: string }
        Returns: {
          email: string
          is_valid: boolean
        }[]
      }
    }
    Enums: {
      alert_severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
      alert_status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED"
      app_role: "SUPER_ADMIN" | "SUPPORT" | "AGENT" | "USER"
      companion_family_role: "elder" | "admin" | "viewer"
      companion_signal_severity: "low" | "medium" | "high"
      consent_status: "GRANTED" | "REVOKED"
      consent_type:
        | "AI_CALLS"
        | "FAMILY_SHARING"
        | "WEARABLE_INGESTION"
        | "FAMILY_DATA_SHARING"
        | "HEALTH_MONITORING"
        | "EMERGENCY_CONTACT"
        | "SERVICE_IMPROVEMENT"
        | "PRIVACY_POLICY"
      device_status: "ACTIVE" | "INACTIVE" | "PENDING"
      device_type: "WEARABLE" | "PHONE" | "HUB"
      health_access_level: "FULL_ACCESS" | "SUMMARY_ONLY" | "NO_ACCESS"
      household_member_role: "FAMILY_PRIMARY" | "FAMILY_MEMBER" | "ELDERLY"
      member_role: "admin" | "member"
      support_channel: "APP" | "EMAIL" | "PHONE"
      support_priority: "P1" | "P2" | "P3"
      support_status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED"
      user_status: "INVITED" | "ACTIVE" | "SUSPENDED"
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
      alert_severity: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
      alert_status: ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"],
      app_role: ["SUPER_ADMIN", "SUPPORT", "AGENT", "USER"],
      companion_family_role: ["elder", "admin", "viewer"],
      companion_signal_severity: ["low", "medium", "high"],
      consent_status: ["GRANTED", "REVOKED"],
      consent_type: [
        "AI_CALLS",
        "FAMILY_SHARING",
        "WEARABLE_INGESTION",
        "FAMILY_DATA_SHARING",
        "HEALTH_MONITORING",
        "EMERGENCY_CONTACT",
        "SERVICE_IMPROVEMENT",
        "PRIVACY_POLICY",
      ],
      device_status: ["ACTIVE", "INACTIVE", "PENDING"],
      device_type: ["WEARABLE", "PHONE", "HUB"],
      health_access_level: ["FULL_ACCESS", "SUMMARY_ONLY", "NO_ACCESS"],
      household_member_role: ["FAMILY_PRIMARY", "FAMILY_MEMBER", "ELDERLY"],
      member_role: ["admin", "member"],
      support_channel: ["APP", "EMAIL", "PHONE"],
      support_priority: ["P1", "P2", "P3"],
      support_status: ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"],
      user_status: ["INVITED", "ACTIVE", "SUSPENDED"],
    },
  },
} as const
