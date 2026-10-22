"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Patient = { id: string; name: string; phone: string; email: string };
type PatientsContext = { patients: Patient[]; addPatient: (patient: Omit<Patient, "id">) => Promise<Patient> };
const Context = createContext<PatientsContext | null>(null);

export function PatientsProvider({ children }: { children: ReactNode }) {
  const [patients, setPatients] = useState<Patient[]>([]);
  useEffect(() => { fetch("/api/patients").then(response => response.json()).then(setPatients).catch(() => undefined); }, []);
  async function addPatient(patient: Omit<Patient, "id">) {
    const response = await fetch("/api/patients", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patient) });
    const saved = await response.json();
    if (!response.ok) throw new Error(saved.error || "Não foi possível salvar o paciente.");
    setPatients(current => [...current, saved]);
    return saved as Patient;
  }
  return <Context.Provider value={{ patients, addPatient }}>{children}</Context.Provider>;
}

export function usePatients() {
  const context = useContext(Context);
  if (!context) throw new Error("PatientsProvider é necessário.");
  return context;
}
