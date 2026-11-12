import type { Transaction } from '../../types/database'

export function getLorometro(transactions: Transaction[], month: string, cashBase: number, creditLimit: number) {
  const capacity = cashBase + creditLimit
  const committed = transactions.filter(item => item.type === 'expense' && item.date.slice(0, 7) === month)
    .reduce((sum, item) => sum + item.amount, 0)
  const percentage = capacity > 0 ? committed / capacity * 100 : null
  const stage = percentage === null ? committed > 0 ? 'danger' : 'unconfigured'
    : percentage <= 50 ? 'healthy' : percentage <= 80 ? 'warning' : 'danger'
  return { capacity, committed, percentage, stage, remaining: capacity - committed } as const
}
