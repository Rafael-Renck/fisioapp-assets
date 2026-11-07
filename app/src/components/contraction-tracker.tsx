"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Icon } from "./icon";
import { ConfirmDialog } from "./confirm-dialog";
import type { Contraction, ContractionMonitoring } from "../lib/store";

type Snapshot = { monitorings: ContractionMonitoring[]; contractions: Contraction[] };
const empty: Snapshot = { monitorings: [], contractions: [] };
const zone = "America/Sao_Paulo";
const clockTime = (iso: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: zone, hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(iso));
const calendarTime = (iso: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: zone, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
const dateLabel = (iso: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: zone, day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));
const secondsBetween = (start: string, end: string) => Math.max(0, Math.round((Date.parse(end) - Date.parse(start)) / 1000));
function duration(seconds: number) {
  const hours = Math.floor(seconds / 3600), minutes = Math.floor(seconds % 3600 / 60), remainder = seconds % 60;
  return hours ? `${hours}h ${String(minutes).padStart(2, "0")}min` : minutes ? `${minutes}min ${String(remainder).padStart(2, "0")}s` : `${remainder}s`;
}
function timerClock(seconds: number) { return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`; }
function localInput(iso: string) {
  const date = new Date(iso);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}
const intensityOptions = [{ value: "Leve", emoji: "😣", label: "Dor" }, { value: "Moderada", emoji: "😖", label: "Dor forte" }, { value: "Forte", emoji: "😫", label: "Muita dor" }] as const;
const intensityLabel = (value: Contraction["intensity"]) => intensityOptions.find(option => option.value === value)?.label || "";
function downloadCsv(records: Contraction[]) {
  const rows = [["Início", "Fim", "Duração (segundos)", "Intensidade", "Observações"], ...records.map(item => [item.startedAt, item.endedAt || "", item.endedAt ? String(secondsBetween(item.startedAt, item.endedAt)) : "", intensityLabel(item.intensity), item.notes])];
  const csv = "\ufeff" + rows.map(row => row.map(value => `"${value.replaceAll('"', '""')}"`).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = "contracoes.csv"; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function IntensityChoices({ value, busy, onChange }: { value: Contraction["intensity"]; busy: boolean; onChange: (intensity: NonNullable<Contraction["intensity"]>) => void }) {
  return <div className="contraction-intensity-choices" role="group" aria-label="Intensidade da contração">{intensityOptions.map(option => <button key={option.value} type="button" aria-label={option.label} aria-pressed={value === option.value} className={value === option.value ? "selected" : ""} disabled={busy} onClick={() => onChange(option.value)}><span className="contraction-intensity-emoji" aria-hidden="true">{option.emoji}</span><span>{option.label}</span></button>)}</div>;
}

