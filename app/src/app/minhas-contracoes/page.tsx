"use client";

import { ContractionTracker } from "../../components/contraction-tracker";
import Image from "next/image";

export default function PatientContractionsPage() {
  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); location.href = "/login"; }
  return <main className="patient-contractions-page"><header className="patient-contractions-header"><div className="patient-contractions-brand"><span><Image src="/logo-mark.svg" alt="" width={32} height={32} /></span><strong>fisioapp</strong></div><button className="secondary" onClick={logout}>Sair</button></header><div className="patient-contractions-content"><div className="page-heading"><div><p className="eyebrow">DOULAGEM</p><h1>Minhas contrações</h1><p className="muted">Registre cada contração e acompanhe os intervalos.</p></div></div><ContractionTracker /></div></main>;
}
