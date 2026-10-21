import Link from "next/link";

const cards = [
  ["👥", "Pacientes", "Cadastros e prontuários", "/pacientes"],
  ["📅", "Agenda", "Próximos atendimentos", "#"],
  ["📈", "Evoluções", "Acompanhamento clínico", "#"],
];

export default function Home() {
  return <main className="shell">
    <header className="topbar"><div><span className="eyebrow">FISIOAPP</span><h1>Olá, Dra. Cristiane</h1></div><button className="avatar">CP</button></header>
    <section className="hero"><p className="eyebrow">VISÃO GERAL</p><h2>Cuide da clínica com mais clareza.</h2><p className="muted">Seu espaço para organizar pacientes, agenda e evolução clínica.</p></section>
    <section className="grid">{cards.map(([icon, title, text, href]) => <Link className="card" href={href} key={title}><span className="card-icon">{icon}</span><strong>{title}</strong><span className="muted">{text}</span><span className="arrow">→</span></Link>)}</section>
    <nav className="bottom-nav"><Link className="active" href="/">⌂<span>Início</span></Link><Link href="/pacientes">👥<span>Pacientes</span></Link><Link href="#">▣<span>Agenda</span></Link><Link href="#">☰<span>Mais</span></Link></nav>
  </main>;
}
