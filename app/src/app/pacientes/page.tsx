"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Icon } from "../../components/icon";
import { usePatients } from "../../components/patients-provider";

export default function PatientsPage() {
  const { patients, addPatient } = usePatients();
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const filtered = patients.filter(patient => patient.name.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR").trim()));

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("novo") === "1") dialog.current?.showModal();
  }, []);

  function closeDialog() {
    dialog.current?.close();
    trigger.current?.focus();
  }

  async function savePatient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") || "").trim();
    const input = event.currentTarget.elements.namedItem("name") as HTMLInputElement;
    input.setCustomValidity(name.length < 2 ? "Informe o nome do paciente com pelo menos dois caracteres." : "");
    if (!event.currentTarget.reportValidity()) return;
    try { await addPatient({ name, phone: String(data.get("phone") || "").trim(), email: String(data.get("email") || "").trim() }); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Erro ao salvar."); return; }
    setQuery("");
    setNotice(`${name} foi cadastrado com sucesso.`);
    form.current?.reset();
    closeDialog();
  }

  return <>
    <div className="page-heading"><div><p className="eyebrow">PESSOAS EM PRIMEIRO LUGAR</p><h1>Meus pacientes</h1><p className="muted">Cada nome, uma história. Cada história, um cuidado.</p></div><button ref={trigger} className="primary" onClick={() => dialog.current?.showModal()}><Icon name="plus" size={18} /> Novo paciente</button></div>
    <div role="status" aria-live="polite">{notice && <div className="success-message"><Icon name="check" size={18} />{notice}<button className="icon-button" aria-label="Dispensar mensagem" onClick={() => setNotice("")}><Icon name="close" size={16} /></button></div>}</div>
    <section className="panel patients-panel" aria-label="Lista de pacientes"><div className="patients-toolbar"><div className="search"><Icon name="search" size={20} /><input type="search" aria-label="Buscar paciente pelo nome" placeholder="Buscar paciente pelo nome..." value={query} onChange={event => setQuery(event.target.value)} /></div><span className="results-count">{patients.length} {patients.length === 1 ? "paciente cadastrado" : "pacientes cadastrados"}</span></div>
    {filtered.length ? <div className="patient-list">{filtered.map(patient => <article className="patient-card" key={patient.id}><div className="patient-avatar">{patient.name.split(/\s+/).slice(0, 2).map(part => part[0]).join("").toLocaleUpperCase("pt-BR")}</div><div className="patient-info"><h2>{patient.name}</h2><div className="patient-contacts">{patient.phone && <span><Icon name="phone" size={14} />{patient.phone}</span>}{patient.email && <span><Icon name="mail" size={14} />{patient.email}</span>}{!patient.phone && !patient.email && <span>Sem contato informado</span>}</div></div><span className="patient-tag">Cadastrado</span></article>)}</div> : <div className="patients-empty"><span className="large-icon"><Icon name={query ? "search" : "patients"} size={35} /></span><h2>{query ? "Não encontramos esse paciente" : "Seu primeiro paciente começa aqui"}</h2><p>{query ? "Confira o nome ou tente uma busca diferente." : "Organize seus contatos e dê o primeiro passo para acompanhar cada história de perto."}</p><button className={query ? "secondary" : "primary"} onClick={() => query ? setQuery("") : dialog.current?.showModal()}>{query ? "Limpar busca" : <><Icon name="plus" size={18} /> Cadastrar paciente</>}</button></div>}
    <p className="temporary-note"><Icon name="help" size={15} /> Cadastros salvos no servidor deste Codespace.</p></section>
    <dialog className="patient-dialog" ref={dialog} aria-labelledby="patient-dialog-title" onClose={() => { form.current?.reset(); const url = new URL(window.location.href); if (url.searchParams.has("novo")) { url.searchParams.delete("novo"); window.history.replaceState(window.history.state, "", url); } }} onClick={event => { if (event.target === event.currentTarget) closeDialog(); }}><form ref={form} onSubmit={savePatient}><div className="modal-heading"><div><p className="eyebrow">UMA NOVA HISTÓRIA</p><h2 id="patient-dialog-title">Adicionar paciente</h2></div><button type="button" className="icon-button" aria-label="Fechar cadastro" onClick={closeDialog}><Icon name="close" /></button></div><p className="muted">Comece pelo essencial. Vamos cuidar dos detalhes juntos.</p><label htmlFor="patient-name">Nome completo <span aria-hidden="true">*</span></label><input id="patient-name" name="name" required minLength={2} maxLength={120} autoComplete="name" autoFocus placeholder="Como o paciente se chama?" onChange={event => event.target.setCustomValidity("")} /><label htmlFor="patient-phone">Telefone <small>Opcional</small></label><input id="patient-phone" name="phone" type="tel" maxLength={30} autoComplete="tel" placeholder="(00) 00000-0000" /><label htmlFor="patient-email">E-mail <small>Opcional</small></label><input id="patient-email" name="email" type="email" maxLength={254} autoComplete="email" placeholder="paciente@email.com" /><div className="modal-actions"><button className="secondary" type="button" onClick={closeDialog}>Cancelar</button><button className="primary" type="submit"><Icon name="check" size={18} /> Salvar paciente</button></div></form></dialog>
  </>;
}
