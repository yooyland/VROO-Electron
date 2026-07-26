/**
 * Garage 차량 인터랙션 — zoom → rotate → door → light → horn → engine
 * (Web Audio · CSS/SVG — Three.js 도로 렌더러와 분리)
 */

let audioCtx = null;

function ctx() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
  }
  if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
  return audioCtx;
}

function tone(freq, dur, type = "sine", gain = 0.08, slideTo = null) {
  const c = ctx();
  if (!c) return;
  const t0 = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo != null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/** 경적 */
export function playHorn() {
  tone(420, 0.18, "square", 0.06);
  setTimeout(() => tone(320, 0.22, "square", 0.05), 90);
}

/** 엔진 시동음 (짧은 럼블) */
export function playEngine() {
  const c = ctx();
  if (!c) return;
  const t0 = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  const lfo = c.createOscillator();
  const lfoGain = c.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(55, t0);
  osc.frequency.linearRampToValueAtTime(90, t0 + 0.8);
  osc.frequency.linearRampToValueAtTime(70, t0 + 1.6);
  lfo.frequency.value = 8;
  lfoGain.gain.value = 12;
  lfo.connect(lfoGain);
  lfoGain.connect(osc.frequency);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.045, t0 + 0.15);
  g.gain.exponentialRampToValueAtTime(0.02, t0 + 1.2);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.8);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(t0);
  lfo.start(t0);
  osc.stop(t0 + 1.85);
  lfo.stop(t0 + 1.85);
}

const STEPS = Object.freeze([
  { id: "zoom", label: "확대", ms: 900 },
  { id: "rotate", label: "좌우 회전", ms: 1600 },
  { id: "door", label: "문 열기", ms: 1000 },
  { id: "light", label: "라이트", ms: 900 },
  { id: "horn", label: "경적", ms: 700 },
  { id: "engine", label: "엔진", ms: 1800 }
]);

/**
 * @param {HTMLElement} stageEl .my-showcase-stage
 * @param {{ onStep?: (id:string,label:string)=>void, onDone?: ()=>void }} opts
 * @returns {{ cancel: () => void }}
 */
export function runCarPresenceSequence(stageEl, opts = {}) {
  if (!stageEl) return { cancel() {} };
  let cancelled = false;
  const timers = [];
  const clearPhases = () => {
    stageEl.classList.remove(
      "is-seq",
      "seq-zoom",
      "seq-rotate",
      "seq-door",
      "seq-light",
      "seq-horn",
      "seq-engine"
    );
  };

  const cancel = () => {
    cancelled = true;
    timers.forEach((id) => clearTimeout(id));
    clearPhases();
  };

  clearPhases();
  stageEl.classList.add("is-seq");

  let delay = 80;
  STEPS.forEach((step, i) => {
    timers.push(
      setTimeout(() => {
        if (cancelled) return;
        stageEl.classList.remove("seq-zoom", "seq-rotate", "seq-door", "seq-light", "seq-horn", "seq-engine");
        stageEl.classList.add(`seq-${step.id}`);
        opts.onStep?.(step.id, step.label);
        if (step.id === "horn") playHorn();
        if (step.id === "engine") playEngine();
        if (i === STEPS.length - 1) {
          timers.push(
            setTimeout(() => {
              if (cancelled) return;
              clearPhases();
              opts.onDone?.();
            }, step.ms)
          );
        }
      }, delay)
    );
    delay += step.ms;
  });

  return { cancel };
}

export { STEPS as CAR_PRESENCE_STEPS };
