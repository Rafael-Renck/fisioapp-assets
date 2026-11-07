"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ContractionTracker } from "../../../components/contraction-tracker";
import Image from "next/image";

export default function PatientLinkPage() {
  const { token } = useParams<{ token: string }>();
  const [patientName, setPatientName] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    fetch(`/api/patient-invite?token=${encodeURIComponent(token)}`, { cache: "no-store" }).then(async response => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Link indisponível.");
      return result;
    }).then(result => setPatientName(result.patientName)).catch(cause => setError(cause instanceof Error ? cause.message : "Link indisponível."));
  }, [token]);
  return <main className="patient-contractions-page"><header className="patient-contractions-header"><div className="patient-contractions-brand"><span><Image src="/logo-mark.svg" alt="" width={32} height={32} /></span><strong>fisioapp</strong></div></header><div className="patient-contractions-content"><div className="page-heading"><div><p className="eyebrow">DOULAGEM</p><h1>Minhas contrações</h1><p className="muted">{patientName ? `${patientName}, registre cada contração e acompanhe os intervalos.` : "Registre cada contração e acompanhe os intervalos."}</p></div></div>{error ? <p className="form-error" role="alert">{error}</p> : patientName ? <ContractionTracker accessToken={token} /> : <p className="muted" role="status">Abrindo seu acompanhamento...</p>}</div></main>;
}
