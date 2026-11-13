import { getSupabaseClient } from '../../lib/supabaseClient'

export interface BankConnection { id: string; institution_name: string; created_at: string }
export interface BankAccount { id: string; name: string; type: string; currencyCode: string; balance: number; availableCreditLimit?: number | null; creditLimit?: number | null }
export interface BankTransaction { id: string; accountId: string; accountName: string; description: string; amount: number; currencyCode: string; date: string; type: string; status: string; paymentMethod?: string | null; operationType?: string | null }
export interface BankSnapshot { accounts: BankAccount[]; transactions: BankTransaction[]; updated_at: string }

export async function bankingApi<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await getSupabaseClient().functions.invoke<T>('pluggy', { body })
  if (error) {
    if ('context' in error && error.context instanceof Response) {
      const response = await error.context.json().catch(() => null) as { error?: string } | null
      if (response?.error) throw new Error(response.error)
    }
    throw new Error('A conexão bancária ainda não está disponível. Confira a publicação da função pluggy e os secrets no Supabase.')
  }
  if (!data) throw new Error('O servidor não retornou os dados da integração.')
  if (['sync', 'disconnect', 'attach'].includes(String(body.action))) window.dispatchEvent(new Event('loro-bank-updated'))
  return data
}

export function formatBankMoney(value: number, currency: string) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(value)
}
