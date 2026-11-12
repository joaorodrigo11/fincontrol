import { createContext } from 'react'
import type { FinanceState } from '../types/finance'

export const FinanceContext = createContext<FinanceState | undefined>(undefined)
