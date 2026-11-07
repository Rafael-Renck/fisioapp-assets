import type { DoulaService } from "./store";

// O modelo informa apenas o preço do pacote; não atribui preços a cada serviço.
export const defaultDoulaServices: DoulaService[] = [
  { description: "Dois encontros pré-parto (aula de parto), online ou presenciais conforme a necessidade", amountCents: null },
  { description: "Consultoria na escrita do plano de parto", amountCents: null },
  { description: "Plantão e assistência presencial no trabalho de parto, parto e pós-parto imediato", amountCents: null },
  { description: "Print de placenta personalizado", amountCents: null },
  { description: "Taping pós-parto e laser", amountCents: null },
  { description: "Consultoria em aleitamento humano", amountCents: null },
];

export function splitDoulaBalance(balanceCents: number, installmentCount: number): number[] {
  if (!Number.isSafeInteger(balanceCents) || balanceCents < 0 || !Number.isSafeInteger(installmentCount) || (balanceCents === 0 ? installmentCount !== 0 : installmentCount < 1 || installmentCount > balanceCents)) throw new Error("Saldo ou quantidade de parcelas inválidos.");
  if (balanceCents === 0) return [];
  const base = Math.floor(balanceCents / installmentCount);
  const remainder = balanceCents % installmentCount;
  return Array.from({ length: installmentCount }, (_, index) => base + (index < remainder ? 1 : 0));
}
