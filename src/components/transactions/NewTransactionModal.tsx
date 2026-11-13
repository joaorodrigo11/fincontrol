import { useDialogFocus } from '../ui/useDialogFocus'
import { motion, useReducedMotion } from 'framer-motion'
import { CategoryIcon } from '../ui/CategoryIcon'
import { useMemo, useState, type FormEvent } from 'react'
import { CalendarDays, ChevronDown, X } from 'lucide-react'
import { addMonths, format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type {
  PaymentMethod,
  TransactionType,
} from '../../types/database'
import { useFinance } from '../../contexts/useFinance'
import { useBankWallet } from '../banking/useBankWallet'
import { formatCurrencyBRL } from '../../utils/formatters'

interface NewTransactionModalProps {
  open: boolean
  onClose: () => void
}

const categories = [
  'Moradia',
  'Alimentação',
  'Transporte',
  'Saúde',
  'Lazer',
  'Educação',
  'Compras',
  'Contas',
  'Outros',
]

function todayDate() {
  return format(new Date(), 'yyyy-MM-dd')
}

export function NewTransactionModal({ open, onClose }: NewTransactionModalProps) {
  const reduced = useReducedMotion()
  const { createTransaction, saving, month } = useFinance()
  const bank = useBankWallet(month, open)
  const [accountChoice, setAccountChoice] = useState({ key: '', id: '' })
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [type, setType] = useState<TransactionType>('expense')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix')
  const [category, setCategory] = useState('Alimentação')
  const [date, setDate] = useState(todayDate)
  const [installments, setInstallments] = useState('1')
  const [repeatEnabled, setRepeatEnabled] = useState(false)
  const [repeatMonths, setRepeatMonths] = useState<string[]>([])
  const [nextRepeatMonth, setNextRepeatMonth] = useState(() => format(addMonths(new Date(), 1), 'yyyy-MM'))
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const dialogRef = useDialogFocus(open, onClose, saving)

  const eligibleAccounts = bank.accounts.filter(account => account.currencyCode === 'BRL' && account.type === (paymentMethod === 'credit_card' ? 'CREDIT' : 'BANK'))
  const accountKey = bank.selected + ':' + paymentMethod
  const chosenAccount = accountChoice.key === accountKey && eligibleAccounts.some(account => account.id === accountChoice.id)
    ? accountChoice.id : eligibleAccounts.length === 1 ? eligibleAccounts[0].id : ''
  const needsAccount = paymentMethod !== 'cash'
  const bankUnavailable = needsAccount && (bank.loading || Boolean(bank.error))
  const installmentCount = paymentMethod === 'credit_card' && type === 'expense' ? Math.max(1, Number(installments) || 1) : 1
  const selectedRepeatMonths = repeatMonths.filter((item) => item !== date.slice(0, 7))
  const installmentValue = useMemo(() => {
    const value = Number(amount.replace(',', '.'))
    if (!Number.isFinite(value) || value <= 0) return 0
    const cents = Math.round((value + Number.EPSILON) * 100)
    return (
      Math.floor(cents / installmentCount) +
      (cents % installmentCount > 0 ? 1 : 0)
    ) / 100
  }, [amount, installmentCount])

  if (!open) return null

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSuccess(null)

    try {
      const amountValue = Number(amount.replace(',', '.'))
      const count = installmentCount
      if (bankUnavailable) throw new Error(bank.error ?? 'Aguarde a consulta das contas bancárias.')
      if (needsAccount && eligibleAccounts.length && !chosenAccount) throw new Error('Escolha a conta ou o cartão do lançamento.')
      if (repeatEnabled && type === 'expense' && selectedRepeatMonths.length === 0) {
        throw new RangeError('Adicione pelo menos um outro mês para repetir o gasto.')
      }
      const created = await createTransaction({
        title,
        amount: amountValue,
        type,
        payment_method: paymentMethod,
        bank_connection_id: needsAccount && chosenAccount ? bank.selected : null,
        bank_account_id: needsAccount && chosenAccount ? chosenAccount : null,
        category,
        date,
        installments: type === 'expense' ? count : 1,
        repeat_months: repeatEnabled && type === 'expense' ? selectedRepeatMonths : undefined,
      })
      setSuccess(
        repeatEnabled && type === 'expense'
          ? `Gasto adicionado em ${created.length} meses, com o valor integral em cada mês.`
          : created.length > 1
          ? `${created.length} parcelas adicionadas aos próximos meses.`
          : 'Lançamento adicionado.',
      )
      window.setTimeout(onClose, 900)
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Não foi possível salvar o lançamento.',
      )
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[var(--accent)]/45 p-0 backdrop-blur-[3px] sm:items-center sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose()
      }}
    >
      <motion.section
        initial={reduced ? false : { opacity: 0, y: 24, scale: .985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 180, damping: 25 }}
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="transaction-modal-title"
        className="dialog-panel max-h-[95vh] w-full max-w-xl overflow-y-auto rounded-t-[1.75rem] bg-[var(--soft)] shadow-2xl sm:rounded-[1.75rem]"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-[var(--border)] bg-[var(--soft)]/95 px-6 py-5 backdrop-blur sm:px-8">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--muted)]">
              {month}
            </p>
            <h2 id="transaction-modal-title" className="mt-1 text-xl font-semibold tracking-tight text-[var(--text)]">
              Novo lançamento
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Fechar"
            className="grid h-9 w-9 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--soft)] disabled:opacity-50"
          >
            <X size={19} />
          </button>
        </div>

        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-5 px-6 py-6 sm:px-8">
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-[var(--soft)] p-1">
            {([
              ['expense', 'Despesa'],
              ['income', 'Entrada extra'],
            ] as const).map(([value, label]) => (
              <button
                type="button"
                key={value}
                onClick={() => {
                  setType(value)
                  if (value === 'income') {
                    setPaymentMethod('pix')
                    setInstallments('1')
                    setRepeatEnabled(false)
                  }
                }}
                aria-pressed={type === value}
                className={`rounded-lg py-2.5 text-sm font-semibold transition ${
                  type === value
                    ? 'bg-[var(--surface)] text-[var(--text)] shadow-sm'
                    : 'text-[var(--muted)] hover:text-[var(--text)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <label className="block text-sm font-semibold text-[var(--text)]">
            Descrição
            <input
              required
              maxLength={120}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ex.: Mercado, aluguel, notebook"
              className="mt-2 h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 font-normal text-[var(--text)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--border)] focus:ring-4 focus:ring-[var(--accent)]"
            />
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-[var(--text)]">
              {repeatEnabled && type === 'expense' ? 'Valor por mês' : 'Valor total'}
              <span className="mt-2 flex h-12 items-center rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 focus-within:border-[var(--border)] focus-within:ring-4 focus-within:ring-[var(--accent)]">
                <span className="mr-2 text-sm text-[var(--muted)]">R$</span>
                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="0,00"
                  className="w-full bg-transparent font-normal text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
                />
              </span>
            </label>
            <label className="block text-sm font-semibold text-[var(--text)]">
              Data
              <span className="mt-2 flex h-12 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 focus-within:border-[var(--border)] focus-within:ring-4 focus-within:ring-[var(--accent)]">
                <CalendarDays size={17} className="shrink-0 text-[var(--muted)]" />
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  className="min-w-0 w-full bg-transparent text-sm font-normal text-[var(--text)] outline-none"
                />
              </span>
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-[var(--text)]">
              <span className="category-label"><CategoryIcon category={category} />Categoria</span>
              <span className="relative mt-2 block">
                <select
                  required
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  className="h-12 w-full appearance-none rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 pr-10 font-normal text-[var(--text)] outline-none focus:border-[var(--border)] focus:ring-4 focus:ring-[var(--accent)]"
                >
                  {categories.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
              </span>
            </label>
            <label className="block text-sm font-semibold text-[var(--text)]">
              Forma de pagamento
              <span className="relative mt-2 block">
                <select
                  value={paymentMethod}
                  onChange={(event) => {
                    setPaymentMethod(event.target.value as PaymentMethod)
                    setInstallments('1')
                  }}
                  className="h-12 w-full appearance-none rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 pr-10 font-normal text-[var(--text)] outline-none focus:border-[var(--border)] focus:ring-4 focus:ring-[var(--accent)]"
                >
                  <option value="pix">Pix</option>
                  <option value="debit">Débito</option>
                  {type === 'expense' && <option value="credit_card">Cartão de crédito</option>}
                  <option value="cash">Dinheiro</option>
                </select>
                <ChevronDown size={16} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
              </span>
            </label>
          </div>

          {needsAccount && <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
            {bank.connections.length > 1 && <label className="block text-sm font-semibold">Instituição
              <select value={bank.selected} disabled={bank.loading || saving} onChange={event => bank.select(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3">{bank.connections.map(connection => <option key={connection.id} value={connection.id}>{connection.institution_name}</option>)}</select>
            </label>}
            {bank.loading ? <p role="status" className="text-sm text-[var(--muted)]">Consultando contas e cartões…</p> : bank.error ? <div role="alert"><p>{bank.error}</p><button type="button" className="banking-secondary" onClick={bank.refresh}>Tentar novamente</button></div>
              : eligibleAccounts.length ? <label className="block text-sm font-semibold">{paymentMethod === 'credit_card' ? 'Cartão de crédito' : 'Conta corrente'}{bank.connections.length === 1 ? ' · ' + bank.connections[0].institution_name : ''}
                <select required value={chosenAccount} disabled={saving} onChange={event => setAccountChoice({key:accountKey,id:event.target.value})} className="mt-2 h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3">
                  <option value="" disabled>Escolha uma opção</option>
                  {eligibleAccounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}
                </select>
              </label> : <p className="text-sm text-[var(--muted)]">{bank.connections.length ? (paymentMethod === 'credit_card' ? 'Esta instituição não informou cartão de crédito.' : 'Esta instituição não informou conta corrente.') : 'Nenhuma instituição conectada.'} O lançamento ficará sem vínculo bancário.</p>}
          </div>}
          <p className="text-xs leading-5 text-[var(--muted)]">{paymentMethod === 'credit_card'
            ? 'A compra compromete o limite do cartão. As parcelas deste mês ficam na fatura e as dos próximos meses ficam previstas.'
            : paymentMethod === 'cash' ? 'Lançamento realizado em dinheiro; não altera o saldo bancário.'
            : type === 'income' ? 'Entrada realizada na conta escolhida.' : 'Pix e débito são registrados como realizados e descontados da conta escolhida.'}</p>
          {type === 'expense' && paymentMethod === 'credit_card' && (
            <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--text)]">Parcelamento</p>
                  <p className="mt-0.5 text-xs text-[var(--muted)]">A primeira parcela vence na data escolhida.</p>
                </div>
                <label className="relative">
                  <select
                    aria-label="Número de parcelas"
                    value={installments}
                    onChange={(event) => {
                      setInstallments(event.target.value)
                      if (event.target.value !== '1') setRepeatEnabled(false)
                    }}
                    className="h-10 appearance-none rounded-lg border border-[var(--border)] bg-[var(--soft)] py-2 pl-3 pr-9 text-sm font-semibold text-[var(--text)] outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  >
                    {Array.from({ length: 24 }, (_, index) => index + 1).map((count) => (
                      <option key={count} value={count}>
                        {count}x
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
                </label>
              </div>
              {installmentCount > 1 && (
                <div className="flex items-center justify-between border-t border-[var(--border)] pt-3 text-sm">
                  <span className="text-[var(--muted)]">
                    {installmentCount} parcelas mensais de
                  </span>
                  <strong className="text-[var(--text)]">
                    {formatCurrencyBRL(installmentValue)}
                  </strong>
                </div>
              )}
            </div>
          )}

          {type === 'expense' && (
            <fieldset className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold text-[var(--text)]">
                <input
                  type="checkbox"
                  checked={repeatEnabled}
                  onChange={(event) => {
                    setRepeatEnabled(event.target.checked)
                    if (event.target.checked) {
                      setInstallments('1')
                      if (selectedRepeatMonths.length === 0 && date) {
                        const next = format(addMonths(parseISO(date), 1), 'yyyy-MM')
                        setRepeatMonths([next])
                        setNextRepeatMonth(format(addMonths(parseISO(date), 2), 'yyyy-MM'))
                      }
                    }
                  }}
                  className="h-5 w-5 accent-[var(--accent)]"
                />
                Repetir este gasto em outros meses
              </label>
              <p className="text-xs leading-5 text-[var(--muted)]">
                O valor integral será lançado em cada mês escolhido, com a mesma categoria e forma de pagamento. As repetições futuras ficam previstas até a data escolhida. Para dividir uma compra, use Parcelamento.
              </p>
              {repeatEnabled && (
                <>
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="min-w-0 flex-1 text-xs font-semibold text-[var(--muted)]">
                      Mês adicional
                      <input type="month" value={nextRepeatMonth} onChange={(event) => setNextRepeatMonth(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)]" />
                    </label>
                    <button type="button" disabled={!nextRepeatMonth || selectedRepeatMonths.length >= 24 || nextRepeatMonth === date.slice(0, 7) || selectedRepeatMonths.includes(nextRepeatMonth)} onClick={() => {
                      setRepeatMonths([...selectedRepeatMonths, nextRepeatMonth].sort())
                      setNextRepeatMonth(format(addMonths(parseISO(`${nextRepeatMonth}-01`), 1), 'yyyy-MM'))
                    }} className="min-h-11 rounded-xl border border-[var(--border)] px-3 text-sm font-semibold text-[var(--text)] disabled:opacity-40">Adicionar mês</button>
                  </div>
                  <ul aria-label="Meses adicionais selecionados" className="flex flex-wrap gap-2">
                    {selectedRepeatMonths.map((item) => (
                      <li key={item}>
                        <button type="button" aria-label={`Remover ${format(parseISO(`${item}-01`), 'MMMM yyyy', { locale: ptBR })}`} onClick={() => setRepeatMonths(selectedRepeatMonths.filter((value) => value !== item))} className="flex min-h-11 items-center gap-2 rounded-xl bg-[var(--soft)] px-3 text-xs capitalize text-[var(--text)]">
                          {format(parseISO(`${item}-01`), 'MMM yyyy', { locale: ptBR })}<X size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs leading-5 text-[var(--muted)]">
                    Inclui o mês da data original e {selectedRepeatMonths.length} {selectedRepeatMonths.length === 1 ? 'mês adicional' : 'meses adicionais'}. Mantém o dia escolhido ou o último dia do mês.
                  </p>
                  {error && <p role="alert" className="text-sm text-[var(--expense)]">{error}</p>}
                </>
              )}
            </fieldset>
          )}



          {error && !(repeatEnabled && type === 'expense') && (
            <p role="alert" className="rounded-xl border border-[var(--expense)]/30 bg-[var(--error-soft)] px-4 py-3 text-sm text-[var(--expense)]">
              {error}
            </p>
          )}
          {success && (
            <p role="status" className="rounded-xl border border-[var(--border)] bg-[var(--soft)] px-4 py-3 text-sm text-[var(--text)]">
              {success}
            </p>
          )}

          <div className="flex gap-3 border-t border-[var(--border)] pt-5">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="h-12 flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm font-semibold text-[var(--text)] hover:bg-[var(--soft)] disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || Boolean(success) || bankUnavailable}
              className="h-12 flex-1 rounded-xl bg-[var(--accent)] text-sm font-semibold text-white hover:bg-[var(--accent)] disabled:cursor-wait disabled:opacity-60"
            >
              {saving ? 'Salvando...' : 'Salvar lançamento'}
            </button>
          </div>
        </form>
      </motion.section>
    </div>
  )
}
