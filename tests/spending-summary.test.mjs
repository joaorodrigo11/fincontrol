import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getSpendingSummary } from '../src/utils/spendingSummary.ts'

const expense = (payment_method, amount, extra = {}) => ({
  payment_method, amount, type: 'expense', status: 'paid', date: '2026-11-13',
  bank_connection_id: null, bank_account_id: null, ...extra,
})

test('spending summary separates all payment methods while preserving linked history and excluding forecasts and income', () => {
  const result = getSpendingSummary([
    expense('pix', 100),
    expense('credit_card', 80, { status: 'pending' }),
    expense('credit_card', 20),
    expense('debit', 30, { bank_connection_id: 'legacy-bank', bank_account_id: 'legacy-account' }),
    expense('cash', 15),
    expense('pix', 999, { status: 'planned' }),
    expense('pix', 999, { type: 'income' }),
    expense('credit_card', 999, { date: '2026-12-01' }),
  ], '2026-11')
  assert.deepEqual(result, { total: 245, byMethod: { pix: 100, credit_card: 100, debit: 30, cash: 15 }, count: 5 })
})

test('spending summary adds cents exactly and includes each installment only in its month', () => {
  const result = getSpendingSummary([
    expense('pix', 0.10), expense('pix', 0.20),
    expense('credit_card', 33.34, { status: 'pending', installment_group_id: 'purchase', installment_current: 1 }),
    expense('credit_card', 33.33, { status: 'planned', installment_group_id: 'purchase', installment_current: 2, date: '2026-12-13' }),
  ], '2026-11')
  assert.equal(result.byMethod.pix, 0.30)
  assert.equal(result.byMethod.credit_card, 33.34)
  assert.equal(result.total, 33.64)
  assert.equal(result.count, 3)
})

test('empty and forecast-only months have zero realized spending', () => {
  const empty = { total: 0, byMethod: { pix: 0, credit_card: 0, debit: 0, cash: 0 }, count: 0 }
  assert.deepEqual(getSpendingSummary([], '2026-11'), empty)
  assert.deepEqual(getSpendingSummary([expense('pix', 30, { status: 'planned' })], '2026-11'), empty)
})
