// Synthesized sound effects only (no music). Preference is stored locally and on the profile.
export type Sfx =
  | "click" | "select" | "change" | "nav" | "warning" | "finalMinute" | "submit" | "correct" | "wrong"
  | "reveal" | "best" | "rank" | "levelUp" | "reward" | "unlock" | "throw" | "hit" | "happy" | "sad";

let ctx: AudioContext | null = null;
const KEY = "zqcm-sound";

export function isSoundOn() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(KEY) !== "off";
}
export function setSoundOn(on: boolean) {
  localStorage.setItem(KEY, on ? "on" : "off");
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = "sine", vol = 0.15, slideTo?: number) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, ctx.currentTime + start);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + start + dur);
  g.gain.setValueAtTime(0.0001, ctx.currentTime + start);
  g.gain.exponentialRampToValueAtTime(vol, ctx.currentTime + start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
  o.connect(g).connect(ctx.destination);
  o.start(ctx.currentTime + start);
  o.stop(ctx.currentTime + start + dur + 0.02);
}

function noise(start: number, dur: number, vol = 0.2) {
  if (!ctx) return;
  const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const s = ctx.createBufferSource();
  const g = ctx.createGain();
  g.gain.value = vol;
  s.buffer = buf;
  s.connect(g).connect(ctx.destination);
  s.start(ctx.currentTime + start);
}

export function play(s: Sfx) {
  if (!isSoundOn()) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    return;
  }
  switch (s) {
    case "click": tone(660, 0, 0.05, "triangle", 0.08); break;
    case "nav": tone(520, 0, 0.06, "triangle", 0.06); tone(780, 0.04, 0.06, "triangle", 0.05); break;
    case "select": tone(880, 0, 0.07, "sine", 0.1); break;
    case "change": tone(700, 0, 0.05, "sine", 0.08); tone(560, 0.05, 0.06, "sine", 0.08); break;
    case "warning": tone(440, 0, 0.15, "square", 0.06); tone(440, 0.25, 0.15, "square", 0.06); break;
    case "finalMinute": [0, 0.2, 0.4].forEach((t) => tone(990, t, 0.12, "square", 0.07)); break;
    case "submit": tone(500, 0, 0.1, "triangle"); tone(750, 0.08, 0.15, "triangle"); break;
    case "correct": tone(660, 0, 0.1); tone(990, 0.08, 0.18); break;
    case "wrong": tone(300, 0, 0.25, "sawtooth", 0.08, 160); break;
    case "reveal": [523, 659, 784].forEach((f, i) => tone(f, i * 0.1, 0.2, "triangle")); break;
    case "best": [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.09, 0.25, "triangle", 0.12)); break;
    case "rank": tone(600, 0, 0.1); tone(900, 0.1, 0.2); break;
    case "levelUp": [392, 523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.08, 0.22, "square", 0.06)); break;
    case "reward": tone(1200, 0, 0.08); tone(1600, 0.07, 0.15); break;
    case "unlock": tone(400, 0, 0.1, "triangle"); tone(800, 0.1, 0.25, "triangle", 0.12, 1200); break;
    case "throw": tone(300, 0, 0.35, "sine", 0.08, 1200); break;
    case "hit": noise(0, 0.25, 0.3); tone(120, 0, 0.2, "sine", 0.2, 60); break;
    case "happy": tone(880, 0, 0.08); tone(1175, 0.07, 0.1); break;
    case "sad": tone(400, 0, 0.2, "sine", 0.08, 300); break;
  }
}
