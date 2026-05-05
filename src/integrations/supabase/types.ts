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
          created_at: string
          first_name: string
          gospel_shared: boolean
          holy_ghost: boolean
          id: string
          last_name: string | null
          notes: string | null
          phone: string | null
          prayer_request: string | null
          status: string
          updated_at: string
          visited: boolean
          where_met: string | null
        }
        Insert: {
          added_by: string
          address?: string | null
          baptized?: boolean
          created_at?: string
          first_name: string
          gospel_shared?: boolean
          holy_ghost?: boolean
          id?: string
          last_name?: string | null
          notes?: string | null
          phone?: string | null
          prayer_request?: string | null
          status?: string
          updated_at?: string
          visited?: boolean
          where_met?: string | null
        }
        Update: {
          added_by?: string
          address?: string | null
          baptized?: boolean
          created_at?: string
          first_name?: string
          gospel_shared?: boolean
          holy_ghost?: boolean
          id?: string
          last_name?: string | null
          notes?: string | null
          phone?: string | null
          prayer_request?: string | null
          status?: string
          updated_at?: string
          visited?: boolean
          where_met?: string | null
        }
        Relationships: []
      }
      event_guest_rsvps: {
        Row: {
          created_at: string
          email: string
          event_id: string
          id: string
          name: string
          response: string
        }
        Insert: {
          created_at?: string
          email: string
          event_id: string
          id?: string
          name: string
          response?: string
        }
        Update: {
          created_at?: string
          email?: string
          event_id?: string
          id?: string
          name?: string
          response?: string
        }
        Relationships: []
      }
      event_rsvps: {
        Row: {
          created_at: string
          event_id: string
          id: string
          response: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          response?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_group_leader: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_group_member: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "leader" | "member"
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
      app_role: ["admin", "leader", "member"],
    },
  },
} as const
