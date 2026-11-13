import { addMonths, format, isValid, parseISO } from 'date-fns'
import type { Database, Transaction, TransactionStatus } from '../types/database.ts'
import type { NewTransaction } from '../types/finance.ts'
import { getRepeatDates } from './repeatDates.ts'

type Insert = Database['public']['Tables']['transactions']['Insert']
type StatusInput = Pick<Transaction, 'status' | 'payment_method' | 'type' | 'date' | 'installment_group_id'>

export function effectiveTransactionStatus(row: StatusInput, today: string): TransactionStatus {
  if (row.status !== 'planned') return row.status
  if (row.type === 'expense' && row.payment_method === 'credit_card') {
    return row.date.slice(0, 7) <= today.slice(0, 7) ? 'pending' : 'planned'
  }
  return row.date <= today ? 'paid' : 'planned'
}

export function buildTransactionRows(input: NewTransaction, userId: string, today: string, groupId: string | null): Insert[] {
  if (!input.title.trim() || !input.category.trim()) throw new RangeError('Descrição e categoria são obrigatórias.')
  const original = parseISO(input.date)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || input.date.startsWith('0000') || !isValid(original) || format(original, 'yyyy-MM-dd') !== input.date) {
    throw new RangeError('A data informada não existe.')
  }
  if (!['expense', 'income'].includes(input.type) || !['pix', 'debit', 'credit_card', 'cash'].includes(input.payment_method)) {
    throw new RangeError('Selecione o tipo e a forma de pagamento.')
  }
  if (input.type === 'income' && input.payment_method === 'credit_card') throw new RangeError('Entradas não podem usar cartão de crédito.')
  const count = input.installments ?? 1
  if (!Number.isInteger(count) || count < 1 || count > 24) throw new RangeError('Selecione entre 1 e 24 parcelas.')
  const credit = input.type === 'expense' && input.payment_method === 'credit_card'
  if (count > 1 && !credit) throw new RangeError('O parcelamento está disponível somente para compras no crédito.')
  const cents = Math.round((input.amount + Number.EPSILON) * 100)
  if (!Number.isFinite(input.amount) || input.amount <= 0 || input.amount > 9_999_999_999.99 || !Number.isSafeInteger(cents) || cents < count) {
    throw new RangeError('Informe um valor válido, com pelo menos R$ 0,01 por parcela.')
  }
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const connectionId = input.bank_connection_id ?? null
  const accountId = input.bank_account_id ?? null
  if (Boolean(connectionId) !== Boolean(accountId) || (connectionId && (!uuid.test(connectionId) || !accountId?.trim() || accountId.length > 200))) {
    throw new RangeError('Escolha uma instituição e uma conta válidas.')
  }
  if (input.payment_method === 'cash' && connectionId) throw new RangeError('Dinheiro em espécie não pode ser vinculado a uma conta bancária.')
  if (count > 1 && (!groupId || !uuid.test(groupId))) throw new RangeError('Identificador do parcelamento inválido.')
  const repeatMonths = input.repeat_months ?? []
  if (repeatMonths.length && (count > 1 || input.type !== 'expense')) throw new RangeError('Use repetição somente em despesas sem parcelamento.')
  const repeating = repeatMonths.length > 0
  const dates = repeating ? getRepeatDates(input.date, repeatMonths)
    : Array.from({ length: count }, (_, index) => format(addMonths(original, index), 'yyyy-MM-dd'))
  const baseCents = Math.floor(cents / count)
  const remainder = cents % count
  return dates.map((date, index) => ({
    user_id: userId,
    title: count > 1 ? `${input.title.trim()} (${index + 1}/${count})` : input.title.trim(),
    amount: (repeating ? cents : baseCents + (index < remainder ? 1 : 0)) / 100,
    type: input.type,
    payment_method: input.payment_method,
    status: credit ? (date.slice(0, 7) <= today.slice(0, 7) ? 'pending' : 'planned')
      : repeating && date > today ? 'planned' : 'paid',
    category: input.category.trim(), date,
    installment_group_id: count > 1 ? groupId : null,
    installment_current: count > 1 ? index + 1 : null,
    installment_total: count > 1 ? count : null,
    bank_connection_id: connectionId, bank_account_id: accountId, bank_reflected: false,
  }))
}