import { useMemo } from 'react'
import { useReducedMotion } from 'framer-motion'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { ArrowDownRight, ShoppingBag } from 'lucide-react'
import { useFinance } from '../../contexts/useFinance'
import type { Transaction } from '../../types/database'
import { formatCurrencyBRL } from '../../utils/formatters'

const palette = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--chart-6)']

interface CategoryTotal {
  category: string
  amount: number
  share: number
}

function sumByCategory(transactions: Transaction[]): CategoryTotal[] {
  const grouped = transactions.reduce<Record<string, number>>((totals, transaction) => {
    totals[transaction.category] = (totals[transaction.category] ?? 0) + transaction.amount
    return totals
  }, {})
  const total = Object.values(grouped).reduce((sum, amount) => sum + amount, 0)
  return Object.entries(grouped)
    .map(([category, amount]) => ({
      category,
      amount,
      share: total > 0 ? (amount / total) * 100 : 0,
    }))
    .sort((left, right) => right.amount - left.amount)
}

function ExpenseTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload: CategoryTotal }>
}) {
  if (!active || !payload?.length) return null
  const item = payload[0].payload
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 shadow-lg">
      <p className="text-xs text-[var(--muted)]">{item.category}</p>
      <p className="mt-1 text-sm font-semibold text-[var(--text)]">
        {formatCurrencyBRL(item.amount)} · {Math.round(item.share)}%
      </p>
    </div>
  )
}

function paymentLabel(method: Transaction['payment_method']) {
  const names: Record<Transaction['payment_method'], string> = {
    pix: 'Pix',
    debit: 'Débito',
    credit_card: 'Crédito',
    cash: 'Dinheiro',
  }
  return names[method]
}

export function ExpenseInsights({ variant = 'categories' }: { variant?: 'categories' | 'ranking' }) {
  const reduced = useReducedMotion()
  const { monthTransactions } = useFinance()
  const expenses = useMemo(
    () =>
      monthTransactions.filter(
        (transaction) =>
          transaction.type === 'expense' && transaction.status !== 'planned',
      ),
    [monthTransactions],
  )
  const categories = useMemo(() => sumByCategory(expenses), [expenses])
  const topFive = useMemo(
    () => [...expenses].sort((a, b) => b.amount - a.amount).slice(0, 5),
    [expenses],
  )
  const totalExpenses = expenses.reduce((sum, item) => sum + item.amount, 0)

  return (
    <section id={variant === 'ranking' ? 'ranking' : 'analises'} aria-labelledby={`${variant}-title`} className={`insights-module ${variant}-module space-y-4`}>
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.19em] text-[var(--muted)]">
          {variant === 'ranking' ? 'Suas maiores escolhas' : 'Um olhar mais de perto'}
        </p>
        <h2 id={`${variant}-title`} className="mt-1 text-xl font-semibold tracking-tight text-[var(--text)]">
          {variant === 'ranking' ? 'Maiores gastos' : 'Onde estão seus gastos'}
        </h2>
      </div>

      <div className="insights-content">
        {variant === 'categories' && <article className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[0_8px_24px_-22px_rgba(38,51,39,0.35)] sm:p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-[var(--text)]">Gastos por categoria</h3>
              <p className="mt-1 text-xs text-[var(--muted)]">Despesas pagas e na fatura</p>
            </div>
            <span className="rounded-full bg-[var(--soft)] px-3 py-1 text-xs font-medium text-[var(--text)]">
              {formatCurrencyBRL(totalExpenses)}
            </span>
          </div>

          <div className="expenses-illustration" aria-hidden="true">
            <img src="/art/parrot-expenses.png" alt="" decoding="async" />
          </div>

          {categories.length ? (
            <div className="expense-chart-layout mt-4 grid items-center gap-3 sm:grid-cols-[minmax(160px,0.85fr)_1fr]">
              <div className="relative mx-auto h-52 w-full max-w-[230px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      isAnimationActive={!reduced}
                      data={categories}
                      dataKey="amount"
                      nameKey="category"
                      innerRadius="66%"
                      outerRadius="91%"
                      paddingAngle={3}
                      stroke="none"
                    >
                      {categories.map((item, index) => (
                        <Cell key={item.category} fill={palette[index % palette.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<ExpenseTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xs text-[var(--muted)]">no mês</span>
                  <strong className="mt-1 text-lg font-semibold text-[var(--text)]">
                    {categories.length} {categories.length === 1 ? 'categoria' : 'categorias'}
                  </strong>
                </div>
              </div>
              <ol className="space-y-3">
                {categories.slice(0, 6).map((item, index) => (
                  <li key={item.category} className="flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: palette[index % palette.length] }}
                      />
                      <span className="truncate text-sm text-[var(--text)]">{item.category}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <strong className="block text-sm font-semibold text-[var(--text)]">
                        {formatCurrencyBRL(item.amount)}
                      </strong>
                      <span className="text-[11px] text-[var(--muted)]">{Math.round(item.share)}%</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <div className="grid min-h-56 place-items-center text-center">
              <div>
                <span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-[var(--soft)] text-[var(--muted)]">
                  <ArrowDownRight size={20} />
                </span>
                <p className="mt-3 text-sm font-medium text-[var(--text)]">Seus gastos aparecem aqui</p>
                <p className="mt-1 text-xs text-[var(--muted)]">Adicione um lançamento realizado para começar.</p>
              </div>
            </div>
          )}
        </article>}

        {variant === 'ranking' && <article className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[0_8px_24px_-22px_rgba(38,51,39,0.35)] sm:p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-[var(--text)]">Maiores gastos do mês</h3>
              <p className="mt-1 text-xs text-[var(--muted)]">Top 5 despesas individuais</p>
            </div>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--soft)] text-[var(--muted)]">
              <ShoppingBag size={18} />
            </span>
          </div>

          {topFive.length ? (
            <ol className="mt-5 divide-y divide-[var(--border)]">
              {topFive.map((transaction, index) => (
                <li key={transaction.id} className="flex items-center gap-3 py-3.5 first:pt-0 last:pb-0">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--soft)] text-xs font-bold text-[var(--muted)]">
                    0{index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-[var(--text)]">
                      {transaction.title}
                    </span>
                    <span className="mt-1 block truncate text-xs text-[var(--muted)]">
                      {transaction.category} · {paymentLabel(transaction.payment_method)}
                      {transaction.installment_current && transaction.installment_total
                        ? ` · ${transaction.installment_current}/${transaction.installment_total}`
                        : ''}
                    </span>
                  </span>
                  <strong className="shrink-0 text-sm font-semibold text-[var(--text)]">
                    {formatCurrencyBRL(transaction.amount)}
                  </strong>
                </li>
              ))}
            </ol>
          ) : (
            <div className="grid min-h-56 place-items-center text-center">
              <p className="max-w-56 text-sm leading-6 text-[var(--muted)]">
                Ainda não há despesas pagas ou na fatura neste mês.
              </p>
            </div>
          )}
        </article>}
      </div>
    </section>
  )
}
