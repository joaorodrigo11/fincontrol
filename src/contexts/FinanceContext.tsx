import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react'
import { addMonths, endOfMonth, format, parseISO } from 'date-fns'
import type { MonthlyBudget, Transaction } from '../types/database'
import type {
  BudgetValues,
  FinanceState,
  FinanceTotals,
  NewTransaction,
  TransactionDeleteScope,
} from '../types/finance'
import { useAuth } from './useAuth'
import { FinanceContext } from './finance-context'
import { getSupabaseClient } from '../lib/supabaseClient'
import { getCurrentMonth } from '../utils/dates'
import { buildTransactionRows, effectiveTransactionStatus } from '../utils/transactionRows'
import { bankingApi } from '../components/banking/banking-api'
import type { BankSnapshot } from '../components/banking/banking-api'

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Ocorreu um erro ao acessar os dados financeiros.'
}

function calculateTotals(
  budget: MonthlyBudget | null,
  transactions: Transaction[],
  month: string,
): FinanceTotals {
  const monthTransactions = transactions.filter(
    (transaction) => transaction.date.slice(0, 7) === month,
  )
  const cashIncome = monthTransactions
    .filter((transaction) => transaction.type === 'income' && transaction.status === 'paid')
    .reduce((total, transaction) => total + transaction.amount, 0)
  const cashExpenses = monthTransactions
    .filter(
      (transaction) =>
        transaction.type === 'expense' &&
        transaction.status === 'paid' &&
        transaction.payment_method !== 'credit_card',
    )
    .reduce((total, transaction) => total + transaction.amount, 0)
  const creditUsed = monthTransactions
    .filter(
      (transaction) =>
        transaction.type === 'expense' && transaction.payment_method === 'credit_card',
    )
    .reduce((total, transaction) => total + transaction.amount, 0)

  const cashBase = (budget?.available_cash ?? 0) + cashIncome
  const creditLimit = budget?.credit_limit ?? 0
  const percentage = (amount: number, limit: number) =>
    limit > 0 ? (amount / limit) * 100 : amount > 0 ? 100 : 0
  const alertFor = (used: number, limit: number): FinanceTotals['cashAlert'] => {
    if (used > limit) return 'over'
    if (limit > 0 && used / limit >= 0.8) return 'warning'
    return 'normal'
  }

  return {
    cashIncome,
    cashExpenses,
    cashBalance: cashBase - cashExpenses,
    creditUsed,
    creditRemaining: creditLimit - creditUsed,
    cashUsagePercent: percentage(cashExpenses, cashBase),
    creditUsagePercent: percentage(creditUsed, creditLimit),
    cashAlert: alertFor(cashExpenses, cashBase),
    creditAlert: alertFor(creditUsed, creditLimit),
  }
}

