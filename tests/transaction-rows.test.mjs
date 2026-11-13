import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildTransactionRows, effectiveTransactionStatus } from '../src/utils/transactionRows.ts'
const user='11111111-1111-4111-8111-111111111111'
const connection='22222222-2222-4222-8222-222222222222'
const group='33333333-3333-4333-8333-333333333333'
const input={title:'Notebook',amount:100,type:'expense',payment_method:'credit_card',category:'Compras',date:'2026-01-31',installments:3,bank_connection_id:connection,bank_account_id:'card'}
test('installments preserve cents, original day and automatic statement/forecast status',()=>{
  const rows=buildTransactionRows(input,user,'2026-01-31',group)
  assert.deepEqual(rows.map(row=>row.amount),[33.34,33.33,33.33])
  assert.deepEqual(rows.map(row=>row.date),['2026-01-31','2026-02-28','2026-03-31'])
  assert.deepEqual(rows.map(row=>row.status),['pending','planned','planned'])
  assert(rows.every(row=>row.bank_connection_id===connection&&row.bank_account_id==='card'&&row.bank_reflected===false))
  assert.equal(rows.reduce((total,row)=>total+Math.round(row.amount*100),0),10000)
})
test('Pix and debit are realized immediately and cannot be split into installments',()=>{
  for(const method of ['pix','debit','cash']){
    const row=buildTransactionRows({...input,payment_method:method,installments:1,bank_connection_id:null,bank_account_id:null},user,'2026-01-31',null)[0]
    assert.equal(row.status,'paid')
    assert.throws(()=>buildTransactionRows({...input,payment_method:method},user,'2026-01-31',group))
  }
})
test('repeated payments retain their full value and future repetitions mature automatically',()=>{
  const rows=buildTransactionRows({...input,payment_method:'pix',installments:1,repeat_months:['2026-02','2026-03']},user,'2026-01-31',null)
  assert.deepEqual(rows.map(row=>row.amount),[100,100,100])
  assert.deepEqual(rows.map(row=>row.status),['paid','planned','planned'])
  assert.equal(effectiveTransactionStatus(rows[1],'2026-02-28'),'paid')
  const credit=buildTransactionRows(input,user,'2026-01-31',group)
  assert.equal(effectiveTransactionStatus(credit[1],'2026-02-01'),'pending')
})
test('invalid routing, amounts, dates and payment combinations are rejected',()=>{
  for(const patch of [
    {amount:NaN},{amount:0},{amount:0.02},{installments:25},{date:'2026-02-30'},
    {type:'income'},{bank_account_id:null},{bank_connection_id:'bad-id'},
    {payment_method:'cash',installments:1},{repeat_months:['2026-02']},
  ]) assert.throws(()=>buildTransactionRows({...input,...patch},user,'2026-01-31',group))
})
test('income on a current account is realized without inventing a card payment',()=>{
  const rows=buildTransactionRows({...input,type:'income',payment_method:'pix',installments:1},user,'2026-01-31',null)
  assert.equal(rows[0].status,'paid')
  assert.equal(rows[0].installment_group_id,null)
})

test('single future income and cash expenses remain planned until their date',()=>{
  for (const type of ['income','expense']) {
    const row=buildTransactionRows({...input,type,payment_method:'pix',date:'2026-02-10',installments:1,bank_connection_id:null,bank_account_id:null},user,'2026-01-31',null)[0]
    assert.equal(row.status,'planned')
    assert.equal(effectiveTransactionStatus(row,'2026-02-09'),'planned')
    assert.equal(effectiveTransactionStatus(row,'2026-02-10'),'paid')
  }
})
test('saved installments update the correct wallet immediately and deletion restores the bank base',async()=>{
  const { projectWallet }=await import('../src/components/banking/wallet-summary.ts')
  const snapshot={accounts:[
    {id:'checking',name:'Conta',type:'BANK',currencyCode:'BRL',balance:1000},
    {id:'card',name:'Cartão',type:'CREDIT',currencyCode:'BRL',balance:0,availableCreditLimit:2000},
  ],transactions:[],updated_at:'2026-01-31T12:00:00Z'}
  const creditRows=buildTransactionRows(input,user,'2026-01-31',group).map((row,index)=>({...row,id:'credit-'+index,created_at:snapshot.updated_at}))
  const pixRow={...buildTransactionRows({...input,amount:80,payment_method:'pix',installments:1,bank_account_id:'checking'},user,'2026-01-31',null)[0],id:'pix',created_at:snapshot.updated_at}
  const result=projectWallet(snapshot,snapshot,[...creditRows,pixRow],connection,'2026-01','2026-01-31')
  assert.equal(result.balance,920)
  assert.equal(result.availableCredit,1900)
  assert.equal(result.cardPurchases,33.34)
  assert.equal(result.pixPaid,80)
  const deleted=projectWallet(snapshot,snapshot,[],connection,'2026-01','2026-01-31')
  assert.equal(deleted.balance,1000)
  assert.equal(deleted.availableCredit,2000)
})
