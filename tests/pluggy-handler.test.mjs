import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createPluggyHandler } from '../supabase/functions/pluggy/handler.ts'

const user='11111111-1111-4111-8111-111111111111'
const other='22222222-2222-4222-8222-222222222222'
const itemId='33333333-3333-4333-8333-333333333333'
const connectionId='44444444-4444-4444-8444-444444444444'
const origin='https://loro.example'
const env={SUPABASE_URL:'https://test.supabase.co',SUPABASE_ANON_KEY:'public',SUPABASE_SERVICE_ROLE_KEY:'admin-secret',PLUGGY_CLIENT_ID:'test-client',PLUGGY_CLIENT_SECRET:'pluggy-secret',LORO_ALLOWED_ORIGINS:origin}
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}})
const bodyReq=(body,headers={})=>new Request('https://test.supabase.co/functions/v1/pluggy',{method:'POST',headers:{origin,authorization:'Bearer verified-test-token','Content-Type':'application/json',...headers},body:JSON.stringify(body)})

function fixture(options={}){
  const calls=[];const snapshots=new Map();let authCalls=0
  const fake=async(input,init={})=>{
    const url=new URL(input);const method=init.method??'GET';calls.push({url,method,init})
    if(url.pathname==='/auth/v1/user')return options.invalidAuth?json({},401):json({id:user})
    if(url.origin==='https://api.pluggy.ai'){
      if(url.pathname==='/auth'){authCalls++;return json({apiKey:'provider-api-secret'})}
      assert.equal(init.headers['X-API-KEY'],'provider-api-secret')
      if(url.pathname==='/connect_token')return json({accessToken:'safe-connect-token'})
      if(url.pathname===`/items/${itemId}`){
        if(options.missingItem)return json({},404)
        if(method==='DELETE')return new Response(null,{status:204})
        return json({id:itemId,clientUserId:options.foreignItem?other:user,connector:{id:2,name:'Pluggy Bank',isSandbox:!options.realBank},status:options.processing?'UPDATING':'UPDATED'})
      }
      if(url.pathname==='/accounts')return json({results:[{id:'account',itemId,name:'Conta de teste',type:'BANK',currencyCode:'BRL',balance:1000}]})
      if(url.pathname==='/v2/transactions'){
        if(options.failedPage&&url.searchParams.has('after'))return json({},500)
        const transaction={id:'external-1',accountId:'account',description:'Mercado',amount:-20,currencyCode:'BRL',date:'2026-11-12',type:'DEBIT',status:'POSTED'}
        return json({results:[transaction,transaction],next:!url.searchParams.has('after')&&options.paginate?options.maliciousCursor?'https://attacker.example/transactions?after=1':'?after=1&accountId=wrong&dateFrom=1900-01-01&dateTo=2100-01-01':null})
      }
    }
    if(url.pathname.startsWith('/rest/v1/')){
      assert.equal(init.headers.apikey,'admin-secret')
      assert(!url.pathname.includes('/transactions')&&!url.pathname.includes('monthly_budgets'),'sandbox must not write to financial ledgers')
      if(url.pathname.endsWith('bank_sandbox_connections')){
        if(method==='POST')return json([{id:connectionId,...JSON.parse(init.body)}])
        if(method==='DELETE')return new Response(null,{status:204})
        if(options.noConnection)return json([])
        if(url.searchParams.has('item_id'))return json(options.existingForeign?[{id:connectionId,user_id:other}]:[])
        assert.equal(url.searchParams.get('user_id'),`eq.${user}`)
        return json([{id:connectionId,user_id:user,item_id:itemId,institution_name:'Pluggy Bank'}])
      }
      if(url.pathname.endsWith('bank_sandbox_snapshots')){
        if(method==='POST'){const row=JSON.parse(init.body);snapshots.set(row.connection_id+row.month,row);return json([row])}
        assert.equal(url.searchParams.get('user_id'),`eq.${user}`)
        return json([])
      }
    }
    throw new Error('Unexpected request '+url)
  }
  return {handler:createPluggyHandler({...env,...options.env},fake),calls,snapshots,authCalls:()=>authCalls}
}

