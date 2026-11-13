import type { PaymentMethod, Transaction } from '../types/database'

const emptyMethods = (): Record<PaymentMethod, number> => ({ pix: 0, credit_card: 0, debit: 0, cash: 0 })

/** Monthly income funds the wallet; each expense reserves money only in its own month. */
export function getPersonalMonthSummary(transactions: Transaction[], month: string) {
  const centsByMethod = emptyMethods()
  const committedCentsByMethod = emptyMethods()
  const seen = new Set<string>()
  let incomeCents = 0
  let expenseCents = 0
  let plannedCents = 0
  let incomeCount = 0
  let expenseCount = 0
  let plannedExpenseCount = 0

  for (const transaction of transactions) {
    if (transaction.date.slice(0, 7) !== month || seen.has(transaction.id)) continue
    if (!Number.isFinite(transaction.amount) || transaction.amount <= 0) continue
    seen.add(transaction.id)
    const cents = Math.round((transaction.amount + Number.EPSILON) * 100)
    if (transaction.type === 'income') {
      if (transaction.status === 'paid') {
        incomeCents += cents
        incomeCount += 1
      }
      continue
    }
    committedCentsByMethod[transaction.payment_method] += cents
    if (transaction.status === 'planned') {
      plannedCents += cents
      plannedExpenseCount += 1
    } else {
      expenseCents += cents
      centsByMethod[transaction.payment_method] += cents
      expenseCount += 1
    }
  }

  const committedCents = expenseCents + plannedCents
  const awaitingIncome = incomeCount === 0
  const percentage = incomeCents > 0 ? committedCents / incomeCents * 100 : null
  const stage = awaitingIncome || percentage === null ? 'unconfigured'
    : percentage <= 50 ? 'healthy' : percentage <= 80 ? 'warning' : 'danger'
  const toMoney = (methods: Record<PaymentMethod, number>): Record<PaymentMethod, number> => ({
    pix: methods.pix / 100,
    credit_card: methods.credit_card / 100,
    debit: methods.debit / 100,
    cash: methods.cash / 100,
  })

  return {
    income: incomeCents / 100,
    expenses: expenseCents / 100,
    plannedExpenses: plannedCents / 100,
    committed: committedCents / 100,
    balance: awaitingIncome ? null : (incomeCents - expenseCents) / 100,
    available: awaitingIncome ? null : (incomeCents - committedCents) / 100,
    awaitingIncome,
    percentage,
    stage,
    incomeCount,
    expenseCount,
    plannedExpenseCount,
    byMethod: toMoney(centsByMethod),
    byMethodCommitted: toMoney(committedCentsByMethod),
  } as const
}
