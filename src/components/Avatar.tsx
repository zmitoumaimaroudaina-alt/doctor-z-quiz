import type { Mood } from "@/lib/game";
import { petEmoji } from "@/lib/game";

/**
 * Interim built-in 2D avatar. Every layer is drawn in ONE shared coordinate system
 * (viewBox 0 0 200 240, head centre 100,95) so clothes/hair/hijab/accessories always align.
 * Will be replaced by the Creator's official asset files once provided.
 */
export type AvatarConfig = {
  gender?: "m" | "f";
  skin?: number;
  eyes?: number;
  nose?: number;
  mouth?: number;
  hair?: number;
  hairColor?: number;
  hijab?: number; // 0 none
  outfit?: number;
  beard?: number;
  moustache?: number;
  glasses?: number;
  accessory?: number;
};

export const SKINS = ["#FDE3CF", "#F6C9A4", "#E3A877", "#C68652", "#9A5D34", "#6B3E22"];
export const HAIR_COLORS = ["#1F1A17", "#4A2E1E", "#7A4A2A", "#C58B3C", "#2B2F45", "#8E3B46"];
export const HIJAB_COLORS = ["", "#5B8DEF", "#F2A7B8", "#2E3A59", "#F4E3C1", "#7FC8A9"];
export const OUTFITS = [
  { name: "Blouse médicale", color: "#FFFFFF", trim: "#5B8DEF" },
  { name: "Hoodie", color: "#5B8DEF", trim: "#3E6FD8" },
  { name: "Jellaba", color: "#E9D8B4", trim: "#B8925A" },
  { name: "Pyjama de bloc", color: "#5FB8A8", trim: "#3E9686" },
  { name: "Veste", color: "#2E3A59", trim: "#F2C14E" },
];
export const OPTIONS = {
  eyes: ["Ronds", "Amande", "Rieurs"],
  nose: ["Petit", "Rond", "Droit"],
  mouth: ["Sourire", "Neutre", "Grand sourire"],
  hair: ["Court", "Bouclé", "Long", "Chignon", "Rasé"],
  beard: ["Aucune", "Courte", "Pleine"],
  moustache: ["Aucune", "Fine", "Épaisse"],
  glasses: ["Aucune", "Rondes", "Carrées"],
  accessory: ["Aucun", "Stéthoscope", "Casquette", "Écouteurs"],
};

const DEFAULT: Required<AvatarConfig> = {
  gender: "m", skin: 1, eyes: 0, nose: 0, mouth: 0, hair: 0, hairColor: 0, hijab: 0, outfit: 0,
  beard: 0, moustache: 0, glasses: 0, accessory: 1,
};

function Eyes({ v, mood }: { v: number; mood: Mood }) {
  if (mood === "veryHappy" || (v === 2 && mood !== "sad" && mood !== "angry"))
    return (
      <g stroke="#2A2230" strokeWidth="3.5" fill="none" strokeLinecap="round">
        <path d="M76 96 q8 -8 16 0" /><path d="M108 96 q8 -8 16 0" />
      </g>
    );
  const ry = v === 1 ? 4 : 6;
  return (
    <g fill="#2A2230">
      <ellipse cx="84" cy="96" rx="5" ry={mood === "angry" ? 4 : ry} />
      <ellipse cx="116" cy="96" rx="5" ry={mood === "angry" ? 4 : ry} />
      <circle cx="86" cy="94" r="1.6" fill="#fff" /><circle cx="118" cy="94" r="1.6" fill="#fff" />
    </g>
  );
}

function Brows({ mood, color }: { mood: Mood; color: string }) {
  const d =
    mood === "angry" ? ["M74 82 l18 6", "M126 82 l-18 6"]
    : mood === "sad" ? ["M74 86 l18 -5", "M126 86 l-18 -5"]
    : ["M75 84 q9 -5 18 0", "M107 84 q9 -5 18 0"];
  return <g stroke={color} strokeWidth="3.5" fill="none" strokeLinecap="round">{d.map((x) => <path key={x} d={x} />)}</g>;
}

function Mouth({ v, mood }: { v: number; mood: Mood }) {
  if (mood === "sad") return <path d="M88 124 q12 -8 24 0" stroke="#7A2E3A" strokeWidth="3.5" fill="none" strokeLinecap="round" />;
  if (mood === "angry") return <path d="M88 124 h24" stroke="#7A2E3A" strokeWidth="4" strokeLinecap="round" />;
  if (mood === "veryHappy" || v === 2) return <path d="M86 116 q14 18 28 0 z" fill="#7A2E3A" />;
  if (v === 1 && mood === "neutral") return <path d="M90 120 h20" stroke="#7A2E3A" strokeWidth="3.5" strokeLinecap="round" />;
  return <path d="M88 116 q12 12 24 0" stroke="#7A2E3A" strokeWidth="3.5" fill="none" strokeLinecap="round" />;
}

