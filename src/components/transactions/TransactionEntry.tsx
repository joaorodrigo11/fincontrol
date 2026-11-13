import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { addMonths, format, isValid, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CheckCircle2, ChevronDown, Plus, X } from 'lucide-react'
import type { PaymentMethod, TransactionType } from '../../types/database'
import { useFinance } from '../../contexts/useFinance'
import { formatCurrencyBRL } from '../../utils/formatters'

const expenseCategories = ['Moradia', 'Alimentação', 'Transporte', 'Saúde', 'Lazer', 'Educação', 'Compras', 'Contas', 'Outros']
const incomeCategories = ['Salário', 'Trabalho extra', 'Reembolso', 'Outros']

function validCalendarMonth(value: string) {
  return /^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(value)
}

function validCalendarDate(value: string) {
  return /^(?!0000)\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(value) && isValid(parseISO(value))
}

function shiftedMonth(date: string, count: number) {
  if (!validCalendarDate(date)) return ''
  const shifted = addMonths(parseISO(date), count)
  if (!isValid(shifted) || shifted.getFullYear() < 1 || shifted.getFullYear() > 9999) return ''
  return format(shifted, 'yyyy-MM')
}

function initialDate(month: string) {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
  return today.slice(0, 7) === month || !validCalendarMonth(month) ? today : `${month}-01`
}

function parseAmount(value: string) {
  const normalized = value.trim().includes(',')
    ? value.trim().replace(/\./g, '').replace(',', '.')
    : value.trim()
  return /^\d+(?:\.\d{1,2})?$/.test(normalized) ? Number(normalized) : NaN
}

