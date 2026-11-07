"use client";

import { useEffect, useRef } from "react";
import { Icon } from "./icon";

type Props = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({ open, title, description, confirmLabel, busy = false, onConfirm, onCancel }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    if (!open && dialog.current?.open) dialog.current?.close();
  }, [open]);
  return <dialog ref={dialog} className="confirm-dialog" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-description" onCancel={event => { if (busy) event.preventDefault(); else onCancel(); }} onClick={event => { if (event.target === event.currentTarget && !busy) onCancel(); }}>
    <div className="confirm-dialog-icon"><Icon name="help" size={22} /></div>
    <h2 id="confirm-dialog-title">{title}</h2>
    <p id="confirm-dialog-description">{description}</p>
    <div className="confirm-dialog-actions"><button type="button" className="secondary" disabled={busy} onClick={onCancel}>Cancelar</button><button type="button" className="primary" disabled={busy} onClick={onConfirm}>{busy ? "Aguarde..." : confirmLabel}</button></div>
  </dialog>;
}
