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
import { getRepeatDates } from '../utils/repeatDates'

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

function splitAmountIntoCents(amount: number, installments: number): number[] {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new RangeError('O valor da transação deve ser maior que zero.')
  }
  if (!Number.isSafeInteger(installments) || installments < 1) {
    throw new RangeError('O número de parcelas deve ser um inteiro positivo.')
  }

  const totalCents = Math.round((amount + Number.EPSILON) * 100)
  if (totalCents < installments) {
    throw new RangeError('O valor não permite dividir parcelas de pelo menos R$ 0,01.')
  }
  if (!Number.isSafeInteger(totalCents)) {
    throw new RangeError('O valor informado está fora do limite permitido.')
  }

  const baseCents = Math.floor(totalCents / installments)
  const remainder = totalCents % installments
  return Array.from(
    { length: installments },
    (_, index) => baseCents + (index < remainder ? 1 : 0),
  )
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
      setTransactions(transactionResult.data)
      setLoadedKey(currentKey)
    } catch (loadError) {
      if (currentRequestId === requestId.current) {
        setError(errorMessage(loadError))
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
      if (!input.title.trim() || !input.category.trim()) {
        throw new RangeError('Descrição e categoria são obrigatórias.')
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
        throw new RangeError('Data inválida. Use o formato YYYY-MM-DD.')
      }

      const installments = input.installments ?? 1
      const cents = splitAmountIntoCents(input.amount, installments)
      const transactionDate = parseISO(input.date)
      if (format(transactionDate, 'yyyy-MM-dd') !== input.date) {
        throw new RangeError('A data informada não existe.')
      }
      const repeatMonths = input.repeat_months ?? []
      if (repeatMonths.length && (installments > 1 || input.type !== 'expense')) {
        throw new RangeError('A repetição entre meses está disponível para despesas sem parcelamento.')
      }
      const repeatDates = repeatMonths.length ? getRepeatDates(input.date, repeatMonths) : null
      if (installments > 1 && !globalThis.crypto?.randomUUID) {
        throw new Error('Este navegador não oferece suporte à geração segura de identificadores.')
      }

      const groupId = installments > 1 ? globalThis.crypto.randomUUID() : null
      const dates = repeatDates ?? cents.map((_, index) => format(addMonths(transactionDate, index), 'yyyy-MM-dd'))
      const rows = dates.map((date, index) => {
        const installmentCents = repeatDates ? cents[0] : cents[index]
        const title =
          installments > 1
            ? `${input.title.trim()} (${index + 1}/${installments})`
            : input.title.trim()
        return {
          user_id: user.id,
          installment_group_id: groupId,
          title,
          amount: installmentCents / 100,
          type: input.type,
          payment_method: input.payment_method,
          status: input.status,
          category: input.category.trim(),
          date,
          installment_current: installments > 1 ? index + 1 : null,
          installment_total: installments > 1 ? installments : null,
        }
      })

      setSaving(true)
      setError(null)
      try {
        const { data, error: insertError } = await getSupabaseClient()
          .from('transactions')
          .insert(rows)
          .select()
        if (insertError) throw insertError
        await refresh()
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
        await refresh()
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
      deleteTransaction,
      totals,
    ],
  )

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>
}