export function TransactionEntry({ idPrefix }: { idPrefix?: string }) {
  const generatedId = useId()
  const prefix = idPrefix ?? `entry-${generatedId}`
  const { month, saving, createTransaction } = useFinance()
  const titleRef = useRef<HTMLInputElement>(null)
  const submitting = useRef(false)
  const [type, setType] = useState<TransactionType>('expense')
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix')
  const [category, setCategory] = useState('Alimentação')
  const [date, setDate] = useState(() => initialDate(month))
  const [installments, setInstallments] = useState('1')
  const [repeatEnabled, setRepeatEnabled] = useState(false)
  const [repeatMonths, setRepeatMonths] = useState<string[]>([])
  const [nextRepeatMonth, setNextRepeatMonth] = useState(() => shiftedMonth(initialDate(month), 1))
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const categories = type === 'expense' ? expenseCategories : incomeCategories
  const installmentCount = type === 'expense' && paymentMethod === 'credit_card' ? Number(installments) : 1
  const selectedRepeatMonths = repeatMonths.filter(item => item !== date.slice(0, 7))
  const parsedAmount = parseAmount(amount)
  const installmentCents = Number.isFinite(parsedAmount) ? Math.round((parsedAmount + Number.EPSILON) * 100) : 0
  const firstInstallment = (Math.floor(installmentCents / installmentCount) + (installmentCents % installmentCount > 0 ? 1 : 0)) / 100

  useEffect(() => {
    if (success && !saving) titleRef.current?.focus()
  }, [success, saving])

  function changeType(nextType: TransactionType) {
    setType(nextType)
    setCategory(nextType === 'expense' ? 'Alimentação' : 'Salário')
    setError(null)
    setSuccess(null)
    setInstallments('1')
    setRepeatEnabled(false)
    if (nextType === 'income' && paymentMethod === 'credit_card') setPaymentMethod('pix')
  }

  function toggleRepeat(enabled: boolean) {
    if (enabled && !validCalendarDate(date)) {
      setError('Informe uma data válida antes de escolher os meses da repetição.')
      return
    }
    setRepeatEnabled(enabled)
    if (!enabled) return
    setInstallments('1')
    if (!selectedRepeatMonths.length && date) {
      const next = shiftedMonth(date, 1)
      setRepeatMonths(next ? [next] : [])
      setNextRepeatMonth(shiftedMonth(date, 2))
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current || saving) return
    setError(null)
    setSuccess(null)
    if (!validCalendarDate(date)) {
      setError('Informe uma data válida entre os anos 0001 e 9999.')
      return
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Informe um valor válido, como 25,90.')
      return
    }
    if (repeatEnabled && type === 'expense' && !selectedRepeatMonths.length) {
      setError('Escolha pelo menos um mês adicional para repetir o gasto.')
      return
    }
    submitting.current = true
    try {
      const created = await createTransaction({
        title, amount: parsedAmount, type, payment_method: paymentMethod, category, date,
        bank_connection_id: null, bank_account_id: null,
        installments: installmentCount,
        repeat_months: type === 'expense' && repeatEnabled ? selectedRepeatMonths : undefined,
      })
      setSuccess(type === 'expense' && repeatEnabled
        ? `Gasto adicionado em ${created.length} meses, com o valor integral em cada mês.`
        : created.length > 1
          ? `Compra registrada em ${created.length} parcelas mensais.`
          : `${type === 'expense' ? 'Gasto' : 'Receita'} registrado${type === 'expense' ? '' : 'a'}. Pode adicionar o próximo lançamento.`)
      setTitle('')
      setAmount('')
      setInstallments('1')
      setRepeatEnabled(false)
      setRepeatMonths([])
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Não foi possível salvar o lançamento. Tente novamente.')
    } finally {
      submitting.current = false
    }
  }

  return (
    <form className="transaction-entry" onSubmit={event => void handleSubmit(event)} aria-label="Criar lançamento" aria-busy={saving}>
      <fieldset className="transaction-entry-type" disabled={saving}>
        <legend className="sr-only">Tipo de lançamento</legend>
        {([['expense', 'Gasto'], ['income', 'Receita']] as const).map(([value, label]) => (
          <button key={value} type="button" data-entry-type={value} aria-pressed={type === value} onClick={() => changeType(value)}>{label}</button>
        ))}
      </fieldset>

      <div className="transaction-entry-fields">
        <div className="transaction-entry-field transaction-entry-description">
          <label htmlFor={`${prefix}-title`}>{type === 'expense' ? 'Onde foi?' : 'De onde veio?'}</label>
          <input
            ref={titleRef} id={`${prefix}-title`} name="title" required maxLength={120}
            value={title} disabled={saving} autoComplete="off"
            placeholder={type === 'expense' ? 'Ex.: Mercado, aluguel, farmácia' : 'Ex.: Salário, trabalho extra'}
            onChange={event => { setTitle(event.target.value); setSuccess(null) }}
          />
        </div>
        <div className="transaction-entry-grid">
          <div className="transaction-entry-field">
            <label htmlFor={`${prefix}-amount`}>{repeatEnabled && type === 'expense' ? 'Valor em cada mês' : 'Quanto foi?'}</label>
            <div className="transaction-entry-amount">
              <span aria-hidden="true">R$</span>
              <input
                id={`${prefix}-amount`} name="amount" type="text" inputMode="decimal" required
                value={amount} placeholder="0,00" disabled={saving} autoComplete="off"
                aria-describedby={installmentCount > 1 ? `${prefix}-installment-hint` : undefined}
                onChange={event => { setAmount(event.target.value); setSuccess(null) }}
              />
            </div>
          </div>
          <div className="transaction-entry-field">
            <label htmlFor={`${prefix}-date`}>Data</label>
            <input id={`${prefix}-date`} name="date" type="date" min="0001-01-01" max="9999-12-31" required value={date} disabled={saving} onChange={event => setDate(event.target.value)} />
          </div>
        </div>
        <div className="transaction-entry-grid">
          <div className="transaction-entry-field">
            <label htmlFor={`${prefix}-payment`}>{type === 'expense' ? 'Como foi pago?' : 'Como recebeu?'}</label>
            <select id={`${prefix}-payment`} name="payment_method" value={paymentMethod} disabled={saving} onChange={event => { setPaymentMethod(event.target.value as PaymentMethod); setInstallments('1') }}>
              <option value="pix">Pix</option>
              <option value="debit">Débito</option>
              {type === 'expense' && <option value="credit_card">Cartão de crédito</option>}
              <option value="cash">Dinheiro</option>
            </select>
          </div>
          <div className="transaction-entry-field">
            <label htmlFor={`${prefix}-category`}>Categoria</label>
            <select id={`${prefix}-category`} name="category" value={category} disabled={saving} onChange={event => setCategory(event.target.value)}>
              {categories.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
        </div>
      </div>

      {type === 'expense' && (
        <details className="transaction-entry-details">
          <summary>
            <span>Parcelar ou repetir{installmentCount > 1
              ? <span className="transaction-entry-options-summary"> · {installmentCount} parcelas</span>
              : repeatEnabled && <span className="transaction-entry-options-summary"> · {selectedRepeatMonths.length ? `${selectedRepeatMonths.length} ${selectedRepeatMonths.length === 1 ? 'mês adicional' : 'meses adicionais'}` : 'Repetição ativa'}</span>}
            </span>
            <ChevronDown size={16} aria-hidden="true" />
          </summary>
          <div className="transaction-entry-advanced">
            {paymentMethod === 'credit_card' && (
              <div className="transaction-entry-field">
                <label htmlFor={`${prefix}-installments`}>Número de parcelas</label>
                <select id={`${prefix}-installments`} value={installments} disabled={saving} onChange={event => { setInstallments(event.target.value); if (event.target.value !== '1') setRepeatEnabled(false) }}>
                  {Array.from({ length: 24 }, (_, index) => index + 1).map(count => <option key={count} value={count}>{count === 1 ? 'À vista' : `${count} parcelas`}</option>)}
                </select>
                {installmentCount > 1 && <p id={`${prefix}-installment-hint`} className="transaction-entry-hint">Informe o valor total da compra. {installmentCount} parcelas mensais, a primeira de {formatCurrencyBRL(firstInstallment)}. A primeira parcela fica na data escolhida.</p>}
              </div>
            )}
            <fieldset className="transaction-entry-repeat">
              <legend className="sr-only">Repetição em outros meses</legend>
              <label className="transaction-entry-check">
                <input type="checkbox" checked={repeatEnabled} disabled={saving} onChange={event => toggleRepeat(event.target.checked)} />
                Repetir este gasto em outros meses
              </label>
              {repeatEnabled && <>
                <p className="transaction-entry-hint">O mesmo valor será registrado em cada mês escolhido. As repetições futuras ficam previstas.</p>
                <div className="transaction-entry-repeat-add">
                  <div className="transaction-entry-field">
                    <label htmlFor={`${prefix}-repeat-month`}>Mês adicional</label>
                    <input id={`${prefix}-repeat-month`} type="month" min="0001-01" max="9999-12" value={nextRepeatMonth} disabled={saving} onChange={event => setNextRepeatMonth(event.target.value)} />
                  </div>
                  <button
                    type="button" disabled={saving || !validCalendarMonth(nextRepeatMonth) || selectedRepeatMonths.length >= 24 || nextRepeatMonth === date.slice(0, 7) || selectedRepeatMonths.includes(nextRepeatMonth)}
                    onClick={() => {
                      if (!validCalendarMonth(nextRepeatMonth)) {
                        setError('Informe um mês válido entre os anos 0001 e 9999.')
                        return
                      }
                      setRepeatMonths([...selectedRepeatMonths, nextRepeatMonth].sort())
                      setNextRepeatMonth(shiftedMonth(`${nextRepeatMonth}-01`, 1))
                    }}
                  >Adicionar mês</button>
                </div>
                <ul className="transaction-entry-months" aria-label="Meses adicionais selecionados">
                  {selectedRepeatMonths.map(item => <li key={item}>
                    <button type="button" disabled={saving} aria-label={`Remover ${format(parseISO(`${item}-01`), 'MMMM yyyy', { locale: ptBR })}`} onClick={() => setRepeatMonths(selectedRepeatMonths.filter(value => value !== item))}>
                      {format(parseISO(`${item}-01`), 'MMM yyyy', { locale: ptBR })}<X size={14} aria-hidden="true" />
                    </button>
                  </li>)}
                </ul>
                <p className="transaction-entry-hint">Inclui o mês original e {selectedRepeatMonths.length} {selectedRepeatMonths.length === 1 ? 'mês adicional' : 'meses adicionais'}, mantendo o dia escolhido ou o último dia do mês.</p>
              </>}
            </fieldset>
          </div>
        </details>
      )}

      {error && <p className="transaction-entry-feedback is-error" role="alert">{error}</p>}
      {success && <p className="transaction-entry-feedback is-success" role="status"><CheckCircle2 size={18} aria-hidden="true" />{success}</p>}
      <div className="transaction-entry-footer">
        <button type="submit" className="primary-button" disabled={saving}><Plus size={18} aria-hidden="true" />{saving ? 'Salvando…' : 'Salvar lançamento'}</button>
      </div>
    </form>
  )
}
