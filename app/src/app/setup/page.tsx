"use client";
import { useState, type FormEvent } from "react";
export default function SetupPage() {
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); const form = new FormData(event.currentTarget);
    try { const response = await fetch("/api/auth/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: form.get("token"), email: form.get("email"), password: form.get("password") }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error); location.href = "/admin"; }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível concluir a instalação."); setBusy(false); }
  }
  return <main className="auth-page"><div className="auth-card"><p className="eyebrow">PRIMEIRO ACESSO</p><h1>Configurar o dono do sistema</h1><p className="muted">Leia o código de instalação no arquivo <code>app/.data/setup-token</code> no servidor. O código será apagado após este cadastro.</p><form onSubmit={submit}><label>Código de instalação<input name="token" required autoComplete="off" /></label><label>Seu e-mail<input name="email" type="email" required autoComplete="username" /></label><label>Senha<input name="password" type="password" minLength={12} required autoComplete="new-password" /><small>Use pelo menos 12 caracteres.</small></label>{error && <p role="alert" className="form-error">{error}</p>}<button className="primary" disabled={busy}>{busy ? "Configurando..." : "Criar conta do dono"}</button></form></div></main>;
}
