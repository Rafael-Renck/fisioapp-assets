"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Icon } from "./icon";
import type { AnamnesisData, ClinicalEntry, EvolutionData, Location, Patient, Service, Session, TreatmentPlanData } from "../lib/store";

type RecordData = { patient: Patient; entries: ClinicalEntry[]; appointments: Session[]; locations: Location[]; services: Service[] };
type Tab = "overview" | "anamnesis" | "evolutions" | "plan";
type AnamnesisEntry = Extract<ClinicalEntry, { kind: "anamnesis" }>;
type EvolutionEntry = Extract<ClinicalEntry, { kind: "evolution" }>;
type PlanEntry = Extract<ClinicalEntry, { kind: "plan" }>;
const tabs: { key: Tab; label: string }[] = [
  { key: "overview", label: "Visão geral" }, { key: "anamnesis", label: "Anamnese" },
  { key: "evolutions", label: "Evoluções" }, { key: "plan", label: "Plano de tratamento" },
];
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const dateLabel = (value: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", day: "2-digit", month: "long", year: "numeric" }).format(new Date(`${value}T12:00:00Z`));
const timestampLabel = (value: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(value));
const recordLabel = (entry: ClinicalEntry) => entry.kind === "anamnesis" ? "Anamnese" : entry.kind === "evolution" ? "Evolução" : "Plano de tratamento";
const text = (form: FormData, name: string) => String(form.get(name) || "").trim();
const emptyIntervention = () => ({ description: "", frequency: "", dosage: "" });

export function PatientRecord({ id }: { id: string }) {
  const [record, setRecord] = useState<RecordData | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [interventions, setInterventions] = useState<TreatmentPlanData["interventions"]>([emptyIntervention()]);

  const load = useCallback(async () => {
    const response = await fetch(`/api/patients/${encodeURIComponent(id)}/record`, { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Não foi possível carregar o prontuário.");
    const next = result as RecordData;
    setRecord(next);
    const currentPlan = next.entries.find((entry): entry is PlanEntry => entry.kind === "plan");
    setInterventions(currentPlan?.data.interventions.length ? currentPlan.data.interventions : [emptyIntervention()]);
    setError("");
  }, [id]);
  useEffect(() => { load().catch(cause => setError(cause instanceof Error ? cause.message : "Erro ao carregar.")); }, [load]);

  async function save(kind: ClinicalEntry["kind"], data: AnamnesisData | EvolutionData | TreatmentPlanData) {
    setBusy(true); setNotice("");
    try {
      const response = await fetch(`/api/patients/${encodeURIComponent(id)}/record`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, data }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível salvar.");
      await load();
      setNotice(kind === "evolution" ? "Evolução registrada." : kind === "anamnesis" ? "Anamnese salva. A versão anterior foi preservada." : "Plano salvo. A versão anterior foi preservada.");
      return true;
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "Não foi possível salvar."); return false; }
    finally { setBusy(false); }
  }

  if (error) return <section className="panel record-empty"><h1>Prontuário indisponível</h1><p>{error}</p><Link className="secondary" href="/pacientes">Voltar aos pacientes</Link></section>;
  if (!record) return <div className="record-loading" role="status">Carregando prontuário...</div>;

  const { patient, appointments, entries } = record;
  const anamneses = entries.filter((entry): entry is AnamnesisEntry => entry.kind === "anamnesis");
  const evolutions = entries.filter((entry): entry is EvolutionEntry => entry.kind === "evolution");
  const plans = entries.filter((entry): entry is PlanEntry => entry.kind === "plan");
  const anamnesis = anamneses[0], plan = plans[0];
  const archived = patient.status === "Arquivado";
  const upcoming = appointments.filter(item => item.date >= today() && !item.status.startsWith("Cancelado") && item.status !== "Não Compareceu").length;

  function submitAnamnesis(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    save("anamnesis", { chiefComplaint: text(form, "chiefComplaint"), currentHistory: text(form, "currentHistory"), pastHistory: text(form, "pastHistory"), medications: text(form, "medications"), physicalExam: text(form, "physicalExam"), goals: text(form, "goals"), proposedTreatment: text(form, "proposedTreatment"), bodyRegions: text(form, "bodyRegions") });
  }
  async function submitEvolution(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget, values = new FormData(form);
    if (await save("evolution", { date: text(values, "date"), description: text(values, "description") })) form.reset();
  }
  function submitPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    save("plan", {
      diagnosis: text(form, "diagnosis"), startDate: text(form, "startDate"), reviewDate: text(form, "reviewDate"),
      status: text(form, "status") as TreatmentPlanData["status"],
      goals: text(form, "goals").split("\n").map(line => line.trim()).filter(Boolean),
      interventions: interventions.map(item => ({ description: item.description.trim(), frequency: item.frequency.trim(), dosage: item.dosage.trim() })).filter(item => item.description || item.frequency || item.dosage),
    });
  }

  return <div className="record-page">
    <Link href="/pacientes" className="record-back"><Icon name="arrow" size={16} /> Pacientes</Link>
    <header className="panel record-hero"><span className="record-avatar">{patient.name.split(/\s+/).slice(0, 2).map(part => part[0]).join("").toLocaleUpperCase("pt-BR")}</span><div className="record-hero-copy"><p className="eyebrow">PRONTUÁRIO DO PACIENTE</p><h1>{patient.name}</h1><p>{patient.id} {patient.careType && patient.careType !== "Default" ? `· ${patient.careType}` : ""}</p></div><span className={`record-status ${archived ? "archived" : ""}`}>{archived ? "Arquivado" : "Ativo"}</span></header>
    <div className="record-tabs" role="tablist" aria-label="Seções do prontuário">{tabs.map(item => <button key={item.key} type="button" role="tab" aria-selected={tab === item.key} className={tab === item.key ? "selected" : ""} onClick={() => { setTab(item.key); setNotice(""); }}>{item.label}</button>)}</div>
    {notice && <div className="success-message record-notice" role="status"><Icon name="check" size={17} />{notice}<button className="icon-button" onClick={() => setNotice("")} aria-label="Fechar aviso"><Icon name="close" size={15} /></button></div>}
    {archived && tab !== "overview" && <p className="agenda-alert">Paciente arquivado. O prontuário está disponível para consulta; reative o cadastro para adicionar registros.</p>}

    {tab === "overview" && <div className="record-overview">
      <section className="panel record-panel"><div className="record-panel-heading"><h2>Resumo clínico</h2><span>Atualizado conforme os registros</span></div><div className="record-facts"><div><small>Queixa principal</small><strong>{anamnesis?.data.chiefComplaint || "Ainda não informada"}</strong></div><div><small>Diagnóstico fisioterapêutico</small><strong>{plan?.data.diagnosis || "Plano ainda não cadastrado"}</strong></div><div><small>Última evolução</small><strong>{evolutions[0] ? dateLabel(evolutions[0].data.date) : "Nenhuma evolução"}</strong></div><div><small>Próximos atendimentos</small><strong>{upcoming}</strong></div></div></section>
      <section className="panel record-panel"><div className="record-panel-heading"><h2>Dados do paciente</h2><Link href="/pacientes">Editar cadastro</Link></div><dl className="record-details"><div><dt>Telefone</dt><dd>{patient.phone || "Não informado"}</dd></div><div><dt>E-mail</dt><dd>{patient.email || "Não informado"}</dd></div><div><dt>Convênio</dt><dd>{patient.insurance || "Particular"}</dd></div><div><dt>Nascimento</dt><dd>{patient.birthDate ? dateLabel(patient.birthDate) : "Não informado"}</dd></div>{patient.pregnant && <div><dt>DPP</dt><dd>{patient.dueDate ? dateLabel(patient.dueDate) : "Não informada"}</dd></div>}{patient.referringDoctor && <div><dt>Médico indicador</dt><dd>{patient.referringDoctor}</dd></div>}</dl>{patient.notes && <p className="record-patient-notes">{patient.notes}</p>}</section>
      <section className="panel record-panel"><div className="record-panel-heading"><h2>Atendimentos</h2><Link href="/agenda">Abrir agenda</Link></div>{appointments.length ? <div className="record-appointment-list">{appointments.slice(0, 8).map(item => <div key={item.id}><strong>{dateLabel(item.date)} · {item.time}</strong><span>{item.status}{item.serviceId ? ` · ${record.services.find(service => service.id === item.serviceId)?.name || "Atendimento"}` : ""}{item.locationId ? ` · ${record.locations.find(location => location.id === item.locationId)?.name || "Local"}` : ""}</span></div>)}</div> : <p className="muted">Nenhum atendimento registrado para este paciente.</p>}</section>
      <section className="panel record-panel"><div className="record-panel-heading"><h2>Histórico do prontuário</h2><span>{entries.length} registro(s)</span></div>{entries.length ? <div className="record-timeline">{entries.slice(0, 12).map(item => <div key={item.id}><span className="record-timeline-dot" /><div><strong>{recordLabel(item)}</strong><small>{timestampLabel(item.createdAt)}</small></div></div>)}</div> : <p className="muted">Comece pela anamnese ou registre a primeira evolução.</p>}</section>
    </div>}

    {tab === "anamnesis" && <section className="panel record-panel record-editor"><div className="record-panel-heading"><div><h2>Anamnese</h2><p>{anamnesis ? `Última versão: ${timestampLabel(anamnesis.createdAt)}` : "Registre a avaliação inicial do paciente."}</p></div></div><form key={anamnesis?.id || "new"} className="record-form" onSubmit={submitAnamnesis}><label>Queixa principal <span>*</span><textarea name="chiefComplaint" required maxLength={5000} rows={3} defaultValue={anamnesis?.data.chiefComplaint || ""} /></label><label>História da condição atual<textarea name="currentHistory" maxLength={5000} rows={4} defaultValue={anamnesis?.data.currentHistory || ""} /></label><label>História pregressa<textarea name="pastHistory" maxLength={5000} rows={3} defaultValue={anamnesis?.data.pastHistory || ""} /></label><label>Medicamentos<textarea name="medications" maxLength={5000} rows={2} defaultValue={anamnesis?.data.medications || ""} /></label><label>Exame físico<textarea name="physicalExam" maxLength={5000} rows={4} defaultValue={anamnesis?.data.physicalExam || ""} /></label><label>Partes do corpo envolvidas<textarea name="bodyRegions" maxLength={5000} rows={2} defaultValue={anamnesis?.data.bodyRegions || ""} /></label><label>Objetivos<textarea name="goals" maxLength={5000} rows={3} defaultValue={anamnesis?.data.goals || ""} /></label><label>Plano de tratamento proposto<textarea name="proposedTreatment" maxLength={5000} rows={3} defaultValue={anamnesis?.data.proposedTreatment || ""} /></label><div className="record-form-actions"><small>Salvar cria uma nova versão e preserva as anteriores.</small><button className="primary" disabled={busy || archived}>{busy ? "Salvando..." : "Salvar anamnese"}</button></div></form>{anamneses.length > 1 && <details className="record-versions"><summary>Ver versões anteriores ({anamneses.length - 1})</summary>{anamneses.slice(1).map(entry => <article key={entry.id}><strong>{timestampLabel(entry.createdAt)}</strong><p>Queixa principal: {entry.data.chiefComplaint}</p><p>História atual: {entry.data.currentHistory || "—"}</p><p>História pregressa: {entry.data.pastHistory || "—"}</p><p>Medicamentos: {entry.data.medications || "—"}</p><p>Exame físico: {entry.data.physicalExam || "—"}</p><p>Partes do corpo: {entry.data.bodyRegions || "—"}</p><p>Objetivos: {entry.data.goals || "—"}</p><p>Plano proposto: {entry.data.proposedTreatment || "—"}</p></article>)}</details>}</section>}

    {tab === "evolutions" && <div className="record-evolutions"><section className="panel record-panel record-editor"><div className="record-panel-heading"><div><h2>Nova evolução</h2><p>Descreva a sessão e a resposta do paciente.</p></div></div><form className="record-form" onSubmit={submitEvolution}><label>Data do atendimento <span>*</span><input name="date" type="date" required defaultValue={today()} /></label><label>Descrição da evolução <span>*</span><textarea name="description" required maxLength={10000} rows={7} placeholder="Registre observações, intervenções e resposta ao tratamento." /></label><div className="record-form-actions"><small>O registro será preservado com data e hora de criação.</small><button className="primary" disabled={busy || archived}>{busy ? "Salvando..." : "Registrar evolução"}</button></div></form></section><section className="record-evolution-list"><h2>Histórico de evoluções <span>{evolutions.length}</span></h2>{evolutions.length ? evolutions.map(entry => <article className="panel record-evolution-card" key={entry.id}><div><strong>{dateLabel(entry.data.date)}</strong><small>Registrado em {timestampLabel(entry.createdAt)}</small></div><p>{entry.data.description}</p></article>) : <div className="panel record-empty"><p>Nenhuma evolução registrada.</p></div>}</section></div>}

    {tab === "plan" && <section className="panel record-panel record-editor"><div className="record-panel-heading"><div><h2>Plano de tratamento</h2><p>{plan ? `Última versão: ${timestampLabel(plan.createdAt)}` : "Defina diagnóstico, metas e intervenções."}</p></div></div><form key={plan?.id || "new"} className="record-form" onSubmit={submitPlan}><label>Diagnóstico fisioterapêutico <span>*</span><textarea name="diagnosis" required maxLength={5000} rows={3} defaultValue={plan?.data.diagnosis || ""} /></label><div className="record-form-row"><label>Início <span>*</span><input name="startDate" type="date" required defaultValue={plan?.data.startDate || today()} /></label><label>Reavaliação<input name="reviewDate" type="date" defaultValue={plan?.data.reviewDate || ""} /></label><label>Estado<select name="status" defaultValue={plan?.data.status || "Ativo"}><option>Ativo</option><option>Pausado</option><option>Concluído</option></select></label></div><label>Metas <small>Uma por linha</small><textarea name="goals" maxLength={16000} rows={4} defaultValue={plan?.data.goals.join("\n") || ""} /></label><div className="record-interventions"><div className="record-panel-heading"><h3>Intervenções</h3><button type="button" className="secondary" onClick={() => setInterventions(current => [...current, emptyIntervention()])} disabled={archived}>+ Adicionar</button></div>{interventions.map((item, index) => <div className="record-intervention-row" key={index}><label>Intervenção<input value={item.description} maxLength={500} onChange={event => setInterventions(current => current.map((value, i) => i === index ? { ...value, description: event.target.value } : value))} /></label><label>Frequência<input value={item.frequency} maxLength={120} placeholder="2x/semana" onChange={event => setInterventions(current => current.map((value, i) => i === index ? { ...value, frequency: event.target.value } : value))} /></label><label>Séries e repetições<input value={item.dosage} maxLength={120} placeholder="3 x 10" onChange={event => setInterventions(current => current.map((value, i) => i === index ? { ...value, dosage: event.target.value } : value))} /></label><button type="button" className="icon-button" aria-label={`Remover intervenção ${index + 1}`} onClick={() => setInterventions(current => current.length === 1 ? [emptyIntervention()] : current.filter((_, i) => i !== index))} disabled={archived}><Icon name="close" size={17} /></button></div>)}</div><div className="record-form-actions"><small>Salvar cria uma nova versão e preserva as anteriores.</small><button className="primary" disabled={busy || archived}>{busy ? "Salvando..." : "Salvar plano"}</button></div></form>{plans.length > 1 && <details className="record-versions"><summary>Ver versões anteriores ({plans.length - 1})</summary>{plans.slice(1).map(entry => <article key={entry.id}><strong>{timestampLabel(entry.createdAt)} · {entry.data.status}</strong><p>Diagnóstico: {entry.data.diagnosis}</p><p>Metas: {entry.data.goals.join("; ") || "—"}</p><p>Intervenções: {entry.data.interventions.map(item => `${item.description} (${item.frequency}; ${item.dosage})`).join("; ") || "—"}</p></article>)}</details>}</section>}
  </div>;
}
