import { PatientRecord } from "../../../components/patient-record";

export default async function PatientRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PatientRecord id={id} />;
}
