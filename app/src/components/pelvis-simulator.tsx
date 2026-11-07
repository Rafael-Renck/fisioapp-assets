"use client";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

type Scenario = "pregnancy" | "bladder" | "floor" | "prolapse" | "uterineProlapse" | "rectocele" | "hypertonic" | "anismus" | "birth";
type FetalPresentation = "cephalic" | "breech" | "transverse";
const fetalPresentations: { id: FetalPresentation; label: string; hint: string; description: string }[] = [
  { id: "cephalic", label: "Cefálica", hint: "Cabeça para baixo", description: "A cabeça está voltada para a entrada da pelve. Nesta vista, você pode acompanhar uma descida ilustrativa pelo canal vaginal." },
  { id: "breech", label: "Pélvica", hint: "Nádegas ou pés para baixo", description: "As nádegas ou os pés ficam voltados para a entrada da pelve. A ilustração mostra apenas a posição no útero." },
  { id: "transverse", label: "Transversa", hint: "Bebê atravessado", description: "O bebê está atravessado em relação ao eixo do útero. A ilustração mostra apenas essa disposição, sem simular um parto vaginal." },
];
type StructureInfo = { name: string; description: string };
const structureInfo: Record<string, StructureInfo> = {
  rectum: { name: "Reto", description: "Parte final do intestino, situada atrás da vagina e ligada à evacuação." },
  "tendinous-arch": { name: "Arco tendíneo", description: "Faixa de tecido que serve de apoio e fixação para estruturas da pelve." },
  "hip-l": { name: "Osso da pelve esquerda", description: "Parte da estrutura óssea que envolve e protege os órgãos pélvicos." },
  "hip-r": { name: "Osso da pelve direita", description: "Parte da estrutura óssea que envolve e protege os órgãos pélvicos." },
  perineal: { name: "Músculos do períneo", description: "Músculos da região inferior da pelve, próximos às aberturas urinária, vaginal e anal." },
  bladder: { name: "Bexiga", description: "Órgão que armazena a urina; fica à frente do útero e da vagina." },
  "levator-ani": { name: "Músculos elevadores do ânus", description: "Conjunto de músculos do assoalho pélvico que ajuda a sustentar os órgãos da pelve." },
  vestibule: { name: "Vestíbulo vaginal", description: "Região externa entre os pequenos lábios onde ficam as aberturas da uretra e da vagina." },
  vagina: { name: "Vagina", description: "Canal muscular que liga o colo do útero à parte externa do corpo." },
  cervix: { name: "Colo do útero", description: "Porção inferior do útero que se comunica com a vagina." },
  "lower-segment": { name: "Segmento inferior do útero", description: "Região do útero situada entre o corpo uterino e o colo." },
  body: { name: "Corpo do útero", description: "Parte principal do útero, acima do colo." },
  fundus: { name: "Fundo do útero", description: "Parte superior arredondada do útero." },
  "round-ligament": { name: "Ligamento redondo", description: "Faixa de tecido que se estende do útero em direção à região da virilha." },
  sacrum: { name: "Sacro", description: "Osso na parte posterior da pelve, abaixo da coluna lombar." },
  "ovary-l": { name: "Ovário esquerdo", description: "Órgão reprodutivo situado ao lado do útero." },
  "ovary-r": { name: "Ovário direito", description: "Órgão reprodutivo situado ao lado do útero." },
  "tube-l": { name: "Tuba uterina esquerda", description: "Estrutura que se estende do útero em direção ao ovário esquerdo." },
  "tube-r": { name: "Tuba uterina direita", description: "Estrutura que se estende do útero em direção ao ovário direito." },
  "broad-ligament": { name: "Ligamento largo", description: "Dobra de tecido que se estende das laterais do útero para a pelve." },
  "clitoral-crus": { name: "Raiz do clitóris", description: "Parte interna da estrutura do clitóris, situada na região vulvar." },
  "vestibular-bulb": { name: "Bulbo do vestíbulo", description: "Tecido da região vulvar localizado ao lado da abertura vaginal." },
  bartholin: { name: "Glândulas de Bartholin", description: "Glândulas situadas próximas à abertura vaginal." },
  fetus: { name: "Bebê", description: "Malha fetal usada para comparar posições no útero e ilustrar a descida cefálica." },
};
const scenarios: { id: Scenario; label: string; caption: string; low: string; high: string }[] = [
  { id: "pregnancy", label: "Gestação", caption: "Observe o útero aumentar e ocupar mais espaço na pelve.", low: "Anatomia de referência", high: "Expansão ilustrativa" },
  { id: "bladder", label: "Bexiga", caption: "Observe a posição da bexiga e uma mudança ilustrativa de volume.", low: "Menor volume", high: "Maior volume" },
  { id: "floor", label: "Assoalho pélvico", caption: "Observe a musculatura pélvica e sua elevação ilustrativa.", low: "Relaxamento", high: "Contração" },
  { id: "prolapse", label: "Cistocele", caption: "Observe a relação entre bexiga e suporte pélvico em um deslocamento ilustrativo.", low: "Posição de referência", high: "Deslocamento ilustrativo" },
  { id: "uterineProlapse", label: "Prolapso uterino", caption: "Observe a descida ilustrativa do útero e do colo em relação à vagina.", low: "Suporte de referência", high: "Descida ilustrativa" },
  { id: "rectocele", label: "Retocele", caption: "Observe o reto projetar-se em direção à parede vaginal posterior.", low: "Suporte de referência", high: "Abaulamento ilustrativo" },
  { id: "hypertonic", label: "Hipertonia pélvica", caption: "Observe a tensão muscular ao redor do canal vaginal.", low: "Relaxamento", high: "Tensão persistente" },
  { id: "anismus", label: "Anismo", caption: "Compare o relaxamento esperado com a contração paradoxal na tentativa de evacuar.", low: "Relaxamento esperado", high: "Contração paradoxal" },
  { id: "birth", label: "Posição fetal e parto", caption: "Compare posições do bebê no útero e acompanhe a descida cefálica.", low: "Dentro do útero", high: "Saída ilustrativa" },
];

