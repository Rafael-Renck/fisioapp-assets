"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { DoulaContract } from "../../../../lib/store";
import { defaultDoulaServices } from "../../../../lib/doula";
import { DocumentEndmark, DocumentLetterhead } from "../../../../components/printable-document";
import { PdfDocumentActions } from "../../../../components/pdf-document-actions";

const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
const dateLabel = (date: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", day: "2-digit", month: "long", year: "numeric" }).format(new Date(`${date}T12:00:00Z`));

export default function DoulaDocumentPage() {
  const { id } = useParams<{ id: string }>();
  const [contract, setContract] = useState<DoulaContract | null>(null);
  const [message, setMessage] = useState("Carregando contrato...");
  useEffect(() => {
    fetch("/api/doulagem").then(async response => {
      if (!response.ok) throw new Error("Não foi possível carregar o contrato.");
      return response.json() as Promise<DoulaContract[]>;
    }).then(items => {
      const found = items.find(item => item.id === id);
      if (found) setContract(found);
      else setMessage("Contrato não encontrado.");
    }).catch(error => setMessage(error.message));
  }, [id]);
  if (!contract) return <div className="doula-document-page"><Link href="/doulagem">← Voltar à doulagem</Link><p>{message}</p></div>;
  const d = contract.details;
  if (!d) return <div className="doula-document-page"><Link href="/doulagem">← Voltar à doulagem</Link><p>Este contrato foi cadastrado antes da inclusão do modelo. Cadastre um novo contrato para gerar o documento.</p></div>;
  const contractedServices = contract.services?.length ? contract.services : defaultDoulaServices;
  const installmentText = contract.installments.length ? contract.installments.map((part, index) => `${index + 1}ª parcela de ${money(part.amountCents)}, com vencimento em ${dateLabel(part.dueDate)}`).join("; ") : "Não há parcelas pendentes";
  const pdfFilename = `contrato-doulagem-${d.clientName || "paciente"}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-|-$/g, "").toLowerCase() + ".pdf";
  return <div className="doula-document-page">
    <div className="doula-document-toolbar"><Link href="/doulagem">← Voltar à doulagem</Link><PdfDocumentActions targetId="doula-contract-document" filename={pdfFilename} /></div>
    <article id="doula-contract-document" className="doula-document printable-document">
      <DocumentLetterhead type="Contrato de serviços" title="Contrato de prestação de serviços de doulagem" subtitle={`Firmado em ${d.city || "Recife"}, ${dateLabel(d.contractDate)}`} />
      <div className="document-parties"><section><span>CONTRATANTE</span><h2>{d.clientName}</h2><dl><div><dt>CPF</dt><dd>{d.clientCpf || "________________"}</dd></div><div><dt>RG</dt><dd>{d.clientRg || "________________"}</dd></div><div><dt>Endereço</dt><dd>{d.clientAddress || "________________"}</dd></div><div><dt>Telefone</dt><dd>{d.clientPhone || "________________"}</dd></div><div><dt>E-mail</dt><dd>{d.clientEmail || "________________"}</dd></div></dl></section><section><span>DOULA / CONTRATADA</span><h2>{d.doulaName}</h2><dl><div><dt>CPF</dt><dd>{d.doulaCpf || "________________"}</dd></div><div><dt>RG</dt><dd>{d.doulaRg || "________________"}</dd></div><div><dt>Endereço</dt><dd>{d.doulaAddress || "________________"}</dd></div><div><dt>Telefone</dt><dd>{d.doulaPhone || "________________"}</dd></div><div><dt>E-mail</dt><dd>{d.doulaEmail || "________________"}</dd></div></dl></section><div className="document-backup"><strong>Doula backup</strong><span>{d.backupName || "________________"} · Telefone: {d.backupPhone || "________________"}</span></div></div>
      <h2>NÃO É PAPEL DA DOULA</h2>
      <p>A doula não é parteira e não assume responsabilidade técnica sobre o parto, que cabe aos profissionais de saúde habilitados. Não executa procedimentos clínicos, como aferição de pressão arterial, ausculta cardíaca fetal ou exame de toque. Oferece conforto físico e emocional sem interferir no trabalho da equipe clínica.</p>
      <p>A doula não toma decisões pela contratante nem fala com a equipe médica em seu lugar. Pode fornecer informações, lembrar o plano de parto, conversar sobre preocupações e alertar sobre situações observadas. Sua presença não garante a prevenção de violência obstétrica. Não acompanha parto planejado sem assistência profissional habilitada.</p>
      <h2>1. TRABALHOS A SEREM EXECUTADOS PELA CONTRATADA</h2>
      <h3>1.1. Serviços contratados</h3>
      <ul>{contractedServices.map((service, index) => <li key={index}>{service.description}</li>)}</ul>
      <h3>1.2. Assistência ao trabalho de parto e parto</h3>
      <p>Acompanhamento no local do parto e por uma a três horas após o nascimento; disponibilidade em plantão de 24 horas a partir da 37ª semana de gestação; técnicas não farmacológicas de alívio da dor e acolhimento físico e emocional, como respiração, massagem, compressas, bola suíça, tecidos, óleos essenciais e musicoterapia; apoio nos primeiros contatos com o bebê e na amamentação inicial; e acompanhamento de cesariana de emergência.</p>
      <h3>1.3. Assistência ao pós-parto</h3>
      <p>Um encontro pós-parto, a ser agendado pela contratante com a doula, com consultoria em aleitamento, taping e laser pós-parto; consultas por telefone ou online até 30 dias após o nascimento; apoio emocional e orientações sobre recuperação materna, cuidados com o bebê, amamentação e integração familiar; e auxílio na busca de serviços ou profissionais necessários.</p>
      <h2>2. DEVERES DAS PARTES</h2>
      <h3>2.1. Deveres da contratante</h3>
      <p>Informar condições de saúde física e emocional e outras informações relevantes à gestação, parto e puerpério; conversar sobre medos, dúvidas e questões relevantes; realizar pré-natal com profissional habilitado; elaborar planejamento do parto, inclusive alternativas; avisar a doula o quanto antes sobre o início provável do trabalho de parto ou eventual rescisão; e remunerar a contratada conforme este contrato.</p>
      <h3>2.2. Deveres da contratada</h3>
      <p>Cumprir o contrato com zelo, atenção e respeito; manter sigilo sobre informações íntimas da contratante e da família; estar disponível para consultas em horário comercial até a 37ª semana, ressalvado parto prematuro; estar disponível da 37ª semana até a primeira semana pós-parto; encaminhar doula backup se não puder comparecer ao parto por motivo pessoal ou força maior; e, conforme a necessidade, deslocar-se à residência da contratante.</p>
      <h2>3. HONORÁRIOS E FORMAS DE PAGAMENTO</h2>
      <p>Os serviços contratados são:</p>
      <ul className="doula-document-services">{contractedServices.map((service, index) => <li key={index}><span>{service.description}</span><strong>{service.amountCents === null ? "Incluído no pacote" : money(service.amountCents)}</strong></li>)}</ul>
      <p>O valor total dos serviços é de <strong>{money(contract.amountCents)}</strong>.</p>
      {contract.paymentAllocations?.length ? <><p><strong>Distribuição por forma de pagamento:</strong></p><ul className="doula-document-payment-methods">{contract.paymentAllocations.map(item => <li key={item.method}><span>{item.method}</span><strong>{money(item.amountCents)}</strong></li>)}</ul></> : <p><strong>Forma de pagamento:</strong> {d.paymentMethod || "a definir"}.</p>}
      {d.pixKey && (contract.paymentAllocations?.some(item => item.method === "Pix") || d.paymentMethod.includes("Pix")) && <p style={{ overflowWrap: "anywhere" }}><strong>Chave Pix da contratada:</strong> {d.pixKey}.</p>}
      {contract.deposit && <p><strong>{contract.deposit.paidAt ? "Sinal recebido:" : "Sinal previsto:"}</strong> {money(contract.deposit.amountCents)} por {contract.deposit.method}, {contract.deposit.paidAt ? `recebido em ${dateLabel(contract.deposit.paidAt.slice(0, 10))}` : `previsto para ${dateLabel(contract.deposit.dueDate || contract.createdAt.slice(0, 10))}`}. Este valor integra o total do contrato e é separado das parcelas restantes.</p>}
      <p><strong>Valor das parcelas restantes:</strong> {money(contract.amountCents - (contract.deposit?.amountCents || 0))}. <strong>Parcelas:</strong> {installmentText}.</p>
      <h2>4. SITUAÇÕES EXCEPCIONAIS E NÃO CUMPRIMENTO DO CONTRATO</h2>
      <p><strong>4.1.</strong> Se a contratante desistir da assistência após a assinatura e até 37 semanas de gestação, o modelo prevê indenização à doula no valor integral de {money(contract.amountCents)}, referente à assistência pré-parto e à disponibilidade reservada. Valor já pago não será restituído; valor pendente deverá ser pago em até uma semana.</p>
      <p><strong>4.2.</strong> Se a contratada não puder comparecer ao parto, compromete-se a encaminhar doula backup. O contrato continua integralmente devido à contratada.</p>
      <p><strong>4.3.</strong> Se a contratada rescindir o contrato ou deixar de prestar os serviços sem justificativa, aviso ou backup, devolverá o valor pago, descontados os atendimentos pré-parto já realizados.</p>
      <p><strong>4.4.</strong> Se o não comparecimento da doula decorrer da falta de aviso da contratante sobre data e horário do parto ou da falta de agendamento dos atendimentos no prazo, os serviços contratados permanecem devidos.</p>
      <p><strong>4.5.</strong> Se eventos fora do controle da contratada impedirem o cumprimento, como óbito, cesariana de emergência ou eletiva, o modelo prevê o pagamento dos serviços contratados.</p>
      <p><strong>4.6.</strong> Se a assistência ao parto começar e for interrompida por impedimento do hospital ou situação semelhante, a remuneração da doula será integral.</p>
      <h2>5. SIGILO CONTRATUAL</h2>
      <p>As informações pessoais e sobre o parto da contratante serão mantidas em sigilo. O compartilhamento de informações sobre o parto, inclusive em redes sociais, depende de autorização prévia da contratante.</p>
      <p><strong>5.1.</strong> Este contrato não inclui serviços de fotografia. A doula poderá fotografar somente quando for possível e sem prejudicar o apoio prestado.</p>
      <p>As partes declaram ter lido e concordado com os termos deste contrato de prestação de serviços de doulagem, firmado em duas vias de igual teor.</p>
      <p className="doula-document-date">{d.city}, {dateLabel(d.contractDate)}.</p>
      <div className="doula-signatures"><div>________________________________<br />{d.clientName}<br />CONTRATANTE</div><div>{d.signatureImage && <img className="doula-signature-image" src={d.signatureImage} alt="Assinatura da doula" />}<span className="doula-signature-line">________________________________</span><br />{d.doulaName}<br />CONTRATADA</div></div>
      <DocumentEndmark label="Contrato de doulagem" />
    </article>
  </div>;
}
