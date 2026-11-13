import type { Transaction } from '../../types/database.ts'
import type { BankSnapshot, BankTransaction } from './banking-api.ts'

export function summarizeWallet(snapshot: BankSnapshot, today: string) {
  const accounts = new Map(snapshot.accounts.map(account => [account.id, account]))
  const groups = { card: [] as BankTransaction[], pixPaid: [] as BankTransaction[], pixPending: [] as BankTransaction[], other: [] as BankTransaction[] }
  const seen = new Set<string>()
  for (const row of snapshot.transactions) {
    const account = accounts.get(row.accountId)
    const key = row.accountId + ':' + row.id
    if (!account || account.currencyCode !== 'BRL' || row.currencyCode !== 'BRL' || seen.has(key)) continue
    seen.add(key)
    // Direction comes from the provider, since card sign conventions can vary.
    if (row.type !== 'DEBIT' || row.operationType === 'PAGAMENTO_FATURA') continue
    if (row.status !== 'POSTED' && row.status !== 'PENDING') continue
    if (account.type === 'CREDIT') groups.card.push(row)
    else if (account.type === 'BANK') {
      if (row.paymentMethod === 'PIX' || row.operationType === 'PIX') {
        if (row.status === 'PENDING' || row.date > today) groups.pixPending.push(row)
        else groups.pixPaid.push(row)
      } else groups.other.push(row)
    }
  }
  const sum = (rows: BankTransaction[]) => rows.reduce((total, row) => total + Math.abs(row.amount), 0)
  const bankAccounts = snapshot.accounts.filter(account => account.type === 'BANK' && account.currencyCode === 'BRL')
  const cards = snapshot.accounts.filter(account => account.type === 'CREDIT' && account.currencyCode === 'BRL')
  const availableCredit = cards.length > 0 && cards.every(account => Number.isFinite(account.availableCreditLimit))
    ? cards.reduce((total, account) => total + account.availableCreditLimit!, 0) : null
  return {
    groups, balance: bankAccounts.length ? bankAccounts.reduce((total, account) => total + account.balance, 0) : null,
    availableCredit, cardPurchases: sum(groups.card), pixPaid: sum(groups.pixPaid), pixPending: sum(groups.pixPending),
    otherOutflows: sum(groups.other), excludedCurrency: snapshot.accounts.some(account => account.currencyCode !== 'BRL'),
    missingPaymentMethod: groups.other.some(row => !row.paymentMethod && !row.operationType),
  }
}
/** Apply only explicit, unreconciled manual records to the bank's latest balances. */
export function projectWallet(
  balances: BankSnapshot,
  monthSnapshot: BankSnapshot | null,
  manual: Transaction[],
  connectionId: string,
  month: string,
  today: string,
) {
  const cents = (value: number) => Math.round((value + Number.EPSILON) * 100)
  const accounts = new Map(balances.accounts.filter(account => account.currencyCode === 'BRL').map(account => [account.id, account]))
  const unique = new Map<string, Transaction>()
  for (const row of manual) {
    const account = row.bank_account_id ? accounts.get(row.bank_account_id) : undefined
    if (row.bank_connection_id !== connectionId || !account || !Number.isFinite(row.amount) || row.amount <= 0) continue
    const correctAccount = row.payment_method === 'credit_card' ? account.type === 'CREDIT'
      : (row.payment_method === 'pix' || row.payment_method === 'debit') && account.type === 'BANK'
    if (correctAccount) unique.set(row.id, row)
  }
  const relevant = [...unique.values()]
  const settledCash = (row: Transaction) => row.status === 'paid' || (row.status === 'planned' && row.date <= today)
  const adjustments = new Map<string, number>()
  for (const row of relevant) {
    if (row.bank_reflected) continue
    const account = accounts.get(row.bank_account_id!)!
    let change = 0
    if (account.type === 'CREDIT') {
      // A purchased installment group reserves its whole outstanding amount.
      // A future recurring purchase without a group has not used the card yet.
      const alreadyPurchased = Boolean(row.installment_group_id) || row.status !== 'planned' || row.date.slice(0, 7) <= today.slice(0, 7)
      if (row.type === 'expense' && alreadyPurchased) change = -cents(row.amount)
    } else if (settledCash(row)) {
      change = (row.type === 'income' ? 1 : -1) * cents(row.amount)
    }
    adjustments.set(account.id, (adjustments.get(account.id) ?? 0) + change)
  }
  const accountBalances = [...accounts.values()].map(account => {
    const adjustment = adjustments.get(account.id) ?? 0
    const bankAvailableCreditLimit = Number.isFinite(account.availableCreditLimit) ? account.availableCreditLimit! : null
    return {
      ...account,
      bankBalance: account.balance,
      bankAvailableCreditLimit,
      balance: account.type === 'BANK' ? (cents(account.balance) + adjustment) / 100 : account.balance,
      availableCreditLimit: account.type === 'CREDIT' && bankAvailableCreditLimit !== null
        ? (cents(bankAvailableCreditLimit) + adjustment) / 100 : account.availableCreditLimit,
      adjustment: adjustment / 100,
    }
  })
  const base = summarizeWallet({
    accounts: balances.accounts,
    transactions: monthSnapshot?.transactions ?? [],
    updated_at: balances.updated_at,
  }, today)
  const manualRows = relevant.filter(row => row.date.slice(0, 7) === month)
  let cardCents = cents(base.cardPurchases)
  let pixPaidCents = cents(base.pixPaid)
  let pixPendingCents = cents(base.pixPending)
  let otherCents = cents(base.otherOutflows)
  for (const row of manualRows) {
    if (row.bank_reflected || row.type !== 'expense') continue
    if (row.payment_method === 'credit_card') cardCents += cents(row.amount)
    else if (row.payment_method === 'pix') {
      if (settledCash(row)) pixPaidCents += cents(row.amount)
      else pixPendingCents += cents(row.amount)
    } else if (row.payment_method === 'debit' && settledCash(row)) otherCents += cents(row.amount)
  }
  const banks = accountBalances.filter(account => account.type === 'BANK')
  const cards = accountBalances.filter(account => account.type === 'CREDIT')
  return {
    ...base,
    balance: banks.length ? banks.reduce((total, account) => total + cents(account.balance), 0) / 100 : null,
    availableCredit: cards.length && cards.every(account => Number.isFinite(account.availableCreditLimit))
      ? cards.reduce((total, account) => total + cents(account.availableCreditLimit!), 0) / 100 : null,
    cardPurchases: cardCents / 100,
    pixPaid: pixPaidCents / 100,
    pixPending: pixPendingCents / 100,
    otherOutflows: otherCents / 100,
    baseBalance: base.balance,
    baseAvailableCredit: base.availableCredit,
    accountBalances,
    hasBank: banks.length > 0,
    hasCard: cards.length > 0,
    manualRows,
  }
}