export function PelvisSimulator() {
  const mount = useRef<HTMLDivElement>(null);
  const updateScene = useRef<(mode: Scenario, value: number, presentation: FetalPresentation) => void>(() => undefined);
  const [scenario, setScenario] = useState<Scenario>("pregnancy");
  const [presentation, setPresentation] = useState<FetalPresentation>("cephalic");
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [birthReady, setBirthReady] = useState(false);
  const [birthError, setBirthError] = useState(false);
  const [comparing, setComparing] = useState(true);
  const comparingRef = useRef(true);
  const [selectedStructure, setSelectedStructure] = useState<StructureInfo | null>(null);
  const selectStructure = useRef<(id: string | null) => void>(() => undefined);
  const current = scenarios.find(item => item.id === scenario)!;
  const pregnancyStep = progress === 0 ? "Anatomia de referência" : progress < 45 ? "Útero começa a ocupar mais espaço" : "Bexiga deslocada e comprimida";
  const observations: Record<Scenario, { title: string; detail: string }> = {
    pregnancy: { title: pregnancyStep, detail: progress === 0 ? "Mova o controle para observar a relação entre útero e bexiga." : "O útero aumenta e sobe. A bexiga, à sua frente, se desloca e fica mais achatada na ilustração." },
    bladder: { title: progress === 0 ? "Menor volume" : progress < 50 ? "Bexiga em expansão" : "Maior volume", detail: progress === 0 ? "Mova o controle para observar como a bexiga ocupa espaço na pelve." : "A bexiga se expande; o útero muda discretamente de posição na ilustração." },
    floor: { title: progress === 0 ? "Musculatura em repouso" : progress < 50 ? "Contração em andamento" : "Elevação do assoalho pélvico", detail: progress === 0 ? "Mova o controle para observar os músculos de suporte." : "A musculatura se eleva e tensiona. Bexiga e vagina acompanham discretamente esse movimento." },
    prolapse: { title: progress === 0 ? "Suporte de referência" : progress < 50 ? "Perda de suporte" : "Bexiga e parede vaginal descem", detail: progress === 0 ? "Mova o controle para observar a relação entre bexiga e parede vaginal." : "A bexiga desce junto da parede vaginal anterior; a musculatura de suporte cede na ilustração." },
    uterineProlapse: { title: progress === 0 ? "Útero em posição de referência" : progress < 50 ? "Suporte uterino reduzido" : "Útero e colo mais baixos", detail: progress === 0 ? "Mova o controle para observar a relação entre útero, colo e vagina." : "O útero e o colo descem em direção ao canal vaginal enquanto o suporte pélvico cede na ilustração." },
    rectocele: { title: progress === 0 ? "Reto em posição de referência" : progress < 50 ? "Parede posterior sob pressão" : "Reto projetado em direção à vagina", detail: progress === 0 ? "Mova o controle para observar a relação entre reto e parede vaginal posterior." : "O reto se projeta para a frente e a parede vaginal posterior acompanha o abaulamento ilustrado." },
    hypertonic: { title: progress === 0 ? "Musculatura relaxada" : progress < 50 ? "Tensão ao redor da vagina" : "Dificuldade de relaxamento ilustrada", detail: progress === 0 ? "Mova o controle para observar a musculatura ao redor do canal vaginal." : "Os músculos se mantêm tensos e o espaço do canal vaginal aparece reduzido. A intensidade visual não representa a dor de uma pessoa." },
    anismus: { title: progress === 0 ? "Relaxamento durante a evacuação" : progress < 50 ? "Relaxamento insuficiente" : "Contração paradoxal ilustrada", detail: progress === 0 ? "Na evacuação coordenada, a musculatura pélvica relaxa para facilitar a saída das fezes." : "O grupo muscular permanece contraído e a saída do reto se estreita na ilustração. O modelo não separa o músculo puborretal." },
    birth: presentation === "cephalic"
      ? { title: progress < 22 ? "Bebê dentro do útero" : progress < 45 ? "Descida em direção ao colo" : progress < 68 ? "Passagem pelo canal vaginal" : progress < 86 ? "Saída da cabeça" : "Nascimento ilustrativo", detail: "Na apresentação cefálica, a cabeça está voltada para a pelve. O movimento é didático: a flexão do bebê é simplificada e os tecidos não se dilatam como em um parto real." }
      : { title: presentation === "breech" ? "Apresentação pélvica" : "Situação transversa", detail: fetalPresentations.find(item => item.id === presentation)!.description },
  };

  useEffect(() => {
    const container = mount.current;
    if (!container) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" }); }
    catch { setUnavailable(true); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    container.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.set(3.9, 1.7, 5.9);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.minDistance = 3.1;
    controls.maxDistance = 10;
    controls.target.set(0, 0.12, 0);
    controls.update();
    scene.add(new THREE.HemisphereLight(0xffffff, 0xa1ada8, 1.7));
    const key = new THREE.DirectionalLight(0xfff4ea, 2.3);
    key.position.set(3, 5, 5);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xc5e3df, 1.2);
    rim.position.set(-4, 2, -3);
    scene.add(rim);
    const referenceScene = new THREE.Scene();
    referenceScene.add(new THREE.HemisphereLight(0xffffff, 0xa1ada8, 1.7));
    const referenceKey = key.clone();
    const referenceRim = rim.clone();
    referenceScene.add(referenceKey, referenceRim);
    const referenceCamera = camera.clone();

    const modelRoot = new THREE.Group();
    modelRoot.scale.setScalar(0.1);
    modelRoot.position.y = -0.12;
    scene.add(modelRoot);
    const referenceRoot = new THREE.Group();
    referenceRoot.scale.copy(modelRoot.scale);
    referenceRoot.position.copy(modelRoot.position);
    referenceScene.add(referenceRoot);
    const uterusPivot = new THREE.Group();
    const bladderPivot = new THREE.Group();
    const bladderOffset = new THREE.Group();
    const floorPivot = new THREE.Group();
    const vaginalPivot = new THREE.Group();
    const vaginalShape = new THREE.Group();
    const cervixPivot = new THREE.Group();
    const rectumPivot = new THREE.Group();
    const fetusPivot = new THREE.Group();
    const birthAnatomy = new THREE.Group();
    modelRoot.add(uterusPivot, bladderPivot, floorPivot, vaginalPivot, cervixPivot, rectumPivot, birthAnatomy, fetusPivot);
    const birthUterusPivot = new THREE.Group();
    birthUterusPivot.scale.set(3.8, 5.6, 3.4);
    birthUterusPivot.position.y = -1.5;
    birthAnatomy.add(birthUterusPivot);
    const birthUterusMeshes: THREE.Mesh[] = [];
    const fetusMeshes: THREE.Mesh[] = [];
    vaginalPivot.add(vaginalShape);
    bladderPivot.add(bladderOffset);
    const muscleMeshes: THREE.Mesh[] = [];
    const uterusMeshes: THREE.Mesh[] = [];
    let vaginalMesh: THREE.Mesh | null = null;
    const accessoryMeshes: THREE.Mesh[] = [];
    const referenceMuscles: THREE.Mesh[] = [];
    const referenceAccessories: THREE.Mesh[] = [];
    const highlighted: { mesh: THREE.Mesh; material: THREE.Material }[] = [];
    const clearHighlight = () => {
      for (const item of highlighted) {
        const highlight = item.mesh.material;
        item.mesh.material = item.material;
        if (!Array.isArray(highlight)) highlight.dispose();
      }
      highlighted.length = 0;
    };
    selectStructure.current = id => {
      clearHighlight();
      if (!id) { setSelectedStructure(null); return; }
      const info = structureInfo[id];
      if (!info) { setSelectedStructure(null); return; }
      for (const renderedScene of [scene, referenceScene]) renderedScene.traverse(object => {
        if (!(object instanceof THREE.Mesh) || object.userData.structureId !== id) return;
        const material = object.material;
        if (!(material instanceof THREE.MeshStandardMaterial)) return;
        const active = material.clone();
        active.emissive.set(0x43846c);
        active.emissiveIntensity = 0.32;
        highlighted.push({ mesh: object, material });
        object.material = active;
      });
      setSelectedStructure(info);
    };
    let rectumPositions: Float32Array | null = null;
    let rectumAttribute: THREE.BufferAttribute | null = null;
    let disposed = false;
    let simulation: { mode: Scenario; value: number; presentation: FetalPresentation } = { mode: "pregnancy", value: 0, presentation: "cephalic" };
    updateScene.current = (mode, value, fetalPresentation) => {
      const enteringBirth = mode === "birth" && simulation.mode !== "birth";
      const leavingBirth = mode !== "birth" && simulation.mode === "birth";
      simulation = { mode, value, presentation: fetalPresentation };
      const t = Math.max(0, Math.min(1, value / 100));
      if (enteringBirth || leavingBirth) {
        camera.position.set(...(enteringBirth ? [6.1, 3.2, 12.4] : [3.9, 1.7, 5.9]) as [number, number, number]);
        controls.target.set(0, enteringBirth ? 0.25 : 0.12, 0);
        controls.update();
      }
      fetusPivot.visible = mode === "birth";
      birthAnatomy.visible = mode === "birth";
      const birthHeight = t < 0.45 ? 15.5 - (t / 0.45) * 9.5 : t < 0.72 ? 6 - ((t - 0.45) / 0.27) * 10 : -4 - ((t - 0.72) / 0.28) * 13;
      const birthForward = t < 0.35 ? 0 : t < 0.72 ? ((t - 0.35) / 0.37) * 3.1 : 3.1 + ((t - 0.72) / 0.28) * 1.5;
      fetusPivot.position.set(0, fetalPresentation === "cephalic" ? birthHeight : 15.5, 2 + (fetalPresentation === "cephalic" ? birthForward * 0.7 : 0));
      fetusPivot.scale.setScalar(fetalPresentation === "transverse" ? 0.85 : 1);
      fetusPivot.rotation.set(fetalPresentation === "cephalic" && t > 0.72 ? (t - 0.72) * 0.5 : 0, fetalPresentation === "cephalic" ? 0.55 * (1 - Math.min(1, t / 0.7)) + Math.sin(t * Math.PI * 4) * 0.045 : 0.15, fetalPresentation === "cephalic" ? Math.PI + Math.sin(t * Math.PI * 3) * 0.045 : fetalPresentation === "breech" ? 0 : Math.PI / 2);
      fetusMeshes.forEach(mesh => { if (mesh.morphTargetInfluences) mesh.morphTargetInfluences[0] = Math.min(1, 0.3 + Math.sin(t * Math.PI) * 0.55 + Math.sin(t * Math.PI * 6) * 0.1); });
      birthUterusMeshes.forEach(mesh => { (mesh.material as THREE.MeshStandardMaterial).opacity = 0.25 * (1 - (fetalPresentation === "cephalic" ? Math.min(1, t / 0.48) * 0.82 : 0)); });
      for (const mesh of uterusMeshes) {
        mesh.visible = mode !== "birth";
      }
      cervixPivot.visible = true;
      cervixPivot.scale.set(mode === "birth" ? 1.7 : 1, mode === "birth" ? 1.4 : 1, mode === "birth" ? 1.7 : 1);
      bladderPivot.visible = mode !== "birth";
      rectumPivot.visible = mode !== "birth";
      if (vaginalMesh) {
        const material = vaginalMesh.material as THREE.MeshStandardMaterial;
        material.transparent = mode === "birth";
        material.opacity = mode === "birth" ? 0.9 : 1;
        material.depthWrite = mode !== "birth";
      }
      uterusPivot.scale.set(1 + (mode === "pregnancy" ? t * 0.28 : 0), 1 + (mode === "pregnancy" ? t * 0.58 : 0), 1 + (mode === "pregnancy" ? t * 0.38 : 0));
      uterusPivot.position.set(0, mode === "pregnancy" ? t * 0.8 : mode === "bladder" ? t * 0.18 : mode === "uterineProlapse" ? -t * 1.25 : 0, mode === "bladder" ? -t * 0.22 : 0);
      cervixPivot.position.y = mode === "uterineProlapse" ? -t * 1.15 : 0;
      rectumPivot.position.set(0, mode === "rectocele" ? -t * 0.22 : 0, mode === "rectocele" ? t * 0.68 : 0);
      if (mode === "pregnancy") {
        // A bexiga fica anterior ao útero: deslocamento anterior e achatamento representam a perda de espaço.
        bladderPivot.scale.set(1 + t * 0.08, 1 - t * 0.14, 1 - t * 0.27);
        bladderPivot.position.set(0, -1.2 - t * 0.22, 3.5 + t * 0.65);
      } else {
        bladderPivot.scale.setScalar(mode === "bladder" ? 0.85 + t * 0.3 : 1);
        bladderPivot.position.set(0, (mode === "prolapse" ? -t * 1.3 : mode === "floor" ? t * 0.2 : 0) - 1.2, (mode === "prolapse" ? t * 0.45 : 0) + 3.5);
      }
      const weakSupport = mode === "prolapse" || mode === "uterineProlapse" || mode === "rectocele";
      floorPivot.position.y = mode === "floor" ? t * 0.65 : mode === "hypertonic" ? t * 0.2 : weakSupport ? -t * 0.32 : 0;
      floorPivot.scale.set(mode === "hypertonic" ? 1 - t * 0.12 : 1, mode === "floor" ? 1 - t * 0.13 : weakSupport ? 1 + t * 0.08 : 1, mode === "hypertonic" ? 1 - t * 0.1 : 1);
      vaginalPivot.position.set(0, mode === "floor" ? t * 0.18 : mode === "prolapse" ? -t * 0.55 : mode === "uterineProlapse" ? -t * 0.48 : mode === "rectocele" ? -t * 0.18 : 0, mode === "prolapse" ? -t * 0.28 : mode === "rectocele" ? t * 0.16 : 0);
      vaginalShape.scale.set(mode === "hypertonic" ? 1 - t * 0.18 : 1, 1, mode === "hypertonic" ? 1 - t * 0.12 : 1);
      if (mode === "birth") vaginalShape.scale.set(1.8, 1, 1.3);
      if (mode === "anismus") {
        floorPivot.position.y = t * 0.34;
        floorPivot.scale.set(1 - t * 0.13, 1, 1 - t * 0.13);
      }
      if (rectumPositions && rectumAttribute) {
        const positions = rectumAttribute.array as Float32Array;
        const narrowing = mode === "anismus" ? t : 0;
        for (let i = 0; i < rectumPositions.length; i += 3) {
          const x = rectumPositions[i], y = rectumPositions[i + 1], z = rectumPositions[i + 2];
          const lowerOutlet = Math.max(0, Math.min(1, (-y - 2.5) / 3));
          positions[i] = x * (1 - narrowing * lowerOutlet * 0.18);
          positions[i + 1] = y;
          positions[i + 2] = -1.5 + (z + 1.5) * (1 - narrowing * lowerOutlet * 0.13);
        }
        rectumAttribute.needsUpdate = true;
      }
      const showMuscles = mode === "floor" || mode === "hypertonic" || mode === "anismus" || mode === "birth" || weakSupport;
      muscleMeshes.forEach(mesh => { mesh.visible = showMuscles; });
      referenceMuscles.forEach(mesh => { mesh.visible = showMuscles; });
      accessoryMeshes.forEach(mesh => { mesh.visible = !weakSupport && mode !== "birth"; });
      referenceAccessories.forEach(mesh => { mesh.visible = !weakSupport; });
    };

    new GLTFLoader().load("/models/stanford-female-pelvis.glb", gltf => {
      if (disposed) return;
      const meshes: THREE.Mesh[] = [];
      gltf.scene.traverse(object => { if (object instanceof THREE.Mesh) meshes.push(object); });
      for (const mesh of meshes) {
        const id = mesh.name.replace(/_[0-9]+$/, "");
        mesh.userData.structureId = id;
        const material = mesh.material as THREE.MeshStandardMaterial;
        material.roughness = 0.9;
        material.metalness = 0;
        const referenceMesh = mesh.clone();
        referenceMesh.userData.structureId = id;
        referenceRoot.add(referenceMesh);
        if (["hip-l", "hip-r", "sacrum"].includes(id)) {
          material.transparent = true;
          material.opacity = 0.42;
          material.depthWrite = false;
          material.side = THREE.DoubleSide;
          modelRoot.add(mesh);
        } else if (["body", "fundus", "lower-segment"].includes(id)) {
          mesh.material = material.clone();
          uterusPivot.add(mesh);
          uterusMeshes.push(mesh);
          const birthMesh = mesh.clone();
          const birthMaterial = material.clone();
          birthMaterial.transparent = true;
          birthMaterial.opacity = 0.25;
          birthMaterial.depthWrite = false;
          birthMaterial.side = THREE.DoubleSide;
          birthMesh.material = birthMaterial;
          birthMesh.userData.structureId = id;
          birthUterusPivot.add(birthMesh);
          birthUterusMeshes.push(birthMesh);
        } else if (id === "bladder") {
          bladderOffset.position.set(0, 1.2, -3.5);
          bladderOffset.add(mesh);
        } else if (id === "vagina") {
          mesh.material = material.clone();
          vaginalShape.position.set(0, -4.62, 3.53);
          mesh.position.set(0, 4.62, -3.53);
          vaginalShape.add(mesh);
          vaginalMesh = mesh;
        } else if (id === "cervix") {
          cervixPivot.add(mesh);
        } else if (id === "rectum") {
          mesh.geometry = mesh.geometry.clone();
          rectumAttribute = mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
          rectumPositions = new Float32Array(rectumAttribute.array as Float32Array);
          rectumPivot.add(mesh);
        } else if (["levator-ani", "perineal", "tendinous-arch"].includes(id)) {
          floorPivot.add(mesh);
          muscleMeshes.push(mesh);
          referenceMuscles.push(referenceMesh);
        } else if (["ovary-l", "ovary-r", "tube-l", "tube-r", "broad-ligament", "round-ligament"].includes(id)) {
          modelRoot.add(mesh);
          accessoryMeshes.push(mesh);
          referenceAccessories.push(referenceMesh);
        } else {
          modelRoot.add(mesh);
        }
      }
      updateScene.current(simulation.mode, simulation.value, simulation.presentation);
      setReady(true);
    }, undefined, () => setUnavailable(true));

    new GLTFLoader().load("/models/term-fetus.glb", gltf => {
      if (disposed) return;
      const fetus = gltf.scene;
      fetus.scale.setScalar(5.8);
      fetus.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        object.userData.structureId = "fetus";
        object.geometry = object.geometry.clone();
        const base = object.geometry.getAttribute("position") as THREE.BufferAttribute;
        const softened = new Float32Array(base.count * 3);
        for (let i = 0; i < base.count; i++) {
          const x = base.getX(i), y = base.getY(i), z = base.getZ(i);
          const upper = Math.max(0, y - 0.15);
          const lower = Math.max(0, -y - 0.35);
          softened[i * 3] = x + upper * upper * 0.13 - lower * lower * 0.1;
          softened[i * 3 + 1] = y - upper * upper * 0.035;
          softened[i * 3 + 2] = z + upper * upper * 0.07 + lower * lower * 0.05;
        }
        object.geometry.morphAttributes.position = [new THREE.Float32BufferAttribute(softened, 3)];
        object.updateMorphTargets();
        fetusMeshes.push(object);
      });
      fetusPivot.add(fetus);
      updateScene.current(simulation.mode, simulation.value, simulation.presentation);
      setBirthReady(true);
    }, undefined, () => { if (!disposed) setBirthError(true); });

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let press: { id: number; x: number; y: number } | null = null;
    const onPointerDown = (event: PointerEvent) => { press = { id: event.pointerId, x: event.clientX, y: event.clientY }; };
    const onPointerUp = (event: PointerEvent) => {
      if (!press || press.id !== event.pointerId) return;
      const moved = Math.hypot(event.clientX - press.x, event.clientY - press.y);
      press = null;
      if (moved > 8) return;
      const bounds = renderer.domElement.getBoundingClientRect();
      const x = event.clientX - bounds.left, y = event.clientY - bounds.top;
      if (x < 0 || y < 0 || x > bounds.width || y > bounds.height) return;
      const split = comparingRef.current;
      const stacked = bounds.width < 620;
      const reference = split && (stacked ? y < bounds.height / 2 : x < bounds.width / 2);
      const paneX = split && !stacked && !reference ? bounds.width / 2 : 0;
      const paneY = split && stacked && !reference ? bounds.height / 2 : 0;
      const paneWidth = split && !stacked ? bounds.width / 2 : bounds.width;
      const paneHeight = split && stacked ? bounds.height / 2 : bounds.height;
      pointer.set(((x - paneX) / paneWidth) * 2 - 1, 1 - ((y - paneY) / paneHeight) * 2);
      raycaster.setFromCamera(pointer, reference ? referenceCamera : camera);
      const hits = raycaster.intersectObjects((reference ? referenceScene : scene).children, true)
        .filter(hit => hit.object instanceof THREE.Mesh && !!hit.object.userData.structureId);
      const organ = hits.find(hit => !["hip-l", "hip-r", "sacrum"].includes(hit.object.userData.structureId as string));
      selectStructure.current((organ ?? hits[0])?.object.userData.structureId as string | undefined ?? null);
    };
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointerup", onPointerUp);

    const resize = () => {
      const width = container.clientWidth, height = container.clientHeight;
      if (!width || !height) return;
      renderer.setSize(width, height, false);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();
    let frame = 0;
    const render = () => {
      frame = requestAnimationFrame(render);
      controls.update();
      const width = container.clientWidth, height = container.clientHeight;
      if (!width || !height) return;
      if (comparingRef.current) {
        const stacked = width < 620;
        const first = stacked
          ? { x: 0, y: Math.floor(height / 2), w: width, h: height - Math.floor(height / 2) }
          : { x: 0, y: 0, w: Math.floor(width / 2), h: height };
        const second = stacked
          ? { x: 0, y: 0, w: width, h: Math.floor(height / 2) }
          : { x: first.w, y: 0, w: width - first.w, h: height };
        referenceCamera.position.copy(camera.position);
        referenceCamera.quaternion.copy(camera.quaternion);
        referenceCamera.aspect = first.w / first.h;
        referenceCamera.updateProjectionMatrix();
        camera.aspect = second.w / second.h;
        camera.updateProjectionMatrix();
        renderer.setScissorTest(true);
        renderer.setViewport(first.x, first.y, first.w, first.h);
        renderer.setScissor(first.x, first.y, first.w, first.h);
        renderer.render(referenceScene, referenceCamera);
        renderer.setViewport(second.x, second.y, second.w, second.h);
        renderer.setScissor(second.x, second.y, second.w, second.h);
        renderer.render(scene, camera);
      } else {
        renderer.setScissorTest(false);
        renderer.setViewport(0, 0, width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.render(scene, camera);
      }
    };
    render();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      clearHighlight();
      selectStructure.current = () => undefined;
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      for (const renderedScene of [scene, referenceScene]) renderedScene.traverse(item => {
        if (item instanceof THREE.Mesh) {
          geometries.add(item.geometry);
          (Array.isArray(item.material) ? item.material : [item.material]).forEach(material => materials.add(material));
        }
      });
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(material => { if (material instanceof THREE.MeshStandardMaterial) material.map?.dispose(); material.dispose(); });
      renderer.dispose();
      renderer.domElement.remove();
      updateScene.current = () => undefined;
    };
  }, []);
  useEffect(() => { comparingRef.current = comparing; }, [comparing]);
  useEffect(() => { updateScene.current(scenario, progress, presentation); }, [scenario, progress, presentation, ready]);
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setProgress(value => value >= 100 ? 0 : value + 1), 55);
    return () => window.clearInterval(timer);
  }, [playing]);

  return <div className="pelvis-simulator">
    <div className="pelvis-sim-intro"><strong>Atlas pélvico interativo</strong><p>Explore ossos, órgãos e musculatura em um modelo anatômico texturizado. Os movimentos dos controles são demonstrações educativas, sem correspondência clínica com uma paciente.</p></div>
    <div className="pelvis-sim-options" role="group" aria-label="Situação para simular">{scenarios.map(item => <button type="button" key={item.id} className={scenario === item.id ? "selected" : ""} aria-pressed={scenario === item.id} onClick={() => { setScenario(item.id); setProgress(0); setPlaying(false); selectStructure.current(null); if (item.id === "birth") setComparing(false); }}>{item.label}</button>)}</div>
    <div className="pelvis-sim-viewbar"><span>Visualização</span><button type="button" className={comparing ? "selected" : ""} aria-pressed={comparing} onClick={() => setComparing(value => !value)}>{comparing ? "Comparação lado a lado" : "Vista única"}</button></div>
    <div className="pelvis-sim-layout"><div className={`pelvis-sim-canvas${comparing ? " is-comparing" : ""}`} ref={mount} role="img" aria-label={comparing ? `Comparação 3D entre anatomia de referência e ${current.label}. As duas vistas giram juntas.` : `Modelo 3D educativo da pelve. ${current.caption}`}>
      {!ready && <span className="pelvis-sim-loading">{unavailable ? "O modelo 3D não está disponível neste navegador." : "Carregando atlas anatômico..."}</span>}
      {comparing && <><span className="pelvis-sim-view-label reference">Anatomia de referência</span><span className="pelvis-sim-view-label simulated">{current.label} · {progress}%</span><span className="pelvis-sim-divider" aria-hidden="true" /></>}
      <span className="pelvis-sim-canvas-label">Arraste para girar · toque em uma estrutura para conhecê-la</span>
    </div><div className="pelvis-sim-controls"><span className="eyebrow">{current.label.toUpperCase()}</span><h3>{current.caption}</h3>{scenario === "birth" && <div className="pelvis-sim-presentations" role="group" aria-label="Posição do bebê no útero"><strong>Posição do bebê no útero</strong><div>{fetalPresentations.map(item => <button type="button" key={item.id} className={presentation === item.id ? "selected" : ""} aria-pressed={presentation === item.id} onClick={() => { setPresentation(item.id); setProgress(0); setPlaying(false); selectStructure.current(null); }}><span>{item.label}</span><small>{item.hint}</small></button>)}</div></div>}<div className="pelvis-sim-explanation" aria-live="polite"><strong>{observations[scenario].title}</strong><p>{observations[scenario].detail}</p></div>{selectedStructure && <div className="pelvis-sim-selection"><div><span>ESTRUTURA SELECIONADA</span><button type="button" aria-label="Fechar detalhes da estrutura" onClick={() => selectStructure.current(null)}>×</button></div><strong>{selectedStructure.name}</strong><p>{selectedStructure.description}</p></div>}{scenario === "birth" && !birthReady && <p className="pelvis-sim-birth-status" role="status">{birthError ? "Não foi possível carregar o modelo fetal." : "Carregando modelo fetal..."}</p>}<div className="pelvis-sim-legend">{scenario === "birth" ? <><span><i className="bone" /> Pelve óssea</span><span><i className="uterus" /> Útero translúcido</span><span><i className="vagina" /> Canal vaginal</span><span><i className="floor" /> Musculatura pélvica</span><span><i className="fetus" /> Bebê</span></> : <><span><i className="bone" /> Pelve óssea</span><span><i className="uterus" /> Útero e anexos</span><span><i className="bladder" /> Bexiga</span>{(scenario === "floor" || scenario === "prolapse" || scenario === "uterineProlapse" || scenario === "rectocele" || scenario === "hypertonic" || scenario === "anismus") && <span><i className="floor" /> Musculatura pélvica</span>}{(scenario === "rectocele" || scenario === "anismus") && <span><i className="rectum" /> Reto</span>}</>}</div>{(scenario !== "birth" || presentation === "cephalic") && <><label htmlFor="pelvis-progress">Progressão visual <strong>{progress}%</strong></label><input id="pelvis-progress" type="range" min="0" max="100" value={progress} onChange={event => { setProgress(Number(event.target.value)); setPlaying(false); }} /><div className="pelvis-sim-range-labels"><span>{current.low}</span><span>{current.high}</span></div><div className="pelvis-sim-actions"><button type="button" className="primary" disabled={unavailable || !ready || (scenario === "birth" && !birthReady)} onClick={() => setPlaying(value => !value)}>{playing ? "Pausar" : "Reproduzir"}</button><button type="button" className="secondary" onClick={() => { setPlaying(false); setProgress(0); }}>Reiniciar</button></div></>}<p className="pelvis-sim-tip">Use a roda do mouse ou dois dedos para aproximar.</p></div></div>
    <p className="pelvis-sim-credit">Modelo: <a href="https://sketchfab.com/3d-models/female-reproductive-system-c4d5e725198d4a1997c641d548bb20ce" target="_blank" rel="noreferrer">Stanford EdTech Team</a>, CC BY 4.0. Adaptação do arquivo por OBGynSpace.{scenario === "birth" && <> Bebê: <a href="https://sketchfab.com/3d-models/fetus-cdbadf8ba54e44ec9533a546dcd52830" target="_blank" rel="noreferrer">gelmi.com.br</a>, CC BY 4.0.</>}</p>
  </div>;
}
