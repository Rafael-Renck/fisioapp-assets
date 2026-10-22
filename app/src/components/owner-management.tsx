"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { SettingsSection } from "./settings-section";

type PhysioSpace = {
  id: string;
  name: string;
  email: string;
  plan: string;
  status: "active" | "suspended";
};
type AdminData = { spaces: PhysioSpace[]; legacyAvailable: boolean };

export function OwnerManagement() {
  const [data, setData] = useState<AdminData | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin", { cache: "no-store" });
    if (!response.ok) throw new Error("Não foi possível carregar os fisioterapeutas.");
    setData(await response.json());
  }, []);
  useEffect(() => { load().catch(error => setNotice(error.message)); }, [load]);

  async function send(method: "POST" | "PATCH", body: Record<string, unknown>) {
    const response = await fetch("/api/admin", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Não foi possível salvar.");
    await load();
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    setBusy(true);
    try {
      await send("POST", { name: fields.get("name"), email: fields.get("email"), password: fields.get("password"), useLegacyData: fields.get("legacy") === "on" });
      form.reset();
      setNotice("Acesso criado. Compartilhe a senha temporária diretamente com o fisioterapeuta.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Não foi possível criar o acesso."); }
    finally { setBusy(false); }
  }

  async function changeStatus(space: PhysioSpace) {
    setBusy(true);
    try {
      const status = space.status === "active" ? "suspended" : "active";
      await send("PATCH", { action: "space", id: space.id, name: space.name, plan: space.plan, status });
      setNotice(status === "suspended" ? "Acesso suspenso." : "Acesso reativado.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Não foi possível atualizar o acesso."); }
    finally { setBusy(false); }
  }

  return <SettingsSection icon="patients" title="Fisioterapeutas" description="Crie e gerencie os acessos dos profissionais" meta={`${data?.spaces.length || 0} cadastrado(s)`}>
    <p className="muted">Cada fisioterapeuta acessa somente seus próprios pacientes e sua agenda.</p>
    {notice && <p role="status" className="success-message">{notice}</p>}
    <form className="settings-form" onSubmit={create}>
      <label>Nome do espaço<input name="name" required maxLength={120} placeholder="Consultório Ana Lima" /></label>
      <label>E-mail de acesso<input name="email" type="email" required /></label>
      <label>Senha temporária<input name="password" type="password" minLength={12} required autoComplete="new-password" /><small>O profissional deverá trocá-la no primeiro acesso.</small></label>
      {data?.legacyAvailable && <label className="check-row"><input name="legacy" type="checkbox" /> Usar neste espaço os dados antigos do sistema</label>}
      <button className="primary" disabled={busy}>Criar login</button>
    </form>
    <h3>Logins cadastrados</h3>
    {data?.spaces.length ? <div className="settings-list">{data.spaces.map(space => <div className="settings-item" key={space.id}><div><strong>{space.name}</strong><p>{space.email} · {space.status === "active" ? "Ativo" : "Suspenso"}</p></div><button className="secondary" disabled={busy} onClick={() => changeStatus(space)}>{space.status === "active" ? "Suspender" : "Reativar"}</button></div>)}</div> : <p className="muted">Nenhum fisioterapeuta cadastrado.</p>}
  </SettingsSection>;
}
