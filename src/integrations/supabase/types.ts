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
      caregiver_links: {
        Row: {
          caregiver_id: string | null
          created_at: string
          id: string
          invite_token: string
          patient_id: string
          status: string
        }
        Insert: {
          caregiver_id?: string | null
          created_at?: string
          id?: string
          invite_token?: string
          patient_id: string
          status?: string
        }
        Update: {
          caregiver_id?: string | null
          created_at?: string
          id?: string
          invite_token?: string
          patient_id?: string
          status?: string
        }
        Relationships: []
      }
      discount_codes: {
        Row: {
          active: boolean
          code: string
          created_at: string
          expires_at: string | null
          id: string
          max_uses: number | null
          percent: number
          used_count: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          percent: number
          used_count?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          percent?: number
          used_count?: number
        }
        Relationships: []
      }
      discount_redemptions: {
        Row: {
          code_id: string
          id: string
          plan: string | null
          redeemed_at: string
          user_id: string
        }
        Insert: {
          code_id: string
          id?: string
          plan?: string | null
          redeemed_at?: string
          user_id: string
        }
        Update: {
          code_id?: string
          id?: string
          plan?: string | null
          redeemed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discount_redemptions_code_id_fkey"
            columns: ["code_id"]
            isOneToOne: false
            referencedRelation: "discount_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      dose_logs: {
        Row: {
          id: string
          medicine_id: string
          scheduled_date: string
          scheduled_time: string
          taken_at: string
          user_id: string
        }
        Insert: {
          id?: string
          medicine_id: string
          scheduled_date: string
          scheduled_time: string
          taken_at?: string
          user_id?: string
        }
        Update: {
          id?: string
          medicine_id?: string
          scheduled_date?: string
          scheduled_time?: string
          taken_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dose_logs_medicine_id_fkey"
            columns: ["medicine_id"]
            isOneToOne: false
            referencedRelation: "medicines"
            referencedColumns: ["id"]
          },
        ]
      }
      medicines: {
        Row: {
          composition: string | null
          created_at: string
          dosage: string | null
          dose_qty: number
          end_date: string | null
          form: string
          id: string
          image_url: string | null
          manufacturer: string | null
          name: string
          notes: string | null
          prescription_path: string | null
          start_date: string
          stock: number
          times: string[]
          user_id: string
        }
        Insert: {
          composition?: string | null
          created_at?: string
          dosage?: string | null
          dose_qty?: number
          end_date?: string | null
          form?: string
          id?: string
          image_url?: string | null
          manufacturer?: string | null
          name: string
          notes?: string | null
          prescription_path?: string | null
          start_date?: string
          stock?: number
          times?: string[]
          user_id?: string
        }
        Update: {
          composition?: string | null
          created_at?: string
          dosage?: string | null
          dose_qty?: number
          end_date?: string | null
          form?: string
          id?: string
          image_url?: string | null
          manufacturer?: string | null
          name?: string
          notes?: string | null
          prescription_path?: string | null
          start_date?: string
          stock?: number
          times?: string[]
          user_id?: string
        }
        Relationships: []
      }
      premium_users: {
        Row: {
          expires_at: string | null
          granted_at: string
          user_id: string
        }
        Insert: {
          expires_at?: string | null
          granted_at?: string
          user_id: string
        }
        Update: {
          expires_at?: string | null
          granted_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          referral_code: string | null
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          referral_code?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          referral_code?: string | null
        }
        Relationships: []
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
      accept_invite: { Args: { _token: string }; Returns: string }
      admin_grant_premium: {
        Args: { _email: string; _expires: string }
        Returns: undefined
      }
      admin_list_premium: {
        Args: never
        Returns: {
          display_name: string
          email: string
          expires_at: string
          granted_at: string
          user_id: string
        }[]
      }
      admin_revoke_premium: { Args: { _user: string }; Returns: undefined }
      check_discount: { Args: { _code: string }; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_caregiver_of: { Args: { _patient: string }; Returns: boolean }
      redeem_discount: {
        Args: { _code: string; _plan: string }
        Returns: number
      }
      take_dose: {
        Args: { _date: string; _medicine: string; _time: string }
        Returns: undefined
      }
      untake_dose: {
        Args: { _date: string; _medicine: string; _time: string }
        Returns: undefined
      }
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
