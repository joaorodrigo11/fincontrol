import { addMonths, endOfMonth, format, isValid, parseISO, startOfMonth } from 'date-fns'

export function getMonthRange(monthYear: string): {
  start: string
  end: string
} {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monthYear)) {
    throw new RangeError('Mês inválido. Use o formato YYYY-MM.')
  }

  const monthStart = parseISO(`${monthYear}-01`)
  if (!isValid(monthStart)) throw new RangeError('Mês inválido.')

  return {
    start: format(startOfMonth(monthStart), 'yyyy-MM-dd'),
    end: format(endOfMonth(monthStart), 'yyyy-MM-dd'),
  }
}

export function addMonthsToDate(date: string, months: number): string {
  const parsedDate = parseISO(date)
  if (!isValid(parsedDate)) throw new RangeError('Data inválida.')
  return format(addMonths(parsedDate, months), 'yyyy-MM-dd')
}

export function getCurrentMonth(): string {
  return format(new Date(), 'yyyy-MM')
}
