import { useEffect, useState } from 'react'
import { ArrowUpRight, Gauge, House, PlusCircle, ListOrdered, Wallet } from 'lucide-react'

const sections = [
  { id: 'inicio', label: 'Visão geral', icon: House },
  { id: 'orcamento', label: 'Minha carteira', icon: Wallet },
  { id: 'novo-lancamento', label: 'Novo lançamento', icon: PlusCircle },
  { id: 'resumo-lancamentos', label: 'Seu mês em números', icon: Gauge },
  { id: 'lancamentos', label: 'Lançamentos', icon: ListOrdered },
]

export function Sidebar() {
  const [active, setActive] = useState('inicio')
  useEffect(() => {
    const update = () => {
      const visible = sections.filter(({ id }) => {
        const node = document.getElementById(id)
        return node && node.getBoundingClientRect().top < innerHeight * .45
      })
      setActive(visible.at(-1)?.id ?? 'inicio')
    }
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [])
  return <aside className="desktop-sidebar">
    <a className="sidebar-brand" href="#inicio" aria-label="Lôro — início"><span><img src="/favicon.png" alt="" width="34" height="34" /></span><strong>Lôro<span>sua vida, em equilíbrio</span></strong></a>
    <p className="sidebar-label">SEU ESPAÇO</p>
    <nav aria-label="Seções do painel">
      {sections.map(({ id, label, icon: Icon }) => (
        <a key={id} href={`#${id}`} aria-current={active === id ? 'location' : undefined} onClick={() => setActive(id)}><Icon size={19} /><span>{label}</span>{active === id && <span className="sidebar-dot" />}</a>
      ))}
    </nav>
    <div className="sidebar-note"><img src="/art/parrot-expenses.png" alt="" width="150" height="100" /><strong>Cada gasto,<br />no seu lugar.</strong><p>Um mês de cada vez, no seu ritmo.</p><a href="#novo-lancamento">Registrar um gasto <ArrowUpRight size={15} /></a></div>
    <p className="sidebar-bottom">Seu dinheiro, suas escolhas.</p>
  </aside>
}
