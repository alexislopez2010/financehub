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
      account_balances: {
        Row: {
          account_id: string
          as_of: string
          balance: number
          created_at: string | null
          household_id: string
          source: string
        }
        Insert: {
          account_id: string
          as_of: string
          balance: number
          created_at?: string | null
          household_id: string
          source?: string
        }
        Update: {
          account_id?: string
          as_of?: string
          balance?: number
          created_at?: string | null
          household_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_balances_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_balances_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          archived_at: string | null
          created_at: string | null
          currency: string | null
          display_order: number | null
          household_id: string
          id: string
          institution: string | null
          is_active: boolean | null
          last_four: string | null
          name: string
          owner: string | null
          starting_balance: number | null
          starting_balance_date: string | null
          type: string | null
        }
        Insert: {
          archived_at?: string | null
          created_at?: string | null
          currency?: string | null
          display_order?: number | null
          household_id: string
          id?: string
          institution?: string | null
          is_active?: boolean | null
          last_four?: string | null
          name: string
          owner?: string | null
          starting_balance?: number | null
          starting_balance_date?: string | null
          type?: string | null
        }
        Update: {
          archived_at?: string | null
          created_at?: string | null
          currency?: string | null
          display_order?: number | null
          household_id?: string
          id?: string
          institution?: string | null
          is_active?: boolean | null
          last_four?: string | null
          name?: string
          owner?: string | null
          starting_balance?: number | null
          starting_balance_date?: string | null
          type?: string | null
        }
        Relationships: []
      }
      bill_match_rules: {
        Row: {
          account_filter: string | null
          bill_id: string | null
          bill_name: string | null
          category: string | null
          created_at: string | null
          household_id: string
          id: string
          keyword: string | null
          rule_kind: string
          sub_category: string | null
        }
        Insert: {
          account_filter?: string | null
          bill_id?: string | null
          bill_name?: string | null
          category?: string | null
          created_at?: string | null
          household_id: string
          id?: string
          keyword?: string | null
          rule_kind: string
          sub_category?: string | null
        }
        Update: {
          account_filter?: string | null
          bill_id?: string | null
          bill_name?: string | null
          category?: string | null
          created_at?: string | null
          household_id?: string
          id?: string
          keyword?: string | null
          rule_kind?: string
          sub_category?: string | null
        }
        Relationships: []
      }
      bills: {
        Row: {
          account: string | null
          budget_amount: number
          budget_category_id: string | null
          category: string | null
          created_at: string | null
          due_day: number | null
          frequency: string | null
          household_id: string
          id: string
          is_active: boolean | null
          linked_debt_id: string | null
          name: string
          notes: string | null
        }
        Insert: {
          account?: string | null
          budget_amount?: number
          budget_category_id?: string | null
          category?: string | null
          created_at?: string | null
          due_day?: number | null
          frequency?: string | null
          household_id: string
          id?: string
          is_active?: boolean | null
          linked_debt_id?: string | null
          name: string
          notes?: string | null
        }
        Update: {
          account?: string | null
          budget_amount?: number
          budget_category_id?: string | null
          category?: string | null
          created_at?: string | null
          due_day?: number | null
          frequency?: string | null
          household_id?: string
          id?: string
          is_active?: boolean | null
          linked_debt_id?: string | null
          name?: string
          notes?: string | null
        }
        Relationships: []
      }
      budgets: {
        Row: {
          amount: number
          category: string
          category_id: string | null
          created_at: string | null
          household_id: string
          id: string
          month: number
          sub_category: string | null
          year: number
        }
        Insert: {
          amount?: number
          category: string
          category_id?: string | null
          created_at?: string | null
          household_id: string
          id?: string
          month: number
          sub_category?: string | null
          year: number
        }
        Update: {
          amount?: number
          category?: string
          category_id?: string | null
          created_at?: string | null
          household_id?: string
          id?: string
          month?: number
          sub_category?: string | null
          year?: number
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string | null
          household_id: string
          id: string
          is_fixed: boolean | null
          name: string
          parent_category: string | null
          type: string
        }
        Insert: {
          created_at?: string | null
          household_id: string
          id?: string
          is_fixed?: boolean | null
          name: string
          parent_category?: string | null
          type: string
        }
        Update: {
          created_at?: string | null
          household_id?: string
          id?: string
          is_fixed?: boolean | null
          name?: string
          parent_category?: string | null
          type?: string
        }
        Relationships: []
      }
      debts: {
        Row: {
          account_id: string | null
          apr: number | null
          balance: number
          created_at: string
          due_day: number | null
          escrow: number | null
          household_id: string
          id: string
          is_active: boolean
          min_payment: number | null
          name: string
          notes: string | null
          original_balance: number | null
          type: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          apr?: number | null
          balance?: number
          created_at?: string
          due_day?: number | null
          escrow?: number | null
          household_id: string
          id?: string
          is_active?: boolean
          min_payment?: number | null
          name: string
          notes?: string | null
          original_balance?: number | null
          type: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          apr?: number | null
          balance?: number
          created_at?: string
          due_day?: number | null
          escrow?: number | null
          household_id?: string
          id?: string
          is_active?: boolean
          min_payment?: number | null
          name?: string
          notes?: string | null
          original_balance?: number | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      family_members: {
        Row: {
          created_at: string | null
          household_id: string
          id: string
          name: string
          relationship: string | null
        }
        Insert: {
          created_at?: string | null
          household_id: string
          id?: string
          name: string
          relationship?: string | null
        }
        Update: {
          created_at?: string | null
          household_id?: string
          id?: string
          name?: string
          relationship?: string | null
        }
        Relationships: []
      }
      household_members: {
        Row: {
          display_name: string | null
          household_id: string
          joined_at: string | null
          role: string | null
          user_id: string
        }
        Insert: {
          display_name?: string | null
          household_id: string
          joined_at?: string | null
          role?: string | null
          user_id: string
        }
        Update: {
          display_name?: string | null
          household_id?: string
          joined_at?: string | null
          role?: string | null
          user_id?: string
        }
        Relationships: []
      }
      households: {
        Row: {
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      income_plan: {
        Row: {
          created_at: string | null
          day_of_month: number | null
          expected_amount: number
          frequency: string
          household_id: string
          id: string
          is_active: boolean
          member: string | null
          month: number
          notes: string | null
          source: string
          year: number
        }
        Insert: {
          created_at?: string | null
          day_of_month?: number | null
          expected_amount?: number
          frequency?: string
          household_id: string
          id?: string
          is_active?: boolean
          member?: string | null
          month: number
          notes?: string | null
          source: string
          year: number
        }
        Update: {
          created_at?: string | null
          day_of_month?: number | null
          expected_amount?: number
          frequency?: string
          household_id?: string
          id?: string
          is_active?: boolean
          member?: string | null
          month?: number
          notes?: string | null
          source?: string
          year?: number
        }
        Relationships: []
      }
      transactions: {
        Row: {
          account: string | null
          account_id: string | null
          amount: number
          category: string | null
          category_id: string | null
          created_at: string | null
          date: string
          description: string
          fingerprint: string | null
          household_id: string
          id: string
          imported_at: string | null
          member: string | null
          notes: string | null
          payment_method: string | null
          sub_category: string | null
          transfer_group_id: string | null
          transfer_pair_id: string | null
          type: string
        }
        Insert: {
          account?: string | null
          account_id?: string | null
          amount: number
          category?: string | null
          category_id?: string | null
          created_at?: string | null
          date: string
          description: string
          fingerprint?: string | null
          household_id: string
          id?: string
          imported_at?: string | null
          member?: string | null
          notes?: string | null
          payment_method?: string | null
          sub_category?: string | null
          transfer_group_id?: string | null
          transfer_pair_id?: string | null
          type: string
        }
        Update: {
          account?: string | null
          account_id?: string | null
          amount?: number
          category?: string | null
          category_id?: string | null
          created_at?: string | null
          date?: string
          description?: string
          fingerprint?: string | null
          household_id?: string
          id?: string
          imported_at?: string | null
          member?: string | null
          notes?: string | null
          payment_method?: string | null
          sub_category?: string | null
          transfer_group_id?: string | null
          transfer_pair_id?: string | null
          type?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

// Helper types for use with Supabase queries
type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<TableName extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][TableName]["Row"]

export type TablesInsert<TableName extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][TableName]["Insert"]

export type TablesUpdate<TableName extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][TableName]["Update"]
