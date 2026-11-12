export type TransactionType = 'income' | 'expense'
export type PaymentMethod = 'pix' | 'debit' | 'credit_card' | 'cash'
export type TransactionStatus = 'paid' | 'pending' | 'planned'

export type MonthlyBudget = {
  id: string
  user_id: string
  month_year: string
  available_cash: number
  credit_limit: number
  created_at: string
}

export type Transaction = {
  id: string
  user_id: string
  installment_group_id: string | null
  title: string
  amount: number
  type: TransactionType
  payment_method: PaymentMethod
  status: TransactionStatus
  category: string
  date: string
  installment_current: number | null
  installment_total: number | null
  created_at: string
}

export interface Database {
  public: {
    Tables: {
      monthly_budgets: {
        Row: MonthlyBudget
        Insert: {
          id?: string
          user_id: string
          month_year: string
          available_cash?: number
          credit_limit?: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          month_year?: string
          available_cash?: number
          credit_limit?: number
          created_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: Transaction
        Insert: {
          id?: string
          user_id: string
          installment_group_id?: string | null
          title: string
          amount: number
          type: TransactionType
          payment_method: PaymentMethod
          status: TransactionStatus
          category: string
          date: string
          installment_current?: number | null
          installment_total?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          installment_group_id?: string | null
          title?: string
          amount?: number
          type?: TransactionType
          payment_method?: PaymentMethod
          status?: TransactionStatus
          category?: string
          date?: string
          installment_current?: number | null
          installment_total?: number | null
          created_at?: string
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
