import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { FlaskConical, Landmark, Link2, RefreshCw, Unplug } from 'lucide-react'
import { useFinance } from '../../contexts/useFinance'
import { bankingApi, formatBankMoney } from './banking-api'
import type { BankConnection, BankSnapshot } from './banking-api'
import { formatDate } from '../../utils/formatters'

const PluggyConnect = lazy(() => import('react-pluggy-connect').then(module => ({ default: module.PluggyConnect })))
type Loaded = { connectionId: string; month: string; data: BankSnapshot | null }

export function BankConnections() {
  const { month } = useFinance()
  const [connections, setConnections] = useState<BankConnection[]>([])
  const [selected, setSelected] = useState('')
  const [configured, setConfigured] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [reading, setReading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const snapshot = loaded?.connectionId === selected && loaded.month === month ? loaded.data : null

  const loadConnections = useCallback(async () => {
    const result = await bankingApi<{ configured: boolean; mode: 'sandbox'; connections: BankConnection[] }>({ action: 'list' })
    setConnections(result.connections)
    setConfigured(result.configured)
    setSelected(current => result.connections.some(item => item.id === current) ? current : result.connections[0]?.id ?? '')
  }, [])

  useEffect(() => {
    let active = true
    bankingApi<{ configured: boolean; mode: 'sandbox'; connections: BankConnection[] }>({ action: 'list' }).then(result => {
      if (!active) return
      setConnections(result.connections); setConfigured(result.configured); setSelected(result.connections[0]?.id ?? '')
    }).catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Não foi possível consultar as conexões.') })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!selected) return
    let active = true
    // oxlint-disable-next-line react/set-state-in-effect -- Track a remote request for the current connection/month.
    setReading(true)
    bankingApi<{ snapshot: BankSnapshot | null }>({ action: 'snapshot', connectionId: selected, month }).then(result => {
      if (active) setLoaded({ connectionId: selected, month, data: result.snapshot })
    }).catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Não foi possível consultar os dados.') })
      .finally(() => { if (active) setReading(false) })
    return () => { active = false }
  }, [selected, month])

  async function run(label: string, operation: () => Promise<void>) {
    if (busy) return
    setBusy(label); setError(null); setNotice(null)
    try { await operation() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível concluir a operação.') }
    finally { setBusy(null) }
  }

  async function sync(connectionId = selected) {
    const result = await bankingApi<{ snapshot: BankSnapshot; count: number }>({ action: 'sync', connectionId, month })
    setLoaded({ connectionId, month, data: result.snapshot })
    setNotice(`${result.count} transações de teste consultadas. Seus lançamentos reais não foram alterados.`)
  }

  return <section id="bancos" className="banking-module dashboard-surface" aria-labelledby="banking-title" aria-busy={Boolean(busy) || reading}>
    <div className="module-heading"><div><span className="eyebrow">SUAS CONEXÕES</span><h2 id="banking-title"><Landmark size={20} />Bancos</h2><p>Conecte uma instituição fictícia e consulte o mês selecionado.</p></div><span className="banking-mode"><FlaskConical size={14} />Ambiente de testes</span></div>
    <p className="banking-test-note">Esta etapa usa apenas dados fictícios da Pluggy. A carteira usa estes saldos e movimentos de teste. O Lorômetro e os lançamentos manuais continuam separados.</p>
    <div className="banking-actions">
      <button type="button" className="primary-button" disabled={Boolean(busy) || !configured || Boolean(token)} onClick={() => void run('connect', async () => {
        const result = await bankingApi<{ connectToken: string }>({ action: 'token' })
        setToken(result.connectToken)
      })}><Link2 size={16} />{busy === 'connect' ? 'Preparando…' : 'Conectar banco de teste'}</button>
      <button type="button" className="banking-secondary" disabled={Boolean(busy)} onClick={() => void run('reload', loadConnections)}><RefreshCw size={15} />Atualizar conexões</button>
      {!configured && <span className="banking-setup">Integração em preparação. A conexão será liberada após a configuração.</span>}
    </div>
    {error && <p role="alert" className="banking-feedback">{error}</p>}
    {notice && <p role="status" className="banking-feedback banking-success">{notice}</p>}
    {connections.length > 0 ? <>
      <div className="banking-connection-controls">
        <label>Instituição de teste<select value={selected} disabled={Boolean(busy)} onChange={event => { setSelected(event.target.value); setError(null); setNotice(null) }}>{connections.map(connection => <option key={connection.id} value={connection.id}>{connection.institution_name}</option>)}</select></label>
        <button type="button" className="banking-secondary" disabled={!selected || Boolean(busy) || reading} onClick={() => void run('sync', () => sync())}><RefreshCw size={15} />{busy === 'sync' ? 'Sincronizando…' : 'Sincronizar mês'}</button>
        <button type="button" className="banking-disconnect" disabled={!selected || Boolean(busy)} onClick={() => {
          if (!window.confirm('Desconectar esta instituição de teste? Os dados de teste salvos serão removidos. Seus lançamentos reais serão mantidos.')) return
          void run('disconnect', async () => { await bankingApi({ action: 'disconnect', connectionId: selected }); setLoaded(null); await loadConnections(); setNotice('Instituição de teste desconectada.') })
        }}><Unplug size={15} />Desconectar</button>
      </div>
      {reading ? <p role="status" className="banking-empty">Consultando dados de teste…</p> : snapshot ? <>
        <div className="banking-account-grid">{snapshot.accounts.map(account => <article key={account.id}><span>{account.type === 'CREDIT' ? 'Cartão' : 'Conta'}</span><h3>{account.name}</h3><strong>{formatBankMoney(account.balance, account.currencyCode)}</strong><small>Saldo informado pela instituição de teste</small></article>)}</div>
        <div className="banking-table-wrap" tabIndex={0} role="region" aria-label="Transações bancárias de teste; role horizontalmente em telas pequenas">
          <table><thead><tr><th scope="col">Descrição</th><th scope="col">Conta</th><th scope="col">Data</th><th scope="col">Situação</th><th scope="col">Valor informado</th></tr></thead><tbody>{snapshot.transactions.map(transaction => <tr key={`${transaction.accountId}:${transaction.id}`}><th scope="row">{transaction.description}</th><td>{transaction.accountName}</td><td>{formatDate(transaction.date)}</td><td>{transaction.status === 'PENDING' ? 'Pendente' : transaction.status === 'POSTED' ? 'Confirmada' : transaction.status}</td><td>{formatBankMoney(transaction.amount, transaction.currencyCode)}</td></tr>)}</tbody></table>
        </div>
        {!snapshot.transactions.length && <p className="banking-empty">Nenhuma transação de teste neste mês.</p>}
        <p className="banking-footnote">Última consulta: {new Date(snapshot.updated_at).toLocaleString('pt-BR')}. Valores e sinais são os informados pela instituição; esta prévia não gera lançamentos ou parcelas no Lôro.</p>
      </> : <p className="banking-empty">Clique em “Sincronizar mês” para consultar as contas e transações de teste.</p>}
    </> : <div className="banking-empty"><Landmark size={28} /><p>Nenhuma instituição de teste conectada.</p><small>Depois da configuração, use “Conectar banco de teste” para experimentar.</small></div>}
    {token && <Suspense fallback={<p role="status">Abrindo a conexão de teste…</p>}><PluggyConnect connectToken={token} includeSandbox connectorIds={[2]} language="pt" onClose={() => setToken(null)} onError={() => { setToken(null); setError('Não foi possível concluir a conexão de teste. Tente novamente.') }} onSuccess={({ item }) => {
      setToken(null)
      void run('attach', async () => { const result = await bankingApi<{ connectionId: string }>({ action: 'attach', itemId: item.id }); await loadConnections(); setSelected(result.connectionId); setNotice('Instituição de teste conectada. Clique em “Sincronizar mês” para consultar os dados.') })
    }} /></Suspense>}
  </section>
}
