import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getPersonalMonthSummary } from '../src/utils/personalMonthSummary.ts'

const month = '2026-11'
const row = (id, amount, extra = {}) => ({
  id, amount, type: 'expense', status: 'paid', payment_method: 'pix', date: '2026-11-13',
  bank_connection_id: null, bank_account_id: null, ...extra,
})
const income = (id, amount, extra = {}) => row(id, amount, { type: 'income', ...extra })
const summarize = rows => getPersonalMonthSummary(rows, month)

test('received income funds the wallet and all realized payment methods reduce its balance', () => {
  const result = summarize([
    income('salary', 1000), income('extra', 200),
    row('pix', 100), row('credit', 200, { payment_method: 'credit_card', status: 'pending' }),
    row('debit', 50, { payment_method: 'debit', bank_connection_id: 'old-bank', bank_account_id: 'old-account' }),
    row('cash', 25, { payment_method: 'cash' }),
  ])
  assert.equal(result.income, 1200)
  assert.equal(result.expenses, 375)
  assert.equal(result.balance, 825)
  assert.equal(result.available, 825)
  assert.equal(result.percentage, 31.25)
  assert.equal(result.stage, 'healthy')
  assert.equal(result.awaitingIncome, false)
  assert.equal(result.incomeCount, 2)
  assert.equal(result.expenseCount, 4)
  assert.deepEqual(result.byMethod, { pix: 100, credit_card: 200, debit: 50, cash: 25 })
})

test('forecasts reserve available money once without being counted as realized spending or income', () => {
  const forecast = row('scheduled', 100, { status: 'planned' })
  const result = summarize([
    income('received', 1000), income('planned-income', 5000, { status: 'planned' }),
    income('pending-income', 5000, { status: 'pending' }),
    row('spent', 200), forecast, forecast,
  ])
  assert.equal(result.income, 1000)
  assert.equal(result.expenses, 200)
  assert.equal(result.plannedExpenses, 100)
  assert.equal(result.committed, 300)
  assert.equal(result.balance, 800)
  assert.equal(result.available, 700)
  assert.equal(result.percentage, 30)
  assert.equal(result.plannedExpenseCount, 1)
  assert.equal(result.byMethod.pix, 200)
  assert.equal(result.byMethodCommitted.pix, 300)
})

test('only the selected month and its installment affect the wallet, preserving exact cents', () => {
  const result = summarize([
    income('income', 100), income('another-month-income', 5000, { date: '2026-12-01' }),
    row('small-a', 0.10), row('small-b', 0.20),
    row('installment-one', 33.34, { payment_method: 'credit_card', status: 'pending', installment_group_id: 'purchase', installment_current: 1, installment_total: 3 }),
    row('installment-two', 33.33, { payment_method: 'credit_card', status: 'planned', date: '2026-12-13', installment_group_id: 'purchase', installment_current: 2, installment_total: 3 }),
    row('past', 99, { date: '2026-10-13' }),
  ])
  assert.equal(result.income, 100)
  assert.equal(result.expenses, 33.64)
  assert.equal(result.plannedExpenses, 0)
  assert.equal(result.balance, 66.36)
  assert.equal(result.available, 66.36)
  assert.equal(result.byMethod.pix, 0.30)
  assert.equal(result.byMethod.credit_card, 33.34)
})

test('duplicate IDs are counted once while different entries with the same values remain separate', () => {
  const firstIncome = income('salary', 100)
  const firstExpense = row('purchase', 20)
  const result = summarize([firstIncome, firstIncome, firstExpense, firstExpense, row('other-purchase', 20)])
  assert.equal(result.income, 100)
  assert.equal(result.expenses, 40)
  assert.equal(result.incomeCount, 1)
  assert.equal(result.expenseCount, 2)
})

