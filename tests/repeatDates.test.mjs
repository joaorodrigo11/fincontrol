import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getRepeatDates } from '../src/utils/repeatDates.ts'

test('includes the original date and arbitrary months, without duplicates', () => {
  assert.deepEqual(getRepeatDates('2026-11-12', ['2027-03', '2026-09', '2026-11', '2027-03']), [
    '2026-09-12', '2026-11-12', '2027-03-12',
  ])
})

test('clamps each occurrence from the original day, including leap years', () => {
  assert.deepEqual(getRepeatDates('2028-01-31', ['2028-02', '2028-03', '2028-04']), [
    '2028-01-31', '2028-02-29', '2028-03-31', '2028-04-30',
  ])
  assert.deepEqual(getRepeatDates('2027-01-31', ['2027-02']), ['2027-01-31', '2027-02-28'])
})

test('rejects invalid dates, months and oversized batches', () => {
  assert.throws(() => getRepeatDates('2026-02-30', ['2026-03']), RangeError)
  for (const month of ['2026-13', '2026-00', '2026-1', 'invalid']) {
    assert.throws(() => getRepeatDates('2026-11-12', [month]), RangeError)
  }
  assert.throws(() => getRepeatDates('2026-11-12', Array(25).fill('2026-12')), RangeError)
})
