"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, type ReactNode } from "react";
import { Icon, type IconName } from "./icon";

const navigation: { label: string; icon: IconName; href?: string }[] = [
  { label: "Início", icon: "home", href: "/" },
  { label: "Pacientes", icon: "patients", href: "/pacientes" },
  { label: "Agenda", icon: "calendar" },
  { label: "Prontuários", icon: "notes" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const help = useRef<HTMLDialogElement>(null);
  return <div className="app-frame">
    <a href="#conteudo" className="skip-link">Ir para o conteúdo</a>
    <aside className="sidebar">
      <Link href="/" className="brand" aria-label="FisioApp — início"><span className="brand-symbol"><Icon name="heart" size={23} /></span><span>fisio<span className="brand-light">app</span><small>CUIDADO QUE CONECTA</small></span></Link>
      <div className="workspace-label">SEU CONSULTÓRIO</div>
      <nav className="desktop-nav" aria-label="Menu principal">{navigation.map(item => item.href ? <Link key={item.label} href={item.href} className={pathname === item.href ? "selected" : ""} aria-current={pathname === item.href ? "page" : undefined}><Icon name={item.icon} /><span>{item.label}</span></Link> : <button key={item.label} disabled><Icon name={item.icon} /><span>{item.label}</span><small>Em breve</small></button>)}</nav>
      <div className="sidebar-bottom"><div className="care-note"><Icon name="heart" /><strong>Mais tempo para cuidar.</strong><p>Uma rotina organizada começa com pequenos passos.</p></div><button className="help-button" onClick={() => help.current?.showModal()}><Icon name="help" /> Sobre esta versão</button><div className="profile"><span className="avatar">CP</span><div><strong>Dra. Cristiane</strong><small>Fisioterapeuta</small></div><span className="online-dot" aria-label="Perfil demonstrativo" /></div></div>
    </aside>
    <div className="app-body"><header className="app-topbar"><div className="desktop-breadcrumb">Consultório <span>/</span> <strong>{pathname === "/" ? "Visão geral" : "Pacientes"}</strong></div><Link href="/" className="mobile-brand"><Icon name="heart" /> fisioapp</Link><div className="topbar-right"><span className="workspace-badge"><span /> Espaço de trabalho</span><span className="avatar" aria-label="Dra. Cristiane Pereira">CP</span></div></header><main id="conteudo" className="page-content">{children}</main><footer className="page-footer"><span>FisioApp · Feito para cuidar</span><button onClick={() => help.current?.showModal()}>Sobre esta versão <Icon name="help" size={15} /></button></footer></div>
    <nav className="bottom-nav" aria-label="Menu principal no celular">{navigation.map(item => item.href ? <Link href={item.href} key={item.label} className={pathname === item.href ? "selected" : ""} aria-current={pathname === item.href ? "page" : undefined}><Icon name={item.icon} /><span>{item.label}</span></Link> : <button key={item.label} disabled><Icon name={item.icon} /><span>{item.label}</span><small>Em breve</small></button>)}</nav>
    <dialog className="info-dialog" ref={help} aria-labelledby="about-title" onClick={e => { if (e.target === e.currentTarget) help.current?.close(); }}><div className="modal-heading"><h2 id="about-title">Seu novo FisioApp</h2><button className="icon-button" aria-label="Fechar" onClick={() => help.current?.close()}><Icon name="close" /></button></div><p>Esta é a primeira versão do sistema. Você já pode cadastrar e buscar pacientes e acompanhar o total na página inicial.</p><p>Os cadastros são temporários e serão apagados ao recarregar a página. Agenda, prontuários e armazenamento permanente serão adicionados nas próximas etapas.</p><button className="primary" onClick={() => help.current?.close()}>Entendi</button></dialog>
  </div>;
}
