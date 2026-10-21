"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

export type Patient = { id: string; name: string; phone: string; email: string };
type PatientsContext = { patients: Patient[]; addPatient: (patient: Omit<Patient, "id">) => void };
const Context = createContext<PatientsContext | null>(null);

export function PatientsProvider({ children }: { children: ReactNode }) {
  const [patients, setPatients] = useState<Patient[]>([]);
  function addPatient(patient: Omit<Patient, "id">) {
    setPatients(current => [...current, { ...patient, id: crypto.randomUUID() }]);
  }
  return <Context.Provider value={{ patients, addPatient }}>{children}</Context.Provider>;
}

export function usePatients() {
  const context = useContext(Context);
  if (!context) throw new Error("PatientsProvider é necessário.");
  return context;
}
