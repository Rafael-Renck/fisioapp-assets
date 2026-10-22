import { PatientRecord } from "../../../components/patient-record";
import { validDate } from "../../../lib/store";

export default async function PatientRecordPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ aba?: string; data?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  return <PatientRecord id={id} initialTab={query.aba === "evolucoes" ? "evolutions" : "overview"} initialDate={validDate(query.data) ? query.data : undefined} />;
}
