import { requireObject, validDate, type AnamnesisData, type EvolutionData, type TreatmentPlanData } from "./store";

function field(input: Record<string, unknown>, key: string, label: string, max = 5000) {
  const value = input[key];
  if (typeof value !== "string") throw new Error(`${label} inválido.`);
  const text = value.trim();
  if (text.length > max) throw new Error(`${label} excede ${max} caracteres.`);
  return text;
}

export function parseAnamnesis(value: unknown): AnamnesisData {
  const input = requireObject(value);
  const data = {
    chiefComplaint: field(input, "chiefComplaint", "Queixa principal"),
    currentHistory: field(input, "currentHistory", "História atual"),
    pastHistory: field(input, "pastHistory", "História pregressa"),
    medications: field(input, "medications", "Medicamentos"),
    physicalExam: field(input, "physicalExam", "Exame físico"),
    goals: field(input, "goals", "Objetivos"),
    proposedTreatment: field(input, "proposedTreatment", "Plano proposto"),
    bodyRegions: field(input, "bodyRegions", "Partes do corpo"),
  };
  if (!data.chiefComplaint) throw new Error("Informe a queixa principal.");
  return data;
}

export function parseEvolution(value: unknown): EvolutionData {
  const input = requireObject(value);
  const date = field(input, "date", "Data", 10);
  const description = field(input, "description", "Evolução", 10000);
  if (!validDate(date) || !description) throw new Error("Informe uma data válida e a descrição da evolução.");
  return { date, description };
}

export function parsePlan(value: unknown): TreatmentPlanData {
  const input = requireObject(value);
  const diagnosis = field(input, "diagnosis", "Diagnóstico");
  const startDate = field(input, "startDate", "Data de início", 10);
  const reviewDate = field(input, "reviewDate", "Data de reavaliação", 10);
  const status = input.status;
  if (!diagnosis || !validDate(startDate) || (reviewDate && !validDate(reviewDate)) || !["Ativo", "Pausado", "Concluído"].includes(String(status))) throw new Error("Revise o diagnóstico, as datas e o estado do plano.");
  if (!Array.isArray(input.goals) || input.goals.length > 30 || !input.goals.every(item => typeof item === "string" && item.trim().length <= 500)) throw new Error("Metas inválidas.");
  if (!Array.isArray(input.interventions) || input.interventions.length > 30) throw new Error("Intervenções inválidas.");
  const interventions = input.interventions.map(value => {
    const item = requireObject(value);
    const description = field(item, "description", "Descrição da intervenção", 500);
    const frequency = field(item, "frequency", "Frequência", 120);
    const dosage = field(item, "dosage", "Séries e repetições", 120);
    if (!description) throw new Error("Descreva cada intervenção.");
    return { description, frequency, dosage };
  });
  return { diagnosis, startDate, reviewDate, status: status as TreatmentPlanData["status"], goals: input.goals.map(item => String(item).trim()).filter(Boolean), interventions };
}
