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
      case_status_events: {
        Row: {
          created_at: string
          id: string
          observed_at: string
          source: string
          status_detail_en: string | null
          status_detail_es: string | null
          status_text_en: string
          status_text_es: string | null
          tracked_case_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          observed_at: string
          source?: string
          status_detail_en?: string | null
          status_detail_es?: string | null
          status_text_en: string
          status_text_es?: string | null
          tracked_case_id: string
        }
        Update: {
          created_at?: string
          id?: string
          observed_at?: string
          source?: string
          status_detail_en?: string | null
          status_detail_es?: string | null
          status_text_en?: string
          status_text_es?: string | null
          tracked_case_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_status_events_tracked_case_id_fkey"
            columns: ["tracked_case_id"]
            isOneToOne: false
            referencedRelation: "my_case_details"
            referencedColumns: ["tracked_case_id"]
          },
          {
            foreignKeyName: "case_status_events_tracked_case_id_fkey"
            columns: ["tracked_case_id"]
            isOneToOne: false
            referencedRelation: "tracked_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      devices: {
        Row: {
          created_at: string
          expo_push_token: string
          id: string
          last_seen_at: string
          platform: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expo_push_token: string
          id?: string
          last_seen_at?: string
          platform: string
          user_id: string
        }
        Update: {
          created_at?: string
          expo_push_token?: string
          id?: string
          last_seen_at?: string
          platform?: string
          user_id?: string
        }
        Relationships: []
      }
      news_items: {
        Row: {
          external_id: string
          fetched_at: string
          id: string
          published_at: string
          source: string
          summary: string | null
          title: string
          url: string
        }
        Insert: {
          external_id: string
          fetched_at?: string
          id?: string
          published_at: string
          source: string
          summary?: string | null
          title: string
          url: string
        }
        Update: {
          external_id?: string
          fetched_at?: string
          id?: string
          published_at?: string
          source?: string
          summary?: string | null
          title?: string
          url?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          case_status_event_id: string
          channel: string
          created_at: string
          error: string | null
          id: string
          sent_at: string | null
          status: string
          user_case_id: string
          user_id: string
        }
        Insert: {
          case_status_event_id: string
          channel: string
          created_at?: string
          error?: string | null
          id?: string
          sent_at?: string | null
          status?: string
          user_case_id: string
          user_id: string
        }
        Update: {
          case_status_event_id?: string
          channel?: string
          created_at?: string
          error?: string | null
          id?: string
          sent_at?: string | null
          status?: string
          user_case_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_case_status_event_id_fkey"
            columns: ["case_status_event_id"]
            isOneToOne: false
            referencedRelation: "case_status_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_case_status_event_id_fkey"
            columns: ["case_status_event_id"]
            isOneToOne: false
            referencedRelation: "my_case_events"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "notifications_user_case_id_fkey"
            columns: ["user_case_id"]
            isOneToOne: false
            referencedRelation: "my_case_details"
            referencedColumns: ["user_case_id"]
          },
          {
            foreignKeyName: "notifications_user_case_id_fkey"
            columns: ["user_case_id"]
            isOneToOne: false
            referencedRelation: "user_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      ops_alerts: {
        Row: {
          detail: Json | null
          id: string
          kind: string
          sent_at: string
        }
        Insert: {
          detail?: Json | null
          id?: string
          kind: string
          sent_at?: string
        }
        Update: {
          detail?: Json | null
          id?: string
          kind?: string
          sent_at?: string
        }
        Relationships: []
      }
      poll_runs: {
        Row: {
          changed: number | null
          claimed: number | null
          crash_message: string | null
          crashed: boolean
          created_at: string
          error_kinds: Json | null
          errored: number | null
          finished_at: string | null
          id: string
          provider: Database["public"]["Enums"]["case_provider"]
          started_at: string
          updated: number | null
        }
        Insert: {
          changed?: number | null
          claimed?: number | null
          crash_message?: string | null
          crashed?: boolean
          created_at?: string
          error_kinds?: Json | null
          errored?: number | null
          finished_at?: string | null
          id?: string
          provider: Database["public"]["Enums"]["case_provider"]
          started_at?: string
          updated?: number | null
        }
        Update: {
          changed?: number | null
          claimed?: number | null
          crash_message?: string | null
          crashed?: boolean
          created_at?: string
          error_kinds?: Json | null
          errored?: number | null
          finished_at?: string | null
          id?: string
          provider?: Database["public"]["Enums"]["case_provider"]
          started_at?: string
          updated?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          preferred_language: string
          quiet_hours_end: number | null
          quiet_hours_start: number | null
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          preferred_language?: string
          quiet_hours_end?: number | null
          quiet_hours_start?: number | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          preferred_language?: string
          quiet_hours_end?: number | null
          quiet_hours_start?: number | null
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      tracked_cases: {
        Row: {
          body_hash: string | null
          case_key: string
          check_interval_seconds: number
          consecutive_errors: number
          created_at: string
          form_type: string | null
          id: string
          last_changed_at: string | null
          last_checked_at: string | null
          last_error_code: string | null
          last_error_message: string | null
          next_check_at: string
          provider: Database["public"]["Enums"]["case_provider"]
          status_detail_en: string | null
          status_detail_es: string | null
          status_text_en: string | null
          status_text_es: string | null
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          body_hash?: string | null
          case_key: string
          check_interval_seconds?: number
          consecutive_errors?: number
          created_at?: string
          form_type?: string | null
          id?: string
          last_changed_at?: string | null
          last_checked_at?: string | null
          last_error_code?: string | null
          last_error_message?: string | null
          next_check_at?: string
          provider: Database["public"]["Enums"]["case_provider"]
          status_detail_en?: string | null
          status_detail_es?: string | null
          status_text_en?: string | null
          status_text_es?: string | null
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          body_hash?: string | null
          case_key?: string
          check_interval_seconds?: number
          consecutive_errors?: number
          created_at?: string
          form_type?: string | null
          id?: string
          last_changed_at?: string | null
          last_checked_at?: string | null
          last_error_code?: string | null
          last_error_message?: string | null
          next_check_at?: string
          provider?: Database["public"]["Enums"]["case_provider"]
          status_detail_en?: string | null
          status_detail_es?: string | null
          status_text_en?: string | null
          status_text_es?: string | null
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_cases: {
        Row: {
          archived_at: string | null
          created_at: string
          id: string
          nickname: string | null
          notify_email: boolean
          notify_push: boolean
          tracked_case_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          id?: string
          nickname?: string | null
          notify_email?: boolean
          notify_push?: boolean
          tracked_case_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          id?: string
          nickname?: string | null
          notify_email?: boolean
          notify_push?: boolean
          tracked_case_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_cases_tracked_case_id_fkey"
            columns: ["tracked_case_id"]
            isOneToOne: false
            referencedRelation: "my_case_details"
            referencedColumns: ["tracked_case_id"]
          },
          {
            foreignKeyName: "user_cases_tracked_case_id_fkey"
            columns: ["tracked_case_id"]
            isOneToOne: false
            referencedRelation: "tracked_cases"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      my_case_details: {
        Row: {
          archived_at: string | null
          case_key: string | null
          form_type: string | null
          last_changed_at: string | null
          last_checked_at: string | null
          nickname: string | null
          notify_email: boolean | null
          notify_push: boolean | null
          provider: Database["public"]["Enums"]["case_provider"] | null
          status_detail_en: string | null
          status_detail_es: string | null
          status_text_en: string | null
          status_text_es: string | null
          submitted_at: string | null
          subscribed_at: string | null
          tracked_case_id: string | null
          user_case_id: string | null
        }
        Relationships: []
      }
      my_case_events: {
        Row: {
          event_id: string | null
          observed_at: string | null
          source: string | null
          status_detail_en: string | null
          status_detail_es: string | null
          status_text_en: string | null
          status_text_es: string | null
          tracked_case_id: string | null
        }
        Insert: {
          event_id?: string | null
          observed_at?: string | null
          source?: string | null
          status_detail_en?: string | null
          status_detail_es?: string | null
          status_text_en?: string | null
          status_text_es?: string | null
          tracked_case_id?: string | null
        }
        Update: {
          event_id?: string | null
          observed_at?: string | null
          source?: string | null
          status_detail_en?: string | null
          status_detail_es?: string | null
          status_text_en?: string | null
          status_text_es?: string | null
          tracked_case_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "case_status_events_tracked_case_id_fkey"
            columns: ["tracked_case_id"]
            isOneToOne: false
            referencedRelation: "my_case_details"
            referencedColumns: ["tracked_case_id"]
          },
          {
            foreignKeyName: "case_status_events_tracked_case_id_fkey"
            columns: ["tracked_case_id"]
            isOneToOne: false
            referencedRelation: "tracked_cases"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_case: {
        Args: {
          p_case_key: string
          p_nickname?: string
          p_provider: Database["public"]["Enums"]["case_provider"]
        }
        Returns: {
          archived_at: string | null
          created_at: string
          id: string
          nickname: string | null
          notify_email: boolean
          notify_push: boolean
          tracked_case_id: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "user_cases"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      check_polling_health: { Args: never; Returns: undefined }
      claim_due_cases: {
        Args: {
          batch_size?: number
          p_provider: Database["public"]["Enums"]["case_provider"]
        }
        Returns: {
          body_hash: string | null
          case_key: string
          check_interval_seconds: number
          consecutive_errors: number
          created_at: string
          form_type: string | null
          id: string
          last_changed_at: string | null
          last_checked_at: string | null
          last_error_code: string | null
          last_error_message: string | null
          next_check_at: string
          provider: Database["public"]["Enums"]["case_provider"]
          status_detail_en: string | null
          status_detail_es: string | null
          status_text_en: string | null
          status_text_es: string | null
          submitted_at: string | null
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "tracked_cases"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      increment_case_errors: {
        Args: {
          p_error_code: string
          p_error_message: string
          p_tracked_case_id: string
        }
        Returns: undefined
      }
      record_manual_status: {
        Args: {
          p_status_detail?: string
          p_status_text: string
          p_user_case_id: string
        }
        Returns: undefined
      }
      // Hand-patched for migration 0016 (not yet applied to production) —
      // regenerate with `npx supabase gen types typescript --linked` from
      // the repo root after `npx supabase db push --linked`.
      report_lookup_breakage: {
        Args: {
          p_provider: Database["public"]["Enums"]["case_provider"]
          p_step: string
        }
        Returns: undefined
      }
      reschedule_case_soon: {
        Args: { p_delay_seconds?: number; p_tracked_case_id: string }
        Returns: undefined
      }
    }
    Enums: {
      case_provider: "uscis" | "eoir" | "ceac"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      case_provider: ["uscis", "eoir", "ceac"],
    },
  },
} as const
