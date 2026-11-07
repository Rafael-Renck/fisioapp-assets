import { errorResponse, readDb, requireObject, updateDb, validDate, type DoulaContract, type DoulaDeposit, type DoulaPaymentAllocation, type DoulaService } from "../../../lib/store";
import { forbidden, noStore, clinicalSpace } from "../../../lib/platform";
import { splitDoulaBalance } from "../../../lib/doula";

export const runtime = "nodejs";
const paymentMethods = ["Pix", "Cartão de crédito", "Cartão de débito", "Transferência bancária", "Boleto", "Dinheiro"];

export async function GET(request: Request) {
  const spaceId = await clinicalSpace(request);
  if (!spaceId) return forbidden();
  return noStore(Response.json((await readDb(spaceId)).doulaContracts));
}

async function saveContract(request: Request, editing: boolean) {
  const spaceId = await clinicalSpace(request);
  if (!spaceId) return forbidden();
  try {
    const body = requireObject(await request.json());
    const patientId = String(body.patientId || "");
    const title = String(body.title || "").trim();
    const amountCents = Number(body.amountCents);
    const dates = body.dueDates;
    if (!Array.isArray(body.services) || body.services.length < 1 || body.services.length > 30) throw new Error("Informe os serviços do contrato.");
    const services: DoulaService[] = body.services.map(value => {
      const item = requireObject(value);
      const description = typeof item.description === "string" ? item.description.trim() : "";
      const price = item.amountCents;
      if (!description || description.length > 250 || (price !== null && (!Number.isSafeInteger(price) || Number(price) < 0 || Number(price) > 100_000_000))) throw new Error("Revise a descrição e o valor de cada serviço.");
      return { description, amountCents: price as number | null };
    });
    const rawDetails = requireObject(body.details);
    const detailLimits = { clientName: 120, clientCpf: 20, clientRg: 30, clientAddress: 250, clientPhone: 30, clientEmail: 254, doulaName: 120, doulaCpf: 20, doulaRg: 30, doulaAddress: 250, doulaPhone: 30, doulaEmail: 254, backupName: 120, backupPhone: 30, city: 100, contractDate: 10, paymentMethod: 120 } as const;
    const details = Object.fromEntries(Object.entries(detailLimits).map(([key, limit]) => {
      const value = rawDetails[key];
      if (typeof value !== "string" || value.trim().length > limit) throw new Error(`Campo ${key} inválido.`);
      return [key, value.trim()];
    })) as unknown as NonNullable<DoulaContract["details"]>;
    if (rawDetails.pixKey !== undefined && typeof rawDetails.pixKey !== "string") throw new Error("Chave Pix inválida.");
    details.pixKey = String(rawDetails.pixKey || "").trim();
    if (details.pixKey.length > 160) throw new Error("Chave Pix inválida.");
    if (rawDetails.signatureImage !== undefined && typeof rawDetails.signatureImage !== "string") throw new Error("Assinatura inválida.");
    details.signatureImage = String(rawDetails.signatureImage || "");
    if (details.signatureImage && (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(details.signatureImage) || details.signatureImage.length > 1_400_000)) throw new Error("Assinatura inválida.");
    details.city = "Recife";
    if (!details.clientName || !details.doulaName || !validDate(details.contractDate)) throw new Error("Informe contratante, doula e data do contrato.");
    const rawAllocations = body.paymentAllocations === undefined ? [{ method: details.paymentMethod, amountCents }] : body.paymentAllocations;
    if (!Array.isArray(rawAllocations) || rawAllocations.length < 1 || rawAllocations.length > 2) throw new Error("Informe uma ou duas formas de pagamento.");
    const paymentAllocations: DoulaPaymentAllocation[] = rawAllocations.map(value => {
      const item = requireObject(value);
      if (typeof item.method !== "string" || !paymentMethods.includes(item.method) || !Number.isSafeInteger(item.amountCents) || Number(item.amountCents) <= 0) throw new Error("Revise as formas de pagamento e seus valores.");
      return { method: item.method, amountCents: Number(item.amountCents) };
    });
    if (new Set(paymentAllocations.map(item => item.method)).size !== paymentAllocations.length || paymentAllocations.reduce((sum, item) => sum + item.amountCents, 0) !== amountCents) throw new Error("Os valores das formas de pagamento devem somar o total do contrato, sem repetir a forma.");
    if (paymentAllocations.some(item => item.method === "Pix") && !details.pixKey) throw new Error("Informe a chave Pix da doula.");
    details.paymentMethod = paymentAllocations.map(item => item.method).join(" + ");
    let deposit: DoulaDeposit | undefined;
    if (body.deposit !== undefined && body.deposit !== null) {
      const raw = requireObject(body.deposit);
      const depositCents = Number(raw.amountCents);
      const method = String(raw.method || "");
      const paidOn = String(raw.paidOn || "");
      const received = raw.received === undefined ? true : raw.received;
      const todayInRecife = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Recife", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
      const existingPaidDeposit = editing ? (await readDb(spaceId)).doulaContracts.find(contract => contract.id === body.contractId)?.deposit : undefined;
      const preservesEarlyPayment = existingPaidDeposit?.paidAt && (existingPaidDeposit.dueDate || existingPaidDeposit.paidAt.slice(0, 10)) === paidOn && existingPaidDeposit.amountCents === depositCents && existingPaidDeposit.method === method;
      if (!Number.isSafeInteger(depositCents) || depositCents <= 0 || depositCents > amountCents || !paymentAllocations.some(item => item.method === method && item.amountCents >= depositCents) || !validDate(paidOn) || typeof received !== "boolean" || (received && paidOn > todayInRecife && !preservesEarlyPayment)) throw new Error("Revise o valor, a forma e a data do sinal.");
      deposit = { amountCents: depositCents, method, dueDate: paidOn, paidAt: received ? `${paidOn}T12:00:00.000Z` : null };
    }
    const balanceCents = amountCents - (deposit?.amountCents || 0);
    if (!title || title.length > 120 || !Number.isSafeInteger(amountCents) || amountCents <= 0 || amountCents > 100_000_000 || !Array.isArray(dates) || dates.length > 24 || !dates.every(validDate) || (balanceCents > 0 && (dates.length < 1 || dates.length > balanceCents)) || (balanceCents === 0 && dates.length !== 0)) throw new Error("Revise o título, valor e vencimentos do contrato.");
    const individuallyPriced = services.filter(service => service.amountCents !== null);
    const itemizedTotal = individuallyPriced.reduce((sum, service) => sum + (service.amountCents || 0), 0);
    if (itemizedTotal > amountCents || (individuallyPriced.length === services.length && itemizedTotal !== amountCents)) throw new Error("A soma dos serviços deve corresponder ao valor total do contrato.");
    if (new Set(dates).size !== dates.length) throw new Error("Os vencimentos devem ser diferentes.");
    const contract = await updateDb(spaceId, db => {
      const existing = editing ? db.doulaContracts.find(contract => contract.id === body.contractId) : undefined;
      if (editing && !existing) throw new Error("Contrato não encontrado.");
      if (existing ? existing.patientId !== patientId : !db.patients.some(patient => patient.id === patientId && patient.status !== "Arquivado" && patient.status !== "Alta")) throw new Error("Selecione a paciente do contrato.");
      const installmentAmounts = splitDoulaBalance(balanceCents, dates.length);
      if (existing?.deposit?.paidAt && deposit && existing.deposit.amountCents === deposit.amountCents && existing.deposit.method === deposit.method && (existing.deposit.dueDate || existing.deposit.paidAt.slice(0, 10)) === deposit.dueDate && deposit.paidAt) deposit.paidAt = existing.deposit.paidAt;
      if (existing && (existing.deposit?.paidAt || existing.installments.some(part => part.paidAt))) {
        const sameAllocations = JSON.stringify(existing.paymentAllocations || [{ method: existing.details?.paymentMethod, amountCents: existing.amountCents }]) === JSON.stringify(paymentAllocations);
        const sameInstallments = existing.installments.length === dates.length && existing.installments.every((part, index) => part.dueDate === dates[index] && part.amountCents === installmentAmounts[index]);
        const sameDeposit = existing.deposit ? Boolean(deposit && existing.deposit.amountCents === deposit.amountCents && existing.deposit.method === deposit.method && (existing.deposit.dueDate || existing.deposit.paidAt?.slice(0, 10)) === deposit.dueDate && existing.deposit.paidAt === deposit.paidAt) : !deposit;
        if (existing.amountCents !== amountCents || !sameAllocations || !sameInstallments || !sameDeposit) throw new Error("Há pagamentos registrados. Preserve os valores, formas, sinal e parcelas ao editar este contrato.");
      }
      const item: DoulaContract = {
        id: existing?.id || crypto.randomUUID(), patientId, title, amountCents, createdAt: existing?.createdAt || new Date().toISOString(), details, services, paymentAllocations, ...(deposit ? { deposit } : {}),
        installments: (dates as string[]).map((dueDate, index) => ({ id: existing?.installments[index]?.id || crypto.randomUUID(), dueDate, amountCents: installmentAmounts[index], paidAt: existing?.installments[index]?.paidAt || null })),
      };
      if (existing) db.doulaContracts[db.doulaContracts.indexOf(existing)] = item;
      else db.doulaContracts.push(item);
      return item;
    });
    return noStore(Response.json(contract, { status: editing ? 200 : 201 }));
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) { return saveContract(request, false); }
export async function PUT(request: Request) { return saveContract(request, true); }

export async function PATCH(request: Request) {
  const spaceId = await clinicalSpace(request);
  if (!spaceId) return forbidden();
  try {
    const body = requireObject(await request.json());
    if (body.settlePaid !== undefined) {
      if (typeof body.contractId !== "string" || body.settlePaid !== true) throw new Error("Baixa do contrato inválida.");
      const contract = await updateDb(spaceId, db => {
        const item = db.doulaContracts.find(contract => contract.id === body.contractId);
        if (!item) throw new Error("Contrato não encontrado.");
        const paidAt = new Date().toISOString();
        if (item.deposit && !item.deposit.paidAt) item.deposit.paidAt = paidAt;
        item.installments.forEach(installment => {
          if (!installment.paidAt) installment.paidAt = paidAt;
        });
        return item;
      });
      return noStore(Response.json(contract));
    }
    if (body.depositPaid !== undefined) {
      if (typeof body.contractId !== "string" || typeof body.depositPaid !== "boolean") throw new Error("Sinal inválido.");
      const contract = await updateDb(spaceId, db => {
        const item = db.doulaContracts.find(contract => contract.id === body.contractId);
        if (!item?.deposit) throw new Error("Sinal não encontrado.");
        item.deposit.paidAt = body.depositPaid ? new Date().toISOString() : null;
        if (!item.deposit.dueDate) item.deposit.dueDate = item.deposit.paidAt?.slice(0, 10) || new Date().toISOString().slice(0, 10);
        return item;
      });
      return noStore(Response.json(contract));
    }
    if (typeof body.contractId !== "string" || typeof body.installmentId !== "string" || typeof body.paid !== "boolean") throw new Error("Pagamento inválido.");
    const contract = await updateDb(spaceId, db => {
      const item = db.doulaContracts.find(contract => contract.id === body.contractId);
      const installment = item?.installments.find(part => part.id === body.installmentId);
      if (!item || !installment) throw new Error("Parcela não encontrada.");
      installment.paidAt = body.paid ? new Date().toISOString() : null;
      return item;
    });
    return noStore(Response.json(contract));
  } catch (error) { return errorResponse(error); }
}
