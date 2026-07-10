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
      accounts: {
        Row: {
          account_type: string
          created_at: string
          created_by: string | null
          current_balance: number
          id: string
          name: string
          opening_balance: number
          opening_date: string
          updated_at: string
        }
        Insert: {
          account_type?: string
          created_at?: string
          created_by?: string | null
          current_balance?: number
          id?: string
          name: string
          opening_balance?: number
          opening_date?: string
          updated_at?: string
        }
        Update: {
          account_type?: string
          created_at?: string
          created_by?: string | null
          current_balance?: number
          id?: string
          name?: string
          opening_balance?: number
          opening_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          created_at: string
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          setting_key: string
          setting_value?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      commissions: {
        Row: {
          agent_name: string
          commission: number
          created_at: string
          created_by: string | null
          date: string
          id: string
          invoice_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          agent_name?: string
          commission?: number
          created_at?: string
          created_by?: string | null
          date: string
          id?: string
          invoice_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          agent_name?: string
          commission?: number
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          invoice_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          balance: number
          business_id: string | null
          city: string | null
          contact_person: string | null
          country: string | null
          created_at: string
          created_by: string | null
          email: string | null
          gstin: string | null
          id: string
          name: string
          pan_no: string | null
          party_type: string
          payable_balance: number
          phone: string | null
          phone2: string | null
          pin_code: string | null
          referral_address: string | null
          referral_email: string | null
          referral_name: string | null
          referral_phone: string | null
          region: string | null
          shipping_city: string | null
          shipping_country: string | null
          shipping_pin_code: string | null
          shipping_same_as_billing: boolean
          shipping_state: string | null
          state: string | null
          updated_at: string
          website: string | null
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          balance?: number
          business_id?: string | null
          city?: string | null
          contact_person?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          gstin?: string | null
          id?: string
          name: string
          pan_no?: string | null
          party_type?: string
          payable_balance?: number
          phone?: string | null
          phone2?: string | null
          pin_code?: string | null
          referral_address?: string | null
          referral_email?: string | null
          referral_name?: string | null
          referral_phone?: string | null
          region?: string | null
          shipping_city?: string | null
          shipping_country?: string | null
          shipping_pin_code?: string | null
          shipping_same_as_billing?: boolean
          shipping_state?: string | null
          state?: string | null
          updated_at?: string
          website?: string | null
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          balance?: number
          business_id?: string | null
          city?: string | null
          contact_person?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          gstin?: string | null
          id?: string
          name?: string
          pan_no?: string | null
          party_type?: string
          payable_balance?: number
          phone?: string | null
          phone2?: string | null
          pin_code?: string | null
          referral_address?: string | null
          referral_email?: string | null
          referral_name?: string | null
          referral_phone?: string | null
          region?: string | null
          shipping_city?: string | null
          shipping_country?: string | null
          shipping_pin_code?: string | null
          shipping_same_as_billing?: boolean
          shipping_state?: string | null
          state?: string | null
          updated_at?: string
          website?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      delivery_notes: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string | null
          date: string
          id: string
          items: Json
          notes: string | null
          number: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          date: string
          id?: string
          items?: Json
          notes?: string | null
          number?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          date?: string
          id?: string
          items?: Json
          notes?: string | null
          number?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      estimates: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string | null
          date: string
          discount_mode: string
          discount_value: number
          id: string
          items: Json
          notes: string | null
          number: string
          shipping_amount: number
          status: string
          tax_rate: number
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          date: string
          discount_mode?: string
          discount_value?: number
          id?: string
          items?: Json
          notes?: string | null
          number?: string
          shipping_amount?: number
          status?: string
          tax_rate?: number
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          date?: string
          discount_mode?: string
          discount_value?: number
          id?: string
          items?: Json
          notes?: string | null
          number?: string
          shipping_amount?: number
          status?: string
          tax_rate?: number
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      fund_transfers: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          date: string
          from_account_id: string | null
          id: string
          remarks: string | null
          to_account_id: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          created_by?: string | null
          date: string
          from_account_id?: string | null
          id?: string
          remarks?: string | null
          to_account_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          date?: string
          from_account_id?: string | null
          id?: string
          remarks?: string | null
          to_account_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string | null
          date: string
          discount_mode: string
          discount_value: number
          due_date: string | null
          id: string
          items: Json
          notes: string | null
          number: string
          paid: number
          shipping_amount: number
          status: string
          tax_rate: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          date?: string
          discount_mode?: string
          discount_value?: number
          due_date?: string | null
          id?: string
          items?: Json
          notes?: string | null
          number?: string
          paid?: number
          shipping_amount?: number
          status?: string
          tax_rate?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          date?: string
          discount_mode?: string
          discount_value?: number
          due_date?: string | null
          id?: string
          items?: Json
          notes?: string | null
          number?: string
          paid?: number
          shipping_amount?: number
          status?: string
          tax_rate?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          customer_name: string | null
          date: string
          id: string
          invoice_number: string | null
          method: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          created_by?: string | null
          customer_name?: string | null
          date?: string
          id?: string
          invoice_number?: string | null
          method?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          customer_name?: string | null
          date?: string
          id?: string
          invoice_number?: string | null
          method?: string
          updated_at?: string
        }
        Relationships: []
      }
      production_entries: {
        Row: {
          created_at: string
          created_by: string | null
          date: string
          id: string
          items: Json
          notes: string | null
          number: string
          product_name: string
          quantity_produced: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date: string
          id?: string
          items?: Json
          notes?: string | null
          number?: string
          product_name?: string
          quantity_produced?: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          items?: Json
          notes?: string | null
          number?: string
          product_name?: string
          quantity_produced?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          barcode: string | null
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          image_url: string | null
          item_type: string
          low_stock_at: number
          mrp: number
          multi_unit: boolean
          name: string
          opening_stock_date: string | null
          price: number
          purchase_rate: number
          sku: string | null
          stock: number
          tax_pct: number
          unit: string
          updated_at: string
          warehouse: string | null
          wholesale_rate: number
        }
        Insert: {
          barcode?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          item_type?: string
          low_stock_at?: number
          mrp?: number
          multi_unit?: boolean
          name: string
          opening_stock_date?: string | null
          price?: number
          purchase_rate?: number
          sku?: string | null
          stock?: number
          tax_pct?: number
          unit?: string
          updated_at?: string
          warehouse?: string | null
          wholesale_rate?: number
        }
        Update: {
          barcode?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          item_type?: string
          low_stock_at?: number
          mrp?: number
          multi_unit?: boolean
          name?: string
          opening_stock_date?: string | null
          price?: number
          purchase_rate?: number
          sku?: string | null
          stock?: number
          tax_pct?: number
          unit?: string
          updated_at?: string
          warehouse?: string | null
          wholesale_rate?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      purchase_orders: {
        Row: {
          created_at: string
          created_by: string | null
          date: string
          id: string
          items: Json
          number: string
          status: string
          supplier_id: string | null
          supplier_name: string
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date: string
          id?: string
          items?: Json
          number?: string
          status?: string
          supplier_id?: string | null
          supplier_name?: string
          total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          items?: Json
          number?: string
          status?: string
          supplier_id?: string | null
          supplier_name?: string
          total?: number
          updated_at?: string
        }
        Relationships: []
      }
      purchase_returns: {
        Row: {
          created_at: string
          created_by: string | null
          date: string
          id: string
          items: Json
          notes: string | null
          number: string
          status: string
          supplier_id: string | null
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date: string
          id?: string
          items?: Json
          notes?: string | null
          number?: string
          status?: string
          supplier_id?: string | null
          total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          items?: Json
          notes?: string | null
          number?: string
          status?: string
          supplier_id?: string | null
          total?: number
          updated_at?: string
        }
        Relationships: []
      }
      sale_orders: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string | null
          date: string
          delivery_date: string | null
          discount_mode: string
          discount_value: number
          id: string
          items: Json
          notes: string | null
          number: string
          shipping_amount: number
          status: string
          tax_rate: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          date: string
          delivery_date?: string | null
          discount_mode?: string
          discount_value?: number
          id?: string
          items?: Json
          notes?: string | null
          number?: string
          shipping_amount?: number
          status?: string
          tax_rate?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          date?: string
          delivery_date?: string | null
          discount_mode?: string
          discount_value?: number
          id?: string
          items?: Json
          notes?: string | null
          number?: string
          shipping_amount?: number
          status?: string
          tax_rate?: number
          updated_at?: string
        }
        Relationships: []
      }
      sale_returns: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string | null
          date: string
          id: string
          items: Json
          notes: string | null
          number: string
          status: string
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          date: string
          id?: string
          items?: Json
          notes?: string | null
          number?: string
          status?: string
          total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          date?: string
          id?: string
          items?: Json
          notes?: string | null
          number?: string
          status?: string
          total?: number
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          amount: number
          billing_cycle: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          id: string
          next_billing_date: string | null
          plan_name: string
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          billing_cycle?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          next_billing_date?: string | null
          plan_name?: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          billing_cycle?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          next_billing_date?: string | null
          plan_name?: string
          status?: string
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
      [_ in never]: never
    }
    Enums: {
      app_role: "admin" | "manager" | "cashier" | "staff"
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
      app_role: ["admin", "manager", "cashier", "staff"],
    },
  },
} as const
