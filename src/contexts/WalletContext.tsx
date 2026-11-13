import { useCallback, useMemo, useState, type PropsWithChildren } from 'react'
import { useBankWallet } from '../components/banking/useBankWallet'
import { projectWallet } from '../components/banking/wallet-summary'
import { useFinance } from './useFinance'
import { WalletContext } from './wallet-context'

export function WalletProvider({ children }: PropsWithChildren) {
  const { month } = useFinance()
  const bank = useBankWallet(month)
  const { today } = bank
  const [visible, setVisible] = useState(() => {
    try { return localStorage.getItem('loro-wallet-private') !== 'true' } catch { return true }
  })
  const toggleVisibility = useCallback(() => {
    setVisible(current => {
      try { localStorage.setItem('loro-wallet-private', String(current)) } catch { /* Optional persistence. */ }
      return !current
    })
  }, [])
  const summary = useMemo(
    () => bank.balances ? projectWallet(bank.balances, bank.snapshot, bank.transactions, bank.selected, month, today) : null,
    [bank.balances, bank.snapshot, bank.transactions, bank.selected, month, today],
  )

  return <WalletContext.Provider value={{ ...bank, summary, today, visible, toggleVisibility }}>{children}</WalletContext.Provider>
}
