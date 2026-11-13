import { test } from 'node:test'
import assert from 'node:assert/strict'
import { projectWallet } from '../src/components/banking/wallet-summary.ts'
import { getWalletLorometro } from '../src/components/dashboard/lorometro-summary.ts'

const month = '2026-11'
const today = '2026-11-12'
const bank = { id: 'bank', name: 'Conta', type: 'BANK', currencyCode: 'BRL', balance: 1000 }
const card = { id: 'card', name: 'Cartão', type: 'CREDIT', currencyCode: 'BRL', balance: -200, availableCreditLimit: 800 }
const snapshot = (accounts = [bank, card], transactions = []) => ({ accounts, transactions, updated_at: today })
const imported = (id, accountId, amount, extra = {}) => ({ id, accountId, accountName: accountId, description: id, amount, currencyCode: 'BRL', date: '2026-11-10', type: 'DEBIT', status: 'POSTED', ...extra })
const manual = (id, accountId, amount, extra = {}) => ({
  id, user_id: 'owner', bank_connection_id: 'selected', bank_account_id: accountId, bank_reflected: false,
  title: id, amount, type: 'expense', category: 'Compras', payment_method: accountId === 'card' ? 'credit_card' : 'pix',
  date: today, status: accountId === 'card' ? 'pending' : 'paid', installment_group_id: null,
  installment_current: null, installment_total: null, created_at: today, ...extra,
})
const project = (rows = [], balances = snapshot(), monthly = balances, selectedMonth = month) => projectWallet(balances, monthly, rows, 'selected', selectedMonth, today)
const meter = (wallet, selectedMonth = month, synced = true) => getWalletLorometro(wallet, selectedMonth, today, synced)

test('meter uses the wallet balances without deducting paid bank and card expenses twice', () => {
  const base = snapshot([{ ...bank, balance: 850 }, { ...card, availableCreditLimit: 600 }], [
    imported('pix', 'bank', -150, { paymentMethod: 'PIX' }),
    imported('card', 'card', -200),
    imported('salary', 'bank', 2000, { type: 'CREDIT' }),
  ])
  const result = meter(project([], base))
  assert.equal(result.available, 1450)
  assert.equal(result.committed, 350)
  assert.equal(result.remaining, 1450)
  assert.equal(result.capacity, 1800)
  assert.equal(result.percentage, 350 / 1800 * 100)
})

test('meter reserves pending bank payments and manual forecasts, including debit', () => {
  const base = snapshot([bank, card], [
    imported('future-pix', 'bank', -50, { paymentMethod: 'PIX', status: 'PENDING' }),
    imported('future-boleto', 'bank', -30, { operationType: 'BOLETO', status: 'PENDING' }),
    imported('card-auth', 'card', -40, { status: 'PENDING' }),
  ])
  const result = meter(project([
    manual('paid', 'bank', 100),
    manual('future-pix', 'bank', 20, { date: '2026-11-20', status: 'planned' }),
    manual('future-debit', 'bank', 10, { payment_method: 'debit', date: '2026-11-20', status: 'planned' }),
  ], base))
  assert.equal(result.available, 1700)
  assert.equal(result.committed, 250)
  assert.equal(result.remaining, 1590)
  assert.equal(result.capacity, 1840)
})

test('future recurring card purchases reserve the target month, while purchased installments are already deducted', () => {
  const futureMonth = '2026-12'
  const projected = project([
    manual('installment-now', 'card', 100, { installment_group_id: 'purchase' }),
    manual('installment-next', 'card', 100, { date: '2026-12-12', status: 'planned', installment_group_id: 'purchase' }),
    manual('repeat-next', 'card', 50, { date: '2026-12-15', status: 'planned' }),
  ], snapshot(), snapshot(), futureMonth)
  const result = meter(projected, futureMonth)
  assert.equal(projected.availableCredit, 600)
  assert.equal(result.available, 1600)
  assert.equal(result.committed, 150)
  assert.equal(result.remaining, 1550)
  assert.equal(result.capacity, 1700)
})

test('reconciliation retains the monthly expense once and keeps the same remaining balance', () => {
  const row = manual('manual-pix', 'bank', 100)
  const before = meter(project([row]))
  const synced = snapshot([{ ...bank, balance: 900 }, card], [imported('bank-pix', 'bank', -100, { paymentMethod: 'PIX' })])
  const after = meter(project([{ ...row, bank_reflected: true }], synced))
  assert.deepEqual(after, before)
  assert.equal(after.committed, 100)
  assert.equal(after.remaining, 1700)
})

test('only the selected institution, supported accounts and selected month contribute', () => {
  const base = snapshot([bank, card, { ...bank, id: 'usd', currencyCode: 'USD' }], [
    imported('current', 'bank', -10, { paymentMethod: 'PIX' }),
    imported('old', 'bank', -500, { date: '2026-10-10' }),
    imported('foreign', 'usd', -100, { currencyCode: 'USD' }),
  ])
  const result = meter(project([
    manual('valid', 'bank', 0.10),
    manual('valid-two', 'bank', 0.20),
    manual('valid-two', 'bank', 0.20),
    manual('other', 'bank', 500, { bank_connection_id: 'other' }),
    manual('cash', 'bank', 500, { payment_method: 'cash' }),
    manual('unlinked', 'bank', 500, { bank_connection_id: null }),
  ], base))
  assert.equal(result.available, 1799.70)
  assert.equal(result.committed, 10.30)
  assert.equal(result.remaining, 1799.70)
})

test('missing account types are zero, but missing balances or credit limits keep the base unknown', () => {
  assert.equal(meter(project([], snapshot([bank]))).available, 1000)
  assert.equal(meter(project([], snapshot([card]))).available, 800)
  for (const wallet of [null, project([], snapshot([])), project([], snapshot([{ ...card, availableCreditLimit: null }]))]) {
    const result = meter(wallet)
    assert.equal(result.available, null)
    assert.equal(result.remaining, null)
    assert.equal(result.percentage, null)
    assert.equal(result.stage, 'unconfigured')
  }
})

test('balances alone never imply that an unsynced month has no commitments', () => {
  const result = meter(project([manual('partial-manual', 'bank', 100)]), month, false)
  assert.equal(result.available, 1700)
  assert.equal(result.committed, null)
  assert.equal(result.capacity, null)
  assert.equal(result.remaining, null)
  assert.equal(result.percentage, null)
  assert.equal(result.stage, 'unconfigured')
})

test('zero and negative balances preserve deficits and never divide by a nonpositive base', () => {
  const zero = meter(project([], snapshot([{ ...bank, balance: 0 }])))
  assert.equal(zero.available, 0)
  assert.equal(zero.remaining, 0)
  assert.equal(zero.percentage, null)
  assert.equal(zero.stage, 'unconfigured')
  const deficit = meter(project([], snapshot([{ ...bank, balance: -100 }, { ...card, availableCreditLimit: -20 }])))
  assert.equal(deficit.available, -120)
  assert.equal(deficit.remaining, -120)
  assert.equal(deficit.percentage, null)
  assert.equal(deficit.stage, 'danger')
  const over = meter(project([manual('forecast', 'bank', 120, { date: '2026-11-20', status: 'planned' })], snapshot([{ ...bank, balance: 100 }])))
  assert.equal(over.remaining, -20)
  assert.equal(over.percentage, 120)
  assert.equal(over.stage, 'danger')
})
