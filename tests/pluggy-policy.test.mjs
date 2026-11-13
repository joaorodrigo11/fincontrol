import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assertOwnedSandbox, monthRange, normalizeTransaction, requireUuid } from '../supabase/functions/pluggy/policy.ts'

const user = '11111111-1111-4111-8111-111111111111'
test('requires both ownership and a sandbox institution', () => {
  assert.doesNotThrow(()=>assertOwnedSandbox({clientUserId:user,connector:{isSandbox:true}},user))
  assert.throws(()=>assertOwnedSandbox({clientUserId:'other',connector:{isSandbox:true}},user),error=>error.status===403)
  assert.throws(()=>assertOwnedSandbox({clientUserId:user,connector:{isSandbox:false}},user),error=>error.status===403)
  assert.throws(()=>assertOwnedSandbox({clientUserId:null,connector:{isSandbox:true}},user),error=>error.status===403)
})
test('rejects malformed identifiers and computes leap-year month ranges', () => {
  assert.equal(requireUuid(user),user)
  for(const value of ['x?user_id=other',null,42,''])assert.throws(()=>requireUuid(value))
  assert.deepEqual(monthRange('2028-02'),{month:'2028-02',from:'2028-02-01',to:'2028-02-29'})
  for(const value of ['2026-13','2026-1',null,'0000-01'])assert.throws(()=>monthRange(value))
})
test('preserves signs and statuses and never expands a card installment', () => {
  const account={id:'account',name:'Cartão',type:'CREDIT',currencyCode:'BRL',balance:100}
  const data={id:'transaction',accountId:'account',amount:-150,date:'2026-11-12T12:00:00Z',description:'Pagamento',type:'CREDIT',status:'POSTED',creditCardMetadata:{totalInstallments:12,installmentNumber:3}}
  const row=normalizeTransaction(data,account,'2026-11')
  assert.equal(row.amount,-150);assert.equal(row.status,'POSTED');assert.equal(row.date,'2026-11-12')
  assert.equal('installments' in row,false)
  assert.equal(normalizeTransaction({...data,date:'2026-12-01'},account,'2026-11'),null)
  assert.throws(()=>normalizeTransaction({...data,accountId:'other'},account,'2026-11'))
  assert.throws(()=>normalizeTransaction({...data,amount:Infinity},account,'2026-11'))
})
