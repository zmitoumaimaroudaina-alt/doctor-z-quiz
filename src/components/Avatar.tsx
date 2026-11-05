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
  hijab?: number; // 0 none, colour
  hijabStyle?: number;
  outfit?: number;
  beard?: number;
  moustache?: number;
  glasses?: number;
  accessory?: number;
};

export const SKINS = ["var(--avatar-pigment-0)", "var(--avatar-pigment-1)", "var(--avatar-pigment-2)", "var(--avatar-pigment-3)", "var(--avatar-pigment-4)", "var(--avatar-pigment-5)"];
export const HAIR_COLORS = ["var(--avatar-pigment-6)", "var(--avatar-pigment-7)", "var(--avatar-pigment-8)", "var(--avatar-pigment-9)", "var(--avatar-pigment-10)", "var(--avatar-pigment-11)", "var(--avatar-pigment-12)", "var(--avatar-pigment-13)"];
export const HIJAB_COLORS = ["", "var(--avatar-pigment-14)", "var(--avatar-pigment-15)", "var(--avatar-pigment-16)", "var(--avatar-pigment-17)", "var(--avatar-pigment-18)", "var(--avatar-pigment-19)", "var(--avatar-pigment-20)", "var(--avatar-pigment-21)", "var(--avatar-pigment-22)"];
export const OUTFITS = [
  { name: "Blouse médicale", color: "var(--avatar-pigment-23)", trim: "var(--avatar-pigment-14)" },
  { name: "Hoodie", color: "var(--avatar-pigment-14)", trim: "var(--avatar-pigment-24)" },
  { name: "Jellaba", color: "var(--avatar-pigment-25)", trim: "var(--avatar-pigment-26)" },
  { name: "Pyjama de bloc", color: "var(--avatar-pigment-27)", trim: "var(--avatar-pigment-28)" },
  { name: "Veste", color: "var(--avatar-pigment-16)", trim: "var(--avatar-pigment-29)" },
  { name: "Blouse rose", color: "var(--avatar-pigment-30)", trim: "var(--avatar-pigment-31)" },
  { name: "Scrubs bordeaux", color: "var(--avatar-pigment-32)", trim: "var(--avatar-pigment-33)" },
  { name: "Pull vert", color: "var(--avatar-pigment-34)", trim: "var(--avatar-pigment-35)" },
  { name: "Chemise", color: "var(--avatar-pigment-36)", trim: "var(--avatar-pigment-37)" },
  { name: "Blouse de laboratoire", color: "var(--avatar-pigment-38)", trim: "var(--avatar-pigment-39)" },
  { name: "Abaya", color: "var(--avatar-pigment-40)", trim: "var(--avatar-pigment-29)" },
  { name: "Kamis", color: "var(--avatar-pigment-20)", trim: "var(--avatar-pigment-26)" },
  { name: "Sweat bleu nuit", color: "var(--avatar-pigment-51)", trim: "var(--avatar-pigment-52)" },
];
export const OPTIONS = {
  eyes: ["Ronds", "Amande", "Rieurs"],
  nose: ["Petit", "Rond", "Droit"],
  mouth: ["Sourire", "Neutre", "Grand sourire"],
  hair: ["Court", "Bouclé", "Long", "Chignon", "Rasé", "Carré", "Queue de cheval", "Ondulé", "Tresses", "Dégradé", "Afro", "Mèche", "Frange", "Mi-long"],
  beard: ["Aucune", "Courte", "Pleine", "Bouc", "Collier", "Longue"],
  moustache: ["Aucune", "Fine", "Épaisse"],
  hijabStyle: ["Classique", "Sport", "Turban", "Long drapé"],
  glasses: ["Aucune", "Rondes", "Carrées"],
  accessory: ["Aucun", "Stéthoscope", "Casquette", "Écouteurs"],
};

const DEFAULT: Required<AvatarConfig> = {
  gender: "m", skin: 1, eyes: 0, nose: 0, mouth: 0, hair: 0, hairColor: 0, hijab: 0, hijabStyle: 0, outfit: 0,
  beard: 0, moustache: 0, glasses: 0, accessory: 1,
};