test('rejects unknown origins and invalid sessions before contacting Pluggy',async()=>{
  const f=fixture()
  assert.equal((await f.handler(bodyReq({action:'token'},{origin:'https://attacker.example'}))).status,403)
  assert.equal((await f.handler(bodyReq({action:'token'},{authorization:''}))).status,401)
  assert.equal(f.calls.length,0)
  const invalid=fixture({invalidAuth:true})
  assert.equal((await invalid.handler(bodyReq({action:'token'}))).status,401)
  assert(!invalid.calls.some(call=>call.url.origin==='https://api.pluggy.ai'))
})
test('issues only a short-lived token with server-assigned ownership; never returns secrets',async()=>{
  const f=fixture()
  const response=await f.handler(bodyReq({action:'token',options:{clientUserId:other}}))
  const text=await response.text();assert.equal(response.status,200)
  assert(text.includes('safe-connect-token'))
  for(const secret of ['admin-secret','pluggy-secret','provider-api-secret'])assert(!text.includes(secret))
  const tokenCall=f.calls.find(call=>call.url.pathname==='/connect_token')
  assert.equal(JSON.parse(tokenCall.init.body).options.clientUserId,user)
  await f.handler(bodyReq({action:'token'}));assert.equal(f.authCalls(),1)
})
test('rejects attaching another user or a real bank, and blocks forged connection ids',async()=>{
  for(const options of [{foreignItem:true},{realBank:true},{existingForeign:true}]){
    const f=fixture(options);const response=await f.handler(bodyReq({action:'attach',itemId}))
    assert.equal(response.status,403)
    assert(!f.calls.some(call=>call.method==='POST'&&call.url.pathname.startsWith('/rest/')))
  }
  const f=fixture({noConnection:true});assert.equal((await f.handler(bodyReq({action:'sync',connectionId,month:'2026-11'}))).status,404)
  assert(!f.calls.some(call=>call.url.origin==='https://api.pluggy.ai'))
})
test('synchronizes duplicate-free sandbox snapshots idempotently without changing financial data',async()=>{
  const f=fixture({paginate:true})
  for(let i=0;i<2;i++){
    const response=await f.handler(bodyReq({action:'sync',connectionId,month:'2026-11'}))
    assert.equal(response.status,200);const data=await response.json();assert.equal(data.count,1);assert.equal(data.snapshot.transactions[0].amount,-20)
  }
  assert.equal(f.snapshots.size,1)
  const transactionCalls=f.calls.filter(call=>call.url.pathname==='/v2/transactions')
  assert(transactionCalls.length>=4)
  for(const call of transactionCalls){
    assert.equal(call.url.searchParams.get('accountId'),'account')
    assert.equal(call.url.searchParams.get('dateFrom'),'2026-11-01')
    assert.equal(call.url.searchParams.get('dateTo'),'2026-11-30')
    assert(!call.url.searchParams.has('from')&&!call.url.searchParams.has('to'))
  }
  assert(!f.calls.some(call=>call.url.origin==='https://api.pluggy.ai'&&call.url.pathname==='/transactions'))
})
test('never persists a partial sync or follows an external pagination URL',async()=>{
  for(const options of [{paginate:true,failedPage:true},{paginate:true,maliciousCursor:true},{processing:true}]){
    const f=fixture(options);const response=await f.handler(bodyReq({action:'sync',connectionId,month:'2026-11'}))
    assert(response.status>=400);assert.equal(f.snapshots.size,0)
    assert(!f.calls.some(call=>call.url.hostname==='attacker.example'))
  }
})
test('missing provider secrets fail safely and expired sandbox items can be disconnected',async()=>{
  const f=fixture({env:{PLUGGY_CLIENT_SECRET:''}})
  const response=await f.handler(bodyReq({action:'token'}));assert.equal(response.status,503)
  assert(!f.calls.some(call=>call.url.origin==='https://api.pluggy.ai'))
  const stale=fixture({missingItem:true});assert.equal((await stale.handler(bodyReq({action:'disconnect',connectionId}))).status,200)
  assert(stale.calls.some(call=>call.method==='DELETE'&&call.url.pathname.endsWith('bank_sandbox_connections')))
})

test('provider failures identify the stage without leaking provider responses or credentials',async()=>{
  for(const [stage,status,expected] of [
    ['/auth',401,'recusou as credenciais'],
    ['/auth',403,'recusou as credenciais'],
    ['/connect_token',403,'recusou o acesso'],
    ['/connect_token',500,'Não foi possível consultar'],
  ]){
    const handler=createPluggyHandler(env,async(input)=>{
      const url=new URL(input)
      if(url.pathname==='/auth/v1/user')return json({id:user})
      if(url.pathname===stage)return json({error:'private-provider-response',secret:'pluggy-secret'},status)
      if(url.pathname==='/auth')return json({apiKey:'provider-api-secret'})
      throw new Error('Unexpected request')
    })
    const response=await handler(bodyReq({action:'token'}))
    assert.equal(response.status,502)
    const text=await response.text()
    assert(text.includes(expected))
    for(const secret of ['private-provider-response','pluggy-secret','provider-api-secret'])assert(!text.includes(secret))
  }
})
test('wallet loads latest balances and selected month only after verifying the connection owner',async()=>{
  const f=fixture()
  const response=await f.handler(bodyReq({action:'wallet',connectionId,month:'2026-11'}))
  assert.equal(response.status,200)
  assert.deepEqual(await response.json(),{balances:null,snapshot:null})
  const queries=f.calls.filter(call=>call.url.pathname.endsWith('bank_sandbox_snapshots'))
  assert.equal(queries.length,2)
  for(const call of queries){
    assert.equal(call.url.searchParams.get('user_id'),'eq.'+user)
    assert.equal(call.url.searchParams.get('connection_id'),'eq.'+connectionId)
  }
  assert(queries.some(call=>call.url.searchParams.get('order')==='updated_at.desc'&&call.url.searchParams.get('limit')==='1'&&!call.url.searchParams.has('month')))
  assert(queries.some(call=>call.url.searchParams.get('month')==='eq.2026-11'))
  const foreign=fixture({noConnection:true})
  assert.equal((await foreign.handler(bodyReq({action:'wallet',connectionId,month:'2026-11'}))).status,404)
  assert(!foreign.calls.some(call=>call.url.pathname.endsWith('bank_sandbox_snapshots')))
})