test('empty or income-less months await data without inventing a percentage or deficit', () => {
  const empty = summarize([])
  assert.equal(empty.income, 0)
  assert.equal(empty.balance, null)
  assert.equal(empty.available, null)
  assert.equal(empty.awaitingIncome, true)
  assert.equal(empty.percentage, null)
  assert.equal(empty.stage, 'unconfigured')
  const uncovered = summarize([row('expense', 30)])
  assert.equal(uncovered.expenses, 30)
  assert.equal(uncovered.committed, 30)
  assert.equal(uncovered.balance, null)
  assert.equal(uncovered.available, null)
  assert.equal(uncovered.awaitingIncome, true)
  assert.equal(uncovered.percentage, null)
  assert.equal(uncovered.stage, 'unconfigured')
})

test('thresholds preserve exact boundaries, percentages above 100 and negative remaining money', () => {
  for (const [amount, stage] of [[0, 'healthy'], [50, 'healthy'], [50.01, 'warning'], [80, 'warning'], [80.01, 'danger'], [120, 'danger']]) {
    const result = summarize([income('salary', 100), ...(amount ? [row('expense', amount)] : [])])
    assert.equal(result.stage, stage)
    assert.equal(result.percentage, amount)
    if (amount === 120) {
      assert.equal(result.available, -20)
      assert.equal(result.balance, -20)
    }
  }
})

test('adding income or deleting an expense immediately recalculates the same wallet and meter base', () => {
  const salary = income('salary', 100)
  const purchase = row('purchase', 80)
  const before = summarize([salary, purchase])
  assert.equal(before.available, 20)
  assert.equal(before.percentage, 80)
  const afterIncome = summarize([salary, purchase, income('extra', 100)])
  assert.equal(afterIncome.available, 120)
  assert.equal(afterIncome.percentage, 40)
  assert.equal(afterIncome.stage, 'healthy')
  const afterDelete = summarize([salary])
  assert.equal(afterDelete.available, 100)
  assert.equal(afterDelete.percentage, 0)
})

test('following installment months await their own income while keeping the known commitments', () => {
  for (const status of ['planned', 'pending']) {
    const transactions = [
      income('november-salary', 1000),
      row('installment-one', 100, { payment_method: 'credit_card', status: 'pending', installment_group_id: 'purchase', installment_current: 1, installment_total: 3 }),
      row('installment-two', 100, { payment_method: 'credit_card', status, date: '2026-12-13', installment_group_id: 'purchase', installment_current: 2, installment_total: 3 }),
      income('december-forecast', 2000, { status: 'planned', date: '2026-12-28' }),
    ]
    const result = getPersonalMonthSummary(transactions, '2026-12')
    assert.equal(result.income, 0)
    assert.equal(result.awaitingIncome, true)
    assert.equal(result.balance, null)
    assert.equal(result.available, null)
    assert.equal(result.percentage, null)
    assert.equal(result.stage, 'unconfigured')
    assert.equal(result.committed, 100)
    assert.equal(result.byMethodCommitted.credit_card, 100)
    assert.equal(result.expenses, status === 'pending' ? 100 : 0)
    assert.equal(result.plannedExpenses, status === 'planned' ? 100 : 0)

    const receivedIncome = income('december-received', 500, { date: '2026-12-01' })
    const funded = getPersonalMonthSummary([...transactions, receivedIncome], '2026-12')
    assert.equal(funded.income, 500)
    assert.equal(funded.awaitingIncome, false)
    assert.equal(funded.available, 400)
    assert.equal(funded.percentage, 20)
    assert.equal(funded.stage, 'healthy')

    const removedIncome = getPersonalMonthSummary(transactions, '2026-12')
    assert.equal(removedIncome.awaitingIncome, true)
    assert.equal(removedIncome.available, null)
    assert.equal(removedIncome.committed, 100)
  }
})

test('planned or pending income alone never enables the monthly spending calculation', () => {
  const result = summarize([
    income('forecast', 1000, { status: 'planned' }),
    income('not-received', 1000, { status: 'pending' }),
    row('installment', 200, { status: 'planned', payment_method: 'credit_card', installment_group_id: 'purchase' }),
  ])
  assert.equal(result.incomeCount, 0)
  assert.equal(result.awaitingIncome, true)
  assert.equal(result.available, null)
  assert.equal(result.balance, null)
  assert.equal(result.percentage, null)
  assert.equal(result.stage, 'unconfigured')
  assert.equal(result.plannedExpenses, 200)
})
