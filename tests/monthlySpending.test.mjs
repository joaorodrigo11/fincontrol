import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getMonthlySpending } from '../src/utils/monthlySpending.ts'

const expense = (payment_method, status, amount, date = '2026-11-12') => ({
  type: 'expense', payment_method, status, amount, date,
})

test('separates forecasts from paid expenses for the selected month and payment method', () => {
  const totals = getMonthlySpending([
    expense('credit_card', 'pending', 100),
    expense('credit_card', 'planned', 50),
    expense('credit_card', 'paid', 75),
    expense('pix', 'planned', 20),
    expense('pix', 'pending', 10),
    expense('pix', 'paid', 30),
    expense('debit', 'planned', 999),
    expense('cash', 'planned', 999),
    expense('credit_card', 'pending', 999, '2026-12-12'),
    { ...expense('pix', 'planned', 999), type: 'income' },
  ], '2026-11')
  assert.deepEqual(totals.credit, { pending: 100, planned: 50, paid: 75, count: 2 })
  assert.deepEqual(totals.pix, { pending: 10, planned: 20, paid: 30, count: 2 })
})

test('handles empty months and counts each installment only in its own month', () => {
  assert.deepEqual(getMonthlySpending([], '2026-11').credit, { planned: 0, pending: 0, paid: 0, count: 0 })
  const rows = [expense('credit_card', 'pending', 150), expense('credit_card', 'pending', 150, '2026-12-12')]
  assert.equal(getMonthlySpending(rows, '2026-11').credit.pending, 150)
  assert.equal(getMonthlySpending(rows, '2026-12').credit.pending, 150)
})
