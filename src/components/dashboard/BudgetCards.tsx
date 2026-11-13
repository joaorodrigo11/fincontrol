import { useState } from 'react'
import { CreditCard, Wallet, ArrowUpRight, RefreshCw } from 'lucide-react'
import { WalletCard } from '../ui/WalletCard'
import { AnimatedCurrency } from '../ui/AnimatedCurrency'
import { useFinance } from '../../contexts/useFinance'
import { useAuth } from '../../contexts/useAuth'
import { useBankWallet } from '../banking/useBankWallet'
import { projectWallet } from '../banking/wallet-summary'
import { formatCurrencyBRL, formatDate } from '../../utils/formatters'
import type { BankTransaction } from '../banking/banking-api'
import type { Transaction } from '../../types/database'

const paymentLabels = { pix: 'Pix', debit: 'Débito', credit_card: 'Crédito', cash: 'Dinheiro' }
export function BudgetCards() {
  const { month } = useFinance()
  const { user } = useAuth()
  return <BankWallet key={user?.id} month={month} />
}

function BankWallet({ month }: { month: string }) {
  const bank = useBankWallet(month)
  const { setBankReflected, saving } = useFinance()
  const [actionError, setActionError] = useState<string | null>(null)
  const [visible, setVisible] = useState(() => {
    try { return localStorage.getItem('loro-wallet-private') !== 'true' } catch { return true }
  })
  const [tab, setTab] = useState<'card' | 'pixPaid' | 'pixPending' | 'other'>('card')
  const [today] = useState(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()))
  const summary = bank.balances ? projectWallet(bank.balances, bank.snapshot, bank.transactions, bank.selected, month, today) : null
  function toggle() {
    setVisible(value => {
      try { localStorage.setItem('loro-wallet-private', String(value)) } catch { /* Optional persistence. */ }
      return !value
    })
  }
  async function reflect(row: Transaction) {
    setActionError(null)
    try { await setBankReflected(row, !row.bank_reflected) }
    catch (error) { setActionError(error instanceof Error ? error.message : 'Não foi possível atualizar o vínculo bancário.') }
  }
  const money = (value: number | null | undefined) => !visible ? '••••' : value == null ? 'Não informado' : formatCurrencyBRL(value)
  const tabs = [
    { id: 'card' as const, label: 'Compras no cartão', value: summary?.cardPurchases },
    { id: 'pixPaid' as const, label: 'Pix que saiu', value: summary?.pixPaid },
    { id: 'pixPending' as const, label: 'Pix previsto / pendente', value: summary?.pixPending },
    { id: 'other' as const, label: 'Débito e outras saídas', value: summary?.otherOutflows },
  ]
  const rows: BankTransaction[] = summary?.groups[tab] ?? []
  return <section id="orcamento" aria-labelledby="budget-title" aria-busy={bank.loading}>
    <div className="module-heading"><div><span className="eyebrow">SEU BANCO, NA CARTEIRA</span><h2 id="budget-title">Minha carteira</h2><p>Os lançamentos atualizam a conta ou o cartão escolhido.</p></div><span className="banking-mode">Sandbox · dados de teste</span></div>
    <div className="banking-connection-controls wallet-source">
      {bank.connections.length > 0 && <label>Instituição<select value={bank.selected} onChange={event => bank.select(event.target.value)}>{bank.connections.map(row => <option key={row.id} value={row.id}>{row.institution_name}</option>)}</select></label>}
      <button type="button" className="banking-secondary" disabled={bank.loading} onClick={bank.refresh}><RefreshCw size={15} />Atualizar carteira</button>
    </div>
    <WalletCard open={visible} onToggle={toggle}>
      <div className="wallet-heading"><span>LÔRO<br /><span className="wallet-subtitle">CARTEIRA CONECTADA</span></span></div>
      <div id="wallet-balances" aria-hidden={!visible}>
        <div className="budget-grid">
          <article className="balance-panel">
            <h3 className="bank-wallet-title"><Wallet size={20} />Saldo em conta</h3>
            {summary?.hasBank ? <>
              <p className="text-3xl" aria-live="polite">{visible ? <AnimatedCurrency value={summary.balance!} /> : money(null)}</p>
              <p className="text-xs mt-4">Banco: {money(summary.baseBalance)} · Ajuste dos lançamentos: {money(summary.balance! - summary.baseBalance!)}</p>
              {summary.accountBalances.filter(account => account.type === 'BANK').map(account => <p className="text-xs mt-4" key={account.id}>{account.name}: {money(account.balance)}</p>)}
            </> : <p className="text-xs mt-4">{bank.loading ? 'Consultando contas…' : 'Esta instituição ainda não informou uma conta corrente.'}</p>}
            <p className="text-xs mt-4">Pix e débito saem desta conta. Entradas via Pix ou débito aumentam o saldo.</p>
          </article>
          <article className="balance-panel">
            <h3 className="bank-wallet-title"><CreditCard size={20} />Crédito disponível</h3>
            {summary?.hasCard ? <>
              <p className="text-3xl" aria-live="polite">{visible && summary.availableCredit != null ? <AnimatedCurrency value={summary.availableCredit} /> : money(summary.availableCredit)}</p>
              {summary.accountBalances.filter(account => account.type === 'CREDIT').map(account => <p className="text-xs mt-4" key={account.id}>{account.name}: {money(account.availableCreditLimit)}<br />Disponível no banco: {money(account.bankAvailableCreditLimit)} · Compras ainda não refletidas: {money(-account.adjustment)}</p>)}
              <p className="text-xs mt-4">Compras do mês: {money(summary.cardPurchases)}. Parcelamentos comprometem o valor total da compra no limite, com cada parcela no seu mês.</p>
            </> : <p className="text-xs mt-4">{bank.loading ? 'Consultando cartões…' : 'Esta instituição não informou cartão de crédito.'}</p>}
          </article>
        </div>
        <div className="bank-wallet-pix">
          <div><ArrowUpRight size={17} /><span>Pix que saiu<strong>{money(summary?.pixPaid)}</strong></span></div>
          <div><ArrowUpRight size={17} /><span>Pix previsto / pendente<strong>{money(summary?.pixPending)}</strong></span></div>
        </div>
      </div>
    </WalletCard>
    {!visible && <p className="wallet-private-notice">Valores ocultos. Abra a carteira para consultar os movimentos.</p>}
    {bank.loading && <p role="status" className="banking-empty">Consultando a carteira…</p>}
    {(bank.error || actionError) && <p role="alert" className="banking-feedback">{actionError ?? bank.error}</p>}
    {!bank.loading && !bank.error && !bank.balances && <div className="banking-empty"><p>{bank.connections.length ? 'Em Bancos, clique em “Sincronizar mês” para consultar seus saldos.' : 'Conecte uma instituição em Bancos e sincronize para preencher sua carteira.'}</p><a href="#bancos">Ir para Bancos</a></div>}
    {visible && summary && <div className="bank-wallet-details dashboard-surface">
      <p className="banking-footnote">Saldo estimado = saldo consultado no banco + lançamentos ainda não refletidos. Quando um gasto já aparecer no extrato, marque “Já consta no banco” abaixo para não descontá-lo novamente. Em compras parceladas, a confirmação vale para a compra inteira.</p>
      <div className="bank-wallet-tabs" role="group" aria-label="Separar movimentos">{tabs.map(item => <button key={item.id} type="button" aria-pressed={tab === item.id} onClick={() => setTab(item.id)}>{item.label}<strong>{money(item.value)}</strong></button>)}</div>
      <h3 className="bank-wallet-list-title">{tabs.find(item => item.id === tab)?.label} · extrato do banco</h3>
      <div className="banking-table-wrap" tabIndex={0} role="region" aria-label="Movimentos bancários da carteira">
        <table><thead><tr><th scope="col">Descrição</th><th scope="col">Conta</th><th scope="col">Data</th><th scope="col">Situação</th><th scope="col">Valor</th></tr></thead><tbody>{rows.map(row => <tr key={row.accountId + ':' + row.id}><th scope="row">{row.description}</th><td>{row.accountName}</td><td>{formatDate(row.date)}</td><td>{row.status === 'PENDING' ? 'Pendente' : row.date > today ? 'Data futura informada' : 'Confirmada'}</td><td>{formatCurrencyBRL(Math.abs(row.amount))}</td></tr>)}</tbody></table>
      </div>
      {!rows.length && <p className="banking-empty">Nenhum movimento bancário identificado nesta categoria no mês.</p>}
      <h3 className="bank-wallet-list-title">Seus lançamentos vinculados · mês</h3>
      {summary.manualRows.length ? <div className="banking-table-wrap" tabIndex={0} role="region" aria-label="Lançamentos que atualizam a carteira"><table>
        <thead><tr><th scope="col">Descrição</th><th scope="col">Conta / pagamento</th><th scope="col">Data</th><th scope="col">Situação</th><th scope="col">No banco</th><th scope="col">Valor</th></tr></thead>
        <tbody>{summary.manualRows.map(row => <tr key={row.id}><th scope="row">{row.title}</th><td>{bank.accounts.find(account => account.id === row.bank_account_id)?.name} · {paymentLabels[row.payment_method]}</td><td>{formatDate(row.date)}</td><td>{row.status === 'paid' ? 'Realizado' : row.status === 'pending' ? 'Na fatura' : 'Previsto'}</td><td><button type="button" className="banking-secondary" aria-pressed={row.bank_reflected} disabled={saving} onClick={() => void reflect(row)}>{row.bank_reflected ? 'Já consta no banco ✓' : 'Marcar: já consta no banco'}</button></td><td>{row.type === 'income' ? '+ ' : '− '}{formatCurrencyBRL(row.amount)}</td></tr>)}</tbody>
      </table></div> : <p className="banking-empty">Escolha a conta ou o cartão no novo lançamento para atualizar esta carteira.</p>}
      <p className="banking-footnote">Saldo bancário consultado em {new Date(bank.balances!.updated_at).toLocaleString('pt-BR')}. Movimentos e parcelas exibidos: {month}. O saldo e o limite consideram todos os lançamentos vinculados ainda não refletidos, inclusive parcelas futuras. Dinheiro em espécie fica fora das contas bancárias.</p>
      {!bank.snapshot && <p className="banking-footnote">O extrato bancário deste mês ainda não foi consultado. Os saldos usam a última sincronização disponível.</p>}
      {summary.missingPaymentMethod && <p className="banking-footnote">Saídas sem meio de pagamento informado aparecem em “Débito e outras saídas”. Sincronize novamente para buscar os detalhes.</p>}
      {summary.excludedCurrency && <p className="banking-footnote">Contas em outras moedas não entram nos totais em reais.</p>}
    </div>}
  </section>
}