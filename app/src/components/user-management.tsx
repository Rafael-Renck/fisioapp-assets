"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ConfirmDialog } from "./confirm-dialog";
import { Icon } from "./icon";

type ManagedUser = { id: string; name: string; email: string; role: "owner" | "physio" | "admin" | "therapist" | "reception" | "staff"; active: boolean; mustChangePassword: boolean; createdAt: string | null };
type Action = { user: ManagedUser; kind: "deactivate" | "resetPassword" };
type Modal = { kind: "create" } | { kind: "edit"; user: ManagedUser } | { kind: "credentials"; name: string; email: string; password: string } | null;

export function UserManagement() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const [action, setAction] = useState<Action | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const load = useCallback(async () => {
    const response = await fetch("/api/settings/users", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Não foi possível carregar os usuários.");
    setUsers(data.users); setCurrentUserId(data.currentUserId);
  }, []);
  useEffect(() => { load().catch(cause => setError(cause instanceof Error ? cause.message : "Não foi possível carregar os usuários.")).finally(() => setLoading(false)); }, [load]);
  function openModal(next: NonNullable<Modal>) { setError(""); setCopied(false); setModal(next); if (!dialog.current?.open) dialog.current?.showModal(); }
  function closeModal() { if (busy) return; dialog.current?.close(); setModal(null); setCopied(false); setError(""); }
  async function request(method: "POST" | "PATCH", body: Record<string, unknown>) {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/settings/users", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível salvar o usuário.");
      await load().catch(() => setNotice("Usuário salvo. Atualize a página para recarregar a lista."));
      return result;
    } finally { setBusy(false); }
  }
  async function saveUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const name = String(values.get("name") || "").trim(), email = String(values.get("email") || "").trim(), role = String(values.get("role") || "");
    try {
      if (modal?.kind === "edit") {
        await request("PATCH", { action: "edit", id: modal.user.id, name, email, role });
        closeModal(); setNotice("Dados do usuário atualizados.");
      } else if (modal?.kind === "create") {
        const result = await request("POST", { name, email, role });
        setModal({ kind: "credentials", name: result.user.name, email: result.user.email, password: result.temporaryPassword });
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível salvar o usuário."); }
  }
  async function confirmAction() {
    if (!action) return;
    const { user, kind } = action;
    try {
      const result = await request("PATCH", kind === "deactivate" ? { action: "setActive", id: user.id, active: false } : { action: "resetPassword", id: user.id });
      setAction(null);
      if (kind === "resetPassword") openModal({ kind: "credentials", name: user.name, email: user.email, password: result.temporaryPassword });
      else setNotice(`Acesso de ${user.name || user.email} desativado.`);
    } catch (cause) { setAction(null); setError(cause instanceof Error ? cause.message : "Não foi possível atualizar o usuário."); }
  }
  async function reactivate(user: ManagedUser) {
    try { await request("PATCH", { action: "setActive", id: user.id, active: true }); setNotice(`Acesso de ${user.name || user.email} reativado.`); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível reativar o usuário."); }
  }
  async function copyPassword() {
    if (modal?.kind !== "credentials") return;
    try { await navigator.clipboard.writeText(modal.password); setCopied(true); }
    catch { setError("Selecione a senha no campo e copie manualmente."); }
  }
  const visible = users.filter(user => `${user.name} ${user.email}`.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR").trim()));
  const activeTeam = users.filter(user => !["owner", "physio"].includes(user.role) && user.active).length;
  return <div className="users-page">
    <Link href="/configuracoes" className="record-back">← Voltar às configurações</Link>
    <div className="page-heading"><div><p className="eyebrow">ACESSOS DO CONSULTÓRIO</p><h1>Usuários</h1><p className="muted">Cadastre pessoas da equipe e controle quem pode entrar no seu espaço.</p></div><button type="button" className="primary" onClick={() => openModal({ kind: "create" })}><Icon name="plus" size={17} /> Novo usuário</button></div>
    {notice && <div className="success-message" role="status"><Icon name="check" size={18} />{notice}<button type="button" className="icon-button" aria-label="Fechar aviso" onClick={() => setNotice("")}><Icon name="close" size={15} /></button></div>}
    {error && !modal && <div className="contraction-error" role="alert">{error}<button type="button" className="icon-button" aria-label="Fechar erro" onClick={() => setError("")}><Icon name="close" size={15} /></button></div>}
    <div className="users-overview"><div className="panel"><span>Usuários do espaço</span><strong>{loading ? "—" : users.length}</strong><small>Inclui administradores</small></div><div className="panel"><span>Equipe ativa</span><strong>{loading ? "—" : activeTeam}</strong><small>Com acesso ao consultório</small></div><div className="panel users-overview-help"><strong>Como funciona o acesso?</strong><p>A equipe usa e-mail e senha para entrar. Você entrega a senha temporária após criar o usuário; ela precisa ser trocada no primeiro acesso.</p></div></div>
    <section className="panel users-list-panel"><div className="users-list-heading"><div><h2>Pessoas com acesso</h2><p className="muted">{loading ? "Carregando..." : `${visible.length} ${visible.length === 1 ? "usuário encontrado" : "usuários encontrados"}`}</p></div><div className="search"><Icon name="search" size={18} /><input type="search" aria-label="Buscar usuário" placeholder="Buscar nome ou e-mail" value={query} onChange={event => setQuery(event.target.value)} /></div></div>
      {loading ? <p className="users-empty" role="status">Carregando usuários...</p> : visible.length ? <div className="users-list">{visible.map(user => <article className="users-item" key={user.id}><span className="users-avatar">{(user.name || user.email).slice(0, 2).toLocaleUpperCase("pt-BR")}</span><div className="users-person"><strong>{user.name || user.email}{user.id === currentUserId && <small> · você</small>}</strong><span>{user.email}</span><small>{user.role === "reception" ? "Recepção" : user.role === "therapist" || user.role === "staff" ? "Fisioterapeuta" : "Administrador"}{user.mustChangePassword && user.active ? " · senha temporária" : ""}</small></div><span className={`users-status ${user.active ? "active" : "inactive"}`}>{user.active ? "Ativo" : "Desativado"}</span>{!["owner", "physio"].includes(user.role) && <div className="users-actions"><button type="button" className="secondary" onClick={() => openModal({ kind: "edit", user })}>Editar</button>{user.id !== currentUserId && <><button type="button" className="secondary" onClick={() => setAction({ user, kind: "resetPassword" })}>Nova senha</button><button type="button" className="secondary" onClick={() => user.active ? setAction({ user, kind: "deactivate" }) : void reactivate(user)}>{user.active ? "Desativar" : "Reativar"}</button></>}</div>}</article>)}</div> : <div className="users-empty"><Icon name="patients" size={28} /><strong>Nenhum usuário encontrado</strong><p>{query ? "Tente buscar outro nome ou e-mail." : "Cadastre a primeira pessoa da equipe."}</p></div>}</section>
    <dialog ref={dialog} className="users-dialog" aria-labelledby="users-dialog-title" onCancel={event => { if (busy) event.preventDefault(); else closeModal(); }} onClick={event => { if (event.target === event.currentTarget) closeModal(); }}>
      {modal?.kind === "credentials" ? <div className="users-dialog-content"><span className="users-dialog-icon"><Icon name="check" size={23} /></span><h2 id="users-dialog-title">Acesso pronto para {modal.name}</h2><p>Envie estes dados diretamente à pessoa. A senha será mostrada apenas agora.</p><label>E-mail de acesso<input readOnly value={modal.email} onFocus={event => event.target.select()} /></label><label>Senha temporária<div className="users-password-row"><input readOnly value={modal.password} onFocus={event => event.target.select()} /><button type="button" className="secondary" onClick={() => void copyPassword()}>{copied ? "Copiado" : "Copiar"}</button></div></label>{error && <p className="form-error" role="alert">{error}</p>}<div className="users-dialog-actions"><button type="button" className="primary" onClick={closeModal}>Concluir</button></div></div> : modal && <form className="users-dialog-content" onSubmit={event => void saveUser(event)}><div className="modal-heading"><div><p className="eyebrow">ACESSO DA EQUIPE</p><h2 id="users-dialog-title">{modal.kind === "create" ? "Novo usuário" : "Editar usuário"}</h2></div><button type="button" className="icon-button" aria-label="Fechar" disabled={busy} onClick={closeModal}><Icon name="close" /></button></div><p>{modal.kind === "create" ? "Escolha o perfil para definir o que esta pessoa pode acessar." : "Atualize os dados e o perfil de acesso."}</p><label>Nome completo<input name="name" autoFocus required minLength={2} maxLength={120} defaultValue={modal.kind === "edit" ? modal.user.name : ""} placeholder="Nome da pessoa" /></label><label>E-mail de acesso<input name="email" type="email" required autoComplete="off" defaultValue={modal.kind === "edit" ? modal.user.email : ""} placeholder="nome@exemplo.com" /></label><label>Perfil de acesso<select name="role" required defaultValue={modal.kind === "edit" ? modal.user.role === "staff" ? "therapist" : modal.user.role : ""}><option value="" disabled>Selecione um perfil</option><option value="admin">Administrador</option><option value="therapist">Fisioterapeuta</option><option value="reception">Recepção</option></select></label><p className="users-role-help">Administrador gerencia configurações e usuários. Fisioterapeuta acessa atendimentos, prontuários e doulagem. Recepção organiza pacientes e agenda, sem acesso a prontuários ou contratos.</p>{modal.kind === "create" && <div className="users-dialog-note"><Icon name="help" size={16} /> Uma senha temporária será gerada após o cadastro.</div>}{error && <p className="form-error" role="alert">{error}</p>}<div className="users-dialog-actions"><button type="button" className="secondary" disabled={busy} onClick={closeModal}>Cancelar</button><button className="primary" disabled={busy}>{busy ? "Salvando..." : modal.kind === "create" ? "Criar usuário" : "Salvar alterações"}</button></div></form>}
    </dialog>
    <ConfirmDialog open={!!action} title={action?.kind === "deactivate" ? "Desativar usuário?" : "Gerar nova senha?"} description={action?.kind === "deactivate" ? `O acesso de ${action.user.name || action.user.email} será encerrado, inclusive nas sessões já abertas.` : action ? `A senha atual de ${action.user.name || action.user.email} deixará de funcionar. A nova senha será mostrada na próxima etapa.` : ""} confirmLabel={action?.kind === "deactivate" ? "Desativar" : "Gerar senha"} busy={busy} onConfirm={() => void confirmAction()} onCancel={() => setAction(null)} />
  </div>;
}
