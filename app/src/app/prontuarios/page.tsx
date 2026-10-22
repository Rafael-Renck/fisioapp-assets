"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Icon } from "../../components/icon";
import { usePatients } from "../../components/patients-provider";

export default function RecordsPage() {
  const { patients } = usePatients();
  const [query, setQuery] = useState("");
  const shown = useMemo(() => patients
    .filter(patient => patient.name.toLocaleLowerCase("pt-BR").includes(query.trim().toLocaleLowerCase("pt-BR")))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")), [patients, query]);
  return <div className="records-index">
    <div className="page-heading"><div><p className="eyebrow">CUIDADO EM CADA DETALHE</p><h1>Prontuários</h1><p className="muted">Anamneses, evoluções e planos de tratamento dos seus pacientes.</p></div><Link className="secondary" href="/pacientes">Gerenciar pacientes</Link></div>
    <section className="panel records-list-panel" aria-label="Prontuários dos pacientes">
      <div className="patients-toolbar"><div className="search"><Icon name="search" size={20} /><input type="search" aria-label="Buscar prontuário pelo nome" placeholder="Buscar paciente pelo nome..." value={query} onChange={event => setQuery(event.target.value)} /></div><span className="results-count">{shown.length} {shown.length === 1 ? "prontuário" : "prontuários"}</span></div>
      {shown.length ? <div className="records-list">{shown.map(patient => <Link className="records-list-item" href={`/pacientes/${encodeURIComponent(patient.id)}`} key={patient.id}><span className="patient-avatar">{patient.name.split(/\s+/).slice(0, 2).map(part => part[0]).join("").toLocaleUpperCase("pt-BR")}</span><span className="records-list-copy"><strong>{patient.name}</strong><small>{patient.id}{patient.careType && patient.careType !== "Default" ? ` · ${patient.careType}` : ""}</small></span><span className={patient.status === "Arquivado" ? "record-list-archived" : "record-list-active"}>{patient.status === "Arquivado" ? "Arquivado" : "Ativo"}</span><Icon name="arrow" size={17} /></Link>)}</div> : <div className="patients-empty"><span className="large-icon"><Icon name={query ? "search" : "notes"} size={35} /></span><h2>{query ? "Nenhum paciente encontrado" : "Nenhum prontuário ainda"}</h2><p>{query ? "Tente buscar por outro nome." : "Cadastre um paciente para começar o acompanhamento clínico."}</p>{!query && <Link className="primary" href="/pacientes?novo=1">Cadastrar paciente</Link>}</div>}
    </section>
  </div>;
}
