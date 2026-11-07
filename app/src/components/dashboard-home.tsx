"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ConfirmDialog } from "./confirm-dialog";
import { Icon } from "./icon";
import type { Status } from "../lib/store";

type Appointment = { id: string; patientId: string; patientName: string; patientActive: boolean; date: string; time: string; duration: number; status: Status; serviceName: string; hasEvolution: boolean };
type Pending = Appointment & { kind: "outcome" | "evolution" };
type Dashboard = { today: string; canAccessClinical: boolean; sessions: Appointment[]; pending: Pending[]; totals: { today: number; unconfirmed: number; pending: number } };
type Action = { session: Appointment; status: Status; label: string };

const dateLabel = (value: string) => new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
const shortDate = (value: string) => value.split("-").reverse().slice(0, 2).join("/");
const finalStatus = (status: Status) => status === "Realizado" || status === "Não Compareceu" || status.startsWith("Cancelado");
const statusClass = (status: Status) => status === "Realizado" ? "done" : status === "Confirmado" ? "confirmed" : status === "Agendado" ? "scheduled" : "closed";

export function DashboardHome() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState<Action | null>(null);
  const [cancelFor, setCancelFor] = useState<string | null>(null);
  const load = useCallback(async () => {
    const response = await fetch("/api/dashboard", { cache: "no-store" });
    if (!response.ok) throw new Error("Não foi possível carregar a agenda do dia.");
    setData(await response.json()); setError(""); setLoading(false);
  }, []);
  useEffect(() => {
    load().catch(err => { setError(err.message); setLoading(false); });
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") load().catch(() => undefined); }, 60_000);
    const refresh = () => { if (document.visibilityState === "visible") load().catch(() => undefined); };
    document.addEventListener("visibilitychange", refresh);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, [load]);

  async function changeStatus(session: Appointment, status: Status) {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/agenda", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "status", id: session.id, status }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível atualizar o atendimento.");
      await load(); setNotice(`${session.patientName}: ${status.toLowerCase()}.`); setCancelFor(null); setAction(null);
    } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível atualizar o atendimento."); }
    finally { setBusy(false); }
  }
  function requestStatus(session: Appointment, status: Status, label: string) { setCancelFor(null); setAction({ session, status, label }); }
  const evolutionLink = (session: Appointment) => `/pacientes/${encodeURIComponent(session.patientId)}?aba=evolucoes&data=${session.date}`;
  const outcomeActions = (session: Appointment) => <>
    {session.patientActive && session.status === "Agendado" && <button disabled={busy} onClick={() => changeStatus(session, "Confirmado")}>Confirmar</button>}
    {session.patientActive && !finalStatus(session.status) && <>
      <button disabled={busy} onClick={() => requestStatus(session, "Realizado", "Marcar como realizado")}>Realizado</button>
      <button disabled={busy} onClick={() => requestStatus(session, "Não Compareceu", "Registrar falta")}>Falta</button>
      <span className="home-cancel-wrap"><button disabled={busy} aria-expanded={cancelFor === session.id} onClick={() => setCancelFor(cancelFor === session.id ? null : session.id)}>Cancelar</button>{cancelFor === session.id && <span className="home-cancel-options" role="group" aria-label={`Motivo do cancelamento de ${session.patientName}`}><button onClick={() => requestStatus(session, "Cancelado pelo Paciente", "Cancelar pela paciente")}>Pela paciente</button><button onClick={() => requestStatus(session, "Cancelado pela Fisio", "Cancelar pelo consultório")}>Pelo consultório</button></span>}</span>
    </>}
  </>;

  return <>
    <div className="page-heading"><div><p className="eyebrow">SEU CONSULTÓRIO HOJE</p><h1>Agenda do dia</h1><p className="muted">Atendimentos, confirmações e registros que precisam da sua atenção.</p></div><div className="home-heading-actions"><span className="date-chip"><Icon name="calendar" size={18} />{data?.today ? dateLabel(data.today) : "Hoje"}</span><Link href="/agenda?novo=1" className="primary"><Icon name="plus" size={17} /> Novo agendamento</Link></div></div>
    {notice && <div className="success-message" role="status">{notice}<button className="icon-button" onClick={() => setNotice("")} aria-label="Dispensar mensagem">×</button></div>}
    {error && <div className="agenda-alert home-error" role="alert">{error} <button className="secondary" onClick={() => load().catch(err => setError(err.message))}>Tentar novamente</button></div>}
    <section className="stats-grid home-stats" aria-label="Resumo do dia">
      <article className="stat-card"><span className="stat-icon sage"><Icon name="calendar" size={22} /></span><div><span className="stat-label">Atendimentos hoje</span><strong className="stat-value">{data?.totals.today ?? "—"}</strong><span className="stat-footnote">Todos os horários do dia</span></div></article>
      <article className="stat-card"><span className="stat-icon sand"><Icon name="clock" size={22} /></span><div><span className="stat-label">A confirmar</span><strong className="stat-value">{data?.totals.unconfirmed ?? "—"}</strong><span className="stat-footnote">Agendamentos de hoje</span></div></article>
      <article className="stat-card"><span className="stat-icon lavender"><Icon name="notes" size={22} /></span><div><span className="stat-label">Pendências recentes</span><strong className="stat-value">{data?.totals.pending ?? "—"}</strong><span className="stat-footnote">Desfechos e evoluções</span></div></article>
    </section>
    <div className="dashboard-columns home-workspace">
      <section className="panel home-schedule"><div className="section-heading"><div><h2>Atendimentos</h2><p>{data?.sessions.length ? `${data.sessions.length} registro(s) para ${dateLabel(data.today)}` : "Sua programação de hoje"}</p></div><Link className="status-tag" href="/agenda">Ver agenda completa</Link></div>
        {loading ? <div className="home-empty">Carregando agenda...</div> : !data?.sessions.length ? <div className="home-empty"><span className="home-empty-icon"><Icon name="calendar" size={28} /></span><h3>Nenhum atendimento hoje</h3><p>Use a agenda para marcar o próximo encontro.</p><Link href="/agenda?novo=1" className="secondary">Novo agendamento</Link></div> : <div className="home-appointment-list">{data.sessions.map(session => <article className="home-appointment" key={session.id}><div className="home-time"><strong>{session.time}</strong><small>{session.duration} min</small></div><div className="home-appointment-main"><div className="home-appointment-top"><div><strong>{session.patientName}</strong><small>{session.serviceName}</small></div><span className={`home-status ${statusClass(session.status)}`}>{session.status}</span></div><div className="home-appointment-actions">{outcomeActions(session)}{data.canAccessClinical && session.patientActive && session.status === "Realizado" && <Link href={evolutionLink(session)}>{session.hasEvolution ? "Ver evolução" : "+ Evolução"}</Link>}{!session.patientActive && <small>Paciente com alta ou arquivada</small>}</div></div></article>)}</div>}
      </section>
      <section className="panel home-pending"><div className="section-heading"><div><h2>Pendências</h2><p>Até 10 itens mais recentes</p></div><span className="home-pending-count">{data?.totals.pending ?? "—"}</span></div>{loading ? <div className="home-empty">Carregando pendências...</div> : !data?.pending.length ? <div className="home-empty"><span className="home-empty-icon"><Icon name="check" size={28} /></span><h3>Tudo em dia</h3><p>Não há desfechos ou evoluções pendentes.</p></div> : <div className="home-pending-list">{data.pending.map(item => <article className="home-pending-item" key={item.id}><span className={`home-pending-dot ${item.kind}`} /><div><strong>{item.patientName}</strong><p>{item.kind === "evolution" ? "Evolução não registrada" : "Atendimento sem desfecho"}</p><small>{shortDate(item.date)} às {item.time} · {item.status}</small><div className="home-pending-actions">{item.kind === "evolution" ? <Link href={evolutionLink(item)}>Registrar evolução</Link> : outcomeActions(item)}</div></div></article>)}</div>}</section>
    </div>
    <div className="home-footer-links"><Link href="/pacientes?novo=1"><Icon name="plus" size={17} /> Cadastrar paciente</Link><Link href="/prontuarios"><Icon name="notes" size={17} /> Prontuários</Link><Link href="/relatorios"><Icon name="chart" size={17} /> Relatórios</Link></div>
    <ConfirmDialog open={!!action} title={action?.label || "Atualizar atendimento"} description={action ? `${action.session.patientName} · ${shortDate(action.session.date)} às ${action.session.time}. Esta ação mudará o status para “${action.status}”.` : ""} confirmLabel={action?.label || "Confirmar"} busy={busy} onCancel={() => setAction(null)} onConfirm={() => { if (action) changeStatus(action.session, action.status); }} />
  </>;
}
