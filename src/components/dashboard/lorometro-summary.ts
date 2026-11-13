import type { Transaction } from '../../types/database'
import type { projectWallet } from '../banking/wallet-summary.ts'

export function getLorometro(transactions: Transaction[], month: string, cashBase: number | null, creditLimit: number | null) {
  const capacity = cashBase === null || creditLimit === null ? null : cashBase + creditLimit
  const committed = transactions.filter(item => item.type === 'expense' && item.date.slice(0, 7) === month)
    .reduce((sum, item) => sum + item.amount, 0)
  const percentage = capacity !== null && capacity > 0 ? committed / capacity * 100 : null
  const stage = capacity === null ? 'unconfigured' : percentage === null ? committed > 0 ? 'danger' : 'unconfigured'
    : percentage <= 50 ? 'healthy' : percentage <= 80 ? 'warning' : 'danger'
  return { capacity, committed, percentage, stage, remaining: capacity === null ? null : capacity - committed } as const
}

/** Measure monthly commitments against the same adjusted balances shown by the wallet. */
export function getWalletLorometro(
  wallet: ReturnType<typeof projectWallet> | null,
  month: string,
  today: string,
  hasMonthSnapshot = true,
) {
  const unknown = {
    available: null,
    capacity: null,
    committed: null,
    remaining: null,
    percentage: null,
    stage: 'unconfigured',
  } as const
  if (!wallet) return unknown

  const cents = (value: number) => Math.round((value + Number.EPSILON) * 100)
  const cash = wallet.hasBank ? wallet.balance : 0
  const credit = wallet.hasCard ? wallet.availableCredit : 0
  const availableCents = (wallet.hasBank || wallet.hasCard) && Number.isFinite(cash) && Number.isFinite(credit)
    ? cents(cash!) + cents(credit!) : null
  const available = availableCents === null ? null : availableCents / 100
  // Latest balances can be available before this month's bank movements are synced.
  if (!hasMonthSnapshot) return { ...unknown, available }

  const accounts = new Map(wallet.accountBalances.map(account => [account.id, account]))
  const imported = new Map(Object.values(wallet.groups).flat()
    .filter(row => row.date.slice(0, 7) === month)
    .map(row => [row.accountId + ':' + row.id, row]))
  const manual = new Map(wallet.manualRows
    .filter(row => row.type === 'expense' && !row.bank_reflected && row.date.slice(0, 7) === month)
    .map(row => [row.id, row]))
  let committedCents = 0
  let reservedCents = 0

  for (const row of imported.values()) {
    const amount = cents(Math.abs(row.amount))
    committedCents += amount
    // Pending bank payments have not left the account. Card authorizations already
    // reduce the bank-reported available credit and must not be reserved again.
    if (accounts.get(row.accountId)?.type === 'BANK' && (row.status === 'PENDING' || row.date > today)) {
      reservedCents += amount
    }
  }
  for (const row of manual.values()) {
    const amount = cents(row.amount)
    committedCents += amount
    if (row.payment_method === 'credit_card') {
      const alreadyPurchased = Boolean(row.installment_group_id) || row.status !== 'planned' || row.date.slice(0, 7) <= today.slice(0, 7)
      if (!alreadyPurchased) reservedCents += amount
    } else {
      const settledCash = row.status === 'paid' || (row.status === 'planned' && row.date <= today)
      if (!settledCash) reservedCents += amount
    }
  }

  const committed = committedCents / 100
  if (availableCents === null) return { ...unknown, committed }
  // Paid expenses are already absent from the wallet balance. Subtract only the
  // forecasts not reserved there, then reconstruct the month's total for the ratio.
  const remainingCents = availableCents - reservedCents
  const capacityCents = committedCents + remainingCents
  const percentage = capacityCents > 0 ? committedCents / capacityCents * 100 : null
  const stage = remainingCents < 0 ? 'danger' : percentage === null ? committedCents > 0 ? 'danger' : 'unconfigured'
    : percentage <= 50 ? 'healthy' : percentage <= 80 ? 'warning' : 'danger'
  return { available, committed, remaining: remainingCents / 100, capacity: capacityCents / 100, percentage, stage } as const
}