export function Avatar({
  config, mood = "neutral", size = 140, pet, tomato = false, className = "",
}: { config?: AvatarConfig; mood?: Mood; size?: number; pet?: string | null; tomato?: boolean; className?: string }) {
  const c = { ...DEFAULT, ...(config ?? {}) };
  const skin = SKINS[c.skin] ?? SKINS[1];
  const hc = HAIR_COLORS[c.hairColor] ?? HAIR_COLORS[0];
  const o = OUTFITS[c.outfit] ?? OUTFITS[0];
  const hijab = c.hijab ? HIJAB_COLORS[c.hijab] : null;
  const shade = "rgba(0,0,0,.08)";
  const anim = mood === "veryHappy" ? "animate-bounce-big" : mood === "angry" ? "animate-shake" : "animate-float";

  return (
    <div className={`relative inline-block ${className}`} style={{ width: size, height: size * 1.2 }}>
      <svg viewBox="0 0 200 240" width={size} height={size * 1.2} className={anim} aria-label="Avatar">
        {/* back layers */}
        {hijab ? <path d="M48 100 q0 -62 52 -62 q52 0 52 62 l6 70 h-116 z" fill={hijab} />
          : c.hair === 2 ? <path d="M56 92 q-6 70 10 90 h68 q16 -20 10 -90 z" fill={hc} /> : null}
        {/* body / outfit */}
        <path d="M40 240 q0 -64 60 -70 q60 6 60 70 z" fill={o.color} stroke={o.trim} strokeWidth="3" />
        {c.outfit === 2 && <path d="M100 172 v68 M88 176 q12 18 24 0" stroke={o.trim} strokeWidth="3" fill="none" />}
        {c.outfit === 0 && <><path d="M86 172 l14 30 l14 -30" fill="none" stroke={o.trim} strokeWidth="3" /><rect x="120" y="200" width="18" height="12" rx="2" fill={o.trim} opacity=".7" /></>}
        {c.outfit === 1 && <path d="M78 176 q22 20 44 0" fill="none" stroke={o.trim} strokeWidth="4" />}
        {c.outfit === 4 && <path d="M86 172 l14 40 l14 -40" fill="#fff" />}
        {/* neck + head */}
        <rect x="88" y="140" width="24" height="34" rx="10" fill={skin} />
        <rect x="88" y="150" width="24" height="10" fill={shade} />
        {!hijab && <><ellipse cx="58" cy="100" rx="8" ry="11" fill={skin} /><ellipse cx="142" cy="100" rx="8" ry="11" fill={skin} /></>}
        <ellipse cx="100" cy="98" rx="42" ry="48" fill={skin} />
        {/* beard (under features) */}
        {c.beard > 0 && !hijab && <path d={c.beard === 1 ? "M62 108 q4 40 38 42 q34 -2 38 -42 q-6 22 -38 24 q-32 -2 -38 -24z" : "M58 96 q0 58 42 56 q42 2 42 -56 q-6 30 -42 32 q-36 -2 -42 -32z"} fill={hc} />}
        {/* face */}
        <Brows mood={mood} color={hijab ? "#3A2A20" : hc} />
        <Eyes v={c.eyes} mood={mood} />
        {c.nose === 0 && <path d="M98 104 q4 6 0 8" stroke="rgba(0,0,0,.35)" strokeWidth="2.5" fill="none" strokeLinecap="round" />}
        {c.nose === 1 && <ellipse cx="100" cy="108" rx="5" ry="4" fill="rgba(0,0,0,.12)" />}
        {c.nose === 2 && <path d="M100 98 v12 h-4" stroke="rgba(0,0,0,.35)" strokeWidth="2.5" fill="none" strokeLinecap="round" />}
        {(mood === "happy" || mood === "veryHappy") && <><circle cx="74" cy="112" r="6" fill="#F28B9B" opacity=".45" /><circle cx="126" cy="112" r="6" fill="#F28B9B" opacity=".45" /></>}
        {c.moustache > 0 && !hijab && <path d={c.moustache === 1 ? "M88 113 q12 -5 24 0" : "M84 114 q16 -10 32 0 q-16 4 -32 0"} stroke={hc} strokeWidth={c.moustache === 1 ? 3 : 5} fill={c.moustache === 2 ? hc : "none"} strokeLinecap="round" />}
        <Mouth v={c.mouth} mood={mood} />
        {mood === "sad" && <path d="M120 104 q4 8 0 12 q-4 -4 0 -12" fill="#7FB5FF" />}
        {mood === "angry" && <path d="M134 70 l6 -6 m-2 8 l8 -2" stroke="#E5484D" strokeWidth="3" strokeLinecap="round" />}
        {/* front hair / hijab */}
        {hijab ? (
          <path d="M52 104 q-2 -64 48 -64 q50 0 48 64 q-6 -40 -48 -44 q-42 4 -48 44 z M52 104 q4 50 48 56 q44 -6 48 -56 l6 30 q-12 40 -54 44 q-42 -4 -54 -44 z" fill={hijab} />
        ) : c.hair === 4 ? (
          <path d="M60 80 q8 -32 40 -32 q32 0 40 32 q-40 -14 -80 0z" fill={hc} opacity=".55" />
        ) : c.hair === 1 ? (
          <g fill={hc}>{[62, 76, 90, 104, 118, 132].map((x, i) => <circle key={x} cx={x + 4} cy={62 - (i % 2) * 6} r="14" />)}<circle cx="60" cy="80" r="10" /><circle cx="140" cy="80" r="10" /></g>
        ) : c.hair === 3 ? (
          <g fill={hc}><circle cx="100" cy="38" r="16" /><path d="M58 92 q0 -46 42 -46 q42 0 42 46 q-14 -28 -42 -28 q-28 0 -42 28z" /></g>
        ) : (
          <path d={c.gender === "f" || c.hair === 2 ? "M56 100 q-4 -56 44 -56 q48 0 44 56 q-8 -30 -30 -34 q-10 14 -40 16 q-12 4 -18 18z" : "M58 88 q0 -44 42 -44 q42 0 42 44 q-10 -20 -30 -22 q-20 10 -54 22z"} fill={hc} />
        )}
        {/* glasses */}
        {c.glasses === 1 && <g stroke="#2A2230" strokeWidth="3" fill="rgba(255,255,255,.25)"><circle cx="84" cy="96" r="12" /><circle cx="116" cy="96" r="12" /><path d="M96 96 h8" /></g>}
        {c.glasses === 2 && <g stroke="#2A2230" strokeWidth="3" fill="rgba(255,255,255,.25)"><rect x="70" y="86" width="28" height="20" rx="4" /><rect x="102" y="86" width="28" height="20" rx="4" /><path d="M98 96 h4" /></g>}
        {/* accessories */}
        {c.accessory === 1 && <g fill="none" stroke="#3A4A6B" strokeWidth="4" strokeLinecap="round"><path d="M80 172 q-6 40 20 44 q26 -4 20 -44" /><circle cx="100" cy="218" r="7" fill="#C9D3E6" /></g>}
        {c.accessory === 2 && !hijab && <g><path d="M56 70 q4 -36 44 -36 q40 0 44 36z" fill="#5B8DEF" /><path d="M120 66 q30 0 40 8 q-20 4 -40 0z" fill="#3E6FD8" /></g>}
        {c.accessory === 3 && <g><path d="M54 96 q0 -60 46 -60 q46 0 46 60" fill="none" stroke="#2E3A59" strokeWidth="6" /><rect x="46" y="88" width="14" height="24" rx="6" fill="#2E3A59" /><rect x="140" y="88" width="14" height="24" rx="6" fill="#2E3A59" /></g>}
        {/* tomato splat — cosmetic only */}
        {tomato && <g className="animate-pop"><path d="M70 70 q20 -20 40 0 q24 -8 26 18 q14 18 -8 30 q-6 22 -30 12 q-24 10 -30 -14 q-20 -14 -6 -30 q-2 -18 8 -16z" fill="#E5484D" opacity=".85" /><circle cx="92" cy="86" r="4" fill="#FFB3A8" /><path d="M96 62 l6 -10 l6 10" fill="#3E9A4A" /></g>}
      </svg>
      {pet && <span className="absolute -bottom-1 -right-2 text-[length:var(--pet)] drop-shadow" style={{ ["--pet" as string]: `${Math.round(size * 0.28)}px` }}>{petEmoji(pet)}</span>}
    </div>
  );
}
