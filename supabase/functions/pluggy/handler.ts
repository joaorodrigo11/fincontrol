import { assertOwnedSandbox, monthRange, normalizeTransaction, PublicError, requireUuid } from './policy.ts'
import type { BankAccount, BankTransaction, PluggyItem } from './policy.ts'

type Env = Record<string, string | undefined>
type Connection = { id: string; user_id: string; item_id: string; institution_name: string; created_at: string }
type Page = { results: Record<string, unknown>[]; next?: string | null; totalPages?: number }
const PLUGGY = 'https://api.pluggy.ai'

export function createPluggyHandler(env: Env, request: typeof fetch = fetch) {
  let apiKey = ''
  let apiExpiresAt = 0
  const origins = new Set((env.LORO_ALLOWED_ORIGINS ?? '').split(',').map(value => value.trim()).filter(Boolean))
  const configured = Boolean(env.PLUGGY_CLIENT_ID && env.PLUGGY_CLIENT_SECRET)

  async function api(path: string, init: RequestInit = {}, authenticate = true): Promise<unknown> {
    if (!configured) throw new PublicError('Cadastre as credenciais da Pluggy nos secrets do Supabase.', 503)
    if (authenticate && Date.now() >= apiExpiresAt) {
      const auth = await api('/auth', { method: 'POST', body: JSON.stringify({ clientId: env.PLUGGY_CLIENT_ID, clientSecret: env.PLUGGY_CLIENT_SECRET }) }, false) as { apiKey?: string }
      if (!auth.apiKey) throw new PublicError('Não foi possível autenticar na Pluggy.', 502)
      apiKey = auth.apiKey
      apiExpiresAt = Date.now() + 110 * 60 * 1000
    }
    const url = new URL(path, PLUGGY)
    if (url.origin !== PLUGGY) throw new PublicError('Endereço da instituição inválido.', 502)
    const response = await request(url, { ...init, redirect: 'error', headers: { 'Content-Type': 'application/json', ...(authenticate ? { 'X-API-KEY': apiKey } : {}) }, signal: AbortSignal.timeout(15000) })
    if (!response.ok) {
      if (response.status === 401) { apiKey = ''; apiExpiresAt = 0 }
      if (response.status === 404) throw new PublicError('Conexão não encontrada na Pluggy. Conecte a instituição de teste novamente.', 404)
      throw new PublicError(response.status === 429 ? 'A Pluggy limitou as consultas. Aguarde um pouco antes de tentar novamente.' : 'Não foi possível consultar a Pluggy. Confira a conexão e tente novamente.', response.status === 429 ? 429 : 502)
    }
    return response.status === 204 ? null : response.json()
  }

  async function db(path: string, init: RequestInit = {}): Promise<unknown> {
    const response = await request(`${env.SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY!, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json', Prefer: 'return=representation,resolution=merge-duplicates',
    }, signal: AbortSignal.timeout(10000) })
    if (!response.ok) throw new PublicError('Não foi possível acessar a integração. Confira se a migração do banco foi aplicada.', 503)
    return response.status === 204 ? null : response.json()
  }

  async function pages(path: string, accountId?: string): Promise<Record<string, unknown>[]> {
    const first = new URL(path, PLUGGY)
    let url = new URL(first)
    const rows: Record<string, unknown>[] = []
    for (let page = 1; page <= 20; page++) {
      const data = await api(url.toString()) as Page
      if (!Array.isArray(data.results)) throw new PublicError('Resposta inesperada da instituição.', 502)
      rows.push(...data.results)
      if (rows.length > 10000) throw new PublicError('Há muitas transações neste mês. A sincronização não foi concluída.', 422)
      if (data.next) {
        const next = new URL(data.next, url)
        if (next.origin !== PLUGGY || next.pathname !== first.pathname) throw new PublicError('Paginação inválida da instituição.', 502)
        // Never follow a cursor into a different account or time range.
        for (const [key, value] of first.searchParams) if (key !== 'page' && key !== 'after') next.searchParams.set(key, value)
        if (accountId) next.searchParams.set('accountId', accountId)
        url = next
      } else if (data.totalPages && page < data.totalPages) {
        url = new URL(first); url.searchParams.set('page', String(page + 1))
      } else return rows
    }
    throw new PublicError('A consulta atingiu o limite de páginas. Nenhuma sincronização parcial foi salva.', 422)
  }

  async function ownedConnection(id: unknown, userId: string) {
    const safeId = requireUuid(id)
    const rows = await db(`bank_sandbox_connections?id=eq.${safeId}&user_id=eq.${userId}&select=*`) as Connection[]
    if (!rows.length) throw new PublicError('Conexão não encontrada para esta conta.', 404)
    return rows[0]
  }

  return async function handler(req: Request): Promise<Response> {
    const origin = req.headers.get('origin') ?? ''
    const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', Vary: 'Origin',
      ...(origins.has(origin) ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } : {}) }
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers })
    if (!origins.has(origin)) return json({ error: 'Origem não autorizada. Configure LORO_ALLOWED_ORIGINS nos secrets.' }, 403)
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers })
    if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)
    try {
      if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY || !env.SUPABASE_SERVICE_ROLE_KEY) throw new PublicError('Integração não configurada no servidor.', 503)
      const bearer = req.headers.get('authorization') ?? ''
      if (!/^Bearer \S+$/i.test(bearer)) throw new PublicError('Entre na sua conta para conectar um banco.', 401)
      const auth = await request(`${env.SUPABASE_URL}/auth/v1/user`, { headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: bearer }, signal: AbortSignal.timeout(10000) })
      if (!auth.ok) throw new PublicError('Sua sessão expirou. Entre novamente.', 401)
      const user = await auth.json() as { id: string }
      const userId = requireUuid(user.id)
      const raw = await req.text()
      if (raw.length > 4096) throw new PublicError('Solicitação muito grande.', 413)
      let body: Record<string, unknown>
      try { body = JSON.parse(raw) } catch { throw new PublicError('Solicitação inválida.') }
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new PublicError('Solicitação inválida.')

      if (body.action === 'list') {
        const connections = await db(`bank_sandbox_connections?user_id=eq.${userId}&select=id,institution_name,created_at&order=created_at.desc`)
        return json({ configured, mode: 'sandbox', connections })
      }
      if (body.action === 'token') {
        const token = await api('/connect_token', { method: 'POST', body: JSON.stringify({ options: { clientUserId: userId, avoidDuplicates: true } }) }) as { accessToken?: string }
        if (!token.accessToken) throw new PublicError('A Pluggy não retornou um token de conexão.', 502)
        return json({ connectToken: token.accessToken, mode: 'sandbox', connectorIds: [2] })
      }
      if (body.action === 'attach') {
        const item = await api(`/items/${requireUuid(body.itemId)}`) as PluggyItem
        assertOwnedSandbox(item, userId)
        const existing = await db(`bank_sandbox_connections?item_id=eq.${requireUuid(item.id)}&select=id,user_id`) as Connection[]
        if (existing.some(row => row.user_id !== userId)) throw new PublicError('Não foi possível associar esta conexão.', 403)
        const connection = existing[0] ?? (await db('bank_sandbox_connections', { method: 'POST', body: JSON.stringify({ user_id: userId, item_id: item.id, institution_name: String(item.connector.name ?? 'Banco de teste').slice(0, 120) }) }) as Connection[])[0]
        return json({ connectionId: connection.id })
      }
      if (body.action === 'snapshot') {
        const connection = await ownedConnection(body.connectionId, userId)
        const range = monthRange(body.month)
        const snapshots = await db(`bank_sandbox_snapshots?connection_id=eq.${connection.id}&user_id=eq.${userId}&month=eq.${range.month}&select=accounts,transactions,updated_at`) as unknown[]
        return json({ snapshot: snapshots[0] ?? null })
      }
      if (body.action === 'sync') {
        const connection = await ownedConnection(body.connectionId, userId)
        const range = monthRange(body.month)
        const item = await api(`/items/${connection.item_id}`) as PluggyItem
        assertOwnedSandbox(item, userId)
        if (item.status !== 'UPDATED') throw new PublicError('A instituição ainda está processando a conexão. Aguarde e sincronize novamente.', 409)
        const rawAccounts = await pages(`/accounts?itemId=${connection.item_id}&pageSize=500`)
        if (rawAccounts.length > 30) throw new PublicError('Limite de contas de teste excedido.', 422)
        const accounts: BankAccount[] = []
        const unique = new Map<string, BankTransaction>()
        for (const row of rawAccounts) {
          if (row.itemId !== connection.item_id || typeof row.id !== 'string') throw new PublicError('Conta bancária inconsistente.', 502)
          if (row.type !== 'BANK' && row.type !== 'CREDIT') continue
          if (typeof row.balance !== 'number' || !Number.isFinite(row.balance) || typeof row.currencyCode !== 'string' || !/^[A-Z]{3}$/.test(row.currencyCode)) throw new PublicError('Saldo ou moeda da conta inválidos.', 502)
          const account: BankAccount = { id: row.id, name: String(row.name ?? 'Conta de teste').slice(0, 120), type: row.type, balance: row.balance, currencyCode: row.currencyCode }
          accounts.push(account)
          const rows = await pages(`/transactions?accountId=${encodeURIComponent(account.id)}&from=${range.from}&to=${range.to}&pageSize=500`, account.id)
          for (const transaction of rows) {
            const normalized = normalizeTransaction(transaction, account, range.month)
            if (normalized) unique.set(`${account.id}:${normalized.id}`, normalized)
            if (unique.size > 10000) throw new PublicError('Há muitas transações neste mês. A sincronização não foi concluída.', 422)
          }
        }
        const transactions = [...unique.values()].sort((a, b) => b.date.localeCompare(a.date))
        const snapshot = { connection_id: connection.id, user_id: userId, month: range.month, accounts, transactions, updated_at: new Date().toISOString() }
        await db('bank_sandbox_snapshots?on_conflict=connection_id,month', { method: 'POST', body: JSON.stringify(snapshot) })
        return json({ snapshot, count: transactions.length })
      }
      if (body.action === 'disconnect') {
        const connection = await ownedConnection(body.connectionId, userId)
        try {
          const item = await api(`/items/${connection.item_id}`) as PluggyItem
          assertOwnedSandbox(item, userId)
          await api(`/items/${connection.item_id}`, { method: 'DELETE' })
        } catch (error) {
          // Sandbox items expire at the provider; still allow removing our own stale reference.
          if (!(error instanceof PublicError) || error.status !== 404) throw error
        }
        await db(`bank_sandbox_connections?id=eq.${connection.id}&user_id=eq.${userId}`, { method: 'DELETE' })
        return json({ disconnected: true })
      }
      throw new PublicError('Ação inválida.')
    } catch (error) {
      if (error instanceof PublicError) return json({ error: error.message }, error.status)
      return json({ error: 'Não foi possível concluir a operação. Tente novamente em instantes.' }, 500)
    }
  }
}
