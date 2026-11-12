import { useContext } from 'react'
import { FinanceContext } from './finance-context'

export function useFinance() {
  const context = useContext(FinanceContext)
  if (!context) {
    throw new Error('useFinance deve ser usado dentro de FinanceProvider.')
  }
  return context
}