export function ContractionTracker({ patientId, accessToken }: { patientId?: string; accessToken?: string }) {
  const [data, setData] = useState<Snapshot>(empty);
  const [selectedRunId, setSelectedRunId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());
  const [editing, setEditing] = useState<Contraction | null>(null);
  const [deleting, setDeleting] = useState<Contraction | null>(null);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editIntensity, setEditIntensity] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const editDialog = useRef<HTMLDialogElement>(null);
  const query = patientId ? `?patientId=${encodeURIComponent(patientId)}` : "";
  const bodyPatient = patientId ? { patientId } : {};
  const accessHeaders: Record<string, string> = accessToken ? { "x-patient-link": accessToken } : {};
  const apply = useCallback((next: Snapshot) => {
    setData(next);
    setSelectedRunId(current => next.monitorings.some(item => item.id === current) ? current : next.monitorings.find(item => !item.endedAt)?.id || next.monitorings[0]?.id || "");
  }, []);
  const refresh = useCallback(async (silent = false) => {
    try {
      const response = await fetch(`/api/contractions${query}`, { cache: "no-store", headers: accessHeaders });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível carregar as contrações.");
      apply(result);
      if (!silent) setError("");
    } catch (cause) { if (!silent) setError(cause instanceof Error ? cause.message : "Não foi possível carregar as contrações."); }
    finally { if (!silent) setLoading(false); }
  }, [query, apply]);
  useEffect(() => { setData(empty); setSelectedRunId(""); setLoading(true); void refresh(); const poll = setInterval(() => void refresh(true), 15_000); return () => clearInterval(poll); }, [refresh]);
  useEffect(() => { const clock = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(clock); }, []);

  async function action(name: "start" | "stop" | "finish", id?: string) {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/contractions", { method: "POST", headers: { "Content-Type": "application/json", ...accessHeaders }, body: JSON.stringify({ ...bodyPatient, action: name, id }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível atualizar o acompanhamento.");
      apply(result);
      if (name === "start") setSelectedRunId(result.monitorings.find((item: ContractionMonitoring) => !item.endedAt)?.id || "");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível atualizar o acompanhamento."); }
    finally { setBusy(false); }
  }
  function openEdit(item: Contraction) {
    setError("");
    setEditing(item); setEditStart(localInput(item.startedAt)); setEditEnd(localInput(item.endedAt!));
    setEditIntensity(item.intensity || ""); setEditNotes(item.notes); editDialog.current?.showModal();
  }
  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/contractions", { method: "PATCH", headers: { "Content-Type": "application/json", ...accessHeaders }, body: JSON.stringify({ ...bodyPatient, id: editing.id, startedAt: new Date(editStart).toISOString(), endedAt: new Date(editEnd).toISOString(), intensity: editIntensity || null, notes: editNotes }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível salvar a edição.");
      apply(result); editDialog.current?.close(); setEditing(null); setDeleting(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível salvar a edição."); }
    finally { setBusy(false); }
  }
  async function setIntensity(item: Contraction, intensity: NonNullable<Contraction["intensity"]>) {
    if (!item.endedAt) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/contractions", { method: "PATCH", headers: { "Content-Type": "application/json", ...accessHeaders }, body: JSON.stringify({ ...bodyPatient, id: item.id, startedAt: item.startedAt, endedAt: item.endedAt, intensity, notes: item.notes }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível registrar a intensidade.");
      apply(result);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível registrar a intensidade."); }
    finally { setBusy(false); }
  }
  async function deleteRecord(item: Contraction) {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/contractions", { method: "DELETE", headers: { "Content-Type": "application/json", ...accessHeaders }, body: JSON.stringify({ ...bodyPatient, id: item.id }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível excluir a contração.");
      apply(result); editDialog.current?.close(); setEditing(null); setDeleting(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível excluir a contração."); setDeleting(null); }
    finally { setBusy(false); }
  }

  const activeRun = data.monitorings.find(item => !item.endedAt);
  const selectedRun = data.monitorings.find(item => item.id === selectedRunId) || data.monitorings[0];
  const runRecords = data.contractions.filter(item => item.monitoringId === selectedRun?.id).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const activeContraction = activeRun && data.contractions.find(item => item.monitoringId === activeRun.id && !item.endedAt);
  const latestUntyped = activeRun && data.contractions.filter(item => item.monitoringId === activeRun.id && !!item.endedAt && !item.intensity).sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
  const completed = runRecords.filter(item => !!item.endedAt);
  const intervals = completed.slice(1).map((item, index) => secondsBetween(completed[index].startedAt, item.startedAt));
  const rests = completed.slice(1).map((item, index) => secondsBetween(completed[index].endedAt!, item.startedAt));
  const averageDuration = completed.length ? Math.round(completed.reduce((total, item) => total + secondsBetween(item.startedAt, item.endedAt!), 0) / completed.length) : null;
  const averageInterval = intervals.length ? Math.round(intervals.reduce((total, value) => total + value, 0) / intervals.length) : null;
  const averageRest = rests.length ? Math.round(rests.reduce((total, value) => total + value, 0) / rests.length) : null;
  const lastInterval = intervals.at(-1) ?? null;
  const chart = completed.slice(-12);
  const intensityHistory = completed.filter(item => item.intensity).slice(-12);
  const maxChart = Math.max(60, ...chart.map(item => secondsBetween(item.startedAt, item.endedAt!)));

  return <div className="contraction-tracker">
    {error && <div className="contraction-error" role="alert">{error}<button type="button" className="icon-button" aria-label="Dispensar erro" onClick={() => setError("")}><Icon name="close" size={16} /></button></div>}
    {loading ? <div className="panel contraction-loading">Carregando acompanhamento...</div> : <>
      <div className="contraction-top-grid"><section className="panel contraction-timer-card"><p className="eyebrow">CRONÔMETRO</p><h2>{activeContraction ? "Contração em andamento" : "Pronta para registrar"}</h2><div className="contraction-clock" aria-live="off">{activeContraction ? timerClock(Math.max(0, Math.floor((now - Date.parse(activeContraction.startedAt)) / 1000))) : "00:00"}</div><p className="contraction-timer-hint">{activeContraction ? `Iniciada às ${clockTime(activeContraction.startedAt)}` : activeRun ? "Toque quando a próxima contração começar." : "Toque quando a primeira contração começar."}</p><button type="button" className={`contraction-main-button ${activeContraction ? "is-running" : ""}`} disabled={busy} onClick={() => void action(activeContraction ? "stop" : "start", activeContraction?.id)}>{activeContraction ? "Parar contração" : activeRun ? "Iniciar contração" : "Iniciar acompanhamento"}</button>{latestUntyped && !activeContraction && <div className="contraction-intensity-prompt"><strong>Como foi a dor?</strong><small>Contração das {clockTime(latestUntyped.startedAt)}</small><IntensityChoices value={null} busy={busy} onChange={intensity => void setIntensity(latestUntyped, intensity)} /></div>}{activeRun && !activeContraction && <button type="button" className="contraction-finish" disabled={busy} onClick={() => void action("finish")}>Concluir acompanhamento</button>}</section>
      <section className="panel contraction-summary-card"><div className="contraction-summary-heading"><div><p className="eyebrow">RESUMO</p><h2>{selectedRun ? `Acompanhamento de ${dateLabel(selectedRun.startedAt)}` : "Nenhum registro ainda"}</h2></div>{selectedRun && <span className={selectedRun.endedAt ? "contraction-run-status done" : "contraction-run-status"}>{selectedRun.endedAt ? "Concluído" : "Em andamento"}</span>}</div><div className="contraction-stats"><div><small>Contrações</small><strong>{completed.length}</strong></div><div><small>Duração média</small><strong>{averageDuration === null ? "—" : duration(averageDuration)}</strong></div><div><small>Intervalo médio*</small><strong>{averageInterval === null ? "—" : duration(averageInterval)}</strong></div><div><small>Último intervalo*</small><strong>{lastInterval === null ? "—" : duration(lastInterval)}</strong></div><div><small>Pausa média**</small><strong>{averageRest === null ? "—" : duration(averageRest)}</strong></div></div><p className="contraction-summary-note">* Entre os inícios de duas contrações. ** Entre o fim de uma e o início da próxima.</p><div className="contraction-intensity-summary"><h3>Intensidade registrada</h3><div className="contraction-intensity-counts">{intensityOptions.map(option => <div key={option.value}><span aria-hidden="true">{option.emoji}</span><small>{option.label}</small><strong>{completed.filter(item => item.intensity === option.value).length}</strong></div>)}</div>{intensityHistory.length > 0 && <div className="contraction-intensity-timeline"><small>Últimos registros, do mais antigo ao mais recente</small><div>{intensityHistory.map(item => { const option = intensityOptions.find(candidate => candidate.value === item.intensity)!; return <span key={item.id} role="img" aria-label={`${clockTime(item.startedAt)}: ${option.label}`} title={`${clockTime(item.startedAt)} · ${option.label}`}>{option.emoji}</span>; })}</div></div>}</div>{chart.length > 0 && <div className="contraction-chart" role="img" aria-label="Duração das últimas contrações"><div className="contraction-chart-bars">{chart.map(item => <span key={item.id} style={{ height: `${Math.max(10, secondsBetween(item.startedAt, item.endedAt!) / maxChart * 100)}%` }} title={`${clockTime(item.startedAt)}: ${duration(secondsBetween(item.startedAt, item.endedAt!))}`} />)}</div><small>Duração das últimas {chart.length} contrações</small></div>}</section></div>
      <section className="panel contraction-history"><div className="contraction-history-heading"><div><h2>Histórico</h2><p className="muted">Horários, duração e intensidade de cada contração.</p></div><div className="contraction-history-tools">{data.monitorings.length > 1 && <label className="sr-only" htmlFor="run-select">Acompanhamento</label>}{data.monitorings.length > 1 && <select id="run-select" value={selectedRunId} onChange={event => setSelectedRunId(event.target.value)}>{data.monitorings.map(item => <option key={item.id} value={item.id}>{calendarTime(item.startedAt)}{item.endedAt ? " · concluído" : " · em andamento"}</option>)}</select>}{completed.length > 0 && <button type="button" className="secondary" onClick={() => downloadCsv(completed)}>Exportar CSV</button>}</div></div>{runRecords.length ? <div className="contraction-list">{runRecords.slice().reverse().map((item, reverseIndex) => {
        const index = runRecords.length - 1 - reverseIndex;
        const previous = index > 0 ? runRecords[index - 1] : null;
        return <article key={item.id} className="contraction-item"><div className="contraction-item-number">{index + 1}</div><div className="contraction-item-main"><strong>{clockTime(item.startedAt)}{item.endedAt ? ` – ${clockTime(item.endedAt)}` : " · em andamento"}</strong><small>Duração: {item.endedAt ? duration(secondsBetween(item.startedAt, item.endedAt)) : duration(Math.max(0, Math.floor((now - Date.parse(item.startedAt)) / 1000)))}{previous ? ` · Intervalo: ${duration(secondsBetween(previous.startedAt, item.startedAt))}` : ""}{previous?.endedAt ? ` · Pausa: ${duration(secondsBetween(previous.endedAt, item.startedAt))}` : ""}</small>{item.notes && <p>{item.notes}</p>}</div>{item.endedAt && <div className="contraction-history-intensity"><small>Intensidade</small><span className={`contraction-intensity-badge ${item.intensity ? "" : "missing"}`}>{item.intensity ? `${intensityOptions.find(option => option.value === item.intensity)?.emoji} ${intensityLabel(item.intensity)}` : "Não informada"}</span></div>}{item.endedAt && <button type="button" className="secondary" onClick={() => openEdit(item)}>Editar</button>}</article>;
      })}</div> : <div className="contraction-empty"><Icon name="clock" size={28} /><p>As contrações aparecerão aqui após o primeiro registro.</p></div>}</section>
    </>}
    <ConfirmDialog open={!!deleting} title="Excluir contração?" description="Este registro será removido do histórico e do resumo do acompanhamento." confirmLabel="Excluir contração" busy={busy} onConfirm={() => deleting && void deleteRecord(deleting)} onCancel={() => setDeleting(null)} />
    <dialog ref={editDialog} className="contraction-edit-dialog" aria-labelledby="contraction-edit-title" onClick={event => { if (event.target === event.currentTarget) editDialog.current?.close(); }}><form onSubmit={saveEdit}><div className="modal-heading"><h2 id="contraction-edit-title">Editar contração</h2><button type="button" className="icon-button" aria-label="Fechar" onClick={() => editDialog.current?.close()}><Icon name="close" /></button></div>{error && <p className="form-error" role="alert">{error}</p>}<label>Início<input type="datetime-local" required value={editStart} onChange={event => setEditStart(event.target.value)} /></label><label>Fim<input type="datetime-local" required value={editEnd} onChange={event => setEditEnd(event.target.value)} /></label><label>Intensidade<select value={editIntensity} onChange={event => setEditIntensity(event.target.value)}><option value="">Não informada</option><option value="Leve">😣 Dor</option><option value="Moderada">😖 Dor forte</option><option value="Forte">😫 Muita dor</option></select></label><label>Observações<textarea maxLength={500} rows={3} value={editNotes} onChange={event => setEditNotes(event.target.value)} /></label><div className="contraction-edit-actions"><button type="button" className="secondary" disabled={busy} onClick={() => editing && setDeleting(editing)}>Excluir</button><button className="primary" disabled={busy}>Salvar</button></div></form></dialog>
  </div>;
}
