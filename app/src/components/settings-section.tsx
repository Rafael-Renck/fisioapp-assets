"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Icon, type IconName } from "./icon";

type SettingsSectionProps = {
  title: string;
  description: string;
  icon: IconName;
  meta?: string;
  children: ReactNode;
  defaultOpen?: boolean;
};

export function SettingsSection({ title, description, icon, meta, children, defaultOpen }: SettingsSectionProps) {
  const details = useRef<HTMLDetailsElement>(null);
  useEffect(() => { if (defaultOpen && details.current) details.current.open = true; }, [defaultOpen]);
  return <details ref={details} className="settings-accordion" name="fisioapp-settings">
    <summary className="settings-accordion-summary">
      <span className="settings-accordion-icon"><Icon name={icon} size={22} /></span>
      <span className="settings-accordion-copy"><strong>{title}</strong><small>{description}</small></span>
      {meta && <span className="settings-accordion-meta">{meta}</span>}
      <span className="settings-accordion-chevron" aria-hidden="true" />
    </summary>
    <div className="settings-accordion-body">{children}</div>
  </details>;
}
