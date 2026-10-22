"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ChangePassword, LogoutButton } from "../../components/account-actions";
import { OwnerManagement } from "../../components/owner-management";
import { SettingsSection } from "../../components/settings-section";
import type { Config, Location, Profile, Service } from "../../lib/store";

type Data = { profile: Profile; locations: Location[]; services: Service[]; insurances: string[]; config: Config };
const weekdays = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export default function SettingsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [notice, setNotice] = useState("");
  const [mustChange, setMustChange] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/settings", { cache: "no-store" });
    if (!response.ok) throw new Error("Não foi possível carregar as configurações.");
    setData(await response.json());
  }, []);
  useEffect(() => {
    load().catch(error => setNotice(error.message));
    fetch("/api/auth/me").then(response => response.json()).then(user => {
      setMustChange(!!user.mustChangePassword);
      setIsOwner(user.role === "owner");
    }).catch(() => undefined);
  }, [load]);

  async function save(body: Record<string, unknown>, message = "Configuração salva.") {
    try {
      const response = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      await load();
      setNotice(message);
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível salvar.");
      return false;
    }
  }
  function fields(event: FormEvent<HTMLFormElement>) { event.preventDefault(); return new FormData(event.currentTarget); }

  return <>
    <div className="page-heading"><div><p className="eyebrow">MEU ESPAÇO</p><h1>Configurações</h1><p className="muted">Abra uma seção para ajustar seu consultório.</p></div><LogoutButton /></div>
    {notice && <div className="success-message settings-toast" role="status"><span>{notice}</span><button type="button" className="icon-button" onClick={() => setNotice("")} aria-label="Fechar aviso">×</button></div>}
    {mustChange && <p className="agenda-alert settings-notice">Troque sua senha temporária para acessar o restante do sistema.</p>}
    {data && <div className="settings-accordion-list">
      {isOwner && <OwnerManagement />}

      <SettingsSection icon="patients" title="Perfil profissional" description="Nome, registro e contato exibidos no seu espaço" meta={data.profile.displayName || "Não preenchido"}>
        <form key={JSON.stringify(data.profile)} className="settings-form settings-form-grid" onSubmit={event => { const f = fields(event); save({ action: "profile", displayName: f.get("displayName"), registration: f.get("registration"), phone: f.get("phone"), email: f.get("email") }); }}>
          <label>Nome de exibição<input name="displayName" required maxLength={120} defaultValue={data.profile.displayName} /></label>
          <label>Registro profissional<input name="registration" maxLength={80} defaultValue={data.profile.registration} /></label>
          <label>Telefone<input name="phone" type="tel" maxLength={40} defaultValue={data.profile.phone} /></label>
          <label>E-mail profissional<input name="email" type="email" defaultValue={data.profile.email} /></label>
          <button className="primary">Salvar perfil</button>
        </form>
      </SettingsSection>

      <SettingsSection icon="home" title="Locais de atendimento" description="Endereços onde você atende" meta={`${data.locations.filter(item => item.active).length} ativo(s)`}>
        <p className="muted">Desativar um local preserva sua identificação nos atendimentos antigos.</p>
        {data.locations.length > 0 && <div className="settings-list">{data.locations.map(item => <form key={item.id} className="settings-item settings-item-form" onSubmit={event => { const f = fields(event); save({ action: "location", id: item.id, name: f.get("name"), address: f.get("address"), active: f.get("active") === "on" }); }}><input aria-label="Nome do local" name="name" required defaultValue={item.name} /><input aria-label="Endereço" name="address" defaultValue={item.address} /><label className="check-row"><input name="active" type="checkbox" defaultChecked={item.active} /> Ativo</label><button className="secondary">Salvar</button></form>)}</div>}
        <form className="settings-form settings-inline-form" onSubmit={event => { const form = event.currentTarget, f = fields(event); save({ action: "location", name: f.get("name"), address: f.get("address"), active: true }, "Local adicionado.").then(saved => { if (saved) form.reset(); }); }}>
          <label>Novo local<input name="name" required maxLength={120} placeholder="Clínica Centro" /></label>
          <label>Endereço<input name="address" maxLength={240} placeholder="Rua e número" /></label>
          <button className="primary">Adicionar local</button>
        </form>
      </SettingsSection>

      <SettingsSection icon="notes" title="Tipos de atendimento" description="Serviços e duração das sessões" meta={`${data.services.filter(item => item.active).length} ativo(s)`}>
        {data.services.length > 0 && <div className="settings-list">{data.services.map(item => <form key={item.id} className="settings-item settings-item-form" onSubmit={event => { const f = fields(event); save({ action: "service", id: item.id, name: f.get("name"), duration: f.get("duration"), active: f.get("active") === "on" }); }}><input aria-label="Tipo de atendimento" name="name" required defaultValue={item.name} /><label>Duração (min)<input name="duration" type="number" min="15" max="480" required defaultValue={item.duration} /></label><label className="check-row"><input name="active" type="checkbox" defaultChecked={item.active} /> Ativo</label><button className="secondary">Salvar</button></form>)}</div>}
        <form className="settings-form settings-inline-form" onSubmit={event => { const form = event.currentTarget, f = fields(event); save({ action: "service", name: f.get("name"), duration: f.get("duration"), active: true }, "Tipo adicionado.").then(saved => { if (saved) form.reset(); }); }}>
          <label>Novo tipo<input name="name" required maxLength={120} placeholder="Avaliação inicial" /></label>
          <label>Duração (min)<input name="duration" type="number" min="15" max="480" defaultValue="60" required /></label>
          <button className="primary">Adicionar tipo</button>
        </form>
      </SettingsSection>

      <SettingsSection icon="heart" title="Convênios" description="Opções disponíveis no cadastro de pacientes" meta={`${data.insurances.length} cadastrado(s)`}>
        <div className="settings-list">{data.insurances.map(name => <div className="settings-item" key={name}><span>{name}</span><button className="secondary" onClick={() => save({ action: "insurance", name, remove: true }, "Convênio removido da lista.")}>Remover</button></div>)}</div>
        <form className="settings-form settings-inline-form" onSubmit={event => { const form = event.currentTarget, f = fields(event); save({ action: "insurance", name: f.get("name") }, "Convênio adicionado.").then(saved => { if (saved) form.reset(); }); }}><label>Novo convênio<input name="name" required maxLength={120} /></label><button className="primary">Adicionar convênio</button></form>
      </SettingsSection>

      <SettingsSection icon="clock" title="Horários e capacidade" description="Expediente, duração padrão e vagas" meta={`${data.config.days.filter(day => day.active).length} dia(s) ativo(s)`}>
        <p className="muted">Ajustes no expediente valem para novos agendamentos.</p>
        <form className="settings-form" onSubmit={event => { event.preventDefault(); save({ action: "schedule", ...data.config }); }}>
          <div className="settings-schedule">
            <div className="settings-schedule-heading"><span>Dia de atendimento</span><span>Início</span><span>Fim</span></div>
            {data.config.days.map((day, index) => <div className="settings-schedule-row" key={index}>
              <label className="settings-day-toggle"><input type="checkbox" checked={day.active} onChange={event => setData(current => current && ({ ...current, config: { ...current.config, days: current.config.days.map((item, i) => i === index ? { ...item, active: event.target.checked } : item) } }))} /><span>{weekdays[index]}</span></label>
              <label><span className="sr-only">Início de {weekdays[index]}</span><input type="time" value={day.start} disabled={!day.active} onChange={event => setData(current => current && ({ ...current, config: { ...current.config, days: current.config.days.map((item, i) => i === index ? { ...item, start: event.target.value } : item) } }))} /></label>
              <label><span className="sr-only">Fim de {weekdays[index]}</span><input type="time" value={day.end} disabled={!day.active} onChange={event => setData(current => current && ({ ...current, config: { ...current.config, days: current.config.days.map((item, i) => i === index ? { ...item, end: event.target.value } : item) } }))} /></label>
            </div>)}
          </div>
          <div className="settings-form-grid settings-schedule-extra"><label>Duração padrão (min)<input type="number" min="15" max="480" value={data.config.duration} onChange={event => setData({ ...data, config: { ...data.config, duration: Number(event.target.value) } })} /></label><label>Vagas por horário<input type="number" min="1" max="100" value={data.config.capacity} onChange={event => setData({ ...data, config: { ...data.config, capacity: Number(event.target.value) } })} /></label></div>
          <button className="primary">Salvar horários</button>
        </form>
      </SettingsSection>

      <SettingsSection key={mustChange ? "must-change" : "security"} icon="check" title="Segurança da conta" description="Altere sua senha de acesso" defaultOpen={mustChange}>
        <ChangePassword />
      </SettingsSection>
    </div>}
  </>;
}
