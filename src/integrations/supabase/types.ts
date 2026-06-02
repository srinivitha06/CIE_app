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
      assigned_tests: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          exam_id: string
          id: string
          locked: boolean
          student_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          exam_id: string
          id?: string
          locked?: boolean
          student_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          exam_id?: string
          id?: string
          locked?: boolean
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assigned_tests_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
        ]
      }
      exams: {
        Row: {
          category: Database["public"]["Enums"]["exam_category"]
          created_at: string
          created_by: string | null
          description: string | null
          duration_minutes: number
          end_at: string | null
          id: string
          is_published: boolean
          start_at: string | null
          timer_enabled: boolean
          title: string
          total_questions: number
          updated_at: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["exam_category"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number
          end_at?: string | null
          id?: string
          is_published?: boolean
          start_at?: string | null
          timer_enabled?: boolean
          title: string
          total_questions?: number
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["exam_category"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number
          end_at?: string | null
          id?: string
          is_published?: boolean
          start_at?: string | null
          timer_enabled?: boolean
          title?: string
          total_questions?: number
          updated_at?: string
        }
        Relationships: []
      }
      group_members: {
        Row: {
          added_at: string
          group_id: string
          id: string
          student_id: string
        }
        Insert: {
          added_at?: string
          group_id: string
          id?: string
          student_id: string
        }
        Update: {
          added_at?: string
          group_id?: string
          id?: string
          student_id?: string
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
      groups: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          class_name: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          roll_number: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          class_name?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          roll_number?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          class_name?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          roll_number?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      questions: {
        Row: {
          correct_option: string
          created_at: string
          exam_id: string
          id: string
          marks: number
          option_a: string
          option_b: string
          option_c: string
          option_d: string
          position: number
          question_text: string
        }
        Insert: {
          correct_option: string
          created_at?: string
          exam_id: string
          id?: string
          marks?: number
          option_a: string
          option_b: string
          option_c: string
          option_d: string
          position?: number
          question_text: string
        }
        Update: {
          correct_option?: string
          created_at?: string
          exam_id?: string
          id?: string
          marks?: number
          option_a?: string
          option_b?: string
          option_c?: string
          option_d?: string
          position?: number
          question_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
        ]
      }
      results: {
        Row: {
          answers: Json
          auto_submitted: boolean
          correct_count: number
          exam_id: string
          id: string
          score: number
          started_at: string
          student_id: string
          submitted_at: string
          total_marks: number
          total_questions: number
        }
        Insert: {
          answers?: Json
          auto_submitted?: boolean
          correct_count?: number
          exam_id: string
          id?: string
          score?: number
          started_at?: string
          student_id: string
          submitted_at?: string
          total_marks?: number
          total_questions?: number
        }
        Update: {
          answers?: Json
          auto_submitted?: boolean
          correct_count?: number
          exam_id?: string
          id?: string
          score?: number
          started_at?: string
          student_id?: string
          submitted_at?: string
          total_marks?: number
          total_questions?: number
        }
        Relationships: [
          {
            foreignKeyName: "results_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
        ]
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
      violations: {
        Row: {
          created_at: string
          detail: string | null
          exam_id: string
          id: string
          student_id: string
          violation: Database["public"]["Enums"]["violation_type"]
        }
        Insert: {
          created_at?: string
          detail?: string | null
          exam_id: string
          id?: string
          student_id: string
          violation: Database["public"]["Enums"]["violation_type"]
        }
        Update: {
          created_at?: string
          detail?: string | null
          exam_id?: string
          id?: string
          student_id?: string
          violation?: Database["public"]["Enums"]["violation_type"]
        }
        Relationships: [
          {
            foreignKeyName: "violations_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
        ]
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
    }
    Enums: {
      app_role: "admin" | "student"
      exam_category: "aptitude" | "softskill"
      violation_type:
        | "tab_switch"
        | "fullscreen_exit"
        | "visibility_hidden"
        | "copy_paste"
        | "right_click"
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
      app_role: ["admin", "student"],
      exam_category: ["aptitude", "softskill"],
      violation_type: [
        "tab_switch",
        "fullscreen_exit",
        "visibility_hidden",
        "copy_paste",
        "right_click",
      ],
    },
  },
} as const