export function FinanceProvider({ children }: PropsWithChildren) {
  const { user, loading: authLoading } = useAuth()
  const [month, setMonthState] = useState(getCurrentMonth)
  const [budget, setBudget] = useState<MonthlyBudget | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  const requestId = useRef(0)

  const setMonth = useCallback((nextMonth: string) => {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(nextMonth)) {
      throw new RangeError('Mês inválido. Use o formato YYYY-MM.')
    }
    setMonthState(nextMonth)
  }, [])

  const refresh = useCallback(async () => {
    const currentRequestId = ++requestId.current
    if (!user) {
      setBudget(null)
      setTransactions([])
      setLoadedKey(null)
      setLoading(false)
      return
    }

    const currentKey = `${user.id}:${month}`
    setLoading(true)
    setError(null)
    try {
      const supabase = getSupabaseClient()
      const start = `${month}-01`
      const lastMonth = endOfMonth(addMonths(parseISO(start), 12))
      const end = format(lastMonth, 'yyyy-MM-dd')
      const [budgetResult, transactionResult] = await Promise.all([
        supabase
          .from('monthly_budgets')
          .select('*')
          .eq('user_id', user.id)
          .eq('month_year', month)
          .maybeSingle(),
        supabase
          .from('transactions')
          .select('*')
          .eq('user_id', user.id)
          .gte('date', start)
          .lte('date', end)
          .order('date', { ascending: true }),
      ])

      if (budgetResult.error) throw budgetResult.error
      if (transactionResult.error) throw transactionResult.error
      if (currentRequestId !== requestId.current) return
      setBudget(budgetResult.data)
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
      setTransactions(transactionResult.data.map(row => ({ ...row, status: effectiveTransactionStatus(row, today) })))
      setLoadedKey(currentKey)
    } catch (loadError) {
      if (currentRequestId === requestId.current) {
        setError(errorMessage(loadError))
        setBudget(null)
        setTransactions([])
        setLoadedKey(currentKey)
      }
      throw loadError
    } finally {
      if (currentRequestId === requestId.current) setLoading(false)
    }
  }, [month, user])

  useEffect(() => {
    if (authLoading) return
    let active = true

    if (!user) {
      requestId.current += 1
      // oxlint-disable-next-line react/set-state-in-effect -- Clear prior account data after logout.
      setBudget(null)
      setTransactions([])
      setError(null)
      // oxlint-disable-next-line react/set-state-in-effect -- Stop the pending loading state after sign-out.
      setLoading(false)
      return
    }

    void refresh().catch((loadError: unknown) => {
      if (active) setError(errorMessage(loadError))
    })

    return () => {
      active = false
    }
  }, [authLoading, user, month, refresh])

  const saveBudget = useCallback(
    async (values: BudgetValues) => {
      if (!user) throw new Error('É necessário entrar para salvar o orçamento.')
      if (
        !Number.isFinite(values.available_cash) ||
        values.available_cash < 0 ||
        !Number.isFinite(values.credit_limit) ||
        values.credit_limit < 0
      ) {
        throw new RangeError('Os valores do orçamento devem ser números não negativos.')
      }

      setSaving(true)
      setError(null)
      try {
        const { data, error: saveError } = await getSupabaseClient()
          .from('monthly_budgets')
          .upsert(
            {
              user_id: user.id,
              month_year: month,
              available_cash: values.available_cash,
              credit_limit: values.credit_limit,
            },
            { onConflict: 'user_id,month_year' },
          )
          .select()
          .single()
        if (saveError) throw saveError
        setBudget(data)
      } catch (saveError) {
        setError(errorMessage(saveError))
        throw saveError
      } finally {
        setSaving(false)
      }
    },
    [month, user],
  )

  const createTransaction = useCallback(
    async (input: NewTransaction) => {
      if (!user) throw new Error('É necessário entrar para registrar uma transação.')
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
      const groupId = (input.installments ?? 1) > 1 ? globalThis.crypto.randomUUID() : null
      const rows = buildTransactionRows(input, user.id, today, groupId)
      setSaving(true)
      setError(null)
      try {
        if (input.bank_connection_id) {
          const { balances } = await bankingApi<{ balances: BankSnapshot | null }>({
            action: 'wallet', connectionId: input.bank_connection_id, month: input.date.slice(0, 7),
          })
          const account = balances?.accounts.find(row => row.id === input.bank_account_id)
          const expectedType = input.payment_method === 'credit_card' ? 'CREDIT' : 'BANK'
          if (!account || account.type !== expectedType || account.currencyCode !== 'BRL') {
            throw new Error('A conta escolhida não está disponível para esta forma de pagamento. Atualize os bancos e tente novamente.')
          }
        }
        const { data, error: insertError } = await getSupabaseClient()
          .from('transactions')
          .insert(rows)
          .select()
        if (insertError) throw insertError
        setTransactions(current => [...new Map([...current, ...data].map(row => [row.id, row])).values()])
        window.dispatchEvent(new Event('loro-bank-updated'))
        await refresh().catch(() => undefined)
        return data
      } catch (insertError) {
        setError(errorMessage(insertError))
        throw insertError
      } finally {
        setSaving(false)
      }
    },
    [refresh, user],
  )

  const setBankReflected = useCallback(async (transaction: Transaction, reflected: boolean) => {
    if (!user || !transaction.bank_connection_id) throw new Error('Este lançamento não está vinculado a uma conta bancária.')
    setSaving(true)
    setError(null)
    try {
      let query = getSupabaseClient().from('transactions').update({ bank_reflected: reflected })
        .eq('user_id', user.id).eq('bank_connection_id', transaction.bank_connection_id)
      query = transaction.installment_group_id
        ? query.eq('installment_group_id', transaction.installment_group_id)
        : query.eq('id', transaction.id)
      const { error: updateError } = await query
      if (updateError) throw updateError
      window.dispatchEvent(new Event('loro-bank-updated'))
      await refresh().catch(() => undefined)
    } catch (updateError) {
      setError(errorMessage(updateError))
      throw updateError
    } finally { setSaving(false) }
  }, [user, refresh])
  const deleteTransaction = useCallback(
    async (
      transaction: Transaction,
      scope: TransactionDeleteScope = 'single',
    ) => {
      if (!user) throw new Error('É necessário entrar para excluir uma transação.')
      setSaving(true)
      setError(null)
      try {
        let query = getSupabaseClient()
          .from('transactions')
          .delete()
          .eq('user_id', user.id)

        if (
          scope === 'this_and_future' &&
          transaction.installment_group_id
        ) {
          query = query
            .eq('installment_group_id', transaction.installment_group_id)
            .gte('date', transaction.date)
        } else {
          query = query.eq('id', transaction.id)
        }

        const { error: deleteError } = await query
        if (deleteError) throw deleteError
        setTransactions(current => current.filter(row => scope === 'this_and_future' && transaction.installment_group_id
          ? row.installment_group_id !== transaction.installment_group_id || row.date < transaction.date
          : row.id !== transaction.id))
        window.dispatchEvent(new Event('loro-bank-updated'))
        await refresh().catch(() => undefined)
      } catch (deleteError) {
        setError(errorMessage(deleteError))
        throw deleteError
      } finally {
        setSaving(false)
      }
    },
    [refresh, user],
  )

  const isCurrentData = Boolean(user && loadedKey === `${user.id}:${month}`)
  const currentBudget = useMemo(
    () => (isCurrentData ? budget : null),
    [budget, isCurrentData],
  )
  const currentTransactions = useMemo(
    () => (isCurrentData ? transactions : []),
    [isCurrentData, transactions],
  )
  const monthTransactions = useMemo(
    () =>
      currentTransactions.filter(
        (transaction) => transaction.date.slice(0, 7) === month,
      ),
    [currentTransactions, month],
  )
  const totals = useMemo(
    () => calculateTotals(currentBudget, currentTransactions, month),
    [currentBudget, currentTransactions, month],
  )

  const value = useMemo<FinanceState>(
    () => ({
      budget: currentBudget,
      month,
      monthTransactions,
      transactions: currentTransactions,
      loading: loading || authLoading || Boolean(user && loadedKey !== `${user.id}:${month}`),
      saving,
      error,
      setMonth,
      refresh,
      saveBudget,
      createTransaction,
      setBankReflected,
      deleteTransaction,
      ...totals,
    }),
    [
      currentBudget,
      month,
      monthTransactions,
      currentTransactions,
      loading,
      authLoading,
      user,
      loadedKey,
      saving,
      error,
      setMonth,
      refresh,
      saveBudget,
      createTransaction,
      setBankReflected,
      deleteTransaction,
      totals,
    ],
  )

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>
}
