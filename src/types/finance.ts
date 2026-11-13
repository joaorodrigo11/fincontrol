import type {
  MonthlyBudget,
  PaymentMethod,
  Transaction,
  TransactionType,
} from './database'

export interface BudgetValues {
  available_cash: number
  credit_limit: number
}

export interface NewTransaction {
  title: string
  amount: number
  type: TransactionType
  payment_method: PaymentMethod
  category: string
  date: string
  installments?: number
  repeat_months?: string[]
  bank_connection_id?: string | null
  bank_account_id?: string | null
}

export type TransactionDeleteScope = 'single' | 'this_and_future'
export type LimitAlert = 'normal' | 'warning' | 'over'

export interface FinanceTotals {
  cashIncome: number
  cashExpenses: number
  cashBalance: number
  creditUsed: number
  creditRemaining: number
  cashUsagePercent: number
  creditUsagePercent: number
  cashAlert: LimitAlert
  creditAlert: LimitAlert
}

export interface FinanceState extends FinanceTotals {
  budget: MonthlyBudget | null
  month: string
  monthTransactions: Transaction[]
  transactions: Transaction[]
  loading: boolean
  saving: boolean
  error: string | null
  setMonth: (month: string) => void
  refresh: () => Promise<void>
  saveBudget: (values: BudgetValues) => Promise<void>
  createTransaction: (transaction: NewTransaction) => Promise<Transaction[]>
  setBankReflected: (transaction: Transaction, reflected: boolean) => Promise<void>
  deleteTransaction: (
    transaction: Transaction,
    scope?: TransactionDeleteScope,
  ) => Promise<void>
}
