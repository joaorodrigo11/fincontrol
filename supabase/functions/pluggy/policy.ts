export class PublicError extends Error {
  status: number
  constructor(message: string, status = 400) { super(message); this.status = status }
}

export function requireUuid(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new PublicError('Identificador inválido.')
  return value
}

export interface PluggyItem {
  id: string
  clientUserId: string | null
  connector: { id: number; name: string; isSandbox: boolean }
  status: string
}

export function assertOwnedSandbox(item: PluggyItem, userId: string) {
  if (item.clientUserId !== userId) throw new PublicError('Esta conexão não pertence à sua conta.', 403)
  if (item.connector?.isSandbox !== true) throw new PublicError('Esta integração aceita apenas instituições de teste.', 403)
}

export function monthRange(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value) || value.startsWith('0000')) throw new PublicError('Selecione um mês válido.')
  const [year, month] = value.split('-').map(Number)
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return { month: value, from: `${value}-01`, to: `${value}-${lastDay}` }
}

export interface BankAccount {
  id: string
  name: string
  type: string
  currencyCode: string
  availableCreditLimit?: number | null
  creditLimit?: number | null
  balance: number
}

export interface BankTransaction {
  paymentMethod?: string | null
  operationType?: string | null
  id: string
  accountId: string
  accountName: string
  description: string
  amount: number
  currencyCode: string
  date: string
  type: string
  status: string
}

export function normalizeTransaction(row: Record<string, unknown>, account: BankAccount, month: string): BankTransaction | null {
  if (typeof row.id !== 'string' || row.id.length > 200 || row.accountId !== account.id) throw new PublicError('A instituição retornou uma transação inconsistente.', 502)
  if (typeof row.amount !== 'number' || !Number.isFinite(row.amount)) throw new PublicError('A instituição retornou um valor inválido.', 502)
  if (typeof row.date !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(row.date)) throw new PublicError('A instituição retornou uma data inválida.', 502)
  const date = row.date.slice(0, 10)
  const parsed = new Date(`${date}T00:00:00Z`)
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) throw new PublicError('A instituição retornou uma data inexistente.', 502)
  if (row.date.slice(0, 7) !== month) return null
  // Preserve the provider's signs and statuses. No accounting conversion or installment expansion.
  const currencyCode = typeof row.currencyCode === 'string' ? row.currencyCode : account.currencyCode
  if (!/^[A-Z]{3}$/.test(currencyCode)) throw new PublicError('A instituição retornou uma moeda inválida.', 502)
  return {
    paymentMethod: row.paymentData && typeof row.paymentData === 'object' && typeof (row.paymentData as Record<string, unknown>).paymentMethod === 'string'
      ? String((row.paymentData as Record<string, unknown>).paymentMethod).slice(0, 40).toUpperCase() : null,
    operationType: typeof row.operationType === 'string' ? row.operationType.slice(0, 80).toUpperCase() : null,
    id: row.id, accountId: account.id, accountName: account.name,
    description: String(row.description ?? 'Transação').slice(0, 240), amount: row.amount,
    currencyCode, date, type: String(row.type ?? '').slice(0, 20), status: String(row.status ?? '').slice(0, 30),
  }
}
