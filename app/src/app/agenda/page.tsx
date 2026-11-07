"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { usePatients } from "../../components/patients-provider";
import { PatientFields, patientFromForm } from "../../components/patient-fields";
import type { Block, Config, Location, Service, Session, Status } from "../../lib/store";

const weekdayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const statuses: Status[] = ["Agendado", "Confirmado", "Realizado", "Cancelado pelo Paciente", "Cancelado pela Fisio", "Não Compareceu"];
const statusStyles: Record<Status, string> = {
  Agendado: "status-agendado",
  Confirmado: "status-confirmado",
  Realizado: "status-realizado",
  "Cancelado pelo Paciente": "status-cancelado-paciente",
  "Cancelado pela Fisio": "status-cancelado-fisio",
  "Não Compareceu": "status-faltou",
};
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const addDays = (date: string, n: number) => { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const dayOf = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();
const minute = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
const clock = (n: number) => `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
const labelDate = (date: string) => new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
const isInsurance = (session: Session) => !!session.insurance && session.insurance.trim().toLocaleLowerCase("pt-BR") !== "particular";
function paymentLabel(session: Session) {
  if (!isInsurance(session) || session.status.startsWith("Cancelado") || session.status === "Não Compareceu") return "";
  if (!session.authorizationCode?.trim()) return "Guia pendente";
  if (session.status !== "Realizado") return "";
  return session.paymentReview?.status || "Pagamento a conferir";
}
function gestationalAge(dueDate: string | undefined, appointmentDate: string) {
  if (!dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return null;
  const due = Date.parse(`${dueDate}T12:00:00Z`);
  const appointment = Date.parse(`${appointmentDate}T12:00:00Z`);
  if (!Number.isFinite(due) || !Number.isFinite(appointment)) return null;
  const days = 280 - Math.round((due - appointment) / 86_400_000);
  if (days < 0) return null;
  return `${Math.floor(days / 7)} semanas e ${days % 7} ${days % 7 === 1 ? "dia" : "dias"}`;
}

type Data = { sessions: Session[]; blocks: Block[]; config: Config; locations: Location[]; services: Service[]; insurances: string[] };

export default function AgendaPage() {
  const { patients, addPatient } = usePatients();
  const [date, setDate] = useState(today);
  const [data, setData] = useState<Data | null>(null);
  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState<"agenda" | "bloqueios" | "config">("agenda");
  const [canConfigure, setCanConfigure] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [patientView, setPatientView] = useState(false);
  const [patientId, setPatientId] = useState("");
  const [bookingInsurance, setBookingInsurance] = useState("");
  const [patientFieldsVersion, setPatientFieldsVersion] = useState(0);
  const [modalNotice, setModalNotice] = useState("");
  const bookingDialog = useRef<HTMLDialogElement>(null);
  const bookingTrigger = useRef<HTMLButtonElement>(null);
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [selected, setSelected] = useState<Session | null>(null);
  const [authorizationCode, setAuthorizationCode] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const load = useCallback(async () => { const response = await fetch("/api/agenda", { cache: "no-store" }); if (!response.ok) throw new Error("Não foi possível carregar a agenda."); const result = await response.json() as Data; setData(result); return result; }, []);
  useEffect(() => { load().then(result => { const params = new URLSearchParams(location.search); const targetDate = params.get("data"); if (targetDate && /^\d{4}-\d{2}-\d{2}$/.test(targetDate)) setDate(targetDate); const target = result.sessions.find(session => session.id === params.get("atendimento")); if (target) { setDate(target.date); setSelected(target); setAuthorizationCode(target.authorizationCode || ""); setEditDate(target.date); setEditTime(target.time); } }).catch(() => setNotice("Não foi possível carregar a agenda.")); }, [load]);
  useEffect(() => { fetch("/api/auth/me").then(response => response.ok ? response.json() : null).then(user => setCanConfigure(user?.role === "owner" || user?.role === "physio" || user?.role === "admin")).catch(() => undefined); }, []);
  useEffect(() => { if (new URLSearchParams(location.search).get("novo") === "1") setShowForm(true); }, []);
  useEffect(() => { const dialog = bookingDialog.current; if (!dialog) return; if (showForm && !dialog.open) dialog.showModal(); else if (!showForm && dialog.open) dialog.close(); }, [showForm]);
  function closeBooking() { setShowForm(false); setPatientView(false); setPatientId(""); setBookingInsurance(""); setModalNotice(""); bookingTrigger.current?.focus(); }
  async function registerPatient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget; const fields = new FormData(form);
    try {
      const patient = await addPatient(patientFromForm(fields));
      setPatientId(patient.id); setBookingInsurance(patient.insurance && data?.insurances.includes(patient.insurance) ? patient.insurance : ""); setPatientView(false); setModalNotice(`${patient.name} cadastrado. Continue o agendamento.`); form.reset(); setPatientFieldsVersion(version => version + 1);
    } catch (error) { setModalNotice(error instanceof Error ? error.message : "Não foi possível cadastrar o paciente."); }
  }
  async function send(body: Record<string, unknown>, success: string, onError: (message: string) => void = setNotice) {
    try {
      const response = await fetch("/api/agenda", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível salvar.");
      await load(); setNotice(success); return true;
    } catch (error) { onError(error instanceof Error ? error.message : "Erro inesperado."); return false; }
  }
  async function confirmSession(session: Session) {
    if (confirmingId) return;
    setConfirmingId(session.id);
    try { await send({ action: "status", id: session.id, status: "Confirmado" }, "Atendimento confirmado."); }
    finally { setConfirmingId(null); }
  }
  async function book(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const fields = new FormData(form);
    const count = Number(fields.get("count"));
    const ok = await send({ action: "book", patientId: fields.get("patientId"), locationId: fields.get("locationId"), serviceId: fields.get("serviceId"), insurance: fields.get("insurance"), authorizationCode: fields.get("authorizationCode"), date: fields.get("date"), time: fields.get("time"), notes: fields.get("notes"), count, weekdays: count > 1 ? weekdays : [] }, count > 1 ? `${count} sessões criadas.` : "Agendamento criado.", setModalNotice);
    if (ok) { closeBooking(); form.reset(); setWeekdays([]); setPatientId(""); setBookingInsurance(""); setDate(String(fields.get("date"))); }
  }
  async function block(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const fields = new FormData(form);
    if (await send({ action: "block", date: fields.get("date"), start: fields.get("start"), end: fields.get("end"), reason: fields.get("reason") }, "Período bloqueado.")) form.reset();
  }
  async function saveConfig(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!data) return;
    await send({ action: "config", config: data.config }, "Configuração salva. Sessões existentes permanecem visíveis.");
  }
  const config = data?.config;
  const sessions = data?.sessions.filter(s => s.date === date).sort((a, b) => a.time.localeCompare(b.time)) || [];
  const guidePending = sessions.filter(s => isInsurance(s) && !s.authorizationCode?.trim() && !s.status.startsWith("Cancelado") && s.status !== "Não Compareceu");
  const paymentPending = sessions.filter(s => isInsurance(s) && s.status === "Realizado" && !!s.authorizationCode?.trim() && !s.paymentReview);
  const blocks = data?.blocks.filter(b => b.date === date).sort((a, b) => a.start.localeCompare(b.start)) || [];
  const day = config?.days[dayOf(date)];
  const slots: string[] = [];
  if (day?.active) for (let n = minute(day.start); n + config!.duration <= minute(day.end); n += config!.duration) slots.push(clock(n));
  const otherTimes = [...new Set(sessions.filter(s => !slots.includes(s.time)).map(s => s.time))];
  const allTimes = [...new Set([...slots, ...otherTimes])].sort();
  const weekStart = addDays(date, -((dayOf(date) + 6) % 7));
  function placesFor(targetDate: string) {
    const scheduled = data?.sessions.filter(session => session.date === targetDate && !session.status.startsWith("Cancelado")) || [];
    const ids = [...new Set(scheduled.map(session => session.locationId).filter((id): id is string => !!id))];
    const places = ids.map(id => data?.locations.find(location => location.id === id)).filter((location): location is Location => !!location);
    const unspecified = scheduled.some(session => !session.locationId || !data?.locations.some(location => location.id === session.locationId));
    return { places, unspecified, count: scheduled.length };
  }
  const dailyPlaces = placesFor(date);
  return <>
    <div className="page-heading"><div><p className="eyebrow">ORGANIZAÇÃO DO CUIDADO</p><h1>Agenda</h1><p className="muted">Horários no fuso de São Paulo · {config?.capacity || 5} pacientes por horário</p></div><button ref={bookingTrigger} className="primary" onClick={() => { setShowForm(true); setPatientView(false); setModalNotice(""); setTab("agenda"); load().catch(() => setModalNotice("Não foi possível atualizar as opções de agendamento.")); }}>+ Novo agendamento</button></div>
    {notice && <div className="success-message" role="status">{notice}<button className="icon-button" onClick={() => setNotice("")} aria-label="Dispensar">×</button></div>}
    <div className="agenda-tabs"><button className={tab === "agenda" ? "selected" : ""} onClick={() => setTab("agenda")}>Agenda diária</button><button className={tab === "bloqueios" ? "selected" : ""} onClick={() => setTab("bloqueios")}>Bloqueios</button>{canConfigure && <button className={tab === "config" ? "selected" : ""} onClick={() => setTab("config")}>Configuração</button>}</div>
    {tab !== "config" && <section className="panel agenda-navigation"><div className="agenda-date-row"><button className="secondary" onClick={() => setDate(addDays(date, -1))} aria-label="Dia anterior">‹</button><input aria-label="Data da agenda" type="date" value={date} onChange={e => setDate(e.target.value)} /><button className="secondary" onClick={() => setDate(addDays(date, 1))} aria-label="Dia seguinte">›</button><button className="secondary" onClick={() => setDate(today())}>Hoje</button></div><h2>{labelDate(date)}</h2><div className="week-strip">{Array.from({ length: 7 }, (_, i) => { const value = addDays(weekStart, i); const summary = placesFor(value); return <button key={value} className={value === date ? "selected" : ""} onClick={() => setDate(value)} title={summary.places.map(place => place.name).join(" · ") || (summary.count ? "Local não informado" : "Sem atendimentos")}><span>{weekdayNames[dayOf(value)]}</span><strong>{value.slice(8)}</strong><i className={summary.places.length > 1 || summary.unspecified ? "agenda-place-dot multiple" : summary.count ? "agenda-place-dot" : "agenda-place-dot empty"} aria-hidden="true" /></button>; })}</div><div className="agenda-day-places"><span className="agenda-day-places-label">Local de atendimento no dia</span>{dailyPlaces.places.length ? <div className="agenda-day-places-list">{dailyPlaces.places.map(place => <div key={place.id} className="agenda-day-place"><strong>{place.name}</strong>{place.address && <small>{place.address}</small>}</div>)}{dailyPlaces.unspecified && <div className="agenda-day-place unspecified"><strong>Há atendimento sem local informado</strong></div>}</div> : <p>{dailyPlaces.count ? "Há atendimentos sem local informado." : "Sem atendimentos agendados; local ainda não definido."}</p>}</div></section>}
    {tab === "agenda" && <>
      <section className="panel daily-grid"><div className="section-heading"><div><h2>Atendimentos do dia</h2><p>{sessions.length} sessão(ões) · {blocks.length} bloqueio(s)</p></div></div>{!day?.active && <p className="agenda-alert">Dia sem expediente configurado. Sessões já registradas continuam visíveis.</p>}{!allTimes.length ? <div className="patients-empty"><h2>Sem horários neste dia</h2><p>Escolha outro dia ou ajuste o expediente.</p></div> : allTimes.map(time => { const at = sessions.filter(s => s.time === time); const n = minute(time); const blocked = blocks.filter(b => n < minute(b.end) && n + (config?.duration || 60) > minute(b.start)); return <div className="time-row" key={time}><strong>{time}</strong><div><small>{at.filter(s => !s.status.startsWith("Cancelado") && s.status !== "Não Compareceu").length}/{config?.capacity} vagas ocupadas</small>{blocked.map(b => <div className="block-pill" key={b.id}>Bloqueado · {b.reason}</div>)}{at.map(s => <div className="agenda-session-entry" key={s.id}><button className={`session-card ${statusStyles[s.status]}`} onClick={() => { setSelected(s); setAuthorizationCode(s.authorizationCode || ""); setEditDate(s.date); setEditTime(s.time); }}><span className="agenda-session-patient"><span>{patients.find(p => p.id === s.patientId)?.name || "Paciente não encontrado"}</span>{patients.find(p => p.id === s.patientId)?.pregnant && <span className="agenda-pregnancy-badge" title="Idade gestacional estimada pela data provável do parto na data do atendimento">{gestationalAge(patients.find(p => p.id === s.patientId)?.dueDate, s.date) ? `IG estimada · ${gestationalAge(patients.find(p => p.id === s.patientId)?.dueDate, s.date)}` : "Gestante · DPP não informada"}</span>}</span><small>{s.status}{s.serviceId ? ` · ${data?.services.find(item => item.id === s.serviceId)?.name || "Atendimento"}` : ""}{s.locationId ? ` · ${data?.locations.find(item => item.id === s.locationId)?.name || "Local"}` : ""}{s.recurrenceId ? " · Recorrência" : ""}{s.insurance ? ` · ${s.insurance}` : ""}</small>{paymentLabel(s) && <span className={`agenda-finance-badge ${paymentLabel(s) === "Guia pendente" ? "missing" : paymentLabel(s) === "Conferido" ? "checked" : paymentLabel(s) === "Divergente" ? "divergent" : "pending"}`}>{paymentLabel(s)}</span>}</button><div className="agenda-row-actions">{s.status === "Agendado" && patients.some(p => p.id === s.patientId && p.status !== "Arquivado" && p.status !== "Alta") && <button type="button" className="agenda-confirm-button" disabled={!!confirmingId} onClick={() => void confirmSession(s)}>{confirmingId === s.id ? "Confirmando..." : "Confirmar"}</button>}{patients.some(p => p.id === s.patientId && p.status !== "Arquivado" && p.status !== "Alta") && <Link className="agenda-evolution-link" href={`/pacientes/${encodeURIComponent(s.patientId)}?aba=evolucoes&data=${s.date}`}>+ Cadastrar evolução</Link>}</div></div>)}</div></div>; })}</section>
      {(guidePending.length > 0 || paymentPending.length > 0) && <section className="panel agenda-finance-panel" aria-label="Pendências de guia e pagamento"><div className="section-heading"><div><h2>Guia e pagamento</h2><p>Confira os atendimentos de convênio deste dia.</p></div></div><div className="agenda-finance-pending">{guidePending.length > 0 && <p><strong>{guidePending.length} {guidePending.length === 1 ? "guia pendente" : "guias pendentes"}</strong> · preencha a guia ou senha para relacionar o atendimento ao relatório de pagamento.</p>}{paymentPending.length > 0 && <p><strong>{paymentPending.length} {paymentPending.length === 1 ? "pagamento a conferir" : "pagamentos a conferir"}</strong> · compare com o PDF recebido da fisio e registre o resultado no atendimento.</p>}</div></section>}
    </>}
    {tab === "bloqueios" && <div className="agenda-two-column"><section className="panel agenda-form"><h2>Bloquear período</h2><form onSubmit={block}><label>Data<input name="date" type="date" required defaultValue={date} /></label><div className="form-grid"><label>Início<input name="start" type="time" required defaultValue="07:00" /></label><label>Fim<input name="end" type="time" required defaultValue="08:00" /></label></div><label>Motivo<input name="reason" required maxLength={300} /></label><div className="form-actions"><button className="primary">Adicionar bloqueio</button></div></form></section><section className="panel agenda-form"><h2>Bloqueios de {date.split("-").reverse().join("/")}</h2>{blocks.length ? blocks.map(b => <div className="block-list" key={b.id}><span><strong>{b.start}–{b.end}</strong><br />{b.reason}</span><button className="secondary" onClick={() => send({ action: "unblock", id: b.id }, "Bloqueio removido.")}>Remover</button></div>) : <p className="muted">Nenhum bloqueio nesta data.</p>}</section></div>}
    {tab === "config" && config && <section className="panel agenda-form"><h2>Expediente e capacidade</h2><p className="muted">Alterações valem para novos agendamentos. Sessões já criadas permanecem registradas.</p><form onSubmit={saveConfig}><div className="config-days">{config.days.map((d, i) => <div className="config-day" key={i}><label><input type="checkbox" checked={d.active} onChange={e => setData(current => current && ({ ...current, config: { ...current.config, days: current.config.days.map((day, index) => index === i ? { ...day, active: e.target.checked } : day) } }))} /> {weekdayNames[i]}</label><input aria-label={`Início ${weekdayNames[i]}`} type="time" value={d.start} onChange={e => setData(current => current && ({ ...current, config: { ...current.config, days: current.config.days.map((day, index) => index === i ? { ...day, start: e.target.value } : day) } }))} /><input aria-label={`Fim ${weekdayNames[i]}`} type="time" value={d.end} onChange={e => setData(current => current && ({ ...current, config: { ...current.config, days: current.config.days.map((day, index) => index === i ? { ...day, end: e.target.value } : day) } }))} /></div>)}</div><div className="form-grid"><label>Duração da sessão (minutos)<input type="number" min="15" max="480" value={config.duration} onChange={e => setData({ ...data, config: { ...config, duration: Number(e.target.value) } })} /></label><label>Capacidade por horário<input type="number" min="1" max="100" value={config.capacity} onChange={e => setData({ ...data, config: { ...config, capacity: Number(e.target.value) } })} /></label></div><div className="form-actions"><button className="primary">Salvar configuração</button></div></form></section>}
    <dialog ref={bookingDialog} className="booking-dialog" aria-labelledby="booking-title" onCancel={closeBooking} onClose={() => { setShowForm(false); setPatientView(false); }} onClick={event => { if (event.target === event.currentTarget) closeBooking(); }}>
      <div className="modal-heading"><div><p className="eyebrow">AGENDA</p><h2 id="booking-title">{patientView ? "Cadastrar paciente" : "Novo agendamento"}</h2></div><button type="button" className="icon-button" aria-label="Fechar" onClick={closeBooking}>×</button></div>
      <div className="booking-dialog-content">
        {modalNotice && <p className="booking-notice" role="status">{modalNotice}</p>}
        <div hidden={patientView}>
          <form key={date} onSubmit={book} className="booking-form"><div className="form-grid"><label>Paciente<select name="patientId" required value={patientId} onChange={e => { setPatientId(e.target.value); const value = patients.find(p => p.id === e.target.value)?.insurance || ""; setBookingInsurance(data?.insurances.includes(value) ? value : ""); }}><option value="" disabled>Selecione um paciente</option>{patients.filter(p => p.status !== "Arquivado" && p.status !== "Alta").map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><div className="new-patient-action"><button type="button" className="secondary" onClick={() => { setPatientView(true); setPatientFieldsVersion(version => version + 1); setModalNotice(""); }}>+ Cadastrar paciente</button></div><label>Data inicial<input name="date" type="date" required defaultValue={date} onChange={e => { const d = dayOf(e.target.value); setWeekdays([d]); }} /></label><label>Horário<input name="time" type="time" required defaultValue={slots[0] || "07:00"} /></label><label>Local de atendimento<select name="locationId" required={!!data?.locations.some(item => item.active)}><option value="">{data?.locations.some(item => item.active) ? "Selecione" : "Sem local configurado"}</option>{data?.locations.filter(item => item.active).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Tipo de atendimento<select name="serviceId" required={!!data?.services.some(item => item.active)}><option value="">{data?.services.some(item => item.active) ? "Selecione" : "Duração padrão"}</option>{data?.services.filter(item => item.active).map(item => <option key={item.id} value={item.id}>{item.name} · {item.duration} min</option>)}</select></label><label>Convênio<select name="insurance" required={!!data?.insurances.length} value={bookingInsurance} onChange={e => setBookingInsurance(e.target.value)}><option value="">{data?.insurances.length ? "Selecione" : "Nenhum convênio configurado"}</option>{data?.insurances.map(name => <option key={name} value={name}>{name}</option>)}</select></label><label>Quantidade total de sessões<input name="count" type="number" min="1" max="260" defaultValue="1" required /></label></div><label>Número da guia / senha de autorização<input name="authorizationCode" maxLength={80} autoComplete="off" placeholder="Informe se houver autorização do convênio" /></label><label>Observações<textarea name="notes" maxLength={2000} rows={3} /></label><fieldset><legend>Dias da recorrência semanal (para mais de uma sessão)</legend><div className="weekday-options">{weekdayNames.map((name, i) => <label key={name}><input type="checkbox" checked={weekdays.includes(i)} onChange={e => setWeekdays(current => e.target.checked ? [...current, i] : current.filter(d => d !== i))} /> {name}</label>)}</div></fieldset><div className="form-actions"><button type="button" className="secondary" onClick={closeBooking}>Cancelar</button><button className="primary">Salvar agendamento</button></div></form>
        </div>
        <div hidden={!patientView}>
          <p className="muted">Cadastre o paciente e volte ao agendamento com os dados preenchidos.</p>
          <form onSubmit={registerPatient} className="booking-form"><PatientFields key={patientFieldsVersion} prefix="booking-patient" /><div className="form-actions"><button type="button" className="secondary" onClick={() => { setPatientView(false); setModalNotice(""); }}>Voltar</button><button className="primary">Salvar paciente</button></div></form>
        </div>
      </div>
    </dialog>
    {selected && <dialog open className="agenda-dialog"><div className="modal-heading"><h2>{patients.find(p => p.id === selected.patientId)?.name || "Atendimento"}</h2><button className="icon-button" onClick={() => setSelected(null)} aria-label="Fechar">×</button></div><p className="muted">{selected.date.split("-").reverse().join("/")} às {selected.time} · {selected.duration} min</p>{selected.insurance && <p className="muted">Convênio: {selected.insurance}</p>}{selected.authorizationCode && <p className="muted">Guia / autorização: {selected.authorizationCode}</p>}{selected.notes && <p className="muted">{selected.notes}</p>}{patients.find(p => p.id === selected.patientId)?.status !== "Alta" && <form className="agenda-authorization-form" onSubmit={async e => { e.preventDefault(); if (await send({ action: "authorization", id: selected.id, authorizationCode }, "Guia / autorização atualizada.")) setSelected({ ...selected, authorizationCode: authorizationCode.trim(), paymentReview: authorizationCode.trim() === selected.authorizationCode ? selected.paymentReview : undefined }); }}><label>Guia / senha de autorização<input value={authorizationCode} maxLength={80} onChange={e => setAuthorizationCode(e.target.value)} placeholder="Número da guia ou senha" /></label><button className="secondary" type="submit">Salvar guia</button></form>}{selected.status === "Realizado" && isInsurance(selected) && !!selected.authorizationCode?.trim() && <PaymentReviewEditor key={selected.id} session={selected} onSave={async (status, amount) => { const ok = await send({ action: "paymentReview", id: selected.id, status, amount }, "Conferência do pagamento atualizada."); if (ok) setSelected({ ...selected, paymentReview: status === "Pendente" ? undefined : { status: status as "Conferido" | "Divergente", amountCents: amount ? Math.round(Number(amount.replace(",", ".")) * 100) : null, reviewedAt: new Date().toISOString(), reviewedBy: "" } }); return ok; }} />}{patients.find(p => p.id === selected.patientId)?.status !== "Alta" && <label>Status<select value={selected.status} onChange={async e => { const status = e.target.value as Status; if (await send({ action: "status", id: selected.id, status }, "Status atualizado.")) setSelected({ ...selected, status }); }}>{statuses.map(s => <option key={s}>{s}</option>)}</select></label>}{patients.some(p => p.id === selected.patientId && p.status !== "Arquivado" && p.status !== "Alta") && <Link className="agenda-evolution-link agenda-dialog-evolution" href={`/pacientes/${encodeURIComponent(selected.patientId)}?aba=evolucoes&data=${selected.date}`}>+ Cadastrar evolução</Link>}{patients.find(p => p.id === selected.patientId)?.status !== "Alta" && <form onSubmit={async e => { e.preventDefault(); if (await send({ action: "reschedule", id: selected.id, date: editDate, time: editTime }, "Sessão reagendada.") ) { setSelected(null); setDate(editDate); } }}><h3>Reagendar esta sessão</h3><div className="form-grid"><label>Data<input type="date" required value={editDate} onChange={e => setEditDate(e.target.value)} /></label><label>Horário<input type="time" required value={editTime} onChange={e => setEditTime(e.target.value)} /></label></div><div className="form-actions"><button className="secondary" type="button" onClick={() => setSelected(null)}>Fechar</button><button className="primary">Reagendar</button></div></form>}{patients.find(p => p.id === selected.patientId)?.status === "Alta" && <p className="muted agenda-discharged-note">Paciente com alta. Este atendimento permanece no histórico para consulta.</p>}</dialog>}
  </>;
}

function PaymentReviewEditor({ session, onSave }: { session: Session; onSave: (status: string, amount: string) => Promise<boolean> }) {
  const [status, setStatus] = useState(session.paymentReview?.status || "Pendente");
  const [amount, setAmount] = useState(session.paymentReview?.amountCents == null ? "" : (session.paymentReview.amountCents / 100).toFixed(2).replace(".", ","));
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true);
    try { await onSave(status, amount); }
    finally { setBusy(false); }
  }
  return <form className="agenda-payment-form" onSubmit={submit}><h3>Conferência do pagamento</h3><p>Compare a guia com o PDF de pagamento recebido da fisio. Este registro é manual.</p><div className="form-grid"><label>Situação<select value={status} onChange={event => setStatus(event.target.value)}><option value="Pendente">Aguardando conferência</option><option value="Conferido">Conferido no relatório</option><option value="Divergente">Divergência encontrada</option></select></label><label>Valor no relatório (R$), se houver<input type="text" inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} placeholder="Ex.: 120,50" maxLength={10} /></label></div><button className="secondary" disabled={busy}>{busy ? "Salvando..." : "Salvar conferência"}</button>{session.paymentReview?.reviewedAt && <small>Última conferência: {new Date(session.paymentReview.reviewedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</small>}</form>;
}
