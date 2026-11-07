"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Icon } from "../../components/icon";
import { usePatients, type Patient } from "../../components/patients-provider";
import { PatientFields, patientFromForm } from "../../components/patient-fields";
import { ConfirmDialog } from "../../components/confirm-dialog";


const patientIsActive = (patient: Patient) => patient.status !== "Arquivado" && patient.status !== "Alta";

export default function PatientsPage() {
  const { patients, addPatient, updatePatient, setArchived, setDischarged } = usePatients();
  const [query, setQuery] = useState("");
  const [canViewClinical, setCanViewClinical] = useState(true);
  const [notice, setNotice] = useState("");
  const [view, setView] = useState<"active" | "discharged" | "archived">("active");
  const [editing, setEditing] = useState<Patient | null>(null);
  const [fieldsVersion, setFieldsVersion] = useState(0);
  const [dischargeTarget, setDischargeTarget] = useState<Patient | null>(null);
  const [discharging, setDischarging] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const visible = patients.filter(patient => view === "active" ? patientIsActive(patient) : view === "discharged" ? patient.status === "Alta" : patient.status === "Arquivado");
  const filtered = visible.filter(patient => patient.name.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR").trim()));
  const activeCount = patients.filter(patientIsActive).length;

  useEffect(() => { fetch("/api/auth/me").then(response => response.json()).then(user => setCanViewClinical(user.role !== "reception")).catch(() => undefined); }, []);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("novo") === "1") dialog.current?.showModal();
  }, []);

  function openPatient(patient?: Patient) {
    setEditing(patient || null);
    setFieldsVersion(version => version + 1);
    dialog.current?.showModal();
  }
  function closeDialog() {
    dialog.current?.close();
    trigger.current?.focus();
  }
  async function savePatient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const fields = patientFromForm(data);
    const input = event.currentTarget.elements.namedItem("name") as HTMLInputElement;
    input.setCustomValidity(fields.name.length < 2 ? "Informe o nome do paciente com pelo menos dois caracteres." : "");
    if (!event.currentTarget.reportValidity()) return;
    try {
      if (editing) await updatePatient(editing.id, fields);
      else await addPatient(fields);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Erro ao salvar."); return; }
    setQuery("");
    setNotice(`${fields.name} ${editing ? "foi atualizado" : "foi cadastrado"} com sucesso.`);
    closeDialog();
  }
  async function dischargePatient() {
    if (!dischargeTarget) return;
    const patient = dischargeTarget;
    setDischarging(true);
    try {
      await setDischarged(patient.id, true);
      setNotice(`Alta registrada para ${patient.name}. Somente as sessões realizadas foram mantidas.`);
      setDischargeTarget(null);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Não foi possível registrar a alta."); setDischargeTarget(null); }
    finally { setDischarging(false); }
  }
  async function reactivatePatient(patient: Patient) {
    try {
      await setDischarged(patient.id, false);
      setNotice(`${patient.name} foi reativado.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Não foi possível reativar a paciente."); }
  }
  async function archivePatient(patient: Patient) {
    const archived = patient.status !== "Arquivado";
    try {
      await setArchived(patient.id, archived);
      setNotice(`${patient.name} ${archived ? "foi arquivado" : "foi reativado"}.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Erro ao atualizar."); }
  }

  return <>
    <div className="page-heading"><div><p className="eyebrow">PESSOAS EM PRIMEIRO LUGAR</p><h1>Meus pacientes</h1><p className="muted">Cada nome, uma história. Cada história, um cuidado.</p></div><button ref={trigger} className="primary" onClick={() => openPatient()}><Icon name="plus" size={18} /> Novo paciente</button></div>
    <div role="status" aria-live="polite">{notice && <div className="success-message"><Icon name="check" size={18} />{notice}<button className="icon-button" aria-label="Dispensar mensagem" onClick={() => setNotice("")}><Icon name="close" size={16} /></button></div>}</div>
    <section className="panel patients-panel" aria-label="Lista de pacientes"><div className="patients-toolbar"><div className="search"><Icon name="search" size={20} /><input type="search" aria-label="Buscar paciente pelo nome" placeholder="Buscar paciente pelo nome..." value={query} onChange={event => setQuery(event.target.value)} /></div><span className="results-count">{activeCount} {activeCount === 1 ? "paciente ativo" : "pacientes ativos"}</span><div className="patients-view-switch" role="group" aria-label="Estado dos pacientes"><button type="button" className={view === "active" ? "secondary selected" : "secondary"} onClick={() => setView("active")}>Ativos</button><button type="button" className={view === "discharged" ? "secondary selected" : "secondary"} onClick={() => setView("discharged")}>Com alta</button><button type="button" className={view === "archived" ? "secondary selected" : "secondary"} onClick={() => setView("archived")}>Arquivados</button></div></div>
      {filtered.length ? <div className="patient-list">{filtered.map(patient => <article className="patient-card" key={patient.id}><div className="patient-avatar">{patient.name.split(/\s+/).slice(0, 2).map(part => part[0]).join("").toLocaleUpperCase("pt-BR")}</div><div className="patient-info"><h2>{patient.name}</h2><div className="patient-contacts"><span>{patient.id}</span>{patient.phone && <span><Icon name="phone" size={14} />{patient.phone}</span>}{patient.email && <span><Icon name="mail" size={14} />{patient.email}</span>}{patient.insurance && <span>{patient.insurance}</span>}</div></div><div className="patient-actions">{canViewClinical && <Link className="secondary" href={`/pacientes/${encodeURIComponent(patient.id)}`}>Prontuário</Link>}<button className="secondary" onClick={() => openPatient(patient)}>Editar</button>{view === "active" ? <>{canViewClinical && <button className="secondary" onClick={() => setDischargeTarget(patient)}>Dar alta</button>}<button className="secondary" onClick={() => archivePatient(patient)}>Arquivar</button></> : view === "discharged" ? canViewClinical && <button className="secondary" onClick={() => reactivatePatient(patient)}>Reativar</button> : <button className="secondary" onClick={() => archivePatient(patient)}>Reativar</button>}</div></article>)}</div> : <div className="patients-empty"><span className="large-icon"><Icon name={query ? "search" : "patients"} size={35} /></span><h2>{query ? "Não encontramos esse paciente" : view === "archived" ? "Nenhum paciente arquivado" : view === "discharged" ? "Nenhum paciente com alta" : "Seu primeiro paciente começa aqui"}</h2><p>{query ? "Confira o nome ou tente uma busca diferente." : view === "archived" ? "Os pacientes arquivados aparecerão aqui." : view === "discharged" ? "As pacientes com alta aparecerão aqui." : "Organize seus contatos e dê o primeiro passo para acompanhar cada história de perto."}</p>{view === "active" && <button className={query ? "secondary" : "primary"} onClick={() => query ? setQuery("") : openPatient()}>{query ? "Limpar busca" : <><Icon name="plus" size={18} /> Cadastrar paciente</>}</button>}</div>}
      <p className="temporary-note"><Icon name="help" size={15} /> Cadastros salvos no servidor deste Codespace.</p></section>
    <ConfirmDialog open={!!dischargeTarget} title="Dar alta à paciente?" description={dischargeTarget ? `As sessões não realizadas de ${dischargeTarget.name} serão removidas da agenda. Somente as realizadas permanecerão no histórico.` : ""} confirmLabel="Confirmar alta" busy={discharging} onConfirm={() => void dischargePatient()} onCancel={() => setDischargeTarget(null)} />
    <dialog className="patient-dialog" ref={dialog} aria-labelledby="patient-dialog-title" onClose={() => { form.current?.reset(); setEditing(null); setFieldsVersion(version => version + 1); const url = new URL(window.location.href); if (url.searchParams.has("novo")) { url.searchParams.delete("novo"); window.history.replaceState(window.history.state, "", url); } }} onClick={event => { if (event.target === event.currentTarget) closeDialog(); }}><form ref={form} onSubmit={savePatient}><div className="modal-heading"><div><p className="eyebrow">{editing ? "DADOS DO PACIENTE" : "UMA NOVA HISTÓRIA"}</p><h2 id="patient-dialog-title">{editing ? "Editar paciente" : "Adicionar paciente"}</h2></div><button type="button" className="icon-button" aria-label="Fechar cadastro" onClick={closeDialog}><Icon name="close" /></button></div><p className="muted">{editing ? `ID ${editing.id} · Atualize os dados do cadastro.` : "Comece pelo essencial. Vamos cuidar dos detalhes juntos."}</p><PatientFields key={`${editing?.id || "new"}-${fieldsVersion}`} patient={editing || undefined} prefix="patient" /><div className="modal-actions"><button className="secondary" type="button" onClick={closeDialog}>Cancelar</button><button className="primary" type="submit"><Icon name="check" size={18} /> {editing ? "Salvar alterações" : "Salvar paciente"}</button></div></form></dialog>
  </>;
}
