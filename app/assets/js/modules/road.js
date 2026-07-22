import {on} from "../core/events.js";

const CAR_COLORS = [0xff344e, 0x2ca9ff, 0xffc400, 0x8e63d9, 0x48c774];
const LANES = [-9, 0, 9];

let scene;
let camera;
let renderer;
let clock;
let running = false;
let frameId = 0;
let scenery = [];
/** @type {Map<string,{mesh:THREE.Object3D,speed:number,z:number,index:number}>} */
const carEntries = new Map();
let mineMesh = null;
let usersRef = [];
let stateRef = null;
let environment = "urban";
let roadReady = false;
let resizeBound = false;
let usersListenerBound = false;

let lastWarnKey = "";
let lastWarnAt = 0;

function warnRare(tag, err) {
  const key = `${tag}:${err?.message || err}`;
  const now = Date.now();
  if (key === lastWarnKey && now - lastWarnAt < 5000) return;
  lastWarnKey = key;
  lastWarnAt = now;
  console.warn(tag, err);
}

function meshCar(color = 0x2ca9ff) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(2, 0.55, 4),
    new THREE.MeshStandardMaterial({color, metalness: 0.5, roughness: 0.35})
  );
  body.position.y = 0.55;
  body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 0.5, 1.8),
    new THREE.MeshStandardMaterial({color: 0x182536})
  );
  cabin.position.set(0, 1.02, -0.1);
  g.add(cabin);
  return g;
}

function addRoad(z) {
  const road = new THREE.Mesh(
    new THREE.BoxGeometry(30, 0.18, 80),
    new THREE.MeshStandardMaterial({color: 0x3b4046, roughness: 0.9})
  );
  road.position.set(0, -0.08, z);
  road.receiveShadow = true;
  scene.add(road);
  scenery.push(road);
  for (const x of [-5, 5]) {
    for (let d = -35; d <= 35; d += 11) {
      const mark = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 0.03, 5),
        new THREE.MeshStandardMaterial({color: 0xfff9d0})
      );
      mark.position.set(x, 0.02, z + d);
      scene.add(mark);
      scenery.push(mark);
    }
  }
}

function addBuilding(x, z, h, color) {
  const b = new THREE.Mesh(
    new THREE.BoxGeometry(8, h, 10),
    new THREE.MeshStandardMaterial({color, roughness: 0.8})
  );
  b.position.set(x, h / 2, z);
  b.castShadow = true;
  scene.add(b);
  scenery.push(b);
}

function clearScenery() {
  for (const o of scenery) scene.remove(o);
  scenery = [];
}

function buildScenery(env) {
  if (!scene) return;
  environment = env;
  clearScenery();
  scene.background = new THREE.Color(env === "coast" ? 0x0b2633 : 0x0a1721);
  scene.fog = new THREE.Fog(0x111c24, 60, 250);
  for (let z = 10; z > -600; z -= 80) addRoad(z);
  if (env !== "highway") {
    for (let z = -40; z > -500; z -= 34) {
      addBuilding(-23 - Math.random() * 7, z, 10 + Math.random() * 28, 0x2d414d);
      addBuilding(23 + Math.random() * 7, z - 12, 10 + Math.random() * 28, 0x334a55);
    }
  }
}

/** 내 위치 대비 상대 좌표 → 도로 공간 x/z */
function roadPosFromUser(user, index) {
  const me = stateRef?.location || {lat: 0, lng: 0};
  const dLat = (user.lat - me.lat) * 111320;
  const cos = Math.cos(me.lat * Math.PI / 180) || 1;
  const dLng = (user.lng - me.lng) * 111320 * cos;
  const dist = Math.sqrt(dLat * dLat + dLng * dLng);
  const z = -20 - Math.min(180, dist / 4) - (index % 3) * 6;
  const x = Math.max(-12, Math.min(12, dLng / 25));
  return {x: Number.isFinite(x) ? x : LANES[index % 3], z: Number.isFinite(z) ? z : -45 - index * 24};
}

function updateHudCount() {
  const countEl = document.querySelector("#roadCount");
  if (countEl) countEl.textContent = String(carEntries.size);
}

/**
 * 사용자 목록 기준 차량 mesh upsert (장면 전체 재생성 없음).
 */
