"use client";

export function PrintDocumentButton() {
  return <button className="primary" type="button" onClick={() => window.print()}>Imprimir ou salvar em PDF</button>;
}
