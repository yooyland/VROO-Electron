import {on} from "../core/events.js";
import {MY_USER_ID} from "./data.js";

const LANES = [-9, 0, 9];
const ME_BEAM_COLOR = 0x00cb51;
const ME_BODY_COLOR = 0x149cff;
const BUBBLE_TTL_MS = 5000;
const PEER_BEAM_PALETTE = [0xff344e, 0x2ca9ff, 0xffc400, 0x8e63d9, 0xff7a18, 0x48c774];

let scene;
let camera;
let renderer;
let clock;
let running = false;
let frameId = 0;
let scenery = [];
/** @type {Map<string,{mesh:THREE.Object3D,speed:number,z:number,index:number,user:object}>} */
const carEntries = new Map();
let mineMesh = null;
let usersRef = [];
let stateRef = null;
let environment = "urban";
let roadReady = false;
let resizeBound = false;
let usersListenerBound = false;
let chatListenerBound = false;

/** @type {Map<string, {mesh:THREE.Object3D, material:THREE.Material, userId:string}>} */
const roadConversationBeams = new Map();
/** @type {{roomId:string|null,type:string|null,peerId:string|null,gridId:string|null,participantIds:string[]}|null} */
let activeConversation = null;

/** @type {Map<string, HTMLElement>} */
const roadBubbleOverlays = new Map();
/** @type {Map<string, ReturnType<typeof setTimeout>>} */
const roadBubbleTimers = new Map();
/** @type {Set<string>} */
const displayedMessageIds = new Set();

let projVec = null;
let bubbleLayer = null;

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

function hashHue(id) {
  let h = 0;
  const s = String(id || "");
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function colorForUserId(userId) {
  if (userId === MY_USER_ID) return ME_BODY_COLOR;
  return PEER_BEAM_PALETTE[hashHue(userId) % PEER_BEAM_PALETTE.length];
}

function beamColorForUserId(userId) {
  if (userId === MY_USER_ID) return ME_BEAM_COLOR;
  return PEER_BEAM_PALETTE[hashHue(userId) % PEER_BEAM_PALETTE.length];
}

function carTier(level) {
  const lv = Math.max(1, Number(level) || 1);
  if (lv >= 60) return 5;
  if (lv >= 40) return 4;
  if (lv >= 20) return 3;
  if (lv >= 10) return 2;
  return 1;
}

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    metalness: opts.metalness ?? 0.55,
    roughness: opts.roughness ?? 0.35,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 0,
    transparent: !!opts.transparent,
    opacity: opts.opacity ?? 1
  });
}

function box(w, h, d, material, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x || 0, y || 0, z || 0);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/**
 * THREE.Group 기반 레벨별 차량.
 * 외부 GLTF 없이 기본 Geometry 조합.
 */
export function createCarGroup(user) {
  const group = new THREE.Group();
  group.userData.vrooUserId = user?.id || "";
  group.userData.parts = {};
  applyCarAppearance(group, user || {});
  return group;
}

