import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/useAuth'
import { getSupabaseClient } from '../../lib/supabaseClient'
import type { Transaction } from '../../types/database'
import { effectiveTransactionStatus } from '../../utils/transactionRows'
import { bankingApi } from './banking-api'
import type { BankConnection, BankSnapshot } from './banking-api'

type Loaded = { key: string; connections: BankConnection[]; selected: string; snapshot: BankSnapshot | null; balances: BankSnapshot | null; transactions: Transaction[]; error: string | null }

export function useBankWallet(month: string, enabled = true) {
  const { user } = useAuth()
  const [selected, setSelected] = useState('')
  const [revision, setRevision] = useState(0)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const key = [user?.id, month, selected].join(':')
  useEffect(() => {
    const refresh = () => setRevision(value => value + 1)
    window.addEventListener('loro-bank-updated', refresh)
    return () => window.removeEventListener('loro-bank-updated', refresh)
  }, [])
  useEffect(() => {
    if (!user || !enabled) return
    let active = true
    const userId = user.id
    async function load() {
      try {
        const { connections } = await bankingApi<{ connections: BankConnection[] }>({ action: 'list' })
        const connectionId = connections.find(row => row.id === selected)?.id ?? connections[0]?.id ?? ''
        const result = connectionId ? await bankingApi<{ snapshot: BankSnapshot | null; balances: BankSnapshot | null }>({ action: 'wallet', connectionId, month }) : { snapshot: null, balances: null }
        const transactions: Transaction[] = []
        const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
        if (connectionId) {
          // Include older entries and every future installment when reserving the card limit.
          for (let offset = 0; ; offset += 1000) {
            if (offset >= 20000) throw new Error('Há muitos lançamentos vinculados. Não foi possível calcular todos os saldos.')
            const { data, error } = await getSupabaseClient().from('transactions').select('*')
              .eq('user_id', userId).eq('bank_connection_id', connectionId).order('id').range(offset, offset + 999)
            if (error) throw error
            transactions.push(...(data ?? []).map(row => ({ ...row, status: effectiveTransactionStatus(row, today) })))
            if (!data || data.length < 1000) break
          }
        }
        if (active) setLoaded({ key, connections, selected: connectionId, snapshot: result.snapshot, balances: result.balances, transactions, error: null })
      } catch (error) {
        if (active) setLoaded({ key, connections: [], selected: '', snapshot: null, balances: null, transactions: [], error: error instanceof Error ? error.message : 'Não foi possível consultar a carteira bancária.' })
      }
    }
    void load()
    return () => { active = false }
  }, [key, month, selected, user, enabled, revision])
  const current = loaded?.key === key ? loaded : null
  return {
    loading: Boolean(user) && enabled && !current, connections: current?.connections ?? [], selected: current?.selected ?? '',
    snapshot: current?.snapshot ?? null, balances: current?.balances ?? null, accounts: current?.balances?.accounts ?? [],
    transactions: current?.transactions ?? [], error: current?.error, select: setSelected, refresh: () => setRevision(value => value + 1),
  }
}