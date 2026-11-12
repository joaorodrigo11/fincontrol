import { format, isValid, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const brlFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

export function formatCurrencyBRL(value: number): string {
  return brlFormatter.format(value)
}

export function formatDate(
  value: Date | string,
  pattern = 'dd/MM/yyyy',
): string {
  const date = typeof value === 'string' ? parseISO(value) : value
  if (!isValid(date)) throw new RangeError('Data inválida para formatação.')
  return format(date, pattern, { locale: ptBR })
}

export function formatMonthYear(value: Date | string): string {
  const formatted = formatDate(value, "MMMM 'de' yyyy")
  return formatted.charAt(0).toLocaleUpperCase('pt-BR') + formatted.slice(1)
}
