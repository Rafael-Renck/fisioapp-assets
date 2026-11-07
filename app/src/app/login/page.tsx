"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState, type FormEvent } from "react";
import { Icon } from "../../components/icon";

export default function LoginPage() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [googleAvailable, setGoogleAvailable] = useState(false);

  useEffect(() => { fetch("/api/auth/setup").then(response => response.json()).then(data => setNeedsSetup(!!data.needed)).catch(() => undefined); }, []);
  useEffect(() => {
    fetch("/api/auth/google").then(response => response.json()).then(data => setGoogleAvailable(data.available === true)).catch(() => undefined);
    const reason = new URLSearchParams(window.location.search).get("erro");
    if (reason === "google_sem_acesso") setError("Esta conta Google não tem acesso ativo ao FisioApp. Confirme o e-mail com o administrador do consultório.");
    else if (reason === "google_indisponivel") setError("A entrada com Google ainda não está disponível. Entre com e-mail e senha.");
    else if (reason?.startsWith("google_")) setError("Não foi possível entrar com Google. Tente novamente.");
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: form.get("email"), password: form.get("password") }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error);
      location.href = result.role === "patient" ? "/minhas-contracoes" : result.mustChangePassword ? "/configuracoes" : "/";
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível entrar."); setBusy(false); }
  }

  return <main className="login-page">
    <div className="login-shell">
      <section className="login-story" aria-label="FisioApp">
        <span className="login-story-mark"><Image src="/logo-mark.svg" alt="" width={48} height={48} priority /></span>
        <div className="login-story-copy"><span className="login-kicker">SEU CUIDADO, MAIS PERTO</span><h1>Mais tempo para cuidar de cada história.</h1><p>Pacientes, agenda e acompanhamento em um espaço pensado para a sua rotina.</p></div>
        <div className="login-art" aria-hidden="true"><div className="login-art-ring login-art-ring-one" /><div className="login-art-ring login-art-ring-two" /><div className="login-art-heart"><Icon name="heart" size={54} /></div><div className="login-art-note login-art-note-top"><span><Icon name="calendar" size={18} /></span> Rotina organizada</div><div className="login-art-note login-art-note-bottom"><span><Icon name="patients" size={18} /></span> Cuidado conectado</div></div>
        <span className="login-story-footer">FisioApp · Cuidado que conecta</span>
      </section>
      <section className="login-form-panel" aria-labelledby="login-title">
        <div className="login-form-wrap"><Image className="login-logo" src="/logo.svg" alt="FisioApp" width={190} height={43} priority /><div className="login-intro"><span className="login-kicker">BOM TER VOCÊ AQUI</span><h2 id="login-title">Acesse seu espaço</h2><p>Entre com o e-mail e a senha do seu consultório.</p></div>
          <form className="login-form" onSubmit={submit}><label htmlFor="login-email">E-mail</label><input id="login-email" name="email" type="email" placeholder="nome@exemplo.com" autoComplete="username" autoCapitalize="none" spellCheck={false} required /><label htmlFor="login-password">Senha</label><div className="login-password-field"><input id="login-password" name="password" type={showPassword ? "text" : "password"} placeholder="Digite sua senha" autoComplete="current-password" required /><button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} aria-pressed={showPassword}>{showPassword ? "Ocultar" : "Mostrar"}</button></div>{error && <p role="alert" className="login-error">{error}</p>}<button className="primary login-submit" disabled={busy}>{busy ? "Entrando..." : <>Entrar no FisioApp <Icon name="arrow" size={18} /></>}</button></form>
          {googleAvailable && <><div className="login-google-divider"><span>ou entre com</span></div><a className="login-google-button" href="/api/auth/google/start"><span className="login-google-mark" aria-hidden="true">G</span>Continuar com Google</a></>}
          {needsSetup && <p className="auth-setup-link">Primeiro acesso do administrador? <Link href="/setup">Criar minha conta</Link></p>}
          <p className="login-help">Precisa de acesso? Peça um convite ao administrador do seu consultório.</p>
        </div>
      </section>
    </div>
  </main>;
}
