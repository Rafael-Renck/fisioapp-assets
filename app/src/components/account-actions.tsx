"use client";
import { useState, type FormEvent } from "react";
export function LogoutButton() { return <button className="secondary" type="button" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); location.href = "/login"; }}>Sair</button>; }
export function ChangePassword() {
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); const response = await fetch("/api/auth/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword: data.get("currentPassword"), newPassword: data.get("newPassword") }) }); const result = await response.json(); setMessage(response.ok ? "Senha atualizada." : result.error || "Erro ao trocar senha."); if (response.ok) { form.reset(); location.reload(); } }
  return <form onSubmit={submit} className="settings-form"><label>Senha atual<input name="currentPassword" type="password" required autoComplete="current-password" /></label><label>Nova senha<input name="newPassword" type="password" minLength={12} required autoComplete="new-password" /></label><button className="primary">Trocar senha</button>{message && <p role="status">{message}</p>}</form>;
}