function Eyes({ v, mood }: { v: number; mood: Mood }) {
  if (mood === "veryHappy" || (v === 2 && mood !== "sad" && mood !== "angry"))
    return (
      <g stroke="var(--avatar-pigment-40)" strokeWidth="3.5" fill="none" strokeLinecap="round">
        <path d="M76 96 q8 -8 16 0" /><path d="M108 96 q8 -8 16 0" />
      </g>
    );
  const ry = v === 1 ? 4 : 6;
  return (
    <g fill="var(--avatar-pigment-40)">
      <ellipse cx="84" cy="96" rx="5" ry={mood === "angry" ? 4 : ry} />
      <ellipse cx="116" cy="96" rx="5" ry={mood === "angry" ? 4 : ry} />
      <circle cx="86" cy="94" r="1.6" fill="var(--avatar-pigment-41)" /><circle cx="118" cy="94" r="1.6" fill="var(--avatar-pigment-41)" />
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
  if (mood === "sad") return <path d="M88 124 q12 -8 24 0" stroke="var(--avatar-pigment-42)" strokeWidth="3.5" fill="none" strokeLinecap="round" />;
  if (mood === "angry") return <path d="M88 124 h24" stroke="var(--avatar-pigment-42)" strokeWidth="4" strokeLinecap="round" />;
  if (mood === "veryHappy" || v === 2) return <path d="M86 116 q14 18 28 0 z" fill="var(--avatar-pigment-42)" />;
  if (v === 1 && mood === "neutral") return <path d="M90 120 h20" stroke="var(--avatar-pigment-42)" strokeWidth="3.5" strokeLinecap="round" />;
  return <path d="M88 116 q12 12 24 0" stroke="var(--avatar-pigment-42)" strokeWidth="3.5" fill="none" strokeLinecap="round" />;
}

export function Avatar({
  config, mood: moodIn = "neutral", size = 140, pet, tomato = false, className = "",
}: { config?: AvatarConfig | undefined; mood?: Mood; size?: number; pet?: string | null; tomato?: boolean; className?: string }) {
  let mood = moodIn;
  const c = { ...DEFAULT, ...(config ?? {}) };
  const skin = SKINS[c.skin] ?? "var(--avatar-skin-default)";
  const hc = HAIR_COLORS[c.hairColor] ?? "var(--avatar-hair-default)";
  const o = OUTFITS[c.outfit] ?? { name: "Blouse médicale", color: "var(--avatar-coat)", trim: "var(--primary)" };
  const hijab = c.hijab ? HIJAB_COLORS[c.hijab] : null;
  const shade = "var(--avatar-pigment-43)";
  if (tomato) mood = "angry";
  const anim = mood === "veryHappy" ? "animate-bounce-big" : mood === "angry" ? "animate-shake" : "animate-float";

  return (
    <div className={`relative inline-block ${className}`} style={{ width: size, height: size * 1.2 }}>
      <svg viewBox="0 0 200 240" width={size} height={size * 1.2} className={anim} aria-label="Avatar">
        {/* back layers */}
        {hijab && c.hijabStyle === 2 ? <><ellipse cx="58" cy="100" rx="8" ry="11" fill={skin} /><ellipse cx="142" cy="100" rx="8" ry="11" fill={skin} /></> : hijab ? <path d="M48 100 q0 -62 52 -62 q52 0 52 62 l6 70 h-116 z" fill={hijab} />
          : [2, 5, 7, 8].includes(c.hair) ? <path d="M56 92 q-6 70 10 90 h68 q16 -20 10 -90 z" fill={hc} /> : null}
        {!hijab && c.hair === 6 && <ellipse cx="143" cy="119" rx="16" ry="57" fill={hc} />}
        {/* body / outfit */}
        <path d="M40 240 q0 -64 60 -70 q60 6 60 70 z" fill={o.color} stroke={o.trim} strokeWidth="3" />
        {c.outfit === 2 && <path d="M100 172 v68 M88 176 q12 18 24 0" stroke={o.trim} strokeWidth="3" fill="none" />}
        {[0, 5, 9].includes(c.outfit) && <><path d="M86 172 l14 30 l14 -30" fill="none" stroke={o.trim} strokeWidth="3" /><rect x="120" y="200" width="18" height="12" rx="2" fill={o.trim} opacity=".7" /></>}
        {c.outfit === 1 && <path d="M78 176 q22 20 44 0" fill="none" stroke={o.trim} strokeWidth="4" />}
        {c.outfit === 4 && <path d="M86 172 l14 40 l14 -40" fill="var(--avatar-pigment-41)" />}
        {c.outfit === 8 && <path d="M86 175 l14 15 l14 -15 M100 190 v50" stroke={o.trim} strokeWidth="3" fill="none" />}
        {c.outfit === 7 && <path d="M78 174 q22 22 44 0" stroke={o.trim} strokeWidth="5" fill="none" />}
        {c.outfit === 6 && <path d="M86 174 l14 18 l14 -18" stroke={o.trim} strokeWidth="3" fill="none" />}
        {/* neck + head */}
        <rect x="88" y="140" width="24" height="34" rx="10" fill={skin} />
        <rect x="88" y="150" width="24" height="10" fill={shade} />
        {!hijab && c.hijabStyle !== 2 && <><ellipse cx="58" cy="100" rx="8" ry="11" fill={skin} /><ellipse cx="142" cy="100" rx="8" ry="11" fill={skin} /></>}
        <ellipse cx="100" cy="98" rx="42" ry="48" fill={skin} />
        {/* beard (under features) */}
        {c.beard > 0 && !hijab && <path d={[
          "", "M62 108 q4 40 38 42 q34 -2 38 -42 q-6 22 -38 24 q-32 -2 -38 -24z", "M58 96 q0 58 42 56 q42 2 42 -56 q-6 30 -42 32 q-36 -2 -42 -32z",
          "M88 126 q12 6 24 0 q-2 20 -12 22 q-10 -2 -12 -22z", "M60 100 q2 50 40 50 q38 0 40 -50 v8 q-4 32 -40 34 q-36 -2 -40 -34z",
          "M58 96 q0 58 42 82 q42 -24 42 -82 q-6 30 -42 32 q-36 -2 -42 -32z"][c.beard] ?? ""} fill={hc} />}
        {/* face */}
        <Brows mood={mood} color={hijab ? "var(--avatar-pigment-44)" : hc} />
        <Eyes v={c.eyes} mood={mood} />
        {c.nose === 0 && <path d="M98 104 q4 6 0 8" stroke="var(--avatar-pigment-45)" strokeWidth="2.5" fill="none" strokeLinecap="round" />}
        {c.nose === 1 && <ellipse cx="100" cy="108" rx="5" ry="4" fill="var(--avatar-pigment-46)" />}
        {c.nose === 2 && <path d="M100 98 v12 h-4" stroke="var(--avatar-pigment-45)" strokeWidth="2.5" fill="none" strokeLinecap="round" />}
        {(mood === "happy" || mood === "veryHappy") && <><circle cx="74" cy="112" r="6" fill="var(--avatar-pigment-47)" opacity=".45" /><circle cx="126" cy="112" r="6" fill="var(--avatar-pigment-47)" opacity=".45" /></>}
        {c.moustache > 0 && !hijab && <path d={c.moustache === 1 ? "M88 113 q12 -5 24 0" : "M84 114 q16 -10 32 0 q-16 4 -32 0"} stroke={hc} strokeWidth={c.moustache === 1 ? 3 : 5} fill={c.moustache === 2 ? hc : "none"} strokeLinecap="round" />}
        <Mouth v={c.mouth} mood={mood} />
        {mood === "sad" && <path d="M120 104 q4 8 0 12 q-4 -4 0 -12" fill="var(--avatar-pigment-48)" />}
        {mood === "angry" && <path d="M134 70 l6 -6 m-2 8 l8 -2" stroke="var(--avatar-pigment-49)" strokeWidth="3" strokeLinecap="round" />}
        {/* front hair / hijab */}
        {hijab && c.hijabStyle === 1 ? (
          <path d="M54 104 q-2 -62 46 -62 q48 0 46 62 q-6 -38 -46 -42 q-40 4 -46 42z M54 104 q6 48 46 52 q40 -4 46 -52 v20 q-10 40 -46 42 q-36 -2 -46 -42z" fill={hijab} />
        ) : hijab && c.hijabStyle === 2 ? (
          <g fill={hijab}><path d="M54 84 q0 -48 46 -48 q46 0 46 48 q-20 -18 -46 -18 q-26 0 -46 18z" /><circle cx="100" cy="40" r="13" /></g>
        ) : hijab && c.hijabStyle === 3 ? (
          <path d="M52 104 q-2 -64 48 -64 q50 0 48 64 q-6 -40 -48 -44 q-42 4 -48 44 z M52 104 q4 50 48 56 q44 -6 48 -56 l14 90 h-124 z" fill={hijab} />
        ) : hijab ? (
          <path d="M52 104 q-2 -64 48 -64 q50 0 48 64 q-6 -40 -48 -44 q-42 4 -48 44 z M52 104 q4 50 48 56 q44 -6 48 -56 l6 30 q-12 40 -54 44 q-42 -4 -54 -44 z" fill={hijab} />
        ) : c.hair === 5 ? (
          <path d="M54 125 V88 q0 -45 46 -45 q46 0 46 45 v37 l-13 10 v-48 q-15 -18 -33 -18 q-24 17 -33 17 v49z" fill={hc} />
        ) : c.hair === 7 ? (
          <path d="M54 112 q-9 -65 46 -69 q55 4 46 69 l-15 -16 q-2 -27 -21 -26 q-8 16 -32 10 l-9 25z" fill={hc} />
        ) : c.hair === 8 ? (
          <g fill={hc}><path d="M58 88 q0 -45 42 -45 q42 0 42 45 q-16 -20 -42 -22 q-26 2 -42 22z" />{[126,140,154,168].map(y => <g key={y}><ellipse cx="61" cy={y} rx="8" ry="10" /><ellipse cx="139" cy={y} rx="8" ry="10" /></g>)}</g>
        ) : c.hair === 10 ? (
          <g fill={hc}>{[[64,74],[80,56],[100,50],[120,56],[136,74],[58,96],[142,96]].map(([x,y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="18" />)}</g>
        ) : c.hair === 11 ? (
          <path d="M58 90 q0 -46 42 -46 q46 0 44 44 q-34 -16 -76 20z" fill={hc} />
        ) : c.hair === 12 ? (
          <path d="M57 98 q-3 -54 43 -54 q46 0 43 54 l-6 -18 h-74z" fill={hc} />
        ) : c.hair === 13 ? (
          <path d="M54 140 q-8 -96 46 -96 q54 0 46 96 l-12 -6 q2 -44 -8 -60 q-26 12 -52 2 q-10 14 -8 58z" fill={hc} />
        ) : c.hair === 9 ? (
          <path d="M58 89 q0 -45 42 -45 q42 0 42 45 l-7 -4 v-15 q-19 -17 -40 3 q-16 7 -30 5 v11z" fill={hc} />
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
        {c.glasses === 1 && <g stroke="var(--avatar-pigment-40)" strokeWidth="3" fill="var(--avatar-pigment-50)"><circle cx="84" cy="96" r="12" /><circle cx="116" cy="96" r="12" /><path d="M96 96 h8" /></g>}
        {c.glasses === 2 && <g stroke="var(--avatar-pigment-40)" strokeWidth="3" fill="var(--avatar-pigment-50)"><rect x="70" y="86" width="28" height="20" rx="4" /><rect x="102" y="86" width="28" height="20" rx="4" /><path d="M98 96 h4" /></g>}
        {/* accessories */}
        {c.accessory === 1 && <g fill="none" stroke="var(--avatar-pigment-51)" strokeWidth="4" strokeLinecap="round"><path d="M80 172 q-6 40 20 44 q26 -4 20 -44" /><circle cx="100" cy="218" r="7" fill="var(--avatar-pigment-52)" /></g>}
        {c.accessory === 2 && !hijab && <g><path d="M56 70 q4 -36 44 -36 q40 0 44 36z" fill="var(--avatar-pigment-14)" /><path d="M120 66 q30 0 40 8 q-20 4 -40 0z" fill="var(--avatar-pigment-24)" /></g>}
        {c.accessory === 3 && <g><path d="M54 96 q0 -60 46 -60 q46 0 46 60" fill="none" stroke="var(--avatar-pigment-16)" strokeWidth="6" /><rect x="46" y="88" width="14" height="24" rx="6" fill="var(--avatar-pigment-16)" /><rect x="140" y="88" width="14" height="24" rx="6" fill="var(--avatar-pigment-16)" /></g>}
        {/* tomato splat — cosmetic only */}
        {tomato && <g className="animate-pop"><path d="M74 92 q-4 26 -2 48 M128 98 q4 18 0 38 M100 124 q-2 14 2 30" stroke="var(--avatar-pigment-49)" strokeWidth="5" strokeLinecap="round" opacity=".75" /><circle cx="70" cy="146" r="5" fill="var(--avatar-pigment-49)" opacity=".75" /><circle cx="132" cy="140" r="4" fill="var(--avatar-pigment-49)" opacity=".75" /><g fill="var(--avatar-pigment-17)" opacity=".9"><ellipse cx="84" cy="80" rx="2.5" ry="4" /><ellipse cx="112" cy="104" rx="2.5" ry="4" /><ellipse cx="104" cy="74" rx="2.5" ry="4" /></g></g>}
        {tomato && <g className="animate-wipe"><ellipse cx="138" cy="112" rx="15" ry="11" fill={skin} stroke="var(--avatar-pigment-45)" strokeWidth="1.5" /><path d="M130 104 q8 -10 18 -2" stroke="var(--avatar-pigment-45)" strokeWidth="2" fill="none" /></g>}
        {tomato && <g className="animate-pop" opacity=".85"><path d="M70 70 q20 -20 40 0 q24 -8 26 18 q14 18 -8 30 q-6 22 -30 12 q-24 10 -30 -14 q-20 -14 -6 -30 q-2 -18 8 -16z" fill="var(--avatar-pigment-49)" opacity=".85" /><circle cx="92" cy="86" r="4" fill="var(--avatar-pigment-53)" /><path d="M96 62 l6 -10 l6 10" fill="var(--avatar-pigment-54)" /></g>}
      </svg>
      {pet && <span className="absolute -bottom-1 -right-2 text-[length:var(--pet)] drop-shadow" style={{ ["--pet" as string]: `${Math.round(size * 0.28)}px` }}>{petEmoji(pet)}</span>}
    </div>
  );
}
