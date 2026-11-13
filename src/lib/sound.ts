// Synthesized sound effects only (no music). Preference is stored locally and on the profile.
export type Sfx =
  | "click" | "select" | "change" | "nav" | "warning" | "finalMinute" | "submit" | "correct" | "wrong"
  | "reveal" | "best" | "rank" | "levelUp" | "reward" | "unlock" | "throw" | "hit" | "happy" | "sad" | "laugh" | "cry" | "angry";

let ctx: AudioContext | null = null;
const KEY = "zqcm-sound";
const VOL_KEY = "zqcm-volume";

export function isSoundOn() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(KEY) !== "off";
}

export function setSoundOn(on: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, on ? "on" : "off");
}

export function getSoundVolume(): number {
  if (typeof window === "undefined") return 0.8;
  const v = localStorage.getItem(VOL_KEY);
  return v ? Math.max(0, Math.min(1, parseFloat(v))) : 0.8;
}

export function setSoundVolume(v: number) {
  if (typeof window === "undefined") return;
  localStorage.setItem(VOL_KEY, String(Math.max(0, Math.min(1, v))));
}

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) {
      ctx = new AudioCtx();
    }
  }
  if (ctx && ctx.state === "suspended") {
    void ctx.resume();
  }
  return ctx;
}

// Unlock audio on first user touch / click
if (typeof window !== "undefined") {
  const unlock = () => {
    const c = getAudioContext();
    if (c && c.state === "suspended") {
      void c.resume();
    }
    window.removeEventListener("click", unlock);
    window.removeEventListener("touchstart", unlock);
    window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("click", unlock, { passive: true });
  window.addEventListener("touchstart", unlock, { passive: true });
  window.addEventListener("keydown", unlock, { passive: true });
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = "sine", baseVol = 0.15, slideTo?: number) {
  const c = getAudioContext();
  if (!c) return;
  const masterVol = getSoundVolume();
  const vol = baseVol * masterVol;
  if (vol <= 0.001) return;

  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, c.currentTime + start);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), c.currentTime + start + dur);
  g.gain.setValueAtTime(0.0001, c.currentTime + start);
  g.gain.exponentialRampToValueAtTime(vol, c.currentTime + start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
  o.connect(g).connect(c.destination);
  o.start(c.currentTime + start);
  o.stop(c.currentTime + start + dur + 0.02);
}

function noise(start: number, dur: number, baseVol = 0.2) {
  const c = getAudioContext();
  if (!c) return;
  const masterVol = getSoundVolume();
  const vol = baseVol * masterVol;
  if (vol <= 0.001) return;

  const buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const s = c.createBufferSource();
  const g = c.createGain();
  g.gain.value = vol;
  s.buffer = buf;
  s.connect(g).connect(c.destination);
  s.start(c.currentTime + start);
}

export function play(s: Sfx) {
  if (!isSoundOn()) return;
  const c = getAudioContext();
  if (!c) return;

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
    case "laugh": [0, .13, .26, .39].forEach((t, i) => tone(620 + i * 40, t, .09, "triangle", .1, 760 + i * 40)); break;
    case "cry": [0, .35, .7].forEach((t) => tone(520, t, .32, "sine", .08, 260)); break;
    case "angry": [0, .12, .24].forEach((t) => tone(150, t, .1, "sawtooth", .1, 110)); noise(.05, .25, .08); break;
    case "sad": tone(400, 0, 0.2, "sine", 0.08, 300); break;
  }
}

export const SOUND_EFFECTS_LIST: { key: Sfx; label: string; ar: string; icon: string }[] = [
  { key: "correct", label: "Bonne réponse", ar: "إجابة صحيحة", icon: "✅" },
  { key: "wrong", label: "Mauvaise réponse", ar: "إجابة خاطئة", icon: "❌" },
  { key: "levelUp", label: "Niveau supérieur", ar: "ترقية المستوى", icon: "⬆️" },
  { key: "reward", label: "Récompense / Bonus", ar: "مكافأة", icon: "🎁" },
  { key: "reveal", label: "Résultats", ar: "إعلان النتائج", icon: "📊" },
  { key: "throw", label: "Lancer de tomate", ar: "رمي طماطم", icon: "🍅" },
  { key: "hit", label: "Impact tomate", ar: "إصابة الهدف", icon: "💥" },
  { key: "submit", label: "Validation", ar: "تأكيد الإجابة", icon: "📝" },
  { key: "click", label: "Clic de bouton", ar: "نقرة زر", icon: "🔘" },
  { key: "laugh", label: "Joie", ar: "فرحة الطبيب", icon: "😄" },
  { key: "cry", label: "Tristesse", ar: "حزن عند الخطأ", icon: "😢" },
];
