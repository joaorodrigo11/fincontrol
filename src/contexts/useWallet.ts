import { useContext } from 'react'
import { WalletContext } from './wallet-context'

export function useWallet() {
  const context = useContext(WalletContext)
  if (!context) throw new Error('useWallet deve ser usado dentro de WalletProvider.')
  return context
}
