import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { PrintDocumentButton } from "../../../../../components/print-document-button";
import { DocumentEndmark, DocumentLetterhead } from "../../../../../components/printable-document";
import { canAccessClinical, getSession } from "../../../../../lib/platform";
import { readDb } from "../../../../../lib/store";

const dateLabel = (value: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${value}T12:00:00Z`));

export default async function ClinicalReportPage({ params }: { params: Promise<{ id: string; entryId: string }> }) {
  const { id, entryId } = await params;
  const requestHeaders = await headers();
  const request = new Request("http://localhost", { headers: requestHeaders });
  const session = await getSession(request);
  if (!session?.space || session.user.mustChangePassword || !canAccessClinical(session.user.role)) redirect("/login");
  const db = await readDb(session.space.id);
  const patient = db.patients.find(item => item.id === id);
  const entry = db.clinicalEntries.find(item => item.id === entryId && item.patientId === id && item.kind === "report");
  if (!patient || !entry || entry.kind !== "report") notFound();
  const data = entry.data;
  return <main className="clinical-report-page"><div className="clinical-report-toolbar"><Link href={`/pacientes/${encodeURIComponent(id)}?aba=laudos`}>← Voltar ao prontuário</Link><PrintDocumentButton /></div><article className="clinical-report-document printable-document"><DocumentLetterhead type="Documento clínico" title={data.title} subtitle={dateLabel(data.date)} /><dl className="clinical-report-identification"><div><dt>Paciente</dt><dd>{patient.name}</dd></div><div><dt>Identificação no prontuário</dt><dd>{patient.id}</dd></div>{patient.birthDate && <div><dt>Data de nascimento</dt><dd>{dateLabel(patient.birthDate)}</dd></div>}</dl>{[
    ["Finalidade", data.purpose], ["Avaliação fisioterapêutica", data.assessment], ["Achados clínicos", data.findings], ["Conclusão", data.conclusion], ["Orientações", data.recommendations],
  ].filter(([, value]) => !!value).map(([title, value]) => <section key={title}><h2>{title}</h2><p>{value}</p></section>)}<footer><div className="clinical-report-signature"><span /> <strong>{data.professionalName}</strong><small>{data.professionalRegistration}</small></div><p>Registro criado no prontuário em {new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(entry.createdAt))}.</p></footer><DocumentEndmark label="Laudo fisioterapêutico" /></article></main>;
}
