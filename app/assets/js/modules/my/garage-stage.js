/**
 * Garage Hero 전용 3D 무대 (도로 threeHost와 분리 · dispose 필수)
 * Level 2: 반실사 박스 조합 렌더 + 클릭 Presence
 */
import { playHorn, playEngine } from "./garage-interact.js";

let raf = 0;
let renderer = null;
let scene = null;
let camera = null;
let car = null;
let lightsOn = false;
let doorOpen = false;
let animMode = "idle"; // idle | zoom | rotate | door | light | horn | engine
let animT0 = 0;
let hostEl = null;
let resizeObs = null;
let seqTimers = [];
let onStepCb = null;
let onDoneCb = null;

function hexToInt(hex, fallback = 0xc9a227) {
  const s = String(hex || "").replace("#", "");
  if (/^[0-9a-fA-F]{6}$/.test(s)) return parseInt(s, 16);
  return fallback;
}

function box(w, h, d, material, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    metalness: opts.metalness ?? 0.55,
    roughness: opts.roughness ?? 0.32,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 0,
    transparent: !!opts.transparent,
    opacity: opts.opacity ?? 1
  });
}

function buildCar(bodyColor) {
  const group = new THREE.Group();
  /* Dark graphite base — bodyColor as accent tint when gold-ish */
  const raw = hexToInt(bodyColor, 0x1a1f28);
  const isGoldish = ((raw >> 16) & 0xff) > 140 && ((raw >> 8) & 0xff) > 120;
  const bodyCol = isGoldish ? 0x1a1f28 : raw;
  const accent = isGoldish ? raw : 0xc9a227;

  const bodyW = 2.05;
  const bodyH = 0.36;
  const bodyL = 4.55;
  const rideY = 0.38;

  const shell = mat(bodyCol, { metalness: 0.82, roughness: 0.18 });
  const dark = mat(0x0c1016, { metalness: 0.55, roughness: 0.4 });
  const glassM = mat(0x6eb0d8, { metalness: 0.1, roughness: 0.08, transparent: true, opacity: 0.55, emissive: 0x1a3048, emissiveIntensity: 0.15 });
  const goldM = mat(accent, { metalness: 0.9, roughness: 0.2, emissive: accent, emissiveIntensity: 0.15 });

  /* main body — low sports profile */
  const body = box(bodyW, bodyH, bodyL, shell, 0, rideY, 0);
  body.name = "vehicle-body";
  group.add(body);

  const rocker = box(bodyW * 1.02, 0.12, bodyL * 0.92, dark, 0, rideY - bodyH * 0.45, 0);
  group.add(rocker);

  /* hood wedge */
  const hood = box(bodyW * 0.9, bodyH * 0.28, 1.35, shell, 0, rideY + bodyH * 0.28, bodyL * 0.28);
  hood.rotation.x = -0.08;
  group.add(hood);

  /* cabin / glass */
  const cabin = box(bodyW * 0.72, 0.34, 1.45, glassM, 0, rideY + bodyH * 0.55 + 0.18, -0.12);
  cabin.name = "vehicle-glass";
  group.add(cabin);

  const windshield = box(bodyW * 0.68, 0.28, 0.06, glassM, 0, rideY + bodyH * 0.7, 0.62);
  windshield.rotation.x = -0.35;
  group.add(windshield);

  /* gold accent line along side */
  const accentLine = box(0.04, 0.03, bodyL * 0.7, goldM, bodyW * 0.52, rideY + 0.02, 0.05);
  accentLine.name = "vehicle-gold-accent";
  group.add(accentLine);
  group.add(box(0.04, 0.03, bodyL * 0.7, goldM, -bodyW * 0.52, rideY + 0.02, 0.05));

  /* bumpers */
  group.add(box(bodyW * 1.05, bodyH * 0.38, 0.32, dark, 0, rideY - 0.04, bodyL / 2 - 0.02));
  group.add(box(bodyW * 1.05, bodyH * 0.38, 0.28, dark, 0, rideY - 0.04, -bodyL / 2 + 0.02));

  /* front splitter gold tip */
  group.add(box(bodyW * 0.7, 0.04, 0.12, goldM, 0, rideY - 0.18, bodyL / 2 + 0.08));

  /* headlights */
  const hl = mat(0xfff6d0, { emissive: 0xffe9a0, emissiveIntensity: 0.45, metalness: 0.1, roughness: 0.2 });
  const headL = box(0.34, 0.1, 0.12, hl, -bodyW * 0.34, rideY + 0.04, bodyL / 2 + 0.04);
  const headR = box(0.34, 0.1, 0.12, hl, bodyW * 0.34, rideY + 0.04, bodyL / 2 + 0.04);
  headL.name = "vehicle-front-light";
  headR.name = "vehicle-front-light";
  group.add(headL, headR);

  const tl = mat(0xff2244, { emissive: 0xff0033, emissiveIntensity: 0.85, metalness: 0.1, roughness: 0.25 });
  group.add(box(0.55, 0.08, 0.08, tl, 0, rideY + 0.05, -bodyL / 2 - 0.02));

  /* wheels — tire + rim separated */
  const wheelMat = mat(0x111111, { metalness: 0.2, roughness: 0.75 });
  const rimMat = mat(0xc9a227, { metalness: 0.92, roughness: 0.2 });
  const wheelR = 0.36;
  const wheelW = 0.3;
  const positions = [
    [-bodyW * 0.48, wheelR, bodyL * 0.3],
    [bodyW * 0.48, wheelR, bodyL * 0.3],
    [-bodyW * 0.48, wheelR, -bodyL * 0.3],
    [bodyW * 0.48, wheelR, -bodyL * 0.3]
  ];
  const wheels = [];
  positions.forEach(([x, y, z], i) => {
    const w = new THREE.Group();
    w.name = i < 2 ? "vehicle-wheel-front" : "vehicle-wheel-rear";
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(wheelR, wheelR, wheelW, 20), wheelMat);
    tire.rotation.z = Math.PI / 2;
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(wheelR * 0.58, wheelR * 0.58, wheelW * 1.08, 14), rimMat);
    rim.rotation.z = Math.PI / 2;
    w.add(tire, rim);
    w.position.set(x, y, z);
    group.add(w);
    wheels.push(w);
  });

  /* doors — pivot at leading edge */
  const doorL = new THREE.Group();
  doorL.name = "vehicle-door";
  doorL.position.set(-bodyW / 2, rideY, 0.05);
  const doorLMesh = box(0.05, bodyH * 0.9, 1.1, shell, 0, 0, 0);
  doorL.add(doorLMesh);
  doorL.add(box(0.03, 0.02, 0.7, goldM, 0.02, 0.02, 0));

  const doorR = new THREE.Group();
  doorR.name = "vehicle-door";
  doorR.position.set(bodyW / 2, rideY, 0.05);
  doorR.add(box(0.05, bodyH * 0.9, 1.1, shell, 0, 0, 0));

  group.add(doorL, doorR);

  group.userData = { headL, headR, doorL, doorR, wheels, bodyColor: bodyCol };
  /* 3/4 front facing right (user right) */
  group.rotation.y = Math.PI * 0.28;
  group.scale.setScalar(1.12);
  return group;
}

