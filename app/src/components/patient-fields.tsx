"use client";

import { useEffect, useState } from "react";
import type { Patient } from "../lib/store";

export function patientFromForm(data: FormData): Omit<Patient, "id" | "createdAt" | "updatedAt"> {
  const value = (name: string) => String(data.get(name) || "").trim();
  return {
    name: value("name"), phone: value("phone"), email: value("email"),
    birthDate: value("birthDate"), insurance: value("insurance"), notes: value("patientNotes"),
    pregnant: data.get("pregnant") === "on", dueDate: value("dueDate"),
    careType: value("careType") || "Default", source: value("source"),
    referringDoctor: value("referringDoctor"),
  };
}

export function PatientFields({ prefix, patient }: { prefix: string; patient?: Patient }) {
  const [pregnant, setPregnant] = useState(patient?.pregnant || false);
  const [insuranceOptions, setInsuranceOptions] = useState<string[]>(["Particular"]);
  useEffect(() => { fetch("/api/settings").then(response => response.ok ? response.json() : null).then(data => { if (Array.isArray(data?.insurances)) setInsuranceOptions(data.insurances); }).catch(() => undefined); }, []);
  return <div className="patient-fields">
    <div className="patient-fields-grid">
      <label htmlFor={`${prefix}-name`}>Nome completo <span aria-hidden="true">*</span><input id={`${prefix}-name`} name="name" required minLength={2} maxLength={120} autoComplete="name" placeholder="Nome do paciente" defaultValue={patient?.name || ""} /></label>
      <label htmlFor={`${prefix}-birth`}>Data de nascimento<input id={`${prefix}-birth`} name="birthDate" type="date" defaultValue={patient?.birthDate || ""} /></label>
      <label htmlFor={`${prefix}-phone`}>Telefone<input id={`${prefix}-phone`} name="phone" type="tel" maxLength={30} autoComplete="tel" placeholder="(00) 00000-0000" defaultValue={patient?.phone || ""} /></label>
      <label htmlFor={`${prefix}-email`}>E-mail <span aria-hidden="true">*</span><input id={`${prefix}-email`} name="email" type="email" required maxLength={254} autoComplete="email" placeholder="paciente@email.com" defaultValue={patient?.email || ""} /></label>
      <label htmlFor={`${prefix}-insurance`}>Convênio<input id={`${prefix}-insurance`} name="insurance" maxLength={120} list={`${prefix}-insurance-options`} defaultValue={patient?.insurance || ""} /><datalist id={`${prefix}-insurance-options`}>{insuranceOptions.map(name => <option key={name} value={name} />)}</datalist></label>
      <label htmlFor={`${prefix}-care`}>Tipo de atendimento<input id={`${prefix}-care`} name="careType" maxLength={120} defaultValue={patient?.careType || "Default"} /></label>
      <label htmlFor={`${prefix}-source`}>Origem do paciente<input id={`${prefix}-source`} name="source" maxLength={120} defaultValue={patient?.source || ""} /></label>
      <label htmlFor={`${prefix}-doctor`}>Médico indicador<input id={`${prefix}-doctor`} name="referringDoctor" maxLength={120} defaultValue={patient?.referringDoctor || ""} /></label>
    </div>
    <div className="patient-pregnancy"><label htmlFor={`${prefix}-pregnant`}><input id={`${prefix}-pregnant`} name="pregnant" type="checkbox" checked={pregnant} onChange={event => setPregnant(event.target.checked)} /> Gestante</label>{pregnant && <label htmlFor={`${prefix}-due`}>Data provável do parto<input id={`${prefix}-due`} name="dueDate" type="date" defaultValue={patient?.dueDate || ""} /></label>}</div>
    <label htmlFor={`${prefix}-notes`}>Observações do paciente<textarea id={`${prefix}-notes`} name="patientNotes" maxLength={2000} rows={3} defaultValue={patient?.notes || ""} /></label>
  </div>;
}