export function applyCarAppearance(group, user) {
  if (!group) return;
  while (group.children.length) {
    const ch = group.children[0];
    group.remove(ch);
    disposeObject(ch);
  }

  const level = user.level ?? stateRef?.level ?? 1;
  const tier = carTier(level);
  const bodyColor = colorForUserId(user.id || MY_USER_ID);
  const isMe = user.id === MY_USER_ID || (!user.id && group === mineMesh);
  const accent = isMe ? ME_BODY_COLOR : bodyColor;

  const parts = {};
  const scale = tier >= 5 ? 1.05 : tier >= 4 ? 1.0 : tier >= 3 ? 0.98 : 0.95;

  // body dims by tier
  const bodyW = tier >= 5 ? 2.35 : tier >= 3 ? 2.15 : tier >= 2 ? 2.05 : 1.9;
  const bodyH = tier >= 5 ? 0.42 : tier >= 3 ? 0.48 : 0.55;
  const bodyL = tier >= 5 ? 4.6 : tier >= 3 ? 4.3 : 4.0;
  const rideY = bodyH / 2 + 0.28;

  parts.body = box(bodyW, bodyH, bodyL, mat(accent, {metalness: 0.65, roughness: 0.28}), 0, rideY, 0);
  group.add(parts.body);

  // hood
  const hoodL = tier >= 5 ? 1.35 : 1.1;
  parts.hood = box(
    bodyW * 0.92,
    bodyH * 0.35,
    hoodL,
    mat(accent, {metalness: 0.7, roughness: 0.25}),
    0,
    rideY + bodyH * 0.35,
    bodyL * 0.28
  );
  group.add(parts.hood);

  // cabin / glass
  const cabinW = bodyW * (tier >= 5 ? 0.78 : 0.82);
  const cabinH = tier >= 5 ? 0.38 : 0.48;
  const cabinL = tier >= 5 ? 1.55 : 1.75;
  parts.cabin = box(
    cabinW,
    cabinH,
    cabinL,
    mat(0x0e1a28, {metalness: 0.2, roughness: 0.15, transparent: true, opacity: 0.85}),
    0,
    rideY + bodyH * 0.55 + cabinH / 2,
    tier >= 5 ? -0.15 : -0.05
  );
  group.add(parts.cabin);

  // windshield strip
  parts.windshield = box(
    cabinW * 0.95,
    cabinH * 0.7,
    0.08,
    mat(0x7ec8ff, {metalness: 0.1, roughness: 0.05, transparent: true, opacity: 0.55, emissive: 0x224466, emissiveIntensity: 0.2}),
    0,
    rideY + bodyH * 0.55 + cabinH * 0.55,
    cabinL * 0.42 + (tier >= 5 ? -0.15 : -0.05)
  );
  group.add(parts.windshield);

  // bumpers
  parts.frontBumper = box(
    bodyW * 1.02,
    bodyH * 0.45,
    0.28,
    mat(0x121820, {metalness: 0.4, roughness: 0.5}),
    0,
    rideY - bodyH * 0.15,
    bodyL / 2 - 0.05
  );
  group.add(parts.frontBumper);
  parts.rearBumper = box(
    bodyW * 1.02,
    bodyH * 0.45,
    0.28,
    mat(0x121820, {metalness: 0.4, roughness: 0.5}),
    0,
    rideY - bodyH * 0.15,
    -bodyL / 2 + 0.05
  );
  group.add(parts.rearBumper);

  // lights
  const lightY = rideY + bodyH * 0.15;
  const hl = mat(0xfff2c4, {emissive: 0xffeeaa, emissiveIntensity: tier >= 2 ? 1.2 : 0.6, metalness: 0.1, roughness: 0.2});
  parts.headL = box(0.28, 0.14, 0.12, hl, -bodyW * 0.32, lightY, bodyL / 2 + 0.02);
  parts.headR = box(0.28, 0.14, 0.12, hl, bodyW * 0.32, lightY, bodyL / 2 + 0.02);
  group.add(parts.headL, parts.headR);

  const tl = mat(0xff2244, {emissive: 0xff0033, emissiveIntensity: tier >= 3 ? 1.4 : 0.8, metalness: 0.1, roughness: 0.3});
  parts.tailL = box(0.32, 0.12, 0.1, tl, -bodyW * 0.3, lightY, -bodyL / 2 - 0.02);
  parts.tailR = box(0.32, 0.12, 0.1, tl, bodyW * 0.3, lightY, -bodyL / 2 - 0.02);
  group.add(parts.tailL, parts.tailR);

  // wheels
  const wheelR = tier >= 4 ? 0.38 : tier >= 2 ? 0.34 : 0.3;
  const wheelW = tier >= 4 ? 0.28 : 0.22;
  const wheelMat = mat(0x1a1a1a, {metalness: 0.3, roughness: 0.7});
  const rimMat = mat(tier >= 5 ? 0xc0c8d4 : 0x666b75, {metalness: 0.85, roughness: 0.25});
  const wx = bodyW / 2 + 0.02;
  const wzF = bodyL * 0.32;
  const wzR = -bodyL * 0.32;
  const wy = wheelR;
  for (const [sx, sz, key] of [
    [-wx, wzF, "wFL"],
    [wx, wzF, "wFR"],
    [-wx, wzR, "wRL"],
    [wx, wzR, "wRR"]
  ]) {
    const wheel = new THREE.Group();
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(wheelR, wheelR, wheelW, 14), wheelMat);
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    wheel.add(tire);
    if (tier >= 2) {
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(wheelR * 0.55, wheelR * 0.55, wheelW * 1.05, 10), rimMat);
      rim.rotation.z = Math.PI / 2;
      wheel.add(rim);
    }
    wheel.position.set(sx, wy, sz);
    parts[key] = wheel;
    group.add(wheel);
  }

  // side skirts (tier 3+)
  if (tier >= 3) {
    parts.skirtL = box(0.08, 0.12, bodyL * 0.7, mat(0x0a0e14), -bodyW / 2 - 0.02, rideY - bodyH * 0.35, 0);
    parts.skirtR = box(0.08, 0.12, bodyL * 0.7, mat(0x0a0e14), bodyW / 2 + 0.02, rideY - bodyH * 0.35, 0);
    group.add(parts.skirtL, parts.skirtR);
  }

  // spoiler
  if (tier >= 3) {
    const spoilerW = bodyW * (tier >= 5 ? 1.05 : 0.9);
    const spoilerY = rideY + bodyH + (tier >= 5 ? 0.55 : 0.35);
    parts.spoiler = box(
      spoilerW,
      0.06,
      tier >= 5 ? 0.45 : 0.28,
      mat(accent, {metalness: 0.7, roughness: 0.25}),
      0,
      spoilerY,
      -bodyL / 2 + 0.35
    );
    group.add(parts.spoiler);
    if (tier >= 4) {
      parts.spoilerPostL = box(0.06, 0.28, 0.06, mat(0x222), -spoilerW * 0.35, spoilerY - 0.14, -bodyL / 2 + 0.4);
      parts.spoilerPostR = box(0.06, 0.28, 0.06, mat(0x222), spoilerW * 0.35, spoilerY - 0.14, -bodyL / 2 + 0.4);
      group.add(parts.spoilerPostL, parts.spoilerPostR);
    }
  }

  // underglow
  if (tier >= 3) {
    const glowCol = isMe ? ME_BEAM_COLOR : accent;
    const ug = new THREE.Mesh(
      new THREE.BoxGeometry(bodyW * 0.85, 0.04, bodyL * 0.75),
      new THREE.MeshBasicMaterial({
        color: glowCol,
        transparent: true,
        opacity: tier >= 5 ? 0.45 : 0.28,
        depthWrite: false
      })
    );
    ug.position.set(0, 0.06, 0);
    ug.renderOrder = 2;
    parts.underglow = ug;
    group.add(ug);
  }

  // emissive body line (tier 5)
  if (tier >= 5) {
    const line = box(
      bodyW * 1.01,
      0.04,
      bodyL * 0.9,
      mat(accent, {emissive: accent, emissiveIntensity: 0.55, metalness: 0.2, roughness: 0.4}),
      0,
      rideY + bodyH * 0.45,
      0
    );
    parts.glowLine = line;
    group.add(line);
  }

  group.scale.setScalar(scale * (isMe || user.id === MY_USER_ID ? 1.12 : 1));
  group.userData.parts = parts;
  group.userData.tier = tier;
  group.userData.bodyColor = accent;
}