function clearSeqTimers() {
  seqTimers.forEach((id) => clearTimeout(id));
  seqTimers = [];
}

function setLights(on) {
  lightsOn = on;
  if (!car?.userData) return;
  const inten = on ? 2.4 : 0.35;
  [car.userData.headL, car.userData.headR].forEach((m) => {
    if (m?.material) m.material.emissiveIntensity = inten;
  });
}

function setDoors(open) {
  doorOpen = open;
  if (!car?.userData) return;
  const a = open ? 1.05 : 0;
  if (car.userData.doorL) car.userData.doorL.rotation.y = -a;
  if (car.userData.doorR) car.userData.doorR.rotation.y = a;
}

function fit() {
  if (!hostEl || !renderer || !camera) return;
  const w = Math.max(1, hostEl.clientWidth);
  const h = Math.max(1, hostEl.clientHeight);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

function tick() {
  raf = requestAnimationFrame(tick);
  if (!renderer || !scene || !camera || !car) return;
  if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
  const t = performance.now() / 1000;
  const elapsed = t - animT0;

  if (animMode === "idle") {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    const baseY = Math.PI * 0.28;
    car.rotation.y = reduced ? baseY : baseY + Math.sin(t * 0.45) * 0.08;
    car.position.y = reduced ? 0 : Math.sin(t * 1.1) * 0.015;
  } else if (animMode === "zoom") {
    const s = 1.12 + Math.min(1, elapsed / 0.7) * 0.38;
    car.scale.setScalar(s);
  } else if (animMode === "rotate") {
    const baseY = Math.PI * 0.28;
    car.rotation.y = baseY + Math.sin(elapsed * 2.0) * 0.75;
  } else if (animMode === "door") {
    setDoors(true);
  } else if (animMode === "light") {
    setLights(true);
  } else if (animMode === "horn") {
    car.scale.setScalar(1.45 + Math.sin(elapsed * 18) * 0.015);
  } else if (animMode === "engine") {
    car.position.y = Math.sin(elapsed * 26) * 0.012;
    (car.userData.wheels || []).forEach((w) => {
      w.rotation.x += 0.16;
    });
  }

  renderer.render(scene, camera);
}

/**
 * @param {HTMLElement} host
 * @param {{ bodyColor?: string, onStep?: Function, onDone?: Function }} opts
 */
export function mountGarageStage(host, opts = {}) {
  disposeGarageStage();
  if (!host || !window.THREE) return false;
  hostEl = host;
  onStepCb = opts.onStep || null;
  onDoneCb = opts.onDone || null;

  const canvas = document.createElement("canvas");
  canvas.className = "my-garage-stage-canvas";
  host.innerHTML = "";
  host.appendChild(canvas);

  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x06080c, 8, 22);

  camera = new THREE.PerspectiveCamera(38, 1, 0.1, 80);
  camera.position.set(4.6, 1.85, 3.4);
  camera.lookAt(0, 0.45, 0);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true;
  renderer.setClearColor(0x000000, 0);

  scene.add(new THREE.HemisphereLight(0xe8f0ff, 0x1a1510, 1.1));
  const key = new THREE.DirectionalLight(0xfff2d0, 2.2);
  key.position.set(4, 8, 3);
  key.castShadow = true;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x88aaff, 0.9);
  rim.position.set(-5, 3, -2);
  scene.add(rim);
  const floorSpot = new THREE.SpotLight(0xc9a227, 1.4, 18, 0.55, 0.4);
  floorSpot.position.set(0, 6, 2);
  floorSpot.target.position.set(0, 0, 0);
  scene.add(floorSpot, floorSpot.target);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(5.5, 48),
    new THREE.MeshStandardMaterial({ color: 0x121820, metalness: 0.55, roughness: 0.35 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.2, 2.35, 64),
    new THREE.MeshBasicMaterial({ color: 0xc9a227, transparent: true, opacity: 0.35 })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  scene.add(ring);

  /* Gold vertical backlight pillars */
  const pillarMat = new THREE.MeshBasicMaterial({ color: 0xc9a227, transparent: true, opacity: 0.35 });
  const pillarL = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 4.2), pillarMat);
  pillarL.position.set(-2.8, 2.1, -1.2);
  const pillarR = pillarL.clone();
  pillarR.position.set(2.6, 2.1, -1.4);
  scene.add(pillarL, pillarR);

  car = buildCar(opts.bodyColor || "#1a1f28");
  scene.add(car);

  fit();
  resizeObs = new ResizeObserver(() => fit());
  resizeObs.observe(host);
  animMode = "idle";
  animT0 = performance.now() / 1000;
  tick();
  return true;
}

