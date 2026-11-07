"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "../../components/icon";

type Outcome = "all" | "realized" | "canceled" | "missed";
type ReportRow = {
  id: string; date: string; time: string; patientId: string; patientName: string;
  status: string; duration: number; insurance: string; authorizationCode: string; serviceName: string; locationName: string;
  paymentReview: { status: "Conferido" | "Divergente"; amountCents: number | null; reviewedAt: string } | null;
};
const dateLabel = (value: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00Z`));
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const category = (status: string): Exclude<Outcome, "all"> => status === "Realizado" ? "realized" : status === "Não Compareceu" ? "missed" : "canceled";
const financialStatus = (row: ReportRow) => row.status !== "Realizado" || !row.insurance || row.insurance.toLocaleLowerCase("pt-BR") === "particular" ? "Não se aplica" : !row.authorizationCode ? "Guia pendente" : row.paymentReview?.status || "A conferir";
const csvCell = (value: string) => `"${(/^[=+\-@]/.test(value) ? `'${value}` : value).replaceAll('"', '""')}"`;

export default function ReportsPage() {
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [patientId, setPatientId] = useState("");
  const [authorizationQuery, setAuthorizationQuery] = useState("");
  const [outcome, setOutcome] = useState<Outcome>("all");
  const [paymentFilter, setPaymentFilter] = useState("");
  useEffect(() => {
    const current = today();
    setFrom(`${current.slice(0, 7)}-01`);
    const monthEnd = new Date(`${current.slice(0, 7)}-01T12:00:00Z`);
    monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1);
    monthEnd.setUTCDate(0);
    setTo(monthEnd.toISOString().slice(0, 10));
    fetch("/api/relatorios", { cache: "no-store" }).then(async response => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível carregar os relatórios.");
      setRows(result.rows);
    }).catch(cause => setError(cause instanceof Error ? cause.message : "Não foi possível carregar os relatórios.")).finally(() => setLoading(false));
  }, []);
  const patients = useMemo(() => [...new Map(rows.map(item => [item.patientId, item.patientName])).entries()].sort((a, b) => a[1].localeCompare(b[1], "pt-BR")), [rows]);
  const invalidPeriod = !!from && !!to && from > to;
  const periodRows = useMemo(() => invalidPeriod ? [] : rows.filter(item => (!from || item.date >= from) && (!to || item.date <= to) && (!patientId || item.patientId === patientId)), [rows, from, to, patientId, invalidPeriod]);
  const counts = { realized: periodRows.filter(item => category(item.status) === "realized").length, canceled: periodRows.filter(item => category(item.status) === "canceled").length, missed: periodRows.filter(item => category(item.status) === "missed").length };
  const normalizedAuthorization = authorizationQuery.trim().toLocaleLowerCase("pt-BR");
  const filtered = periodRows.filter(item => (outcome === "all" || category(item.status) === outcome) && (!normalizedAuthorization || (item.authorizationCode || "").toLocaleLowerCase("pt-BR").includes(normalizedAuthorization)) && (!paymentFilter || financialStatus(item) === paymentFilter));
  const cards: { key: Outcome; label: string; detail: string; count: number }[] = [
    { key: "all", label: "Total com desfecho", detail: "Atendimentos no período", count: periodRows.length },
    { key: "realized", label: "Realizados", detail: "Sessões concluídas", count: counts.realized },
    { key: "canceled", label: "Cancelados", detail: "Pela paciente ou pela fisio", count: counts.canceled },
    { key: "missed", label: "Faltosos", detail: "Não compareceram", count: counts.missed },
  ];
  function exportCsv() {
    const data = [["Data", "Horário", "Paciente", "Situação", "Tipo de atendimento", "Local", "Convênio", "Guia / autorização", "Conferência do pagamento", "Valor no relatório (R$)", "Duração (min)"], ...filtered.map(item => [item.date, item.time, item.patientName, item.status, item.serviceName, item.locationName, item.insurance, item.authorizationCode || "", financialStatus(item), item.paymentReview?.amountCents == null ? "" : (item.paymentReview.amountCents / 100).toFixed(2).replace(".", ","), String(item.duration)])];
    const csv = "\ufeff" + data.map(line => line.map(csvCell).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "relatorio-atendimentos.csv"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <div className="reports-page">
    <div className="page-heading"><div><p className="eyebrow">VISÃO DOS ATENDIMENTOS</p><h1>Relatórios</h1><p className="muted">Acompanhe sessões realizadas, cancelamentos e faltas.</p></div><button type="button" className="secondary" disabled={loading || invalidPeriod || filtered.length === 0} onClick={exportCsv}><Icon name="notes" size={17} /> Exportar CSV</button></div>
    <section className="panel reports-filters" aria-label="Filtros do relatório"><div className="reports-filter-heading"><h2>Filtrar atendimentos</h2><button type="button" onClick={() => { setFrom(""); setTo(""); setPatientId(""); setAuthorizationQuery(""); setOutcome("all"); setPaymentFilter(""); }}>Ver todo o histórico</button></div><div className="reports-filter-grid"><label>De<input type="date" value={from} onChange={event => setFrom(event.target.value)} /></label><label>Até<input type="date" value={to} onChange={event => setTo(event.target.value)} /></label><label>Paciente<select value={patientId} onChange={event => setPatientId(event.target.value)}><option value="">Todas as pacientes</option>{patients.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label><label>Tipo<select value={outcome} onChange={event => setOutcome(event.target.value as Outcome)}><option value="all">Todos</option><option value="realized">Realizados</option><option value="canceled">Cancelados</option><option value="missed">Faltosos</option></select></label></div><label className="reports-authorization-filter">Conferência do pagamento<select value={paymentFilter} onChange={event => setPaymentFilter(event.target.value)}><option value="">Todas as situações</option><option value="Guia pendente">Guia pendente</option><option value="A conferir">A conferir</option><option value="Conferido">Conferido</option><option value="Divergente">Divergente</option><option value="Não se aplica">Não se aplica</option></select></label><label className="reports-authorization-filter">Guia / autorização<input type="search" value={authorizationQuery} onChange={event => setAuthorizationQuery(event.target.value)} placeholder="Buscar número da guia ou senha" /></label>{invalidPeriod && <p className="form-error" role="alert">A data inicial precisa ser anterior à data final.</p>}</section>
    {error && <p className="form-error" role="alert">{error}</p>}
    <section className="reports-metrics" aria-label="Totais por situação">{cards.map(card => <button key={card.key} type="button" className={`panel reports-metric reports-metric-${card.key}${outcome === card.key ? " selected" : ""}`} aria-pressed={outcome === card.key} onClick={() => setOutcome(card.key)}><span>{card.label}</span><strong>{loading ? "—" : card.count}</strong><small>{card.detail}</small></button>)}</section>
    <section className="panel reports-results"><div className="reports-results-heading"><div><h2>Atendimentos</h2><p className="muted">{loading ? "Carregando..." : `${filtered.length} ${filtered.length === 1 ? "registro encontrado" : "registros encontrados"}`}</p></div><span className="reports-filter-active">{cards.find(card => card.key === outcome)?.label}</span></div>{loading ? <div className="reports-empty" role="status">Carregando atendimentos...</div> : filtered.length ? <div className="reports-list">{filtered.map(item => <article className="reports-row" key={item.id}><div className="reports-date"><strong>{dateLabel(item.date)}</strong><small>{item.time}</small></div><div className="reports-patient"><Link href={`/pacientes/${encodeURIComponent(item.patientId)}`}>{item.patientName}</Link><small>{[item.serviceName, item.locationName, item.insurance].filter(Boolean).join(" · ") || `${item.duration} min`}</small>{item.authorizationCode && <small className="reports-authorization-code">Guia / autorização: {item.authorizationCode}</small>}{financialStatus(item) !== "Não se aplica" && <small className={`reports-payment-status reports-payment-${financialStatus(item) === "Conferido" ? "checked" : financialStatus(item) === "Divergente" ? "divergent" : "pending"}`}>Pagamento: {financialStatus(item)}{item.paymentReview?.amountCents == null ? "" : ` · R$ ${(item.paymentReview.amountCents / 100).toFixed(2).replace(".", ",")}`}</small>}{financialStatus(item) !== "Não se aplica" && <Link className="reports-agenda-link" href={`/agenda?data=${item.date}&atendimento=${item.id}`}>Conferir na agenda →</Link>}</div><span className={`reports-status reports-status-${category(item.status)}`}>{item.status}</span></article>)}</div> : <div className="reports-empty"><Icon name="chart" size={29} /><h3>Nenhum atendimento encontrado</h3><p>Revise o período ou selecione outra situação.</p></div>}</section>
  </div>;
}
