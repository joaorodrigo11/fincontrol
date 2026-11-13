import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getLorometro } from '../src/components/dashboard/lorometro-summary.ts'

const expense = (amount, status = 'paid') => ({ amount, status, type: 'expense', date: '2026-11-12' })
test('includes each monthly expense once, excluding income and other months', () => {
  const result = getLorometro([expense(200),expense(300,'pending'),expense(100,'planned'),{...expense(999),type:'income'},{...expense(999),date:'2026-12-01'}], '2026-11', 1000, 500)
  assert.equal(result.committed,600)
  assert.equal(result.capacity,1500)
  assert.equal(result.percentage,40)
  assert.equal(result.stage,'healthy')
  assert.equal(result.remaining,900)
})
test('preserves thresholds and percentages over 100%', () => {
  for (const [amount,stage] of [[50,'healthy'],[50.01,'warning'],[80,'warning'],[80.01,'danger'],[120,'danger']]) {
    const result=getLorometro([expense(amount)],'2026-11',100,0)
    assert.equal(result.stage,stage)
    if(amount===120){assert.equal(result.percentage,120);assert.equal(result.remaining,-20)}
  }
})
test('does not call an unconfigured budget healthy or divide by zero', () => {
  assert.equal(getLorometro([],'2026-11',0,0).stage,'unconfigured')
  assert.equal(getLorometro([expense(10)],'2026-11',0,0).stage,'danger')
  assert.equal(getLorometro([expense(10)],'2026-11',0,0).percentage,null)
})

test('unknown capacity leaves the meter neutral and the remaining amount unset while preserving monthly expenses', () => {
  for (const [cash, credit] of [[null, null], [null, 500], [1000, null]]) {
    const result = getLorometro([expense(200), expense(300, 'pending'), expense(100, 'planned')], '2026-11', cash, credit)
    assert.equal(result.committed, 600)
    assert.equal(result.capacity, null)
    assert.equal(result.percentage, null)
    assert.equal(result.remaining, null)
    assert.equal(result.stage, 'unconfigured')
  }
})
