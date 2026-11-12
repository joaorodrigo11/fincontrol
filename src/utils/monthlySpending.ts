import type { Transaction } from '../types/database'

export function getMonthlySpending(transactions: Transaction[], month: string) {
  const result = {
    credit: { planned: 0, pending: 0, paid: 0, count: 0 },
    pix: { planned: 0, pending: 0, paid: 0, count: 0 },
  }
  for (const transaction of transactions) {
    if (transaction.type !== 'expense' || transaction.date.slice(0, 7) !== month) continue
    const target = transaction.payment_method === 'credit_card'
      ? result.credit
      : transaction.payment_method === 'pix' ? result.pix : null
    if (!target) continue
    target[transaction.status] += transaction.amount
    if (transaction.status !== 'paid') target.count += 1
  }
  return result
}
