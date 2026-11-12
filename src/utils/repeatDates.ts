import { addMonths, format, isValid, parseISO } from 'date-fns'

/** Keep the original day where possible; otherwise use the month's last day. */
export function getRepeatDates(date: string, months: string[]): string[] {
  const original = parseISO(date)
  if (!isValid(original) || format(original, 'yyyy-MM-dd') !== date) {
    throw new RangeError('A data informada não existe.')
  }
  if (months.length > 24) throw new RangeError('Selecione no máximo 24 meses adicionais.')
  const originalMonth = date.slice(0, 7)
  const uniqueMonths = [...new Set([originalMonth, ...months])].sort()
  return uniqueMonths.map((month) => {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      throw new RangeError('Selecione um mês válido para repetir o gasto.')
    }
    const target = parseISO(`${month}-01`)
    const offset = (target.getFullYear() - original.getFullYear()) * 12 + target.getMonth() - original.getMonth()
    return format(addMonths(original, offset), 'yyyy-MM-dd')
  })
}
