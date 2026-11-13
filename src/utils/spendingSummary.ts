import type { PaymentMethod, Transaction } from '../types/database'

export function getSpendingSummary(transactions: Transaction[], month: string) {
  const centsByMethod: Record<PaymentMethod, number> = { pix: 0, credit_card: 0, debit: 0, cash: 0 }
  let count = 0
  for (const transaction of transactions) {
    if (transaction.type !== 'expense' || transaction.status === 'planned' || transaction.date.slice(0, 7) !== month) continue
    centsByMethod[transaction.payment_method] += Math.round((transaction.amount + Number.EPSILON) * 100)
    count += 1
  }
  const byMethod: Record<PaymentMethod, number> = {
    pix: centsByMethod.pix / 100,
    credit_card: centsByMethod.credit_card / 100,
    debit: centsByMethod.debit / 100,
    cash: centsByMethod.cash / 100,
  }
  const total = Object.values(centsByMethod).reduce((sum, amount) => sum + amount, 0) / 100
  return { total, byMethod, count }
}
