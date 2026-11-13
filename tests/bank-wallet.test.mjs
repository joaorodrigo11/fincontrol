import { test } from 'node:test'
import assert from 'node:assert/strict'
import { summarizeWallet, projectWallet } from '../src/components/banking/wallet-summary.ts'
import { normalizeTransaction } from '../supabase/functions/pluggy/policy.ts'

const bank={id:'bank',name:'Conta',type:'BANK',currencyCode:'BRL',balance:1000}
const card={id:'card',name:'Cartão',type:'CREDIT',currencyCode:'BRL',balance:-200,availableCreditLimit:800}
const tx=(id,accountId,amount,extra={})=>({id,accountId,accountName:'Conta',amount,description:id,currencyCode:'BRL',date:'2026-11-10',type:'DEBIT',status:'POSTED',...extra})
test('wallet separates card purchases, outgoing Pix, pending Pix and other payments without double counting',()=>{
  const pix=tx('pix','bank',-100,{paymentMethod:'PIX'})
  const rows=[
    pix,pix,tx('incoming','bank',200,{type:'CREDIT',operationType:'PIX'}),
    tx('pending','bank',-50,{operationType:'PIX',status:'PENDING'}),
    tx('future','bank',-25,{paymentMethod:'PIX',date:'2026-11-20'}),
    tx('boleto','bank',-80,{paymentMethod:'BOLETO'}),
    tx('unknown','bank',-15),
    tx('purchase','card',-30),tx('positive-purchase','card',40,{status:'PENDING'}),
    tx('refund','card',-20,{type:'CREDIT'}),
    tx('bill','card',-300,{operationType:'PAGAMENTO_FATURA'}),
    tx('foreign','usd',-700),
  ]
  const snapshot={accounts:[bank,card,{...bank,id:'usd',currencyCode:'USD'}],transactions:rows,updated_at:'2026-11-12'}
  const result=summarizeWallet(snapshot,'2026-11-12')
  assert.equal(result.balance,1000) // Do not subtract settled expenses from a bank-reported balance.
  assert.equal(result.cardPurchases,70)
  assert.equal(result.pixPaid,100)
  assert.equal(result.pixPending,75)
  assert.equal(result.otherOutflows,95)
  assert.equal(result.availableCredit,800)
  assert.equal(result.excludedCurrency,true)
  assert.equal(result.missingPaymentMethod,true)
})
test('missing credit limits and old snapshots are explicit, and no Pix is inferred from a description',()=>{
  const result=summarizeWallet({accounts:[bank,{...card,availableCreditLimit:undefined}],transactions:[tx('old','bank',-50,{description:'PIX para alguém'})],updated_at:''},'2026-11-12')
  assert.equal(result.availableCredit,null)
  assert.equal(result.pixPaid,0)
  assert.equal(result.otherOutflows,50)
  assert.equal(summarizeWallet({accounts:[],transactions:[],updated_at:''},'2026-11-12').balance,null)
})
test('normalization preserves payment classification but discards identity and payment details',()=>{
  const row=normalizeTransaction({...tx('pix','bank',-100),paymentData:{paymentMethod:'PIX',payer:{documentNumber:'private-id'},receiver:{name:'private-name'}},operationType:'PIX'},bank,'2026-11')
  assert.equal(row.paymentMethod,'PIX')
  assert.equal(row.operationType,'PIX')
  assert(!JSON.stringify(row).includes('private'))
})
const manualTx=(id,accountId,amount,extra={})=>({
  id,user_id:'owner',bank_connection_id:'connection',bank_account_id:accountId,bank_reflected:false,
  title:id,amount,type:'expense',payment_method:accountId==='card'?'credit_card':'pix',
  status:accountId==='card'?'pending':'paid',date:'2026-11-12',category:'Compras',
  installment_group_id:null,installment_current:null,installment_total:null,created_at:'2026-11-12',...extra,
})
const balances=(accounts=[bank,card],transactions=[])=>({accounts,transactions,updated_at:'2026-11-12'})
const project=(manual,base=balances(),monthSnapshot=null)=>projectWallet(base,monthSnapshot,manual,'connection','2026-11','2026-11-12')

