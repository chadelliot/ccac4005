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
    PostgrestVersion: "14.15"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admin_capability_grants: {
        Row: {
          capability: Database["public"]["Enums"]["admin_capability"]
          granted_at: string
          granted_by: string | null
          user_id: string
        }
        Insert: {
          capability: Database["public"]["Enums"]["admin_capability"]
          granted_at?: string
          granted_by?: string | null
          user_id: string
        }
        Update: {
          capability?: Database["public"]["Enums"]["admin_capability"]
          granted_at?: string
          granted_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      bishop_booking_activity: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          detail: string | null
          from_status:
            | Database["public"]["Enums"]["bishop_booking_status"]
            | null
          id: string
          request_id: string
          to_status: Database["public"]["Enums"]["bishop_booking_status"] | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          detail?: string | null
          from_status?:
            | Database["public"]["Enums"]["bishop_booking_status"]
            | null
          id?: string
          request_id: string
          to_status?:
            | Database["public"]["Enums"]["bishop_booking_status"]
            | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          detail?: string | null
          from_status?:
            | Database["public"]["Enums"]["bishop_booking_status"]
            | null
          id?: string
          request_id?: string
          to_status?:
            | Database["public"]["Enums"]["bishop_booking_status"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "bishop_booking_activity_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "bishop_booking_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      bishop_booking_attachments: {
        Row: {
          content_type: string | null
          created_at: string
          file_name: string
          id: string
          request_id: string
          size_bytes: number | null
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          content_type?: string | null
          created_at?: string
          file_name: string
          id?: string
          request_id: string
          size_bytes?: number | null
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          content_type?: string | null
          created_at?: string
          file_name?: string
          id?: string
          request_id?: string
          size_bytes?: number | null
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bishop_booking_attachments_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "bishop_booking_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      bishop_booking_authorized_users: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          is_bishop: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          is_bishop?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          is_bishop?: boolean
          user_id?: string
        }
        Relationships: []
      }
      bishop_booking_internal_settings: {
        Row: {
          auto_acknowledge: boolean
          bishop_email: string
          calendar_id: string
          id: number
          notification_emails: string[]
          secretary_email: string
          secretary_name: string
          tentative_hold_days: number
          updated_at: string
        }
        Insert: {
          auto_acknowledge?: boolean
          bishop_email?: string
          calendar_id?: string
          id?: number
          notification_emails?: string[]
          secretary_email?: string
          secretary_name?: string
          tentative_hold_days?: number
          updated_at?: string
        }
        Update: {
          auto_acknowledge?: boolean
          bishop_email?: string
          calendar_id?: string
          id?: number
          notification_emails?: string[]
          secretary_email?: string
          secretary_name?: string
          tentative_hold_days?: number
          updated_at?: string
        }
        Relationships: []
      }
      bishop_booking_notes: {
        Row: {
          author_email: string | null
          author_id: string
          body: string
          created_at: string
          id: string
          request_id: string
          visibility: Database["public"]["Enums"]["bishop_note_visibility"]
        }
        Insert: {
          author_email?: string | null
          author_id: string
          body: string
          created_at?: string
          id?: string
          request_id: string
          visibility?: Database["public"]["Enums"]["bishop_note_visibility"]
        }
        Update: {
          author_email?: string | null
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          request_id?: string
          visibility?: Database["public"]["Enums"]["bishop_note_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "bishop_booking_notes_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "bishop_booking_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      bishop_booking_public_settings: {
        Row: {
          accepting_requests: boolean
          accommodation_policy: string
          blocked_weekdays: number[]
          honorarium_policy: string
          id: number
          intro_body: string
          intro_heading: string
          lead_time_days: number
          response_time_note: string
          travel_policy: string
          updated_at: string
        }
        Insert: {
          accepting_requests?: boolean
          accommodation_policy?: string
          blocked_weekdays?: number[]
          honorarium_policy?: string
          id?: number
          intro_body?: string
          intro_heading?: string
          lead_time_days?: number
          response_time_note?: string
          travel_policy?: string
          updated_at?: string
        }
        Update: {
          accepting_requests?: boolean
          accommodation_policy?: string
          blocked_weekdays?: number[]
          honorarium_policy?: string
          id?: number
          intro_body?: string
          intro_heading?: string
          lead_time_days?: number
          response_time_note?: string
          travel_policy?: string
          updated_at?: string
        }
        Relationships: []
      }
      bishop_booking_rate_limit: {
        Row: {
          created_at: string
          email: string | null
          id: string
          ip_hash: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          ip_hash: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          ip_hash?: string
        }
        Relationships: []
      }
      bishop_booking_requests: {
        Row: {
          accommodation_notes: string | null
          additional_notes: string | null
          affiliation: string | null
          apparel: Database["public"]["Enums"]["bishop_apparel"] | null
          apparel_notes: string | null
          armor_bearer_count: number
          calendar_event_id: string | null
          church_address: string | null
          church_city: string
          church_name: string
          church_postal_code: string
          church_state: string
          church_website: string | null
          contact_email: string
          contact_name: string
          contact_phone: string
          contact_role: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          event_date: string
          event_end_date: string | null
          event_name: string
          event_type: Database["public"]["Enums"]["bishop_event_type"]
          event_type_other: string | null
          expected_attendance: number | null
          honorarium_notes: string | null
          id: string
          nearest_airport: string | null
          pastor_name: string
          preferred_contact_method: string
          request_number: string
          service_role: Database["public"]["Enums"]["bishop_service_role"]
          service_role_other: string | null
          start_time: string
          status: Database["public"]["Enums"]["bishop_booking_status"]
          submitted_ip_hash: string | null
          submitted_user_agent: string | null
          theme: string | null
          travel_arrangement: Database["public"]["Enums"]["bishop_travel_arrangement"]
          updated_at: string
          venue_address: string | null
          venue_name: string | null
        }
        Insert: {
          accommodation_notes?: string | null
          additional_notes?: string | null
          affiliation?: string | null
          apparel?: Database["public"]["Enums"]["bishop_apparel"] | null
          apparel_notes?: string | null
          armor_bearer_count?: number
          calendar_event_id?: string | null
          church_address?: string | null
          church_city: string
          church_name: string
          church_postal_code: string
          church_state: string
          church_website?: string | null
          contact_email: string
          contact_name: string
          contact_phone: string
          contact_role?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          event_date: string
          event_end_date?: string | null
          event_name: string
          event_type: Database["public"]["Enums"]["bishop_event_type"]
          event_type_other?: string | null
          expected_attendance?: number | null
          honorarium_notes?: string | null
          id?: string
          nearest_airport?: string | null
          pastor_name: string
          preferred_contact_method?: string
          request_number: string
          service_role: Database["public"]["Enums"]["bishop_service_role"]
          service_role_other?: string | null
          start_time: string
          status?: Database["public"]["Enums"]["bishop_booking_status"]
          submitted_ip_hash?: string | null
          submitted_user_agent?: string | null
          theme?: string | null
          travel_arrangement?: Database["public"]["Enums"]["bishop_travel_arrangement"]
          updated_at?: string
          venue_address?: string | null
          venue_name?: string | null
        }
        Update: {
          accommodation_notes?: string | null
          additional_notes?: string | null
          affiliation?: string | null
          apparel?: Database["public"]["Enums"]["bishop_apparel"] | null
          apparel_notes?: string | null
          armor_bearer_count?: number
          calendar_event_id?: string | null
          church_address?: string | null
          church_city?: string
          church_name?: string
          church_postal_code?: string
          church_state?: string
          church_website?: string | null
          contact_email?: string
          contact_name?: string
          contact_phone?: string
          contact_role?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          event_date?: string
          event_end_date?: string | null
          event_name?: string
          event_type?: Database["public"]["Enums"]["bishop_event_type"]
          event_type_other?: string | null
          expected_attendance?: number | null
          honorarium_notes?: string | null
          id?: string
          nearest_airport?: string | null
          pastor_name?: string
          preferred_contact_method?: string
          request_number?: string
          service_role?: Database["public"]["Enums"]["bishop_service_role"]
          service_role_other?: string | null
          start_time?: string
          status?: Database["public"]["Enums"]["bishop_booking_status"]
          submitted_ip_hash?: string | null
          submitted_user_agent?: string | null
          theme?: string | null
          travel_arrangement?: Database["public"]["Enums"]["bishop_travel_arrangement"]
          updated_at?: string
          venue_address?: string | null
          venue_name?: string | null
        }
        Relationships: []
      }
      certificates: {
        Row: {
          certificate_subtitle: string | null
          certificate_title: string
          church_name: string | null
          completion_date: string
          id: string
          issued_at: string
          member_name: string
          program_id: string
          signature_name: string | null
          signature_title: string | null
          user_id: string
        }
        Insert: {
          certificate_subtitle?: string | null
          certificate_title: string
          church_name?: string | null
          completion_date?: string
          id?: string
          issued_at?: string
          member_name: string
          program_id: string
          signature_name?: string | null
          signature_title?: string | null
          user_id: string
        }
        Update: {
          certificate_subtitle?: string | null
          certificate_title?: string
          church_name?: string | null
          completion_date?: string
          id?: string
          issued_at?: string
          member_name?: string
          program_id?: string
          signature_name?: string | null
          signature_title?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificates_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "reading_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_follow_ups: {
        Row: {
          assigned_to: string
          completed: boolean
          completed_at: string | null
          contact_id: string
          created_at: string
          due_date: string
          id: string
          touch_number: number
        }
        Insert: {
          assigned_to: string
          completed?: boolean
          completed_at?: string | null
          contact_id: string
          created_at?: string
          due_date: string
          id?: string
          touch_number: number
        }
        Update: {
          assigned_to?: string
          completed?: boolean
          completed_at?: string | null
          contact_id?: string
          created_at?: string
          due_date?: string
          id?: string
          touch_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "contact_follow_ups_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "evangelism_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      evangelism_contacts: {
        Row: {
          added_by: string
          address: string | null
          baptized: boolean
          city: string | null
          co_witness: string | null
          country: string | null
          created_at: string
          first_name: string
          follow_up_interval_days: number
          follow_up_opt_in: boolean
          follow_up_touches: number
          geocoded_at: string | null
          gospel_shared: boolean
          holy_ghost: boolean
          id: string
          last_name: string | null
          latitude: number | null
          longitude: number | null
          met_on: string
          notes: string | null
          phone: string | null
          prayer_request: string | null
          region: string | null
          source: string
          status: string
          updated_at: string
          visited: boolean
          where_met: string | null
          witness_id: string | null
        }
        Insert: {
          added_by: string
          address?: string | null
          baptized?: boolean
          city?: string | null
          co_witness?: string | null
          country?: string | null
          created_at?: string
          first_name: string
          follow_up_interval_days?: number
          follow_up_opt_in?: boolean
          follow_up_touches?: number
          geocoded_at?: string | null
          gospel_shared?: boolean
          holy_ghost?: boolean
          id?: string
          last_name?: string | null
          latitude?: number | null
          longitude?: number | null
          met_on?: string
          notes?: string | null
          phone?: string | null
          prayer_request?: string | null
          region?: string | null
          source?: string
          status?: string
          updated_at?: string
          visited?: boolean
          where_met?: string | null
          witness_id?: string | null
        }
        Update: {
          added_by?: string
          address?: string | null
          baptized?: boolean
          city?: string | null
          co_witness?: string | null
          country?: string | null
          created_at?: string
          first_name?: string
          follow_up_interval_days?: number
          follow_up_opt_in?: boolean
          follow_up_touches?: number
          geocoded_at?: string | null
          gospel_shared?: boolean
          holy_ghost?: boolean
          id?: string
          last_name?: string | null
          latitude?: number | null
          longitude?: number | null
          met_on?: string
          notes?: string | null
          phone?: string | null
          prayer_request?: string | null
          region?: string | null
          source?: string
          status?: string
          updated_at?: string
          visited?: boolean
          where_met?: string | null
          witness_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evangelism_contacts_witness_id_fkey"
            columns: ["witness_id"]
            isOneToOne: false
            referencedRelation: "witnesses"
            referencedColumns: ["id"]
          },
        ]
      }
      event_guest_rsvps: {
        Row: {
          created_at: string
          email: string
          event_id: string
          id: string
          name: string
          party_size: number
          response: string
        }
        Insert: {
          created_at?: string
          email: string
          event_id: string
          id?: string
          name: string
          party_size?: number
          response?: string
        }
        Update: {
          created_at?: string
          email?: string
          event_id?: string
          id?: string
          name?: string
          party_size?: number
          response?: string
        }
        Relationships: []
      }
      event_rsvps: {
        Row: {
          created_at: string
          event_id: string
          id: string
          party_size: number
          response: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          party_size?: number
          response?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          party_size?: number
          response?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          description: string | null
          end_at: string | null
          flyer_url: string | null
          group_id: string | null
          id: string
          is_featured: boolean
          is_public: boolean
          location: string | null
          rejection_reason: string | null
          start_at: string
          status: string
          submitted_by: string
          title: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          description?: string | null
          end_at?: string | null
          flyer_url?: string | null
          group_id?: string | null
          id?: string
          is_featured?: boolean
          is_public?: boolean
          location?: string | null
          rejection_reason?: string | null
          start_at: string
          status?: string
          submitted_by: string
          title: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          description?: string | null
          end_at?: string | null
          flyer_url?: string | null
          group_id?: string | null
          id?: string
          is_featured?: boolean
          is_public?: boolean
          location?: string | null
          rejection_reason?: string | null
          start_at?: string
          status?: string
          submitted_by?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          created_at: string
          group_id: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_messages: {
        Row: {
          body: string
          created_at: string
          group_id: string
          id: string
          parent_id: string | null
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          group_id: string
          id?: string
          parent_id?: string | null
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          group_id?: string
          id?: string
          parent_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_messages_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "group_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      lesson_progress: {
        Row: {
          completed_at: string
          id: string
          lesson_id: string
          program_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          id?: string
          lesson_id: string
          program_id: string
          user_id: string
        }
        Update: {
          completed_at?: string
          id?: string
          lesson_id?: string
          program_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "program_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_progress_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "reading_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      program_enrollments: {
        Row: {
          certificate_issued: boolean
          completion_date: string | null
          current_day: number | null
          current_lesson: number | null
          enrolled_at: string
          id: string
          percent_complete: number
          program_id: string
          status: string
          user_id: string
        }
        Insert: {
          certificate_issued?: boolean
          completion_date?: string | null
          current_day?: number | null
          current_lesson?: number | null
          enrolled_at?: string
          id?: string
          percent_complete?: number
          program_id: string
          status?: string
          user_id: string
        }
        Update: {
          certificate_issued?: boolean
          completion_date?: string | null
          current_day?: number | null
          current_lesson?: number | null
          enrolled_at?: string
          id?: string
          percent_complete?: number
          program_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_enrollments_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "reading_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      program_lessons: {
        Row: {
          call_to_action: string | null
          completion_required: boolean
          created_at: string
          description: string | null
          focus_scriptures: Json
          id: string
          lesson_number: number
          program_id: string
          reflection_questions: Json
          scripture_text: string | null
          teaching_notes: string | null
          title: string
          updated_at: string
        }
        Insert: {
          call_to_action?: string | null
          completion_required?: boolean
          created_at?: string
          description?: string | null
          focus_scriptures?: Json
          id?: string
          lesson_number: number
          program_id: string
          reflection_questions?: Json
          scripture_text?: string | null
          teaching_notes?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          call_to_action?: string | null
          completion_required?: boolean
          created_at?: string
          description?: string | null
          focus_scriptures?: Json
          id?: string
          lesson_number?: number
          program_id?: string
          reflection_questions?: Json
          scripture_text?: string | null
          teaching_notes?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_lessons_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "reading_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_attempts: {
        Row: {
          admin_override_score: number | null
          ai_grading_feedback: Json | null
          answers: Json
          id: string
          max_score: number
          passed: boolean
          percent: number
          quiz_id: string
          score: number
          submitted_at: string
          user_id: string
        }
        Insert: {
          admin_override_score?: number | null
          ai_grading_feedback?: Json | null
          answers?: Json
          id?: string
          max_score?: number
          passed?: boolean
          percent?: number
          quiz_id: string
          score?: number
          submitted_at?: string
          user_id: string
        }
        Update: {
          admin_override_score?: number | null
          ai_grading_feedback?: Json | null
          answers?: Json
          id?: string
          max_score?: number
          passed?: boolean
          percent?: number
          quiz_id?: string
          score?: number
          submitted_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions: {
        Row: {
          acceptable_answers: Json | null
          answer_options: Json | null
          auto_grading_enabled: boolean
          case_sensitive: boolean
          correct_answer: string | null
          created_at: string
          explanation: string | null
          grading_instructions: string | null
          id: string
          points: number
          position: number
          question_text: string
          question_type: string
          quiz_id: string
          requires_admin_review: boolean
        }
        Insert: {
          acceptable_answers?: Json | null
          answer_options?: Json | null
          auto_grading_enabled?: boolean
          case_sensitive?: boolean
          correct_answer?: string | null
          created_at?: string
          explanation?: string | null
          grading_instructions?: string | null
          id?: string
          points?: number
          position?: number
          question_text: string
          question_type: string
          quiz_id: string
          requires_admin_review?: boolean
        }
        Update: {
          acceptable_answers?: Json | null
          answer_options?: Json | null
          auto_grading_enabled?: boolean
          case_sensitive?: boolean
          correct_answer?: string | null
          created_at?: string
          explanation?: string | null
          grading_instructions?: string | null
          id?: string
          points?: number
          position?: number
          question_text?: string
          question_type?: string
          quiz_id?: string
          requires_admin_review?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          allow_retakes: boolean
          created_at: string
          description: string | null
          id: string
          lesson_id: string | null
          passing_score: number
          program_id: string
          randomize_questions: boolean
          required_for_completion: boolean
          show_correct_answers: boolean
          title: string
          updated_at: string
        }
        Insert: {
          allow_retakes?: boolean
          created_at?: string
          description?: string | null
          id?: string
          lesson_id?: string | null
          passing_score?: number
          program_id: string
          randomize_questions?: boolean
          required_for_completion?: boolean
          show_correct_answers?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          allow_retakes?: boolean
          created_at?: string
          description?: string | null
          id?: string
          lesson_id?: string | null
          passing_score?: number
          program_id?: string
          randomize_questions?: boolean
          required_for_completion?: boolean
          show_correct_answers?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "program_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quizzes_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "reading_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      reading_program_days: {
        Row: {
          assigned_date: string | null
          book_name: string | null
          chapter_end: number | null
          chapter_start: number | null
          created_at: string
          day_number: number
          id: string
          notes: string | null
          passages: Json
          program_id: string
          reflection_question: string | null
          scripture_reference: string | null
          summary: string | null
          title: string | null
        }
        Insert: {
          assigned_date?: string | null
          book_name?: string | null
          chapter_end?: number | null
          chapter_start?: number | null
          created_at?: string
          day_number: number
          id?: string
          notes?: string | null
          passages?: Json
          program_id: string
          reflection_question?: string | null
          scripture_reference?: string | null
          summary?: string | null
          title?: string | null
        }
        Update: {
          assigned_date?: string | null
          book_name?: string | null
          chapter_end?: number | null
          chapter_start?: number | null
          created_at?: string
          day_number?: number
          id?: string
          notes?: string | null
          passages?: Json
          program_id?: string
          reflection_question?: string | null
          scripture_reference?: string | null
          summary?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reading_program_days_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "reading_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      reading_program_progress: {
        Row: {
          completed_at: string
          day_id: string
          id: string
          program_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          day_id: string
          id?: string
          program_id: string
          user_id: string
        }
        Update: {
          completed_at?: string
          day_id?: string
          id?: string
          program_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reading_program_progress_day_id_fkey"
            columns: ["day_id"]
            isOneToOne: false
            referencedRelation: "reading_program_days"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reading_program_progress_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "reading_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      reading_programs: {
        Row: {
          certificate_config: Json | null
          cover_image: string | null
          created_at: string
          created_by: string
          description: string | null
          end_date: string | null
          enrollment_required: boolean
          estimated_duration: string | null
          id: string
          includes_certificate: boolean
          includes_quiz: boolean
          is_published: boolean
          program_type: string
          self_paced: boolean
          start_date: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          certificate_config?: Json | null
          cover_image?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          end_date?: string | null
          enrollment_required?: boolean
          estimated_duration?: string | null
          id?: string
          includes_certificate?: boolean
          includes_quiz?: boolean
          is_published?: boolean
          program_type?: string
          self_paced?: boolean
          start_date?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          certificate_config?: Json | null
          cover_image?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          end_date?: string | null
          enrollment_required?: boolean
          estimated_duration?: string | null
          id?: string
          includes_certificate?: boolean
          includes_quiz?: boolean
          is_published?: boolean
          program_type?: string
          self_paced?: boolean
          start_date?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      weekly_services: {
        Row: {
          day_of_week: number
          description: string | null
          id: string
          is_active: boolean
          is_virtual: boolean
          location: string | null
          sort_order: number
          start_time: string
          title: string
          updated_at: string
          updated_by: string | null
          virtual_link: string | null
          virtual_note: string | null
          virtual_platform: string | null
          virtual_until: string | null
        }
        Insert: {
          day_of_week: number
          description?: string | null
          id?: string
          is_active?: boolean
          is_virtual?: boolean
          location?: string | null
          sort_order?: number
          start_time: string
          title: string
          updated_at?: string
          updated_by?: string | null
          virtual_link?: string | null
          virtual_note?: string | null
          virtual_platform?: string | null
          virtual_until?: string | null
        }
        Update: {
          day_of_week?: number
          description?: string | null
          id?: string
          is_active?: boolean
          is_virtual?: boolean
          location?: string | null
          sort_order?: number
          start_time?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
          virtual_link?: string | null
          virtual_note?: string | null
          virtual_platform?: string | null
          virtual_until?: string | null
        }
        Relationships: []
      }
      witnesses: {
        Row: {
          created_at: string
          id: string
          linked_user_id: string | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          linked_user_id?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          linked_user_id?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      event_guest_list: {
        Args: { _event_id: string }
        Returns: {
          first_name: string
          is_member: boolean
          party_size: number
          response: string
        }[]
      }
      event_headcount: {
        Args: { _event_id: string }
        Returns: {
          going: number
          maybe: number
          parties: number
        }[]
      }
      has_bishop_desk_access: { Args: { _user_id: string }; Returns: boolean }
      has_capability: {
        Args: {
          _capability: Database["public"]["Enums"]["admin_capability"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_bishop: { Args: { _user_id: string }; Returns: boolean }
      is_group_leader: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_group_member: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      prune_bishop_rate_limit: {
        Args: { _older_than?: string }
        Returns: number
      }
      schedule_followups_for_contact: {
        Args: { _contact_id: string }
        Returns: undefined
      }
    }
    Enums: {
      admin_capability:
        | "events_review"
        | "groups_management"
        | "evangelism_management"
        | "programs_management"
        | "bishop_desk"
        | "admin_management"
      app_role: "admin" | "leader" | "member"
      bishop_apparel: "vestments" | "civic" | "shirt_tie" | "casual" | "other"
      bishop_booking_status:
        | "new"
        | "under_review"
        | "awaiting_bishop"
        | "tentatively_held"
        | "accepted"
        | "declined"
      bishop_event_type:
        | "revival"
        | "conference"
        | "anniversary"
        | "installation"
        | "ordination"
        | "musical"
        | "banquet"
        | "funeral"
        | "wedding"
        | "other"
      bishop_note_visibility: "secretary" | "bishop"
      bishop_service_role:
        | "preach"
        | "teach"
        | "keynote"
        | "officiate"
        | "panel"
        | "greetings"
        | "other"
      bishop_travel_arrangement:
        | "host_arranges"
        | "bishop_arranges"
        | "not_required"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      admin_capability: [
        "events_review",
        "groups_management",
        "evangelism_management",
        "programs_management",
        "bishop_desk",
        "admin_management",
      ],
      app_role: ["admin", "leader", "member"],
      bishop_apparel: ["vestments", "civic", "shirt_tie", "casual", "other"],
      bishop_booking_status: [
        "new",
        "under_review",
        "awaiting_bishop",
        "tentatively_held",
        "accepted",
        "declined",
      ],
      bishop_event_type: [
        "revival",
        "conference",
        "anniversary",
        "installation",
        "ordination",
        "musical",
        "banquet",
        "funeral",
        "wedding",
        "other",
      ],
      bishop_note_visibility: ["secretary", "bishop"],
      bishop_service_role: [
        "preach",
        "teach",
        "keynote",
        "officiate",
        "panel",
        "greetings",
        "other",
      ],
      bishop_travel_arrangement: [
        "host_arranges",
        "bishop_arranges",
        "not_required",
      ],
    },
  },
} as const
