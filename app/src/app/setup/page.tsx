"use client";
import { useEffect, useState, type FormEvent } from "react";
export default function SetupPage() {
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [token, setToken] = useState("");
  useEffect(() => {
    const code = new URLSearchParams(location.hash.slice(1)).get("token");
    if (code) { setToken(code); history.replaceState(null, "", location.pathname); }
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); const form = new FormData(event.currentTarget);
    try { const response = await fetch("/api/auth/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, email: form.get("email"), password: form.get("password") }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error); location.href = "/"; }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível concluir a instalação."); setBusy(false); }
  }
  return <main className="auth-page"><div className="auth-card"><p className="eyebrow">PRIMEIRO ACESSO</p><h1>Criar conta de super administrador</h1><p className="muted">Escolha o e-mail e a senha que usará para administrar os espaços dos fisioterapeutas.</p><form onSubmit={submit}>{!token && <label>Código de instalação<input value={token} onChange={event => setToken(event.target.value.trim())} required autoComplete="off" /><small>O código está em <code>app/.data/setup-token</code> no servidor.</small></label>}<label>Seu e-mail<input name="email" type="email" required autoComplete="username" /></label><label>Sua senha<input name="password" type="password" minLength={12} required autoComplete="new-password" /><small>Use pelo menos 12 caracteres.</small></label>{error && <p role="alert" className="form-error">{error}</p>}<button className="primary" disabled={busy || !token}>{busy ? "Configurando..." : "Criar super administrador"}</button></form></div></main>;
}