test('manual account and credit projections use their own bank values and reserve all installments',()=>{
  const rows=[
    manualTx('pix','bank',100),
    manualTx('debit','bank',30,{payment_method:'debit'}),
    manualTx('income','bank',20,{type:'income'}),
    manualTx('first','card',33.34,{installment_group_id:'group',installment_current:1,installment_total:3}),
    manualTx('second','card',33.33,{date:'2026-12-12',status:'planned',installment_group_id:'group',installment_current:2,installment_total:3}),
    manualTx('third','card',33.33,{date:'2027-01-12',status:'planned',installment_group_id:'group',installment_current:3,installment_total:3}),
  ]
  const result=project(rows)
  assert.equal(result.balance,890)
  assert.equal(result.availableCredit,700)
  assert.equal(result.baseBalance,1000)
  assert.equal(result.baseAvailableCredit,800)
  assert.equal(result.cardPurchases,33.34)
  assert.equal(result.pixPaid,100)
  assert.equal(result.otherOutflows,30)
  assert.equal(result.accountBalances.find(row=>row.id==='bank').adjustment,-110)
  assert.equal(result.accountBalances.find(row=>row.id==='card').adjustment,-100)
  assert.equal(result.manualRows.length,4)
  assert.equal(result.hasBank,true)
  assert.equal(result.hasCard,true)
})
test('wallet excludes cash, other institutions, unlinked records and incompatible accounts',()=>{
  const result=project([
    manualTx('cash','bank',500,{payment_method:'cash'}),
    manualTx('other','bank',500,{bank_connection_id:'another'}),
    manualTx('unlinked','bank',500,{bank_connection_id:null}),
    manualTx('wrong','bank',500,{payment_method:'credit_card'}),
    manualTx('missing','gone',500),
    manualTx('valid','bank',0.10),
    manualTx('valid2','bank',0.20),
    manualTx('valid2','bank',0.20),
  ])
  assert.equal(result.balance,999.70)
  assert.equal(result.availableCredit,800)
  assert.equal(result.manualRows.length,2)
})
test('confirmation avoids a second bank deduction after a new sync, and deletion restores the adjustment',()=>{
  const entry=manualTx('pix','bank',100)
  assert.equal(project([entry]).balance,900)
  assert.equal(project([]).balance,1000)
  const reflected={...entry,bank_reflected:true}
  const newBank={...bank,balance:900}
  const bankTransaction=tx('bank-pix','bank',-100,{paymentMethod:'PIX'})
  const synced=balances([newBank,card],[bankTransaction])
  const result=project([reflected],synced,synced)
  assert.equal(result.balance,900)
  assert.equal(result.pixPaid,100)
  assert.equal(result.manualRows[0].bank_reflected,true)
  assert.equal(result.accountBalances.find(row=>row.id==='bank').adjustment,0)
  assert.equal(project([manualTx('card','card',100,{bank_reflected:true})]).availableCredit,800)
})
test('cash repeats only affect the balance when realized and missing card or credit limit stays explicit',()=>{
  const rows=[
    manualTx('matured','bank',40,{status:'planned',date:'2026-11-10'}),
    manualTx('future','bank',60,{status:'planned',date:'2026-11-20'}),
  ]
  const result=project(rows,balances([bank]))
  assert.equal(result.balance,960)
  assert.equal(result.pixPaid,40)
  assert.equal(result.pixPending,60)
  assert.equal(result.hasCard,false)
  assert.equal(result.availableCredit,null)
  const noLimit=project([manualTx('credit','card',100)],balances([{...card,availableCreditLimit:null}]))
  assert.equal(noLimit.hasBank,false)
  assert.equal(noLimit.balance,null)
  assert.equal(noLimit.hasCard,true)
  assert.equal(noLimit.availableCredit,null)
})
test('future recurring credit purchases do not reserve the limit before their month',()=>{
  const current=manualTx('current','card',50)
  const future=manualTx('recurring','card',50,{date:'2026-12-12',status:'planned'})
  const installment=manualTx('installment','card',100,{date:'2026-12-12',status:'planned',installment_group_id:'already-purchased'})
  const result=project([current,future,installment])
  assert.equal(result.availableCredit,650)
  assert.equal(result.cardPurchases,50)
  const nextMonth=projectWallet(balances(),null,[future],'connection','2026-12','2026-12-01')
  assert.equal(nextMonth.availableCredit,750)
})