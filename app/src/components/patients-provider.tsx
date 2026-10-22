"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Patient } from "../lib/store";

export type { Patient };
type PatientInput = Omit<Patient, "id" | "createdAt" | "updatedAt" | "portalAccessActive" | "status">;
type PatientsContext = {
  patients: Patient[];
  addPatient: (patient: PatientInput) => Promise<Patient>;
  updatePatient: (id: string, patient: PatientInput) => Promise<Patient>;
  setArchived: (id: string, archived: boolean) => Promise<Patient>;
};
const Context = createContext<PatientsContext | null>(null);

export function PatientsProvider({ children }: { children: ReactNode }) {
  const [patients, setPatients] = useState<Patient[]>([]);
  useEffect(() => { fetch("/api/patients").then(response => response.json()).then(setPatients).catch(() => undefined); }, []);
  async function addPatient(patient: PatientInput) {
    const response = await fetch("/api/patients", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patient) });
    const saved = await response.json();
    if (!response.ok) throw new Error(saved.error || "Não foi possível salvar o paciente.");
    setPatients(current => [...current, saved]);
    return saved as Patient;
  }
  async function updatePatient(id: string, patient: PatientInput) {
    const response = await fetch("/api/patients", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...patient, id }) });
    const saved = await response.json();
    if (!response.ok) throw new Error(saved.error || "Não foi possível atualizar o paciente.");
    setPatients(current => current.map(item => item.id === id ? saved : item));
    return saved as Patient;
  }
  async function setArchived(id: string, archived: boolean) {
    const response = await fetch("/api/patients", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, archived }) });
    const saved = await response.json();
    if (!response.ok) throw new Error(saved.error || "Não foi possível atualizar o paciente.");
    setPatients(current => current.map(item => item.id === id ? saved : item));
    return saved as Patient;
  }
  return <Context.Provider value={{ patients, addPatient, updatePatient, setArchived }}>{children}</Context.Provider>;
}

export function usePatients() {
  const context = useContext(Context);
  if (!context) throw new Error("PatientsProvider é necessário.");
  return context;
}
