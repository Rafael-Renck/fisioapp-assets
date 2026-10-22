"use client";
import { useState, type FormEvent } from "react";
export default function LoginPage() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: form.get("email"), password: form.get("password") }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error);
      location.href = result.role === "owner" ? "/admin" : result.mustChangePassword ? "/configuracoes" : "/";
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível entrar."); setBusy(false); }
  }
  return <main className="auth-page"><div className="auth-card"><p className="eyebrow">FISIOAPP</p><h1>Entre no seu espaço</h1><p className="muted">Acesse seus pacientes, agenda e configurações.</p><form onSubmit={submit}><label>E-mail<input name="email" type="email" autoComplete="username" required /></label><label>Senha<input name="password" type="password" autoComplete="current-password" required /></label>{error && <p role="alert" className="form-error">{error}</p>}<button className="primary" disabled={busy}>{busy ? "Entrando..." : "Entrar"}</button></form></div></main>;
}
