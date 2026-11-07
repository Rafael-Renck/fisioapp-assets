"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon, type IconName } from "./icon";
import { LogoutButton } from "./account-actions";

const navigation: { label: string; icon: IconName; href?: string }[] = [
  { label: "Início", icon: "home", href: "/" },
  { label: "Pacientes", icon: "patients", href: "/pacientes" },
  { label: "Agenda", icon: "calendar", href: "/agenda" },
  { label: "Doulagem", icon: "heart", href: "/doulagem" },
  { label: "Relatórios", icon: "chart", href: "/relatorios" },
  { label: "Configurações", icon: "notes", href: "/configuracoes" },
  { label: "Prontuários", icon: "notes", href: "/prontuarios" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const help = useRef<HTMLDialogElement>(null);
  const [spaceName, setSpaceName] = useState("Meu espaço");
  const [isOwner, setIsOwner] = useState(false);
  const [role, setRole] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  useEffect(() => { fetch("/api/auth/me").then(response => response.ok ? response.json() : null).then(user => { if (user?.spaceName) setSpaceName(user.spaceName); if (user?.role === "owner") setIsOwner(true); if (user?.role) setRole(user.role); }).catch(() => undefined); }, []);
  useEffect(() => { setMoreOpen(false); }, [pathname]);
  const visibleNavigation = navigation.filter(item => role !== "reception" || !["Doulagem", "Relatórios", "Prontuários"].includes(item.label));
  const mobilePrimary = visibleNavigation.slice(0, 4);
  const mobileMore = visibleNavigation.slice(4);
  if (["/login", "/setup", "/admin", "/minhas-contracoes"].includes(pathname) || pathname.startsWith("/convite/")) return <>{children}</>;
  return <div className="app-frame">
    <a href="#conteudo" className="skip-link">Ir para o conteúdo</a>
    <aside className="sidebar">
      <Link href="/" className="brand" aria-label="FisioApp — início"><span className="brand-symbol"><Image src="/logo-mark.svg" alt="" width={41} height={41} /></span><span>fisio<span className="brand-light">app</span><small>CUIDADO QUE CONECTA</small></span></Link>
      <div className="workspace-label">{spaceName}</div>
      <nav className="desktop-nav" aria-label="Menu principal">{visibleNavigation.map(item => item.href ? <Link key={item.label} href={item.href} className={pathname === item.href || item.href === "/doulagem" && pathname.startsWith("/doulagem/") || item.href === "/prontuarios" && pathname.startsWith("/pacientes/") ? "selected" : ""} aria-current={pathname === item.href || item.href === "/doulagem" && pathname.startsWith("/doulagem/") || item.href === "/prontuarios" && pathname.startsWith("/pacientes/") ? "page" : undefined}><Icon name={item.icon} /><span>{item.label}</span></Link> : <button key={item.label} disabled><Icon name={item.icon} /><span>{item.label}</span><small>Em breve</small></button>)}</nav>
      <div className="sidebar-bottom"><div className="care-note"><Icon name="heart" /><strong>Mais tempo para cuidar.</strong><p>Uma rotina organizada começa com pequenos passos.</p></div><button className="help-button" onClick={() => help.current?.showModal()}><Icon name="help" /> Sobre esta versão</button><div className="profile"><span className="avatar">FA</span><div><strong>{spaceName}</strong><small>{isOwner ? "Super administrador" : role === "admin" ? "Administrador" : role === "reception" ? "Recepção" : "Fisioterapeuta"}</small></div></div><LogoutButton className="sidebar-logout" /></div>
    </aside>
    <div className="app-body"><header className="app-topbar"><div className="desktop-breadcrumb">Consultório <span>/</span> <strong>{pathname === "/" ? "Visão geral" : pathname === "/agenda" ? "Agenda" : pathname.startsWith("/doulagem") ? "Doulagem" : pathname === "/relatorios" ? "Relatórios" : pathname === "/configuracoes/usuarios" ? "Usuários" : pathname === "/configuracoes" ? "Configurações" : pathname === "/prontuarios" || pathname.startsWith("/pacientes/") ? "Prontuários" : "Pacientes"}</strong></div><Link href="/" className="mobile-brand"><Image src="/logo-mark.svg" alt="" width={29} height={29} /> fisioapp</Link><div className="topbar-right"><span className="workspace-badge"><span /> {spaceName}</span><LogoutButton className="topbar-logout" /><span className="avatar" aria-label={spaceName}>FA</span></div></header><main id="conteudo" className="page-content">{children}</main><footer className="page-footer"><span>FisioApp · Feito para cuidar</span><button onClick={() => help.current?.showModal()}>Sobre esta versão <Icon name="help" size={15} /></button></footer></div>
    {moreOpen && mobileMore.length > 0 && <><button type="button" className="mobile-more-backdrop" aria-label="Fechar mais opções" onClick={() => setMoreOpen(false)} /><div id="mobile-more-menu" className="mobile-more-menu" onKeyDown={event => { if (event.key === "Escape") setMoreOpen(false); }}><strong>Mais opções</strong>{mobileMore.map(item => item.href && <Link key={item.label} href={item.href} onClick={() => setMoreOpen(false)}><Icon name={item.icon} size={19} />{item.label}</Link>)}</div></>}
    <nav className="bottom-nav" aria-label="Menu principal no celular">{mobilePrimary.map(item => item.href ? <Link href={item.href} key={item.label} className={pathname === item.href || item.href === "/doulagem" && pathname.startsWith("/doulagem/") || item.href === "/prontuarios" && pathname.startsWith("/pacientes/") ? "selected" : ""} aria-current={pathname === item.href || item.href === "/doulagem" && pathname.startsWith("/doulagem/") || item.href === "/prontuarios" && pathname.startsWith("/pacientes/") ? "page" : undefined}><Icon name={item.icon} /><span>{item.label}</span></Link> : null)}{mobileMore.length > 0 && <button type="button" className={moreOpen || mobileMore.some(item => item.href && (pathname === item.href || pathname.startsWith(`${item.href}/`))) ? "selected" : ""} aria-expanded={moreOpen} aria-controls="mobile-more-menu" onClick={() => setMoreOpen(open => !open)}><Icon name="menu" /><span>Mais</span></button>}</nav>
    <dialog className="info-dialog" ref={help} aria-labelledby="about-title" onClick={e => { if (e.target === e.currentTarget) help.current?.close(); }}><div className="modal-heading"><h2 id="about-title">Seu novo FisioApp</h2><button className="icon-button" aria-label="Fechar" onClick={() => help.current?.close()}><Icon name="close" /></button></div><p>Cadastre pacientes e organize atendimentos na Agenda. Os dados são salvos neste Codespace.</p><button className="primary" onClick={() => help.current?.close()}>Entendi</button></dialog>
  </div>;
}
