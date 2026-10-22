"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { usePatients } from "../../components/patients-provider";
import type { Block, Config, Session, Status } from "../../lib/store";

const weekdayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const statuses: Status[] = ["Agendado", "Confirmado", "Realizado", "Cancelado pelo Paciente", "Cancelado pela Fisio", "Não Compareceu"];
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const addDays = (date: string, n: number) => { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const dayOf = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();
const minute = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
const clock = (n: number) => `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
const labelDate = (date: string) => new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
type Data = { sessions: Session[]; blocks: Block[]; config: Config };

export default function AgendaPage() {
  const { patients, addPatient } = usePatients();
  const [date, setDate] = useState(today);
  const [data, setData] = useState<Data | null>(null);
  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState<"agenda" | "bloqueios" | "config">("agenda");
  const [showForm, setShowForm] = useState(false);
  const [patientView, setPatientView] = useState(false);
  const [patientId, setPatientId] = useState("");
  const [modalNotice, setModalNotice] = useState("");
  const bookingDialog = useRef<HTMLDialogElement>(null);
  const bookingTrigger = useRef<HTMLButtonElement>(null);
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [selected, setSelected] = useState<Session | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const load = useCallback(async () => { const response = await fetch("/api/agenda", { cache: "no-store" }); setData(await response.json()); }, []);
  useEffect(() => { load().catch(() => setNotice("Não foi possível carregar a agenda.")); }, [load]);
  useEffect(() => { if (new URLSearchParams(location.search).get("novo") === "1") setShowForm(true); }, []);
  useEffect(() => { const dialog = bookingDialog.current; if (!dialog) return; if (showForm && !dialog.open) dialog.showModal(); else if (!showForm && dialog.open) dialog.close(); }, [showForm]);
  function closeBooking() { setShowForm(false); setPatientView(false); setModalNotice(""); bookingTrigger.current?.focus(); }
  async function registerPatient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget; const fields = new FormData(form);
    try {
      const patient = await addPatient({ name: String(fields.get("name") || "").trim(), phone: String(fields.get("phone") || "").trim(), email: String(fields.get("email") || "").trim() });
      setPatientId(patient.id); setPatientView(false); setModalNotice(`${patient.name} cadastrado. Continue o agendamento.`); form.reset();
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
  async function book(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const fields = new FormData(form);
    const count = Number(fields.get("count"));
    const ok = await send({ action: "book", patientId: fields.get("patientId"), date: fields.get("date"), time: fields.get("time"), notes: fields.get("notes"), count, weekdays: count > 1 ? weekdays : [] }, count > 1 ? `${count} sessões criadas.` : "Agendamento criado.", setModalNotice);
    if (ok) { closeBooking(); form.reset(); setWeekdays([]); setPatientId(""); setDate(String(fields.get("date"))); }
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
  const blocks = data?.blocks.filter(b => b.date === date).sort((a, b) => a.start.localeCompare(b.start)) || [];
  const day = config?.days[dayOf(date)];
  const slots: string[] = [];
  if (day?.active) for (let n = minute(day.start); n + config!.duration <= minute(day.end); n += config!.duration) slots.push(clock(n));
  const otherTimes = [...new Set(sessions.filter(s => !slots.includes(s.time)).map(s => s.time))];
  const allTimes = [...new Set([...slots, ...otherTimes])].sort();
  const weekStart = addDays(date, -((dayOf(date) + 6) % 7));
  return <>
    <div className="page-heading"><div><p className="eyebrow">ORGANIZAÇÃO DO CUIDADO</p><h1>Agenda</h1><p className="muted">Horários no fuso de São Paulo · {config?.capacity || 5} pacientes por horário</p></div><button ref={bookingTrigger} className="primary" onClick={() => { setShowForm(true); setPatientView(false); setModalNotice(""); setTab("agenda"); }}>+ Novo agendamento</button></div>
    {notice && <div className="success-message" role="status">{notice}<button className="icon-button" onClick={() => setNotice("")} aria-label="Dispensar">×</button></div>}
    <div className="agenda-tabs"><button className={tab === "agenda" ? "selected" : ""} onClick={() => setTab("agenda")}>Agenda diária</button><button className={tab === "bloqueios" ? "selected" : ""} onClick={() => setTab("bloqueios")}>Bloqueios</button><button className={tab === "config" ? "selected" : ""} onClick={() => setTab("config")}>Configuração</button></div>
    {tab !== "config" && <section className="panel agenda-navigation"><div className="agenda-date-row"><button className="secondary" onClick={() => setDate(addDays(date, -1))} aria-label="Dia anterior">‹</button><input aria-label="Data da agenda" type="date" value={date} onChange={e => setDate(e.target.value)} /><button className="secondary" onClick={() => setDate(addDays(date, 1))} aria-label="Dia seguinte">›</button><button className="secondary" onClick={() => setDate(today())}>Hoje</button></div><h2>{labelDate(date)}</h2><div className="week-strip">{Array.from({ length: 7 }, (_, i) => { const value = addDays(weekStart, i); return <button key={value} className={value === date ? "selected" : ""} onClick={() => setDate(value)}><span>{weekdayNames[dayOf(value)]}</span><strong>{value.slice(8)}</strong></button>; })}</div></section>}
    {tab === "agenda" && <>
      <section className="panel daily-grid"><div className="section-heading"><div><h2>Atendimentos do dia</h2><p>{sessions.length} sessão(ões) · {blocks.length} bloqueio(s)</p></div></div>{!day?.active && <p className="agenda-alert">Dia sem expediente configurado. Sessões já registradas continuam visíveis.</p>}{!allTimes.length ? <div className="patients-empty"><h2>Sem horários neste dia</h2><p>Escolha outro dia ou ajuste o expediente.</p></div> : allTimes.map(time => { const at = sessions.filter(s => s.time === time); const n = minute(time); const blocked = blocks.filter(b => n < minute(b.end) && n + (config?.duration || 60) > minute(b.start)); return <div className="time-row" key={time}><strong>{time}</strong><div><small>{at.filter(s => !s.status.startsWith("Cancelado") && s.status !== "Não Compareceu").length}/{config?.capacity} vagas ocupadas</small>{blocked.map(b => <div className="block-pill" key={b.id}>Bloqueado · {b.reason}</div>)}{at.map(s => <button key={s.id} className="session-card" onClick={() => { setSelected(s); setEditDate(s.date); setEditTime(s.time); }}><span>{patients.find(p => p.id === s.patientId)?.name || "Paciente não encontrado"}</span><small>{s.status}{s.recurrenceId ? " · Recorrência" : ""}</small></button>)}</div></div>; })}</section>
    </>}
    {tab === "bloqueios" && <div className="agenda-two-column"><section className="panel agenda-form"><h2>Bloquear período</h2><form onSubmit={block}><label>Data<input name="date" type="date" required defaultValue={date} /></label><div className="form-grid"><label>Início<input name="start" type="time" required defaultValue="07:00" /></label><label>Fim<input name="end" type="time" required defaultValue="08:00" /></label></div><label>Motivo<input name="reason" required maxLength={300} /></label><div className="form-actions"><button className="primary">Adicionar bloqueio</button></div></form></section><section className="panel agenda-form"><h2>Bloqueios de {date.split("-").reverse().join("/")}</h2>{blocks.length ? blocks.map(b => <div className="block-list" key={b.id}><span><strong>{b.start}–{b.end}</strong><br />{b.reason}</span><button className="secondary" onClick={() => send({ action: "unblock", id: b.id }, "Bloqueio removido.")}>Remover</button></div>) : <p className="muted">Nenhum bloqueio nesta data.</p>}</section></div>}
    {tab === "config" && config && <section className="panel agenda-form"><h2>Expediente e capacidade</h2><p className="muted">Alterações valem para novos agendamentos. Sessões já criadas permanecem registradas.</p><form onSubmit={saveConfig}><div className="config-days">{config.days.map((d, i) => <div className="config-day" key={i}><label><input type="checkbox" checked={d.active} onChange={e => setData(current => current && ({ ...current, config: { ...current.config, days: current.config.days.map((day, index) => index === i ? { ...day, active: e.target.checked } : day) } }))} /> {weekdayNames[i]}</label><input aria-label={`Início ${weekdayNames[i]}`} type="time" value={d.start} onChange={e => setData(current => current && ({ ...current, config: { ...current.config, days: current.config.days.map((day, index) => index === i ? { ...day, start: e.target.value } : day) } }))} /><input aria-label={`Fim ${weekdayNames[i]}`} type="time" value={d.end} onChange={e => setData(current => current && ({ ...current, config: { ...current.config, days: current.config.days.map((day, index) => index === i ? { ...day, end: e.target.value } : day) } }))} /></div>)}</div><div className="form-grid"><label>Duração da sessão (minutos)<input type="number" min="15" max="480" value={config.duration} onChange={e => setData({ ...data, config: { ...config, duration: Number(e.target.value) } })} /></label><label>Capacidade por horário<input type="number" min="1" max="100" value={config.capacity} onChange={e => setData({ ...data, config: { ...config, capacity: Number(e.target.value) } })} /></label></div><div className="form-actions"><button className="primary">Salvar configuração</button></div></form></section>}
    <dialog ref={bookingDialog} className="booking-dialog" aria-labelledby="booking-title" onCancel={closeBooking} onClose={() => { setShowForm(false); setPatientView(false); }} onClick={event => { if (event.target === event.currentTarget) closeBooking(); }}>
      <div className="modal-heading"><div><p className="eyebrow">AGENDA</p><h2 id="booking-title">{patientView ? "Cadastrar paciente" : "Novo agendamento"}</h2></div><button type="button" className="icon-button" aria-label="Fechar" onClick={closeBooking}>×</button></div>
      <div className="booking-dialog-content">
        {modalNotice && <p className="booking-notice" role="status">{modalNotice}</p>}
        <div hidden={patientView}>
          <form key={date} onSubmit={book} className="booking-form"><div className="form-grid"><label>Paciente<select name="patientId" required value={patientId} onChange={e => setPatientId(e.target.value)}><option value="" disabled>Selecione um paciente</option>{patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><div className="new-patient-action"><button type="button" className="secondary" onClick={() => { setPatientView(true); setModalNotice(""); }}>+ Cadastrar paciente</button></div><label>Data inicial<input name="date" type="date" required defaultValue={date} onChange={e => { const d = dayOf(e.target.value); setWeekdays([d]); }} /></label><label>Horário<input name="time" type="time" required defaultValue={slots[0] || "07:00"} /></label><label>Quantidade total de sessões<input name="count" type="number" min="1" max="260" defaultValue="1" required /></label></div><label>Observações<textarea name="notes" maxLength={2000} rows={3} /></label><fieldset><legend>Dias da recorrência semanal (para mais de uma sessão)</legend><div className="weekday-options">{weekdayNames.map((name, i) => <label key={name}><input type="checkbox" checked={weekdays.includes(i)} onChange={e => setWeekdays(current => e.target.checked ? [...current, i] : current.filter(d => d !== i))} /> {name}</label>)}</div></fieldset><div className="form-actions"><button type="button" className="secondary" onClick={closeBooking}>Cancelar</button><button className="primary">Salvar agendamento</button></div></form>
        </div>
        <div hidden={!patientView}>
          <p className="muted">Cadastre o paciente e volte ao agendamento com os dados preenchidos.</p>
          <form onSubmit={registerPatient} className="booking-form"><label>Nome completo<input name="name" required minLength={2} maxLength={120} autoComplete="name" /></label><label>Telefone (opcional)<input name="phone" type="tel" maxLength={30} autoComplete="tel" /></label><label>E-mail (opcional)<input name="email" type="email" maxLength={254} autoComplete="email" /></label><div className="form-actions"><button type="button" className="secondary" onClick={() => { setPatientView(false); setModalNotice(""); }}>Voltar</button><button className="primary">Salvar paciente</button></div></form>
        </div>
      </div>
    </dialog>
    {selected && <dialog open className="agenda-dialog"><div className="modal-heading"><h2>{patients.find(p => p.id === selected.patientId)?.name || "Atendimento"}</h2><button className="icon-button" onClick={() => setSelected(null)} aria-label="Fechar">×</button></div><p className="muted">{selected.date.split("-").reverse().join("/")} às {selected.time} · {selected.duration} min</p>{selected.notes && <p className="muted">{selected.notes}</p>}<label>Status<select value={selected.status} onChange={async e => { const status = e.target.value as Status; if (await send({ action: "status", id: selected.id, status }, "Status atualizado.")) setSelected({ ...selected, status }); }}>{statuses.map(s => <option key={s}>{s}</option>)}</select></label><form onSubmit={async e => { e.preventDefault(); if (await send({ action: "reschedule", id: selected.id, date: editDate, time: editTime }, "Sessão reagendada.") ) { setSelected(null); setDate(editDate); } }}><h3>Reagendar esta sessão</h3><div className="form-grid"><label>Data<input type="date" required value={editDate} onChange={e => setEditDate(e.target.value)} /></label><label>Horário<input type="time" required value={editTime} onChange={e => setEditTime(e.target.value)} /></label></div><div className="form-actions"><button className="secondary" type="button" onClick={() => setSelected(null)}>Fechar</button><button className="primary">Reagendar</button></div></form></dialog>}
  </>;
}