export function runGarageStagePresence() {
  if (!car) return false;
  clearSeqTimers();
  setLights(false);
  setDoors(false);
  car.scale.setScalar(1.12);
  const steps = [
    { id: "zoom", label: "확대", ms: 900 },
    { id: "rotate", label: "좌우 회전", ms: 1600 },
    { id: "door", label: "문 열기", ms: 1000 },
    { id: "light", label: "라이트", ms: 900 },
    { id: "horn", label: "경적", ms: 700 },
    { id: "engine", label: "엔진", ms: 1800 }
  ];
  let delay = 60;
  steps.forEach((step, i) => {
    seqTimers.push(
      setTimeout(() => {
        animMode = step.id;
        animT0 = performance.now() / 1000;
        onStepCb?.(step.id, step.label);
        if (step.id === "horn") playHorn();
        if (step.id === "engine") playEngine();
        if (i === steps.length - 1) {
          seqTimers.push(
            setTimeout(() => {
              animMode = "idle";
              setDoors(false);
              car.scale.setScalar(1.12);
              onDoneCb?.();
            }, step.ms)
          );
        }
      }, delay)
    );
    delay += step.ms;
  });
  return true;
}

export function disposeGarageStage() {
  clearSeqTimers();
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  resizeObs?.disconnect();
  resizeObs = null;
  if (renderer) {
    renderer.dispose();
    renderer.forceContextLoss?.();
  }
  renderer = null;
  scene = null;
  camera = null;
  car = null;
  hostEl = null;
  animMode = "idle";
  lightsOn = false;
  doorOpen = false;
}

export function garageStageAvailable() {
  return !!window.THREE;
}
