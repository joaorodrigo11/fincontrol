import { useEffect, useState } from 'react'
import { ArrowUpRight, ChartPie, Gauge, House, Landmark, ListOrdered, WalletCards } from 'lucide-react'

const sections = [
  { id: 'orcamento', label: 'Visão geral', icon: House },
  { id: 'lorometro', label: 'Lorômetro', icon: Gauge },
  { id: 'previsao-mensal', label: 'Cartão e Pix', icon: WalletCards },
  { id: 'analises', label: 'Categorias', icon: ChartPie },
  { id: 'lancamentos', label: 'Lançamentos', icon: ListOrdered },
  { id: 'bancos', label: 'Bancos', icon: Landmark },
]

export function Sidebar() {
  const [active, setActive] = useState('orcamento')
  useEffect(() => {
    const update = () => {
      const visible = sections.filter(({ id }) => {
        const node = document.getElementById(id)
        return node && node.getBoundingClientRect().top < innerHeight * .45
      })
      setActive(visible.at(-1)?.id ?? 'orcamento')
    }
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [])
  return <aside className="desktop-sidebar">
    <a className="sidebar-brand" href="#inicio" aria-label="Lôro — início"><span><img src="/favicon.png" alt="" width="34" height="34" /></span><strong>Lôro<span>sua vida, em equilíbrio</span></strong></a>
    <p className="sidebar-label">SEU ESPAÇO</p>
    <nav aria-label="Seções do painel">
      {sections.map(({ id, label, icon: Icon }) => <a key={id} href={`#${id}`} aria-current={active === id ? 'location' : undefined} onClick={() => setActive(id)}><Icon size={19} /><span>{label}</span>{active === id && <span className="sidebar-dot" />}</a>)}
    </nav>
    <div className="sidebar-note"><img src="/art/wallet.svg" alt="" width="150" height="100" /><strong>Mais clareza.<br />Mais tranquilidade.</strong><p>Um mês de cada vez, no seu ritmo.</p><a href="#previsao-mensal">Veja os gastos do mês <ArrowUpRight size={15} /></a></div>
    <p className="sidebar-bottom">Seu dinheiro, suas escolhas.</p>
  </aside>
}