export function updateCarTransform(group, x, y, z) {
  if (!group) return;
  group.position.set(x, y || 0, z);
}

function disposeObject(obj) {
  if (!obj) return;
  obj.traverse?.(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
      else o.material.dispose();
    }
  });
  if (obj.geometry) obj.geometry.dispose();
  if (obj.material) {
    if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
    else obj.material.dispose();
  }
}

export function disposeCarGroup(group) {
  if (!group) return;
  disposeObject(group);
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

function roadPosFromUser(user, index) {
  const me = stateRef?.location || {lat: 0, lng: 0};
  const dLat = (user.lat - me.lat) * 111320;
  const cos = Math.cos((me.lat * Math.PI) / 180) || 1;
  const dLng = (user.lng - me.lng) * 111320 * cos;
  const dist = Math.sqrt(dLat * dLat + dLng * dLng);
  const z = -20 - Math.min(180, dist / 4) - (index % 3) * 6;
  const x = Math.max(-12, Math.min(12, dLng / 25));
  return {
    x: Number.isFinite(x) ? x : LANES[index % 3],
    z: Number.isFinite(z) ? z : -45 - index * 24
  };
}

function updateHudCount() {
  const countEl = document.querySelector("#roadCount");
  if (countEl) countEl.textContent = String(carEntries.size);
}

function ensureBubbleLayer() {
  const host = document.querySelector("#threeHost");
  if (!host) return null;
  if (!bubbleLayer) {
    bubbleLayer = document.createElement("div");
    bubbleLayer.id = "roadBubbleLayer";
    bubbleLayer.className = "road-bubble-layer";
    host.appendChild(bubbleLayer);
  }
  return bubbleLayer;
}

function clearAllBubbles() {
  for (const [, t] of roadBubbleTimers) clearTimeout(t);
  roadBubbleTimers.clear();
  for (const [, el] of roadBubbleOverlays) el.remove();
  roadBubbleOverlays.clear();
}

function hideAllBubbles() {
  for (const el of roadBubbleOverlays.values()) {
    el.style.opacity = "0";
    el.style.visibility = "hidden";
  }
}

function showBubbleForUser(userId, text, messageId) {
  if (!userId || !text) return;
  if (messageId && displayedMessageIds.has(messageId)) return;
  if (messageId) displayedMessageIds.add(messageId);

  const layer = ensureBubbleLayer();
  if (!layer) return;

  let el = roadBubbleOverlays.get(userId);
  if (!el) {
    el = document.createElement("div");
    el.className = "road-chat-bubble";
    layer.appendChild(el);
    roadBubbleOverlays.set(userId, el);
  }

  const prev = roadBubbleTimers.get(userId);
  if (prev) clearTimeout(prev);

  el.textContent = "";
  const span = document.createElement("span");
  span.textContent = String(text).slice(0, 80);
  el.appendChild(span);
  el.classList.remove("fade-out");
  el.style.opacity = "1";
  el.style.visibility = "visible";

  const timer = setTimeout(() => {
    el.classList.add("fade-out");
    setTimeout(() => {
      el.remove();
      roadBubbleOverlays.delete(userId);
      roadBubbleTimers.delete(userId);
    }, 400);
  }, BUBBLE_TTL_MS);
  roadBubbleTimers.set(userId, timer);
}

function updateBubblePositions() {
  if (!camera || !renderer || !running) return;
  if (!projVec) projVec = new THREE.Vector3();
  const host = document.querySelector("#threeHost");
  if (!host) return;
  const w = host.clientWidth;
  const h = host.clientHeight;

  for (const [userId, el] of roadBubbleOverlays) {
    const mesh = userId === MY_USER_ID ? mineMesh : carEntries.get(userId)?.mesh;
    if (!mesh || mesh.visible === false) {
      el.style.visibility = "hidden";
      continue;
    }
    mesh.getWorldPosition(projVec);
    projVec.y += 2.4;
    projVec.project(camera);
    if (projVec.z > 1) {
      el.style.visibility = "hidden";
      continue;
    }
    const x = (projVec.x * 0.5 + 0.5) * w;
    const y = (-projVec.y * 0.5 + 0.5) * h;
    if (x < -40 || y < -40 || x > w + 40 || y > h + 40) {
      el.style.visibility = "hidden";
      continue;
    }
    el.style.visibility = "visible";
    el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -100%)`;
  }
}

function clearConversationBeams() {
  for (const [id, beam] of roadConversationBeams) {
    scene?.remove(beam.mesh);
    disposeObject(beam.mesh);
    roadConversationBeams.delete(id);
  }
}

function ensureBeam(userId) {
  if (!scene || roadConversationBeams.has(userId)) return roadConversationBeams.get(userId);
  const color = beamColorForUserId(userId);
  const isMe = userId === MY_USER_ID;
  const geo = new THREE.ConeGeometry(isMe ? 1.05 : 1.35, isMe ? 2.2 : 2.8, 20, 1, true);
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: isMe ? 0.28 : 0.38,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending
  });
  const mesh = new THREE.Mesh(geo, material);
  mesh.rotation.x = Math.PI;
  mesh.position.y = isMe ? 1.1 : 1.35;
  mesh.renderOrder = 3;
  mesh.frustumCulled = false;
  scene.add(mesh);
  const entry = {mesh, material, userId};
  roadConversationBeams.set(userId, entry);
  return entry;
}

function syncConversationBeams() {
  if (!roadReady || !scene) return;
  const wanted = new Set();
  if (activeConversation?.participantIds?.length) {
    for (const id of activeConversation.participantIds) {
      if (!id) continue;
      if (id === MY_USER_ID) {
        wanted.add(MY_USER_ID);
        continue;
      }
      const entry = carEntries.get(id);
      if (entry?.mesh?.visible !== false) wanted.add(id);
    }
  }

  for (const [id] of roadConversationBeams) {
    if (!wanted.has(id)) {
      const beam = roadConversationBeams.get(id);
      scene.remove(beam.mesh);
      disposeObject(beam.mesh);
      roadConversationBeams.delete(id);
    }
  }
  for (const id of wanted) ensureBeam(id);
  updateBeamTransforms();
}

function updateBeamTransforms(timeMs) {
  const t = (timeMs || performance.now()) / 1000;
  for (const [userId, beam] of roadConversationBeams) {
    const car = userId === MY_USER_ID ? mineMesh : carEntries.get(userId)?.mesh;
    if (!car) {
      beam.mesh.visible = false;
      continue;
    }
    beam.mesh.visible = true;
    beam.mesh.position.x = car.position.x;
    beam.mesh.position.z = car.position.z;
    const base = userId === MY_USER_ID ? 0.26 : 0.34;
    beam.material.opacity = base + Math.sin(t * 2.4 + hashHue(userId) * 0.01) * 0.07;
  }
}

function buildMineUser() {
  return {
    id: MY_USER_ID,
    level: stateRef?.level || 1,
    car: stateRef?.profile?.car || "sport",
    online: true
  };
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
      disposeCarGroup(entry.mesh);
      carEntries.delete(id);
      if (roadConversationBeams.has(id)) {
        const beam = roadConversationBeams.get(id);
        scene.remove(beam.mesh);
        disposeObject(beam.mesh);
        roadConversationBeams.delete(id);
      }
    }

    list.forEach((user, index) => {
      let entry = carEntries.get(user.id);
      if (!entry) {
        const mesh = createCarGroup(user);
        scene.add(mesh);
        entry = {
          mesh,
          speed: 0.2 + (index % 4) * 0.05,
          z: -45 - index * 24,
          index,
          user
        };
        carEntries.set(user.id, entry);
      } else {
        const prevLv = entry.user?.level;
        entry.user = user;
        if (prevLv !== user.level) applyCarAppearance(entry.mesh, user);
      }
      const pos = roadPosFromUser(user, index);
      entry.index = index;
      entry.z = pos.z;
      updateCarTransform(entry.mesh, pos.x, 0, pos.z);
      entry.mesh.visible = user.online !== false;
    });

    if (mineMesh) applyCarAppearance(mineMesh, buildMineUser());
    syncConversationBeams();
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

function ensureChatListeners() {
  if (chatListenerBound) return;
  chatListenerBound = true;

  on("chat:activeRoomChanged", detail => {
    activeConversation = {
      roomId: detail?.roomId || null,
      type: detail?.type || null,
      peerId: detail?.peerId || null,
      gridId: detail?.gridId || null,
      participantIds: Array.isArray(detail?.participantIds)
        ? detail.participantIds.map(String)
        : []
    };
    if (roadReady) syncConversationBeams();
  });

  on("chat:closed", () => {
    activeConversation = null;
    clearConversationBeams();
  });

  on("chat:messagePreview", detail => {
    if (!roadReady) return;
    const senderId = detail?.senderId;
    const text = detail?.text;
    const messageId = detail?.messageId;
    if (!senderId || !text) return;
    if (senderId !== MY_USER_ID && !carEntries.has(senderId)) return;
    showBubbleForUser(senderId, text, messageId);
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
  ensureBubbleLayer();

  scene.add(new THREE.HemisphereLight(0xd9efff, 0x394334, 1.8));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(-30, 45, 25);
  sun.castShadow = true;
  scene.add(sun);

  mineMesh = createCarGroup(buildMineUser());
  mineMesh.position.set(0, 0, 6);
  scene.add(mineMesh);

  clock = new THREE.Clock();
  buildScenery("urban");
  syncRoadUsers(usersRef);

  if (!resizeBound) {
    window.addEventListener("resize", resize);
    resizeBound = true;
  }
  ensureUsersListener();
  ensureChatListeners();
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
    const now = performance.now();
    const speed = 38 + Math.round(Math.sin(now / 2500) * 3);
    const speedEl = document.querySelector("#roadSpeed");
    if (speedEl) speedEl.textContent = String(speed);

    let min = 999;
    for (const entry of carEntries.values()) {
      entry.z += dt * (1.2 + entry.speed * 2);
      if (entry.z > -18) entry.z = -150 - Math.random() * 80;
      entry.mesh.position.z = entry.z;
      min = Math.min(min, Math.max(18, Math.round(-entry.z)));
    }

    updateBeamTransforms(now);
    updateBubblePositions();

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
  syncConversationBeams();
  tick();
}

export function stopRoad() {
  running = false;
  if (frameId) {
    cancelAnimationFrame(frameId);
    frameId = 0;
  }
  hideAllBubbles();
}

export function setEnvironment(env) {
  if (!roadReady) return;
  try {
    if (env === "auto") env = "urban";
    buildScenery(env);
    syncRoadUsers(usersRef);
    syncConversationBeams();
  } catch (e) {
    warnRare("[VROO road] setEnvironment", e);
  }
}

export function isRoadReady() {
  return roadReady;
}
