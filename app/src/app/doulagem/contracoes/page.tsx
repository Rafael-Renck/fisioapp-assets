"use client";

import Link from "next/link";
import { useState } from "react";
import { ContractionTracker } from "../../../components/contraction-tracker";
import { ConfirmDialog } from "../../../components/confirm-dialog";
import { usePatients } from "../../../components/patients-provider";
import { Icon } from "../../../components/icon";

export default function ProfessionalContractionsPage() {
  const { patients } = usePatients();
  const [patientId, setPatientId] = useState("");
  const [invite, setInvite] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [accessOverride, setAccessOverride] = useState<Record<string, boolean>>({});
  const patient = patients.find(item => item.id === patientId);
  const accessActive = accessOverride[patientId] ?? !!patient?.portalAccessActive;
  const activePatients = patients.filter(item => item.status !== "Arquivado" && item.status !== "Alta");
  async function createInvite() {
    setBusy(true); setError(""); setInvite("");
    try {
      const response = await fetch("/api/doulagem/convites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ patientId }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível gerar o link.");
      setInvite(`${window.location.origin}${result.path}`);
      setAccessOverride(current => ({ ...current, [patientId]: true }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível gerar o link."); }
    finally { setBusy(false); }
  }
  async function deactivate() {
    setBusy(true); setError(""); setInvite("");
    try {
      const response = await fetch("/api/doulagem/convites", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ patientId }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível desativar o acesso.");
      setAccessOverride(current => ({ ...current, [patientId]: false }));
      setConfirmDeactivate(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível desativar o acesso."); setConfirmDeactivate(false); }
    finally { setBusy(false); }
  }
  return <div className="contraction-page"><ConfirmDialog open={confirmDeactivate} title="Desativar acesso?" description={patient ? `O link de ${patient.name} deixará de funcionar. Os registros já feitos permanecerão no acompanhamento.` : ""} confirmLabel="Desativar acesso" busy={busy} onConfirm={() => void deactivate()} onCancel={() => setConfirmDeactivate(false)} /><Link className="record-back" href="/doulagem">← Voltar à doulagem</Link><div className="page-heading"><div><p className="eyebrow">DOULAGEM</p><h1>Contrações</h1><p className="muted">Veja o ritmo, a duração e a intensidade das contrações da paciente.</p></div></div><section className="panel contraction-patient-panel"><label>Paciente<select value={patientId} onChange={event => { setPatientId(event.target.value); setInvite(""); setError(""); }}><option value="">Selecione uma paciente</option>{activePatients.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>{patient && <div className="contraction-access"><div><strong>Acesso da paciente</strong><small>{accessActive ? "Ativo" : invite ? "Link pronto para envio" : "Link necessário"}. O link permanece ativo até ser substituído ou desativado.</small></div><button type="button" className="secondary" disabled={busy} onClick={createInvite}><Icon name="plus" size={16} /> {accessActive ? "Gerar novo link" : "Gerar link"}</button>{accessActive && <button type="button" className="secondary" disabled={busy} onClick={() => setConfirmDeactivate(true)}>Desativar acesso</button>}</div>}{error && <p className="contraction-access-message" role="status">{error}</p>}{invite && <div className="contraction-invite"><label>Link individual da paciente<input readOnly value={invite} onFocus={event => event.target.select()} /></label><button type="button" className="secondary" onClick={() => void navigator.clipboard.writeText(invite)}>Copiar link</button></div>}</section>{patientId ? <ContractionTracker key={patientId} patientId={patientId} /> : <div className="panel contraction-select-empty"><Icon name="heart" size={30} /><h2>Selecione uma paciente</h2><p>O cronômetro e o histórico aparecerão aqui.</p></div>}</div>;
}
