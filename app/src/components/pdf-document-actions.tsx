"use client";

import { useState } from "react";

type Props = { targetId: string; filename: string };

export function PdfDocumentActions({ targetId, filename }: Props) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  async function downloadPdf() {
    const documentElement = document.getElementById(targetId);
    if (!documentElement) {
      setError("Não foi possível localizar o contrato.");
      return;
    }

    setGenerating(true);
    setError("");
    try {
      await document.fonts?.ready;
      await Promise.all(Array.from(documentElement.querySelectorAll("img")).map(image => image.complete ? image.decode().catch(() => undefined) : new Promise<void>(resolve => {
        image.addEventListener("load", () => resolve(), { once: true });
        image.addEventListener("error", () => resolve(), { once: true });
      })));
      const { default: html2pdf } = await import("html2pdf.js");
      await html2pdf().set({
        margin: [12, 12, 12, 12],
        filename,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["css", "legacy"], avoid: [".document-letterhead", ".document-parties", ".doula-signatures", ".document-endmark", "li"] },
      }).from(documentElement).save();
    } catch {
      setError("Não foi possível gerar o PDF. Tente a opção Imprimir.");
    } finally {
      setGenerating(false);
    }
  }

  return <div className="document-download-actions">
    <button className="primary" type="button" disabled={generating} onClick={() => void downloadPdf()}>{generating ? "Gerando PDF..." : "Baixar PDF"}</button>
    <button className="secondary" type="button" disabled={generating} onClick={() => window.print()}>Imprimir</button>
    {error && <span role="alert">{error}</span>}
  </div>;
}
