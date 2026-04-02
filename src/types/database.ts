export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Profile, 'id'>>
      }
      accounts: {
        Row: Account
        Insert: Omit<Account, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Account, 'id'>>
      }
      categories: {
        Row: Category
        Insert: Omit<Category, 'id' | 'created_at'>
        Update: Partial<Omit<Category, 'id'>>
      }
      transactions: {
        Row: Transaction
        Insert: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Transaction, 'id'>>
      }
      budgets: {
        Row: Budget
        Insert: Omit<Budget, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Budget, 'id'>>
      }
      bills: {
        Row: Bill
        Insert: Omit<Bill, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Bill, 'id'>>
      }
      assets: {
        Row: Asset
        Insert: Omit<Asset, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Asset, 'id'>>
      }
    }
  }
}

export interface Profile {
  id: string
  user_id: string
  full_name: string
  email: string
  avatar_url?: string
  currency: string
  created_at: string
  updated_at: string
}

export type AccountType = 'checking' | 'savings' | 'credit_card' | 'investment' | 'cash' | 'loan' | 'mortgage' | 'other'

export interface Account {
  id: string
  user_id: string
  name: string
  type: AccountType
  institution: string
  balance: number
  currency: string
  is_asset: boolean
  is_active: boolean
  icon?: string
  color?: string
  created_at: string
  updated_at: string
}

export type TransactionType = 'income' | 'expense' | 'transfer'

export interface Transaction {
  id: string
  user_id: string
  account_id: string
  category_id?: string
  type: TransactionType
  amount: number
  description: string
  merchant?: string
  date: string
  notes?: string
  is_recurring: boolean
  tags?: string[]
  created_at: string
  updated_at: string
}

export interface Category {
  id: string
  user_id: string
  name: string
  type: TransactionType
  icon: string
  color: string
  parent_id?: string
  is_system: boolean
  created_at: string
}

export interface Budget {
  id: string
  user_id: string
  category_id: string
  amount: number
  period: 'monthly' | 'weekly' | 'yearly'
  month: string // YYYY-MM
  spent: number
  created_at: string
  updated_at: string
}

export type BillFrequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly'

export interface Bill {
  id: string
  user_id: string
  name: string
  amount: number
  frequency: BillFrequency
  category_id?: string
  account_id?: string
  due_day: number
  next_due_date: string
  is_autopay: boolean
  is_active: boolean
  url?: string
  notes?: string
  created_at: string
  updated_at: string
}

export type AssetType = 'property' | 'vehicle' | 'investment' | 'retirement' | 'crypto' | 'other_asset' | 'mortgage' | 'student_loan' | 'auto_loan' | 'personal_loan' | 'credit_card_debt' | 'other_liability'

export interface Asset {
  id: string
  user_id: string
  name: string
  type: AssetType
  value: number
  is_liability: boolean
  institution?: string
  interest_rate?: number
  notes?: string
  created_at: string
  updated_at: string
}
