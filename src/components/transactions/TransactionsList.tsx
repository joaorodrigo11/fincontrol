import { useDialogFocus } from '../ui/useDialogFocus'
import { useMemo, useState } from 'react'
import { Search, Trash2 } from 'lucide-react'
import { CategoryIcon } from '../ui/CategoryIcon'
import type { Transaction } from '../../types/database'
import { useFinance } from '../../contexts/useFinance'
import { formatCurrencyBRL, formatDate } from '../../utils/formatters'

type StatusFilter = 'all' | 'paid' | 'pending' | 'planned'

const paymentLabels: Record<Transaction['payment_method'], string> = {
  pix: 'Pix',
  debit: 'Débito',
  credit_card: 'Crédito',
  cash: 'Dinheiro',
}

const statusLabels: Record<Transaction['status'], string> = {
  paid: 'Pago',
  pending: 'Na fatura',
  planned: 'Previsto',
}

export function TransactionsList() {
  const { monthTransactions, deleteTransaction, saving } = useFinance()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [target, setTarget] = useState<Transaction | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const dialogRef = useDialogFocus(Boolean(target), () => setTarget(null), deleting)

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('pt-BR')
    return [...monthTransactions]
      .filter((transaction) => filter === 'all' || transaction.status === filter)
      .filter(
        (transaction) =>
          !normalized ||
          transaction.title.toLocaleLowerCase('pt-BR').includes(normalized) ||
          transaction.category.toLocaleLowerCase('pt-BR').includes(normalized),
      )
      .sort((left, right) => right.date.localeCompare(left.date))
  }, [filter, monthTransactions, query])

  async function handleDelete(scope: 'single' | 'this_and_future') {
    if (!target) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteTransaction(target, scope)
      setTarget(null)
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Não foi possível excluir o lançamento.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <section id="lancamentos" aria-labelledby="transactions-title">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.19em] text-[var(--muted)]">
            Tudo em um só lugar
          </p>
          <h2 id="transactions-title" className="mt-1 text-xl font-semibold tracking-tight text-[var(--text)]">
            Lançamentos do mês
          </h2>
        </div>
        <span className="text-xs text-[var(--muted)]">
          {monthTransactions.length} {monthTransactions.length === 1 ? 'registro' : 'registros'}
        </span>
      </div>

      <div className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-[0_8px_24px_-22px_rgba(38,51,39,0.35)]">
        <div className="flex flex-col gap-3 border-b border-[var(--border)] p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <label className="flex h-10 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--soft)] px-3 sm:w-64">
            <Search size={16} className="shrink-0 text-[var(--muted)]" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar lançamento"
              aria-label="Buscar lançamento por nome ou categoria"
              className="min-w-0 flex-1 bg-transparent text-sm text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
            />
          </label>
          <label className="flex items-center gap-2 text-xs font-medium text-[var(--muted)]">
            Situação
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value as StatusFilter)}
              className="h-10 rounded-xl border border-[var(--border)] bg-[var(--soft)] px-3 text-sm text-[var(--text)] outline-none focus:ring-2 focus:ring-[var(--accent)]"
            >
              <option value="all">Todas</option>
              <option value="paid">Pagas</option>
              <option value="pending">Na fatura</option>
              <option value="planned">Previstas</option>
            </select>
          </label>
        </div>

        {filtered.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[690px] border-collapse text-left">
              <thead>
                <tr className="bg-[var(--soft)] text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
                  <th scope="col" className="px-5 py-3">Lançamento</th>
                  <th scope="col" className="px-3 py-3">Categoria</th>
                  <th scope="col" className="px-3 py-3">Data</th>
                  <th scope="col" className="px-3 py-3">Situação</th>
                  <th scope="col" className="px-3 py-3 text-right">Valor</th>
                  <th scope="col" className="w-12 px-4 py-3"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((transaction) => {
                  const isIncome = transaction.type === 'income'
                  return (
                    <tr key={transaction.id} className="border-t border-[var(--border)] transition hover:bg-[var(--soft)]">
                      <th scope="row" className="px-5 py-3.5 font-normal">
                        <span className="flex min-w-48 items-center gap-3">
                          <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${isIncome ? 'bg-[var(--soft)] text-[var(--muted)]' : 'bg-[var(--soft)] text-[var(--muted)]'}`}>
                            <CategoryIcon category={isIncome ? 'Entrada' : transaction.category} />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-[var(--text)]">{transaction.title}</span>
                            <span className="mt-0.5 block text-xs text-[var(--muted)]">
                              {paymentLabels[transaction.payment_method]}
                              {transaction.installment_current && transaction.installment_total
                                ? ` · ${transaction.installment_current}/${transaction.installment_total}`
                                : ''}
                            </span>
                            <span className="transaction-mobile-meta">
                              {transaction.category} · {formatDate(transaction.date)} · {isIncome ? 'Recebido' : statusLabels[transaction.status]}
                            </span>
                          </span>
                        </span>
                      </th>
                      <td className="px-3 py-3.5 text-sm text-[var(--muted)]">{transaction.category}</td>
                      <td className="px-3 py-3.5 text-sm text-[var(--muted)]">{formatDate(transaction.date)}</td>
                      <td className="px-3 py-3.5">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          transaction.status === 'paid'
                            ? 'bg-[var(--soft)] text-[var(--text)]'
                            : transaction.status === 'pending'
                              ? 'bg-[var(--soft)] text-[var(--muted)]'
                              : 'bg-[var(--soft)] text-[var(--muted)]'
                        }`}>
                          {statusLabels[transaction.status]}
                        </span>
                      </td>
                      <td data-flow={isIncome ? 'income' : 'expense'} className="px-3 py-3.5 text-right text-sm font-semibold">
                        {isIncome ? '+ ' : '− '}{formatCurrencyBRL(transaction.amount)}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => {
                            setDeleteError(null)
                            setTarget(transaction)
                          }}
                          aria-label={`Excluir ${transaction.title}`}
                          title="Excluir lançamento"
                          className="grid h-8 w-8 place-items-center rounded-lg text-[var(--alert)] hover:bg-[var(--error-soft)] hover:text-[var(--expense)] disabled:opacity-40"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state grid min-h-40 place-items-center px-6 text-center"><img src="/art/empty.svg" alt="" width="120" height="90" />
            <p className="max-w-sm text-sm leading-6 text-[var(--muted)]">
              {monthTransactions.length
                ? 'Nenhum lançamento corresponde à busca ou ao filtro.'
                : 'Nenhum lançamento neste mês. Adicione o primeiro para acompanhar suas finanças.'}
            </p>
          </div>
        )}
      </div>

      {target && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[var(--accent)]/40 p-5 backdrop-blur-sm">
          <section
            ref={dialogRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-title"
            className="w-full max-w-md rounded-3xl bg-[var(--surface)] p-6 shadow-2xl"
          >
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--error-soft)] text-[var(--expense)]">
              <Trash2 size={19} />
            </span>
            <h3 id="delete-title" className="mt-4 text-lg font-semibold text-[var(--text)]">
              Excluir lançamento?
            </h3>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              {target.title}. Esta ação não pode ser desfeita.
              {target.installment_group_id && ' Como deseja tratar as parcelas desta compra?'}
            </p>
            {deleteError && (
              <p role="alert" className="mt-4 rounded-xl bg-[var(--error-soft)] px-3 py-2 text-sm text-[var(--expense)]">
                {deleteError}
              </p>
            )}
            <div className="mt-6 grid gap-2">
              {target.installment_group_id && (
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => void handleDelete('this_and_future')}
                  className="min-h-11 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-white hover:bg-[var(--accent)] disabled:opacity-50"
                >
                  {deleting ? 'Excluindo...' : 'Esta e todas as parcelas futuras'}
                </button>
              )}
              <button
                type="button"
                disabled={deleting}
                onClick={() => void handleDelete('single')}
                className="min-h-11 rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-[var(--text)] hover:bg-[var(--soft)] disabled:opacity-50"
              >
                {target.installment_group_id ? 'Somente esta parcela' : 'Excluir lançamento'}
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => setTarget(null)}
                className="min-h-10 rounded-xl px-4 text-sm font-medium text-[var(--muted)] hover:bg-[var(--soft)] disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  )
}
