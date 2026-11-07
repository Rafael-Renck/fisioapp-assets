"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Icon } from "../../components/icon";
import { usePatients } from "../../components/patients-provider";
import { defaultDoulaServices } from "../../lib/doula";
import type { DoulaContract } from "../../lib/store";

type Details = NonNullable<DoulaContract["details"]>;
type ServiceDraft = { description: string; amount: string };
type PaymentDraft = { method: string; amount: string };
const initialDetails: Details = { clientName: "", clientCpf: "", clientRg: "", clientAddress: "", clientPhone: "", clientEmail: "", doulaName: "Renata Michelle Batista André Renck", doulaCpf: "070.996.444-75", doulaRg: "7716803", doulaAddress: "Rua Costa Brava, 520, Maranguape 2 - Paulista/PE, CEP 53422-650", doulaPhone: "(81) 9 7338-4714", doulaEmail: "batistarenata767@gmail.com", backupName: "Tatiane Maria", backupPhone: "(81) 9 9435-7583", city: "Recife", contractDate: "", paymentMethod: "" };
const initialServices = (): ServiceDraft[] => defaultDoulaServices.map(service => ({ description: service.description, amount: "" }));
const paymentMethods = ["Pix", "Cartão de crédito", "Cartão de débito", "Transferência bancária", "Boleto", "Dinheiro"];
const clientFields: { key: keyof Details; label: string; type?: string }[] = [
  { key: "clientName", label: "Nome da contratante" }, { key: "clientCpf", label: "CPF" }, { key: "clientRg", label: "RG" }, { key: "clientAddress", label: "Endereço" }, { key: "clientPhone", label: "Telefone" }, { key: "clientEmail", label: "E-mail", type: "email" },
];
const doulaFields: { key: keyof Details; label: string; type?: string }[] = [
  { key: "doulaName", label: "Nome da doula" }, { key: "doulaCpf", label: "CPF" }, { key: "doulaRg", label: "RG" }, { key: "doulaAddress", label: "Endereço" }, { key: "doulaPhone", label: "Telefone" }, { key: "doulaEmail", label: "E-mail", type: "email" }, { key: "backupName", label: "Doula backup" }, { key: "backupPhone", label: "Telefone da backup" },
];
const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const dateLabel = (date: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Recife", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
function parseReais(value: string): number | null {
  const normalized = value.trim().replace(/\./g, "").replace(",", ".");
  return /^\d+(?:\.\d{1,2})?$/.test(normalized) ? Math.round(Number(normalized) * 100) : null;
}

export default function DoulagemPage() {
  const { patients } = usePatients();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [contracts, setContracts] = useState<DoulaContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [modalError, setModalError] = useState("");
  const [query, setQuery] = useState("");
  const [patientId, setPatientId] = useState("");
  const [title, setTitle] = useState("Acompanhamento de doulagem");
  const [amount, setAmount] = useState("2.300,00");
  const [paymentAllocations, setPaymentAllocations] = useState<PaymentDraft[]>([{ method: "", amount: "2.300,00" }]);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositMethod, setDepositMethod] = useState("");
  const [depositDate, setDepositDate] = useState(today);
  const [depositReceived, setDepositReceived] = useState(true);
  const [services, setServices] = useState<ServiceDraft[]>(initialServices);
  const [dueDates, setDueDates] = useState([""]);
  const [saving, setSaving] = useState(false);
  const [details, setDetails] = useState<Details>(initialDetails);
  const [savedPixKey, setSavedPixKey] = useState("");
  const [savedSignatureImage, setSavedSignatureImage] = useState("");
  const [savingPixKey, setSavingPixKey] = useState(false);
  const [savingSignature, setSavingSignature] = useState(false);
  const [editingContract, setEditingContract] = useState<DoulaContract | null>(null);
  const [settlingContractId, setSettlingContractId] = useState("");

  useEffect(() => {
    fetch("/api/doulagem").then(async response => {
      if (!response.ok) throw new Error("Não foi possível carregar os contratos.");
      return response.json() as Promise<DoulaContract[]>;
    }).then(setContracts).catch(error => setNotice(error.message)).finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    fetch("/api/doulagem/pix").then(response => response.ok ? response.json() as Promise<{ pixKey: string }> : null).then(result => {
      if (!result?.pixKey) return;
      setSavedPixKey(result.pixKey);
      setDetails(current => ({ ...current, pixKey: current.pixKey || result.pixKey }));
    }).catch(() => {});
  }, []);
  useEffect(() => {
    fetch("/api/doulagem/assinatura").then(response => response.ok ? response.json() as Promise<{ signatureImage: string }> : null).then(result => {
      if (!result?.signatureImage) return;
      setSavedSignatureImage(result.signatureImage);
      setDetails(current => ({ ...current, signatureImage: current.signatureImage || result.signatureImage }));
    }).catch(() => {});
  }, []);
  useEffect(() => {
    const patient = patients.find(item => item.id === patientId);
    if (patient) setDetails(current => ({ ...current, clientName: patient.name, clientPhone: patient.phone, clientEmail: patient.email }));
  }, [patientId, patients]);

  function resetForm() {
    setEditingContract(null);
    setPatientId(""); setTitle("Acompanhamento de doulagem"); setAmount("2.300,00"); setPaymentAllocations([{ method: "", amount: "2.300,00" }]); setDepositAmount(""); setDepositMethod(""); setDepositDate(today()); setDepositReceived(true);
    setServices(initialServices()); setDueDates([""]); setDetails({ ...initialDetails, pixKey: savedPixKey, signatureImage: savedSignatureImage });
  }
  function closeDialog() { dialog.current?.close(); trigger.current?.focus(); }
  function openNewContract() { resetForm(); setModalError(""); dialog.current?.showModal(); }
  function openEditContract(contract: DoulaContract) {
    setEditingContract(contract);
    setPatientId(contract.patientId);
    setTitle(contract.title);
    setAmount(money(contract.amountCents).replace("R$", "").trim());
    setPaymentAllocations((contract.paymentAllocations?.length ? contract.paymentAllocations : [{ method: contract.details?.paymentMethod || "", amountCents: contract.amountCents }]).map(item => ({ method: item.method, amount: money(item.amountCents).replace("R$", "").trim() })));
    setDepositAmount(contract.deposit ? money(contract.deposit.amountCents).replace("R$", "").trim() : "");
    setDepositMethod(contract.deposit?.method || "");
    setDepositDate(contract.deposit?.dueDate || contract.deposit?.paidAt?.slice(0, 10) || today());
    setDepositReceived(Boolean(contract.deposit?.paidAt));
    setServices((contract.services?.length ? contract.services : defaultDoulaServices).map(item => ({ description: item.description, amount: item.amountCents === null ? "" : money(item.amountCents).replace("R$", "").trim() })));
    setDueDates(contract.installments.map(item => item.dueDate));
    setDetails({ ...initialDetails, ...contract.details, pixKey: contract.details?.pixKey || savedPixKey, signatureImage: contract.details?.signatureImage ?? savedSignatureImage });
    setModalError("");
    dialog.current?.showModal();
  }
  function updateDetail(key: keyof Details, value: string) { setDetails(current => ({ ...current, [key]: value })); }

  async function savePixKey() {
    const pixKey = details.pixKey?.trim();
    if (!pixKey) { setModalError("Informe a chave Pix antes de salvá-la como padrão."); return; }
    setSavingPixKey(true);
    try {
      const response = await fetch("/api/doulagem/pix", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pixKey }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível salvar a chave Pix.");
      setSavedPixKey(result.pixKey);
      setModalError("");
      setNotice("Chave Pix salva para os próximos contratos.");
    } catch (error) { setModalError(error instanceof Error ? error.message : "Não foi possível salvar a chave Pix."); }
    finally { setSavingPixKey(false); }
  }

  async function loadSignature(file: File | undefined) {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 1_000_000) { setModalError("Use uma imagem PNG, JPG ou WebP de até 1 MB."); return; }
    const reader = new FileReader();
    reader.onload = () => { if (typeof reader.result === "string") { updateDetail("signatureImage", reader.result); setModalError(""); } };
    reader.onerror = () => setModalError("Não foi possível ler a imagem da assinatura.");
    reader.readAsDataURL(file);
  }

  async function saveSignature() {
    setSavingSignature(true);
    try {
      const response = await fetch("/api/doulagem/assinatura", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ signatureImage: details.signatureImage || "" }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível salvar a assinatura.");
      setSavedSignatureImage(result.signatureImage);
      setModalError("");
      setNotice(result.signatureImage ? "Assinatura salva para os próximos contratos." : "Assinatura padrão removida.");
    } catch (error) { setModalError(error instanceof Error ? error.message : "Não foi possível salvar a assinatura."); }
    finally { setSavingSignature(false); }
  }

  async function createContract(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amountCents = parseReais(amount);
    if (amountCents === null || amountCents <= 0) { setModalError("Informe um valor total válido em reais."); return; }
    const allocations = paymentAllocations.map(item => ({ method: item.method, amountCents: parseReais(item.amount) }));
    if (allocations.some(item => !paymentMethods.includes(item.method) || item.amountCents === null || item.amountCents <= 0) || new Set(allocations.map(item => item.method)).size !== allocations.length || allocations.reduce((sum, item) => sum + (item.amountCents || 0), 0) !== amountCents) { setModalError("Os valores das formas de pagamento devem somar o total do contrato e usar formas diferentes."); return; }
    if (allocations.some(item => item.method === "Pix") && !details.pixKey?.trim()) { setModalError("Informe a chave Pix da doula para incluir no contrato."); return; }
    const depositCents = depositAmount.trim() ? parseReais(depositAmount) : 0;
    if (depositCents === null || depositCents < 0 || depositCents > amountCents || (depositCents > 0 && (!allocations.some(item => item.method === depositMethod && (item.amountCents || 0) >= depositCents) || !depositDate || (depositReceived && depositDate > today())))) { setModalError("Revise o valor, a forma e a data do sinal. Um sinal futuro deve ficar como previsto."); return; }
    const balanceCents = amountCents - depositCents;
    if (balanceCents > 0 && (dueDates.some(date => !date) || dueDates.length > balanceCents)) { setModalError("Informe os vencimentos do saldo restante."); return; }
    const parsedServices = services.map(service => ({ description: service.description.trim(), amountCents: service.amount.trim() ? parseReais(service.amount) : null }));
    if (parsedServices.some((service, index) => !service.description || (service.amountCents === null && services[index].amount.trim()))) { setModalError("Revise os serviços e seus valores."); return; }
    setModalError("");
    setSaving(true);
    try {
      const response = await fetch("/api/doulagem", { method: editingContract ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contractId: editingContract?.id, patientId, title, amountCents, dueDates: balanceCents > 0 ? dueDates : [], details, services: parsedServices, paymentAllocations: allocations, deposit: depositCents > 0 ? { amountCents: depositCents, method: depositMethod, paidOn: depositDate, received: depositReceived } : null }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível salvar.");
      setContracts(current => editingContract ? current.map(item => item.id === editingContract.id ? result : item) : [...current, result]);
      resetForm(); closeDialog();
      setNotice(editingContract ? "Contrato atualizado. O documento já reflete as alterações." : "Contrato cadastrado com sucesso.");
    } catch (error) { setModalError(error instanceof Error ? error.message : "Não foi possível salvar."); }
    finally { setSaving(false); }
  }

  async function setPaid(contractId: string, installmentId: string, paid: boolean) {
    try {
      const response = await fetch("/api/doulagem", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contractId, installmentId, paid }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível atualizar a parcela.");
      setContracts(current => current.map(item => item.id === contractId ? result : item));
      setNotice(paid ? "Pagamento registrado." : "Pagamento desfeito.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Não foi possível atualizar a parcela."); }
  }

  async function setDepositPaid(contractId: string, paid: boolean) {
    try {
      const response = await fetch("/api/doulagem", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contractId, depositPaid: paid }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível atualizar o sinal.");
      setContracts(current => current.map(item => item.id === contractId ? result : item));
      setNotice(paid ? "Sinal marcado como recebido." : "Recebimento do sinal desfeito.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Não foi possível atualizar o sinal."); }
  }

  async function settleContract(contract: DoulaContract) {
    const patient = patients.find(item => item.id === contract.patientId);
    if (!window.confirm(`Confirmar que o contrato de ${patient?.name || contract.details?.clientName || "paciente"} foi totalmente pago?`)) return;
    setSettlingContractId(contract.id);
    try {
      const response = await fetch("/api/doulagem", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contractId: contract.id, settlePaid: true }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível dar baixa no contrato.");
      setContracts(current => current.map(item => item.id === contract.id ? result : item));
      setNotice("Contrato baixado como totalmente pago.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Não foi possível dar baixa no contrato."); }
    finally { setSettlingContractId(""); }
  }

  const installments = contracts.flatMap(contract => contract.installments);
  const pending = installments.filter(part => !part.paidAt);
  const pendingDeposits = contracts.filter(contract => contract.deposit && !contract.deposit.paidAt).map(contract => ({ contract, deposit: contract.deposit! }));
  const overdue = pending.filter(part => part.dueDate < today());
  const nextPayments = [...contracts.flatMap(contract => contract.installments.filter(part => !part.paidAt).map(part => ({ contract, dueDate: part.dueDate, amountCents: part.amountCents, label: "Parcela" }))), ...pendingDeposits.map(({ contract, deposit }) => ({ contract, dueDate: deposit.dueDate || contract.createdAt.slice(0, 10), amountCents: deposit.amountCents, label: "Sinal" }))].sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 4);
  const activePatients = patients.filter(patient => patient.status !== "Arquivado" && patient.status !== "Alta");
  const selectablePatients = patients.filter(patient => activePatients.includes(patient) || patient.id === editingContract?.patientId);
  const financialLocked = Boolean(editingContract?.deposit?.paidAt || editingContract?.installments.some(part => part.paidAt));
  const previewTotal = parseReais(amount) || 0;
  const previewDeposit = parseReais(depositAmount || "0") || 0;
  const previewBalance = Math.max(0, previewTotal - previewDeposit);
  const filtered = contracts.filter(contract => {
    const patient = patients.find(item => item.id === contract.patientId);
    return `${patient?.name || ""} ${contract.title}`.toLocaleLowerCase("pt-BR").includes(query.trim().toLocaleLowerCase("pt-BR"));
  }).slice().reverse();

  return <div className="doula-page">
    <div className="page-heading doula-heading"><div><p className="eyebrow">ACOMPANHAMENTO DE DOULAGEM</p><h1>Doulagem</h1><p className="muted">Contratos, pagamentos e contrações das pacientes em um só lugar.</p></div><div className="doula-heading-actions"><Link href="/doulagem/contracoes" className="secondary"><Icon name="clock" size={18} /> Contrações</Link><button ref={trigger} className="primary" onClick={openNewContract}><Icon name="plus" size={18} /> Novo contrato</button></div></div>
    {notice && <div className="success-message" role="status">{notice}<button className="icon-button" aria-label="Fechar mensagem" onClick={() => setNotice("")}><Icon name="close" size={16} /></button></div>}
    <div className="doula-summary"><div className="panel"><small>Contratos cadastrados</small><strong>{contracts.length}</strong></div><div className="panel"><small>Sinais recebidos</small><strong>{money(contracts.reduce((sum, contract) => sum + (contract.deposit?.paidAt ? contract.deposit.amountCents : 0), 0))}</strong></div><div className="panel"><small>A receber</small><strong>{money(pending.reduce((sum, part) => sum + part.amountCents, 0) + pendingDeposits.reduce((sum, item) => sum + item.deposit.amountCents, 0))}</strong></div><div className="panel"><small>Parcelas vencidas</small><strong>{overdue.length}</strong></div></div>
    <div className="doula-content-grid"><section className="panel doula-section doula-list-panel" aria-label="Lista de contratos"><div className="doula-list-heading"><div><h2>Contratos</h2><p className="muted">Acompanhe as parcelas e abra o documento de cada paciente.</p></div><label className="doula-search"><Icon name="search" size={17} /><input type="search" placeholder="Buscar contrato" aria-label="Buscar contrato por paciente ou serviço" value={query} onChange={event => setQuery(event.target.value)} /></label></div>
      {loading ? <p className="muted">Carregando contratos...</p> : filtered.length ? <div className="doula-contract-list">{filtered.map(contract => {
        const patient = patients.find(item => item.id === contract.patientId);
        const unpaid = contract.installments.filter(part => !part.paidAt);
        const late = unpaid.filter(part => part.dueDate < today());
        const signalPending = Boolean(contract.deposit && !contract.deposit.paidAt); const status = late.length ? `${late.length} ${late.length === 1 ? "parcela vencida" : "parcelas vencidas"}` : unpaid.length || signalPending ? `${unpaid.length + Number(signalPending)} pagamento(s) pendente(s)` : "Quitado";
        return <article className="doula-list-item" key={contract.id}><div className="doula-list-main"><span className="doula-list-avatar"><Icon name="heart" size={20} /></span><div className="doula-list-copy"><h3>{patient?.name || contract.details?.clientName || contract.patientId}</h3><p>{contract.title}</p><small>Criado em {dateLabel(contract.createdAt.slice(0, 10))}</small></div><div className="doula-list-meta"><strong>{money(contract.amountCents)}</strong><span className={late.length ? "doula-late" : unpaid.length || signalPending ? "doula-pending" : "doula-paid"}>{status}</span></div><div className="doula-list-actions">{(unpaid.length > 0 || signalPending) && <button type="button" className="primary doula-view-link" disabled={settlingContractId === contract.id} onClick={() => settleContract(contract)}>{settlingContractId === contract.id ? "Dando baixa..." : "Dar baixa como pago"}</button>}<button type="button" className="secondary doula-view-link" onClick={() => openEditContract(contract)}>Editar</button><Link className="secondary doula-view-link" href={`/doulagem/contrato/${encodeURIComponent(contract.id)}`}>Ver contrato</Link></div></div><details className="doula-installments"><summary>Ver pagamentos ({contract.installments.length + (contract.deposit ? 1 : 0)})</summary><div>{contract.deposit && <div className="doula-installment doula-deposit-item"><div><strong>Sinal · {money(contract.deposit.amountCents)}</strong><small>{contract.deposit.method} · {contract.deposit.paidAt ? `Recebido em ${dateLabel(contract.deposit.paidAt.slice(0, 10))}` : `Previsto para ${dateLabel(contract.deposit.dueDate || contract.createdAt.slice(0, 10))}`}</small></div><button type="button" className="secondary" onClick={() => setDepositPaid(contract.id, !contract.deposit!.paidAt)}>{contract.deposit.paidAt ? "Desfazer recebimento" : "Marcar como recebido"}</button></div>}{contract.installments.map((part, index) => <div className="doula-installment" key={part.id}><div><strong>Parcela {index + 1} · {money(part.amountCents)}</strong><small>Vencimento: {dateLabel(part.dueDate)} · {part.paidAt ? `Pago em ${dateLabel(part.paidAt.slice(0, 10))}` : part.dueDate < today() ? "Vencida" : "Pendente"}</small></div><button className="secondary" onClick={() => setPaid(contract.id, part.id, !part.paidAt)}>{part.paidAt ? "Desfazer pagamento" : "Marcar como pago"}</button></div>)}</div></details></article>;
      })}</div> : <div className="doula-empty"><span className="doula-empty-icon"><Icon name={query ? "search" : "notes"} size={28} /></span><h3>{query ? "Nenhum contrato encontrado" : "Nenhum contrato ainda"}</h3><p>{query ? "Tente buscar por outro nome ou serviço." : "Crie o primeiro contrato para acompanhar os pagamentos por aqui."}</p>{!query && <button className="primary" onClick={openNewContract}><Icon name="plus" size={17} /> Novo contrato</button>}</div>}</section>
      <aside className="panel doula-section doula-finance-panel" aria-label="Próximos pagamentos"><div className="doula-finance-heading"><div><p className="eyebrow">FINANCEIRO</p><h2>Próximos pagamentos</h2></div><span className="doula-finance-count">{pending.length + pendingDeposits.length} em aberto</span></div>
        {loading ? <p className="muted">Carregando pagamentos...</p> : nextPayments.length ? <div className="doula-payment-list">{nextPayments.map(({ contract, dueDate, amountCents, label }, index) => { const patient = patients.find(item => item.id === contract.patientId); const isLate = dueDate < today(); return <Link href={`/doulagem/contrato/${encodeURIComponent(contract.id)}`} className="doula-payment-item" key={`${contract.id}-${label}-${index}`}><span><strong>{patient?.name || contract.details?.clientName || "Paciente"}</strong><small>{label} · {isLate ? "Vencido em" : "Vence em"} {dateLabel(dueDate)}</small></span><b>{money(amountCents)}</b></Link>; })}</div> : <div className="doula-payments-empty"><Icon name="check" size={20} /><div><strong>Pagamentos em dia</strong><p>Não há parcelas em aberto.</p></div></div>}
        <p className="doula-billing-note">Cobranças automáticas poderão ser configuradas após a definição do meio de pagamento.</p>
      </aside></div>

    <dialog ref={dialog} className="doula-dialog" aria-labelledby="doula-dialog-title" onClose={() => { setModalError(""); trigger.current?.focus(); }} onClick={event => { if (event.target === event.currentTarget) closeDialog(); }}>
      <form className="doula-modal-form" onSubmit={createContract}><div className="doula-modal-header"><div><p className="eyebrow">DOULAGEM</p><h2 id="doula-dialog-title">{editingContract ? "Editar contrato" : "Novo contrato"}</h2></div><button type="button" className="icon-button" aria-label="Fechar" onClick={closeDialog}><Icon name="close" /></button></div>
        <div className="doula-modal-body"><p className="muted">Preencha os dados do serviço e da paciente.</p>{modalError && <p className="form-error" role="alert">{modalError}</p>}<div className="doula-modal-grid"><label>Paciente<select required disabled={Boolean(editingContract)} value={patientId} onChange={event => setPatientId(event.target.value)}><option value="">Selecione uma paciente</option>{selectablePatients.map(patient => <option key={patient.id} value={patient.id}>{patient.name}</option>)}</select></label><label>Descrição do contrato<input required maxLength={120} value={title} onChange={event => setTitle(event.target.value)} /></label></div>
          <section className="doula-modal-section"><div className="doula-modal-section-heading"><div><h3>Serviços incluídos</h3><p>O modelo informa apenas o valor do pacote. Preços individuais são opcionais.</p></div></div><div className="doula-modal-services">{services.map((service, index) => <div className="doula-service-row" key={index}><label>Serviço {index + 1}<textarea required rows={2} maxLength={250} value={service.description} onChange={event => setServices(current => current.map((item, position) => position === index ? { ...item, description: event.target.value } : item))} /></label><label>Valor individual (R$)<input inputMode="decimal" placeholder="Incluído no pacote" value={service.amount} onChange={event => setServices(current => current.map((item, position) => position === index ? { ...item, amount: event.target.value } : item))} /></label><button className="secondary" type="button" onClick={() => setServices(current => current.filter((_, position) => position !== index))} disabled={services.length === 1}>Remover</button></div>)}</div><button className="secondary" type="button" disabled={services.length >= 30} onClick={() => setServices(current => [...current, { description: "", amount: "" }])}><Icon name="plus" size={16} /> Adicionar serviço</button></section>
          <section className="doula-modal-section"><h3>Pagamento</h3>{financialLocked && <p className="muted">Valores e parcelas ficam preservados porque já há pagamento registrado.</p>}<fieldset disabled={financialLocked} className="doula-financial-fields"><p className="muted">Distribua o valor total entre uma ou duas formas de pagamento. O sinal, recebido ou previsto, fica separado das parcelas.</p><label className="doula-payment-total">Valor total do contrato (R$)<input required inputMode="decimal" value={amount} onChange={event => { const value = event.target.value; setAmount(value); if (paymentAllocations.length === 1) setPaymentAllocations(current => [{ ...current[0], amount: value }]); }} /></label><div className="doula-payment-methods"><div className="doula-modal-section-heading"><div><h4>Formas de pagamento</h4><p>Os valores devem somar {money(previewTotal)}.</p></div>{paymentAllocations.length < 2 && <button type="button" className="secondary" onClick={() => setPaymentAllocations(current => [...current, { method: "", amount: "" }])}><Icon name="plus" size={16} /> Segunda forma</button>}</div>{paymentAllocations.map((item, index) => <div className="doula-payment-method-row" key={index}><label>Forma {index + 1}<select required value={item.method} onChange={event => { const value = event.target.value; setPaymentAllocations(current => current.map((entry, position) => position === index ? { ...entry, method: value } : entry)); if (depositMethod === item.method) setDepositMethod(""); }}><option value="">Selecione</option>{paymentMethods.map(method => <option key={method} value={method} disabled={paymentAllocations.some((other, position) => position !== index && other.method === method)}>{method}</option>)}</select></label><label>Valor desta forma (R$)<input required inputMode="decimal" value={item.amount} onChange={event => setPaymentAllocations(current => current.map((entry, position) => position === index ? { ...entry, amount: event.target.value } : entry))} placeholder="0,00" /></label>{index > 0 && <button type="button" className="secondary" onClick={() => { setPaymentAllocations(current => current.slice(0, 1)); if (depositMethod === item.method) setDepositMethod(""); }}>Remover</button>}</div>)}</div><div className="doula-deposit-fields"><div><h4>Sinal</h4><p>Registre um sinal recebido ou previsto para uma data futura.</p></div><div className="doula-modal-grid"><label>Valor do sinal (R$)<input inputMode="decimal" value={depositAmount} onChange={event => setDepositAmount(event.target.value)} placeholder="0,00" /></label><label>Recebido por<select required={previewDeposit > 0} disabled={previewDeposit === 0} value={depositMethod} onChange={event => setDepositMethod(event.target.value)}><option value="">Selecione a forma</option>{paymentAllocations.filter(item => item.method).map(item => <option key={item.method} value={item.method}>{item.method}</option>)}</select></label><label>Situação<select disabled={previewDeposit === 0} value={depositReceived ? "received" : "planned"} onChange={event => setDepositReceived(event.target.value === "received")}><option value="received">Já recebido</option><option value="planned">Previsto</option></select></label><label>Data do sinal<input type="date" required={previewDeposit > 0} disabled={previewDeposit === 0} value={depositDate} onChange={event => { setDepositDate(event.target.value); if (event.target.value > today()) setDepositReceived(false); }} /></label></div></div><div className="doula-balance-preview"><span>Valor das parcelas, sem o sinal</span><strong>{money(previewBalance)}</strong></div>{previewBalance > 0 && <div className="doula-dates"><strong>Vencimentos do saldo restante</strong>{dueDates.map((date, index) => <div key={index}><label>Parcela {index + 1}<input required type="date" value={date} onChange={event => setDueDates(current => current.map((item, position) => position === index ? event.target.value : item))} /></label>{dueDates.length > 1 && <button type="button" className="secondary" onClick={() => setDueDates(current => current.filter((_, position) => position !== index))}>Remover</button>}</div>)}{dueDates.length < 24 && <button type="button" className="secondary" onClick={() => setDueDates(current => [...current, ""])}><Icon name="plus" size={16} /> Adicionar parcela</button>}</div>}</fieldset><div className="doula-pix-settings"><label className="doula-payment-total">Chave Pix da doula<input required={paymentAllocations.some(item => item.method === "Pix")} maxLength={160} value={details.pixKey || ""} onChange={event => updateDetail("pixKey", event.target.value)} placeholder="CPF, e-mail, telefone ou chave aleatória" /><small>Será exibida no contrato quando a forma de pagamento for Pix.</small></label><button type="button" className="secondary" disabled={savingPixKey || !details.pixKey?.trim()} onClick={savePixKey}>{savingPixKey ? "Salvando..." : "Salvar como chave padrão"}</button></div></section>
          <section className="doula-modal-section"><h3>Dados do documento</h3><h4>Contratante</h4><div className="doula-modal-grid">{clientFields.map(field => <label key={field.key}>{field.label}<input type={field.type || "text"} required={field.key === "clientName"} value={details[field.key]} onChange={event => updateDetail(field.key, event.target.value)} /></label>)}</div><h4>Doula e backup</h4><div className="doula-modal-grid">{doulaFields.map(field => <label key={field.key}>{field.label}<input type={field.type || "text"} required={field.key === "doulaName"} value={details[field.key]} onChange={event => updateDetail(field.key, event.target.value)} /></label>)}</div><h4>Assinatura</h4><div className="doula-modal-grid"><label>Cidade<input readOnly value="Recife" /></label><label>Data do contrato<input required type="date" value={details.contractDate} onChange={event => updateDetail("contractDate", event.target.value)} /></label></div><div className="doula-signature-editor"><div><h4>Assinatura da doula</h4><p className="muted">Envie uma foto ou imagem recortada da sua assinatura. Ela aparecerá acima do nome da contratada no documento.</p></div>{details.signatureImage && <img src={details.signatureImage} alt="Prévia da assinatura da doula" />}<label>Imagem da assinatura<input type="file" accept="image/png,image/jpeg,image/webp" onChange={event => loadSignature(event.target.files?.[0])} /></label><div className="doula-signature-actions"><button type="button" className="secondary" disabled={savingSignature} onClick={saveSignature}>{savingSignature ? "Salvando..." : "Salvar para próximos contratos"}</button>{details.signatureImage && <button type="button" className="secondary" onClick={() => updateDetail("signatureImage", "")}>Remover deste contrato</button>}</div></div></section>
          {!activePatients.length && <p className="muted">Cadastre uma paciente em <Link href="/pacientes?novo=1">Pacientes</Link> para começar.</p>}
        </div><div className="doula-modal-footer"><button type="button" className="secondary" onClick={closeDialog}>Cancelar</button><button className="primary" type="submit" disabled={saving || !selectablePatients.length}>{saving ? "Salvando..." : editingContract ? "Salvar alterações" : "Cadastrar contrato"}</button></div>
      </form>
    </dialog>
  </div>;
}
