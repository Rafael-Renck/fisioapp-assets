"use client";

import { useState } from "react";
import { PelvisSimulator } from "./pelvis-simulator";

const models = [
  {
    id: "bones",
    label: "Ossos da pelve",
    title: "Pelve feminina — estrutura óssea",
    description: "Explore a forma da pelve e a posição dos ossos em diferentes ângulos.",
    source: "Pecora Medical Illustration",
    url: "https://sketchfab.com/3d-models/female-pelvis-42b5c4b839154be89279e2eabd517b14",
    embed: "https://sketchfab.com/models/42b5c4b839154be89279e2eabd517b14/embed?autostart=1&dnt=1&ui_hint=2",
  },
  {
    id: "floor",
    label: "Assoalho pélvico",
    title: "Assoalho pélvico feminino",
    description: "Veja as camadas de suporte e sua relação com a pelve.",
    source: "University of Dundee, CAHID",
    url: "https://sketchfab.com/3d-models/female-pelvic-floor-46ad109760144930a5fc5e4289b2f81e",
    embed: "https://sketchfab.com/models/46ad109760144930a5fc5e4289b2f81e/embed?autostart=1&dnt=1&ui_hint=2",
  },
] as const;

export function PelvisViewer() {
  const [view, setView] = useState<"simulation" | "models">("simulation");
  const [selected, setSelected] = useState<(typeof models)[number]["id"]>("bones");
  const model = models.find(item => item.id === selected)!;

  return <section className="panel pelvis-section" aria-labelledby="pelvis-title">
    <div className="pelvis-heading"><div><p className="eyebrow">RECURSO VISUAL</p><h2 id="pelvis-title">Pelve em 3D</h2><p>Explore as simulações educativas e os modelos anatômicos durante a consulta.</p></div><span className="pelvis-badge">Interativo</span></div>
    <div className="pelvis-switch" role="group" aria-label="Tipo de visualização"><button type="button" className={view === "simulation" ? "selected" : ""} aria-pressed={view === "simulation"} onClick={() => setView("simulation")}>Simulações</button><button type="button" className={view === "models" ? "selected" : ""} aria-pressed={view === "models"} onClick={() => setView("models")}>Modelos anatômicos</button></div>
    {view === "simulation" ? <PelvisSimulator /> : <><div className="pelvis-switch pelvis-model-switch" role="group" aria-label="Escolher modelo anatômico">{models.map(item => <button key={item.id} type="button" className={selected === item.id ? "selected" : ""} aria-pressed={selected === item.id} onClick={() => setSelected(item.id)}>{item.label}</button>)}</div><div className="pelvis-viewer-frame"><iframe key={model.id} title={model.title} src={model.embed} loading="lazy" allow="fullscreen; xr-spatial-tracking" allowFullScreen referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-popups allow-forms" /></div><div className="pelvis-caption"><div><strong>{model.title}</strong><p>{model.description}</p><small>Arraste para girar · use a roda do mouse ou dois dedos para aproximar · toque no botão de tela cheia do visualizador para ampliar.</small></div><a href={model.url} target="_blank" rel="noopener noreferrer">Modelo de {model.source} ↗</a></div></>}
  </section>;
}
