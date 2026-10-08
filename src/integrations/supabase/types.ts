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
      blood_requests: {
        Row: {
          area: string
          blood_group: string
          city: string
          created_at: string
          hospital: string
          id: string
          latitude: number
          longitude: number
          note: string
          radius_km: number
          requester_id: string
          status: string
          units: number
          updated_at: string
          urgency: string
        }
        Insert: {
          area?: string
          blood_group: string
          city?: string
          created_at?: string
          hospital: string
          id?: string
          latitude: number
          longitude: number
          note?: string
          radius_km?: number
          requester_id: string
          status?: string
          units: number
          updated_at?: string
          urgency?: string
        }
        Update: {
          area?: string
          blood_group?: string
          city?: string
          created_at?: string
          hospital?: string
          id?: string
          latitude?: number
          longitude?: number
          note?: string
          radius_km?: number
          requester_id?: string
          status?: string
          units?: number
          updated_at?: string
          urgency?: string
        }
        Relationships: []
      }
      location_requests: {
        Row: {
          blood_request_id: string
          created_at: string
          donor_id: string
          id: string
          requester_id: string
          status: string
          updated_at: string
        }
        Insert: {
          blood_request_id: string
          created_at?: string
          donor_id: string
          id?: string
          requester_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          blood_request_id?: string
          created_at?: string
          donor_id?: string
          id?: string
          requester_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_requests_blood_request_id_fkey"
            columns: ["blood_request_id"]
            isOneToOne: false
            referencedRelation: "blood_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_requests_donor_id_fkey"
            columns: ["donor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      profiles: {
        Row: {
          area: string
          available: boolean
          blood_group: string | null
          city: string
          created_at: string
          full_name: string
          last_donation_date: string | null
          latitude: number
          longitude: number
          phone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          area?: string
          available?: boolean
          blood_group?: string | null
          city?: string
          created_at?: string
          full_name?: string
          last_donation_date?: string | null
          latitude?: number
          longitude?: number
          phone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          area?: string
          available?: boolean
          blood_group?: string | null
          city?: string
          created_at?: string
          full_name?: string
          last_donation_date?: string | null
          latitude?: number
          longitude?: number
          phone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      request_responses: {
        Row: {
          created_at: string
          donor_id: string
          id: string
          message: string
          request_id: string
          response: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          donor_id: string
          id?: string
          message?: string
          request_id: string
          response?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          donor_id?: string
          id?: string
          message?: string
          request_id?: string
          response?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_responses_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "blood_requests"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accepted_request_contacts: {
        Args: { target_request_id: string }
        Returns: {
          member_name: string
          member_role: string
          phone: string
        }[]
      }
      blood_group_compatible: {
        Args: { donor_group: string; recipient_group: string }
        Returns: boolean
      }
      get_approved_donor_location: {
        Args: { target_location_request_id: string }
        Returns: {
          latitude: number
          longitude: number
        }[]
      }
      get_donor_profile: {
        Args: {
          donor_reference: string
          search_blood_group: string
          search_radius_km: number
        }
        Returns: {
          area: string
          available: boolean
          blood_group: string
          city: string
          days_since_donation: number
          distance_km: number
          donor_initials: string
          eligible: boolean
          is_demo: boolean
        }[]
      }
      list_incoming_location_requests: {
        Args: never
        Returns: {
          created_at: string
          hospital: string
          location_request_id: string
          note: string
          request_blood_group: string
          requester_area: string
          requester_city: string
          requester_name: string
          status: string
          units: number
          urgency: string
        }[]
      }
      list_my_location_requests: {
        Args: never
        Returns: {
          area: string
          blood_group: string
          city: string
          created_at: string
          donor_reference: string
          hospital: string
          location_request_id: string
          request_blood_group: string
          status: string
          units: number
          urgency: string
        }[]
      }
      request_donor_location: {
        Args: { target_blood_request_id: string; target_donor_id: string }
        Returns: string
      }
      respond_to_location_request: {
        Args: { approve: boolean; target_location_request_id: string }
        Returns: string
      }
      search_donors: {
        Args: {
          search_blood_group: string
          search_city: string
          search_latitude: number
          search_longitude: number
          search_radius_km: number
        }
        Returns: {
          area: string
          available: boolean
          blood_group: string
          city: string
          days_since_donation: number
          distance_km: number
          donor_initials: string
        }[]
      }
      search_donors_with_ids: {
        Args: {
          search_blood_group: string
          search_city: string
          search_latitude: number
          search_longitude: number
          search_radius_km: number
        }
        Returns: {
          area: string
          available: boolean
          blood_group: string
          city: string
          days_since_donation: number
          distance_km: number
          donor_initials: string
          donor_reference: string
          eligible: boolean
          is_demo: boolean
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
