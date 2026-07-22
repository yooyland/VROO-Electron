export function playHorn(enabled = true) {
  if (!enabled) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = new AC();
    const make = (start, freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + 0.11);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + 0.13);
    };
    make(0, 420);
    make(0.13, 470);
    setTimeout(() => ctx.close(), 600);
  } catch {
    /* ignore */
  }
}

let lastHornAt = 0;

/** 연속 클릭 중첩 방지. 재생되면 true */
export function playHornThrottled(enabled = true, cooldownMs = 900) {
  const now = Date.now();
  if (now - lastHornAt < cooldownMs) return false;
  lastHornAt = now;
  playHorn(enabled);
  return true;
}