export function syncRoadUsers(users) {
  if (!roadReady || !scene) return;
  try {
    usersRef = Array.isArray(users) ? users : [];
    const list = usersRef.slice(0, 8);
    const ids = new Set(list.map(u => u.id));

    for (const [id, entry] of carEntries) {
      if (ids.has(id)) continue;
      scene.remove(entry.mesh);
      carEntries.delete(id);
    }

    list.forEach((user, index) => {
      let entry = carEntries.get(user.id);
      if (!entry) {
        const mesh = meshCar(CAR_COLORS[index % CAR_COLORS.length]);
        scene.add(mesh);
        entry = {
          mesh,
          speed: 0.2 + (index % 4) * 0.05,
          z: -45 - index * 24,
          index
        };
        carEntries.set(user.id, entry);
      }
      const pos = roadPosFromUser(user, index);
      entry.index = index;
      entry.z = pos.z;
      entry.mesh.position.set(pos.x, 0, pos.z);
      entry.mesh.visible = user.online !== false;
    });

    updateHudCount();
  } catch (e) {
    warnRare("[VROO road] syncRoadUsers", e);
  }
}

function ensureUsersListener() {
  if (usersListenerBound) return;
  usersListenerBound = true;
  on("users:changed", list => {
    if (!roadReady) return;
    syncRoadUsers(list);
  });
}

export function initRoad(state, users) {
  stateRef = state;
  usersRef = users || [];
  if (!window.THREE) throw new Error("Three.js를 불러오지 못했습니다.");
  const host = document.querySelector("#threeHost");
  if (!host) throw new Error("도로 모드 영역을 찾을 수 없습니다.");

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(
    65,
    Math.max(host.clientWidth, 1) / Math.max(host.clientHeight, 1),
    0.1,
    800
  );
  camera.position.set(0, 4, 19);
  camera.lookAt(0, 0.7, -45);

  renderer = new THREE.WebGLRenderer({antialias: true});
  renderer.setSize(Math.max(host.clientWidth, 1), Math.max(host.clientHeight, 1));
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  host.appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xd9efff, 0x394334, 1.8));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(-30, 45, 25);
  sun.castShadow = true;
  scene.add(sun);

  mineMesh = meshCar(0x149cff);
  mineMesh.position.set(0, 0, 6);
  mineMesh.scale.setScalar(1.15);
  scene.add(mineMesh);

  clock = new THREE.Clock();
  buildScenery("urban");
  syncRoadUsers(usersRef);

  if (!resizeBound) {
    window.addEventListener("resize", resize);
    resizeBound = true;
  }
  ensureUsersListener();
  roadReady = true;
}

function resize() {
  if (!renderer || !camera) return;
  const host = document.querySelector("#threeHost");
  if (!host) return;
  camera.aspect = Math.max(host.clientWidth, 1) / Math.max(host.clientHeight, 1);
  camera.updateProjectionMatrix();
  renderer.setSize(Math.max(host.clientWidth, 1), Math.max(host.clientHeight, 1));
}

function tick() {
  if (!running || !renderer || !clock) return;
  frameId = requestAnimationFrame(tick);
  try {
    const dt = Math.min(clock.getDelta(), 0.03);
    const speed = 38 + Math.round(Math.sin(performance.now() / 2500) * 3);
    const speedEl = document.querySelector("#roadSpeed");
    if (speedEl) speedEl.textContent = String(speed);

    let min = 999;
    for (const entry of carEntries.values()) {
      entry.z += dt * (1.2 + entry.speed * 2);
      if (entry.z > -18) entry.z = -150 - Math.random() * 80;
      entry.mesh.position.z = entry.z;
      min = Math.min(min, Math.max(18, Math.round(-entry.z)));
    }

    const safetyEl = document.querySelector("#roadSafety");
    if (safetyEl) safetyEl.textContent = min < 22 ? "안전거리 주의" : "안전거리 정상";
    const metaEl = document.querySelector("#roadMeta");
    if (metaEl) {
      metaEl.textContent = `${environment} · 안정 주행 · 전방 ${carEntries.size}대`;
    }
    renderer.render(scene, camera);
  } catch (e) {
    warnRare("[VROO road] tick", e);
  }
}

export function startRoad() {
  if (!roadReady || !clock) return;
  if (running) return;
  running = true;
  clock.start();
  resize();
  tick();
}

export function stopRoad() {
  running = false;
  if (frameId) {
    cancelAnimationFrame(frameId);
    frameId = 0;
  }
}

export function setEnvironment(env) {
  if (!roadReady) return;
  try {
    if (env === "auto") env = "urban";
    buildScenery(env);
    syncRoadUsers(usersRef);
  } catch (e) {
    warnRare("[VROO road] setEnvironment", e);
  }
}

export function isRoadReady() {
  return roadReady;
}
