import { createContext } from 'react'
import type { useBankWallet } from '../components/banking/useBankWallet'
import type { projectWallet } from '../components/banking/wallet-summary'

export type WalletState = ReturnType<typeof useBankWallet> & {
  summary: ReturnType<typeof projectWallet> | null
  visible: boolean
  toggleVisibility: () => void
}

export const WalletContext = createContext<WalletState | undefined>(undefined)
