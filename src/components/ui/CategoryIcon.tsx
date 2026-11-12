import { useId } from 'react'

const paths: Record<string, string> = {
  Moradia: 'M9 17 20 8l11 9v15h-8v-9h-6v9H9Z',
  Alimentação: 'M9 10v10q0 5 5 5V10m-5 6h5m0 9v8m13-23q-8 8-4 14h5m0-14v23',
  Transporte: 'm9 18 3-8h16l3 8v12H9Zm0 3h22M14 30v3m12-3v3M13 25h2m10 0h2',
  Saúde: 'M16 9h8v8h8v8h-8v8h-8v-8H8v-8h8Z',
  Lazer: 'm20 8 4 9 10 1-8 7 2 10-8-5-9 5 2-10-7-7 10-1Z',
  Educação: 'M7 12q7-5 13 0 7-5 13 0v21q-7-5-13 0-6-5-13 0Zm13 0v21',
  Compras: 'M10 15h20l2 18H8Zm5 0v-3a5 5 0 0 1 10 0v3',
  Contas: 'M11 7h18v28l-5-3-4 3-4-3-5 3Zm5 8h8m-8 6h8m-8 6h5',
  Outros: 'M10 10h7v7h-7Zm13 0h7v7h-7ZM10 23h7v7h-7Zm13 0h7v7h-7Z',
  Entrada: 'M20 8v24m-9-10 9 10 9-10M9 8h22',
}
export function CategoryIcon({ category }: { category: string }) {
  const id = useId()
  return <svg className="category-icon" aria-hidden="true" viewBox="0 0 40 40" width="36" height="36"><defs><linearGradient id={id} x2="1" y2="1"><stop stopColor="var(--art-light)"/><stop offset="1" stopColor="var(--art-mid)"/></linearGradient></defs><rect x="1" y="3" width="38" height="36" rx="12" fill="var(--art-dark)" opacity=".25"/><rect x="1" y="1" width="38" height="36" rx="12" fill={`url(#${id})`} stroke="var(--art-mid)"/><path d={paths[category] ?? paths.Outros} transform="translate(0 1)" stroke="var(--art-dark)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" fill="none"/><path d="M9 4h20" stroke="var(--soft)" strokeOpacity=".6" strokeLinecap="round"/></svg>
}
