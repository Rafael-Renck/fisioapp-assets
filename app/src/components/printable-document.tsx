import Image from "next/image";

export function DocumentLetterhead({ type, title, subtitle }: { type: string; title: string; subtitle?: string }) {
  return <div className="document-letterhead"><div className="document-letterhead-top"><Image src="/logo.svg" alt="FisioApp" width={153} height={34} priority /><span>{type}</span></div><div className="document-letterhead-rule" /><p className="document-eyebrow">CUIDADO QUE CONECTA</p><h1>{title}</h1>{subtitle && <p className="document-subtitle">{subtitle}</p>}</div>;
}

export function DocumentEndmark({ label }: { label: string }) {
  return <div className="document-endmark"><span>FisioApp · Cuidado que conecta</span><span>{label}</span></div>;
}
