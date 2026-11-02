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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      attempts: {
        Row: {
          answers: Json
          attempt_number: number | null
          correct_count: number | null
          duration_sec: number | null
          exam_id: string | null
          id: string
          score20: number | null
          started_at: string
          submitted_at: string | null
          total: number | null
          unanswered_count: number | null
          user_id: string
          wrong_count: number | null
        }
        Insert: {
          answers?: Json
          attempt_number?: number | null
          correct_count?: number | null
          duration_sec?: number | null
          exam_id?: string | null
          id?: string
          score20?: number | null
          started_at?: string
          submitted_at?: string | null
          total?: number | null
          unanswered_count?: number | null
          user_id: string
          wrong_count?: number | null
        }
        Update: {
          answers?: Json
          attempt_number?: number | null
          correct_count?: number | null
          duration_sec?: number | null
          exam_id?: string | null
          id?: string
          score20?: number | null
          started_at?: string
          submitted_at?: string | null
          total?: number | null
          unanswered_count?: number | null
          user_id?: string
          wrong_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "attempts_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          id: string
          sort: number
          source_file: string
          subject_id: number
          title: string
        }
        Insert: {
          id?: string
          sort: number
          source_file: string
          subject_id: number
          title: string
        }
        Update: {
          id?: string
          sort?: number
          source_file?: string
          subject_id?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_hearts: {
        Row: {
          exam_id: string
          locked_until: string | null
          used: number
          user_id: string
        }
        Insert: {
          exam_id: string
          locked_until?: string | null
          used?: number
          user_id: string
        }
        Update: {
          exam_id?: string
          locked_until?: string | null
          used?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_hearts_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_hearts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_subjects: {
        Row: {
          exam_id: string
          subject_id: number
        }
        Insert: {
          exam_id: string
          subject_id: number
        }
        Update: {
          exam_id?: string
          subject_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "exam_subjects_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_subjects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      exams: {
        Row: {
          id: string
          sort: number
          source_file: string
          title: string
          unit: string | null
          year: number
        }
        Insert: {
          id?: string
          sort?: number
          source_file: string
          title: string
          unit?: string | null
          year: number
        }
        Update: {
          id?: string
          sort?: number
          source_file?: string
          title?: string
          unit?: string | null
          year?: number
        }
        Relationships: []
      }
      mission_claims: {
        Row: {
          claimed_at: string
          mission_key: string
          period_key: string
          user_id: string
        }
        Insert: {
          claimed_at?: string
          mission_key: string
          period_key: string
          user_id: string
        }
        Update: {
          claimed_at?: string
          mission_key?: string
          period_key?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_claims_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_attempts: {
        Row: {
          answers: Json
          correct_count: number | null
          id: string
          question_ids: string[]
          score20: number | null
          started_at: string
          submitted_at: string | null
          total: number | null
          unanswered_count: number | null
          user_id: string
          wrong_count: number | null
        }
        Insert: {
          answers?: Json
          correct_count?: number | null
          id?: string
          question_ids: string[]
          score20?: number | null
          started_at?: string
          submitted_at?: string | null
          total?: number | null
          unanswered_count?: number | null
          user_id: string
          wrong_count?: number | null
        }
        Update: {
          answers?: Json
          correct_count?: number | null
          id?: string
          question_ids?: string[]
          score20?: number | null
          started_at?: string
          submitted_at?: string | null
          total?: number | null
          unanswered_count?: number | null
          user_id?: string
          wrong_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "practice_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar: Json
          bubble: string | null
          coins: number
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          last_active_date: string | null
          onboarded: boolean
          pet: string | null
          sound_on: boolean
          streak: number
          xp: number
        }
        Insert: {
          avatar?: Json
          bubble?: string | null
          coins?: number
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          last_active_date?: string | null
          onboarded?: boolean
          pet?: string | null
          sound_on?: boolean
          streak?: number
          xp?: number
        }
        Update: {
          avatar?: Json
          bubble?: string | null
          coins?: number
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          last_active_date?: string | null
          onboarded?: boolean
          pet?: string | null
          sound_on?: boolean
          streak?: number
          xp?: number
        }
        Relationships: []
      }
      question_keys: {
        Row: {
          correct: string[]
          explanation: string | null
          note: string | null
          question_id: string
        }
        Insert: {
          correct?: string[]
          explanation?: string | null
          note?: string | null
          question_id: string
        }
        Update: {
          correct?: string[]
          explanation?: string | null
          note?: string | null
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_keys_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: true
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      question_mistakes: {
        Row: {
          corrected_at: string | null
          first_wrong_at: string
          last_wrong_at: string
          question_id: string
          user_id: string
          wrong_count: number
        }
        Insert: {
          corrected_at?: string | null
          first_wrong_at?: string
          last_wrong_at?: string
          question_id: string
          user_id: string
          wrong_count?: number
        }
        Update: {
          corrected_at?: string | null
          first_wrong_at?: string
          last_wrong_at?: string
          question_id?: string
          user_id?: string
          wrong_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "question_mistakes_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_mistakes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          case_text: string | null
          course_id: string | null
          created_at: string
          exam_id: string | null
          id: string
          needs_review: boolean
          options: Json
          pos: number
          review_reason: string | null
          source_file: string
          source_page: number | null
          source_year: string | null
          stem: string
          subject_id: number | null
        }
        Insert: {
          case_text?: string | null
          course_id?: string | null
          created_at?: string
          exam_id?: string | null
          id?: string
          needs_review?: boolean
          options: Json
          pos: number
          review_reason?: string | null
          source_file: string
          source_page?: number | null
          source_year?: string | null
          stem: string
          subject_id?: number | null
        }
        Update: {
          case_text?: string | null
          course_id?: string | null
          created_at?: string
          exam_id?: string | null
          id?: string
          needs_review?: boolean
          options?: Json
          pos?: number
          review_reason?: string | null
          source_file?: string
          source_page?: number | null
          source_year?: string | null
          stem?: string
          subject_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "questions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          emoji: string | null
          id: number
          name: string
          name_ar: string | null
          slug: string
          sort: number
        }
        Insert: {
          emoji?: string | null
          id?: number
          name: string
          name_ar?: string | null
          slug: string
          sort: number
        }
        Update: {
          emoji?: string | null
          id?: number
          name?: string
          name_ar?: string | null
          slug?: string
          sort?: number
        }
        Relationships: []
      }
      tomatoes: {
        Row: {
          created_at: string
          exam_id: string
          expires_at: string
          id: string
          target_id: string
          thrower_id: string
        }
        Insert: {
          created_at?: string
          exam_id: string
          expires_at?: string
          id?: string
          target_id: string
          thrower_id: string
        }
        Update: {
          created_at?: string
          exam_id?: string
          expires_at?: string
          id?: string
          target_id?: string
          thrower_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tomatoes_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tomatoes_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tomatoes_thrower_id_fkey"
            columns: ["thrower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      answer_practice: {
        Args: { _attempt: string; _q: string; _sel: string[] }
        Returns: Json
      }
      attempt_review: {
        Args: { _attempt: string }
        Returns: {
          case_text: string
          explanation: string
          note: string
          official: string[]
          ok: boolean
          options: Json
          pos: number
          question_id: string
          selected: Json
          source_file: string
          source_page: number
          stem: string
        }[]
      }
      check_answer: {
        Args: { _q: string; _record?: boolean; _sel: string[] }
        Returns: Json
      }
      claim_mission: { Args: { _key: string }; Returns: Json }
      creator_ids: { Args: never; Returns: string[] }
      exam_duration_seconds: { Args: never; Returns: number }
      exam_status: {
        Args: { _exam: string }
        Returns: {
          hearts_left: number
          locked_until: string
          unlimited: boolean
        }[]
      }
      finish_practice: { Args: { _attempt: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_creator: { Args: never; Returns: boolean }
      leaderboard: {
        Args: { _exam: string }
        Returns: {
          avatar: Json
          best_score: number
          best_time: number
          bubble: string
          display_name: string
          pet: string
          rnk: number
          tomato_until: string
          user_id: string
        }[]
      }
      my_course_counts: {
        Args: never
        Returns: {
          course_id: string
          n: number
        }[]
      }
      save_exam_answers: {
        Args: { _answers: Json; _attempt: string }
        Returns: undefined
      }
      start_attempt: { Args: { _exam: string }; Returns: string }
      start_practice: { Args: { _questions: string[] }; Returns: string }
      submit_attempt: {
        Args: { _answers: Json; _attempt: string }
        Returns: Json
      }
      throw_tomato: { Args: { _exam: string; _target: string }; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "user"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "user"],
    },
  },
} as const
