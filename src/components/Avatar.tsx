import type { Mood } from "@/lib/game";
import { petEmoji } from "@/lib/game";

/**
 * 2D Medical Avatar with precision SVG layers (viewBox 0 0 200 240, head center 100,95).
 * Clothes, hair, hijab, accessories, and tomato reactions are strictly aligned.
 */
export type AvatarConfig = {
  gender?: "m" | "f";
  skin?: number;
  eyes?: number;
  nose?: number;
  mouth?: number;
  hair?: number;
  hairColor?: number;
  hijab?: number; // 0 none, 1..N color
  hijabStyle?: number; // 0..5 diverse elegant styles
  outfit?: number;
  beard?: number;
  moustache?: number;
  glasses?: number;
  accessory?: number;
};

export const SKINS = [
  "#fce3cf", // 0: Très clair
  "#f3cfb3", // 1: Clair rosé
  "#e0ad84", // 2: Moyen doré / algérien
  "#c6885b", // 3: Mat / hâlé
  "#8c5836", // 4: Foncé
  "#57371f", // 5: Très foncé
];

export const HAIR_COLORS = [
  "#18181b", // Noir
  "#3f2619", // Châtain foncé
  "#5c3a21", // Châtain moyen
  "#7a4a28", // Marron chaud
  "#a26938", // Châtain clair
  "#b45309", // Roux
  "#d97706", // Blond doré
  "#71717a", // Poivre et sel
];

export const HIJAB_COLORS = [
  "",
  "#ffffff", // 1: Blanc médical éclatant
  "#0f172a", // 2: Noir profond chic
  "#1e3a8a", // 3: Bleu marine / nuit
  "#db2777", // 4: Vieux rose élégant
  "#047857", // 5: Vert sauge / émeraude doux
  "#78350f", // 6: Moka chaud / taupe
  "#0284c7", // 7: Bleu ciel scrubs
  "#881337", // 8: Bordeaux impérial
  "#7c3aed", // 9: Mauve poudré
  "#e2e8f0", // 10: Gris perle satiné
];

export const OUTFITS = [
  { name: "Blouse médicale blanche", color: "#ffffff", trim: "#3b82f6" },
  { name: "Pyjama de bloc bleu (Scrubs)", color: "#0284c7", trim: "#0369a1" },
  { name: "Pyjama de bloc vert chirurgical", color: "#059669", trim: "#047857" },
  { name: "Scrubs bordeaux", color: "#881337", trim: "#9f1239" },
  { name: "Blouse de laboratoire", color: "#f8fafc", trim: "#64748b" },
  { name: "Hoodie étudiant", color: "#334155", trim: "#64748b" },
  { name: "Pull col roulé", color: "#1e293b", trim: "#3b82f6" },
  { name: "Abaya médicale", color: "#18181b", trim: "#d4af37" },
  { name: "Jellaba moderne", color: "#475569", trim: "#94a3b8" },
  { name: "Chemise soignée", color: "#f1f5f9", trim: "#2563eb" },
  { name: "Veste blazer", color: "#1e293b", trim: "#0f172a" },
  { name: "Kamis traditionnel", color: "#f8fafc", trim: "#cbd5e1" },
];

export const OPTIONS = {
  eyes: ["Ronds", "Amande", "Rieurs", "Concentrés"],
  nose: ["Fin", "Rond", "Droit"],
  mouth: ["Sourire", "Neutre", "Grand sourire", "Concentré"],
  hair: [
    "Court classique", "Bouclé", "Long fluide", "Chignon haut", "Rasé",
    "Carré soigné", "Queue de cheval", "Ondulé", "Tresses", "Dégradé moderne",
    "Afro", "Mèche latérale", "Frange droite", "Mi-long structuré"
  ],
  beard: ["Aucune", "Barbe courte", "Barbe pleine", "Bouc soigné", "Collier", "Barbe longue"],
  moustache: ["Aucune", "Fine taillée", "Épaisse classique"],
  hijabStyle: [
    "Médical classique (كلاسيكي أنيق)",
    "Khimar long drapé (خمار منسدل واسع)",
    "Turban chic moderne (توربان عصري)",
    "Châle turc / koweïtien (شال بقمة مثلثة)",
    "Bonnet bloc chirurgical (بوني جراحي للعمليات)",
    "Foulard drapé d'épaule (شال منسدل على الكتف)",
  ],
  glasses: ["Aucune", "Rondes dorées", "Rectangulaires médicales", "Stylées noires"],
  accessory: ["Aucun", "Stéthoscope cardiologique", "Casquette étudiante", "Écouteurs sans fil"],
};

const DEFAULT: Required<AvatarConfig> = {
  gender: "m",
  skin: 2,
  eyes: 0,
  nose: 0,
  mouth: 0,
  hair: 0,
  hairColor: 0,
  hijab: 0,
  hijabStyle: 0,
  outfit: 0,
  beard: 0,
  moustache: 0,
  glasses: 0,
  accessory: 1,
};

function Eyes({ v, mood }: { v: number; mood: Mood }) {
  if (mood === "veryHappy" || (v === 2 && mood !== "sad" && mood !== "angry")) {
    return (
      <g stroke="#18181b" strokeWidth="3.5" fill="none" strokeLinecap="round">
        <path d="M76 96 q8 -8 16 0" />
        <path d="M108 96 q8 -8 16 0" />
      </g>
    );
  }
  if (mood === "angry") {
    return (
      <g fill="#18181b">
        {/* Squinted annoyed eyes */}
        <ellipse cx="84" cy="97" rx="5" ry="3" />
        <ellipse cx="116" cy="97" rx="5" ry="3" />
        <circle cx="85" cy="96" r="1.2" fill="#ffffff" />
        <circle cx="117" cy="96" r="1.2" fill="#ffffff" />
      </g>
    );
  }
  const ry = v === 1 ? 4 : 5.5;
  return (
    <g fill="#18181b">
      <ellipse cx="84" cy="96" rx="5" ry={ry} />
      <ellipse cx="116" cy="96" rx="5" ry={ry} />
      <circle cx="86" cy="94" r="1.6" fill="#ffffff" />
      <circle cx="118" cy="94" r="1.6" fill="#ffffff" />
      {v === 3 && (
        <path d="M78 92 h12 M110 92 h12" stroke="#18181b" strokeWidth="1" />
      )}
    </g>
  );
}

function Brows({ mood, color }: { mood: Mood; color: string }) {
  const d =
    mood === "angry"
      ? ["M74 81 l18 7", "M126 81 l-18 7"] // Annoyed deep furrow
      : mood === "sad"
      ? ["M74 86 l18 -5", "M126 86 l-18 -5"]
      : ["M75 83 q9 -5 18 0", "M107 83 q9 -5 18 0"];
  return (
    <g stroke={color} strokeWidth="3.5" fill="none" strokeLinecap="round">
      {d.map((x) => (
        <path key={x} d={x} />
      ))}
    </g>
  );
}

function Mouth({ v, mood }: { v: number; mood: Mood }) {
  if (mood === "sad") {
    return <path d="M88 124 q12 -8 24 0" stroke="#be123c" strokeWidth="3.5" fill="none" strokeLinecap="round" />;
  }
  if (mood === "angry") {
    // Annoyed wavy grimace
    return <path d="M86 124 q7 -4 14 0 q7 4 14 -2" stroke="#be123c" strokeWidth="3.5" fill="none" strokeLinecap="round" />;
  }
  if (mood === "veryHappy" || v === 2) {
    return (
      <g>
        <path d="M84 116 q16 18 32 0 z" fill="#be123c" />
        <path d="M88 117 q12 6 24 0" stroke="#ffffff" strokeWidth="2.5" fill="none" />
      </g>
    );
  }
  if (v === 1 && mood === "neutral") {
    return <path d="M90 120 h20" stroke="#be123c" strokeWidth="3.2" strokeLinecap="round" />;
  }
  if (v === 3) {
    return <path d="M92 121 h16" stroke="#be123c" strokeWidth="2.5" strokeLinecap="round" />;
  }
  return <path d="M88 116 q12 11 24 0" stroke="#be123c" strokeWidth="3.5" fill="none" strokeLinecap="round" />;
}

export function Avatar({
  config,
  mood: moodIn = "neutral",
  size = 140,
  pet,
  tomato = false,
  tomatoHoursLeft,
  className = "",
}: {
  config?: AvatarConfig | undefined;
  mood?: Mood;
  size?: number;
  pet?: string | null;
  tomato?: boolean;
  tomatoHoursLeft?: number;
  className?: string;
}) {
  let mood = moodIn;
  const c = { ...DEFAULT, ...(config ?? {}) };
  const skin = SKINS[c.skin] ?? SKINS[2];
  const hc = HAIR_COLORS[c.hairColor] ?? HAIR_COLORS[0];
  const o = OUTFITS[c.outfit] ?? OUTFITS[0];
  const hijab = c.hijab && c.hijab > 0 ? HIJAB_COLORS[c.hijab] || HIJAB_COLORS[1] : null;

  // Tomato hit triggers annoyed mood + tomato visuals
  if (tomato) mood = "angry";

  const anim =
    mood === "veryHappy"
      ? "animate-bounce-big"
      : mood === "angry" && !tomato
      ? "animate-shake"
      : "animate-float";

  return (
    <div
      className={`relative inline-block ${className}`}
      style={{ width: size, height: size * 1.25 }}
      title={tomato ? `🍅 ملطخ بالطماطم (متبقي ${tomatoHoursLeft ?? 12} ساعة)` : undefined}
    >
      <svg
        viewBox="0 0 200 240"
        width={size}
        height={size * 1.25}
        className={anim}
        aria-label="Avatar"
      >
        <defs>
          <linearGradient id="tomato-splat-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="60%" stopColor="#dc2626" />
            <stop offset="100%" stopColor="#991b1b" />
          </linearGradient>
          <filter id="shadow-drape" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.15" />
          </filter>
        </defs>

        {/* ======================================================== */}
        {/* 1. BACK LAYERS (Hijab back / Long Hair back)             */}
        {/* ======================================================== */}
        {hijab ? (
          c.hijabStyle === 1 ? (
            /* Style 1: Khimar long drapé arrière - extra wide flowing cape */
            <path
              d="M32 100 q0 -72 68 -72 q68 0 68 72 l18 135 h-172 z"
              fill={hijab}
              filter="url(#shadow-drape)"
            />
          ) : c.hijabStyle === 2 ? (
            /* Style 2: Turban moderne - wrapped high bun at back */
            <g fill={hijab}>
              <circle cx="100" cy="46" r="22" filter="url(#shadow-drape)" />
              <path d="M56 86 q0 -54 44 -54 q44 0 44 54 z" />
            </g>
          ) : c.hijabStyle === 3 ? (
            /* Style 3: Châle turc - structured high back with peak */
            <path
              d="M44 98 q0 -68 56 -68 q56 0 56 68 l10 88 h-122 z"
              fill={hijab}
            />
          ) : c.hijabStyle === 4 ? (
            /* Style 4: Bonnet chirurgical bloc - snug round back */
            <path
              d="M50 96 q0 -58 50 -58 q50 0 50 58 l4 70 h-108 z"
              fill={hijab}
            />
          ) : (
            /* Style 0 & 5: Hijab médical classique / épaule - standard back cape */
            <path
              d="M44 96 q0 -66 56 -66 q56 0 56 66 l8 78 h-120 z"
              fill={hijab}
              filter="url(#shadow-drape)"
            />
          )
        ) : (
          /* Hair Back for long/medium styles */
          [2, 5, 7, 8, 12, 13].includes(c.hair) && (
            <path d="M54 90 q-8 72 12 92 h68 q20 -20 12 -92 z" fill={hc} />
          )
        )}

        {/* Ponytail back */}
        {!hijab && c.hair === 6 && (
          <ellipse cx="145" cy="118" rx="16" ry="56" fill={hc} />
        )}

        {/* ======================================================== */}
        {/* 2. BODY & MEDICAL OUTFIT                                 */}
        {/* ======================================================== */}
        <path
          d="M38 240 q0 -66 62 -72 q62 6 62 72 z"
          fill={o.color}
          stroke={o.trim}
          strokeWidth="3"
        />

        {/* Lab coat collar & lapels */}
        {[0, 4].includes(c.outfit) && (
          <>
            <path d="M84 172 l16 32 l16 -32" fill="none" stroke={o.trim} strokeWidth="3" />
            <path d="M72 186 l28 42 l28 -42" fill="none" stroke="#cbd5e1" strokeWidth="1.5" />
            {/* Pocket with pen */}
            <rect x="122" y="202" width="18" height="14" rx="2" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5" />
            <rect x="126" y="196" width="3" height="10" rx="1" fill="#2563eb" />
            <rect x="131" y="198" width="3" height="8" rx="1" fill="#dc2626" />
          </>
        )}

        {/* Scrubs V-neck (Bloc) */}
        {[1, 2, 3].includes(c.outfit) && (
          <path d="M84 172 l16 26 l16 -26" fill="none" stroke={o.trim} strokeWidth="3.5" />
        )}

        {/* ======================================================== */}
        {/* 3. NECK & HEAD                                           */}
        {/* ======================================================== */}
        <rect x="88" y="138" width="24" height="34" rx="10" fill={skin} />
        <rect x="88" y="148" width="24" height="10" fill="#000000" opacity="0.08" />

        {/* Ears (only if no hijab or turban style 2) */}
        {(!hijab || c.hijabStyle === 2) && (
          <>
            <ellipse cx="58" cy="100" rx="7.5" ry="11" fill={skin} />
            <ellipse cx="142" cy="100" rx="7.5" ry="11" fill={skin} />
          </>
        )}

        {/* Head Ellipse */}
        <ellipse cx="100" cy="98" rx="42" ry="48" fill={skin} />

        {/* ======================================================== */}
        {/* 4. BEARD (if any and not wearing hijab)                 */}
        {/* ======================================================== */}
        {c.beard > 0 && !hijab && (
          <path
            d={
              [
                "",
                "M62 108 q4 40 38 42 q34 -2 38 -42 q-6 22 -38 24 q-32 -2 -38 -24z",
                "M58 96 q0 58 42 56 q42 2 42 -56 q-6 30 -42 32 q-36 -2 -42 -32z",
                "M88 126 q12 6 24 0 q-2 20 -12 22 q-10 -2 -12 -22z",
                "M60 100 q2 50 40 50 q38 0 40 -50 v8 q-4 32 -40 34 q-36 -2 -40 -34z",
                "M58 96 q0 58 42 82 q42 -24 42 -82 q-6 30 -42 32 q-36 -2 -42 -32z",
              ][c.beard] ?? ""
            }
            fill={hc}
          />
        )}

        {/* ======================================================== */}
        {/* 5. FACIAL FEATURES                                       */}
        {/* ======================================================== */}
        <Brows mood={mood} color={hijab ? "#1e293b" : hc} />
        <Eyes v={c.eyes} mood={mood} />

        {/* Nose */}
        {c.nose === 0 && <path d="M98 104 q4 6 0 8" stroke="#a16207" strokeWidth="2.2" fill="none" strokeLinecap="round" />}
        {c.nose === 1 && <ellipse cx="100" cy="108" rx="5" ry="3.8" fill="#a16207" opacity="0.3" />}
        {c.nose === 2 && <path d="M100 98 v12 h-4" stroke="#a16207" strokeWidth="2.2" fill="none" strokeLinecap="round" />}

        {/* Cheeks blush if happy */}
        {(mood === "happy" || mood === "veryHappy") && !tomato && (
          <>
            <circle cx="74" cy="112" r="6" fill="#f43f5e" opacity="0.35" />
            <circle cx="126" cy="112" r="6" fill="#f43f5e" opacity="0.35" />
          </>
        )}

        {/* Moustache */}
        {c.moustache > 0 && !hijab && (
          <path
            d={c.moustache === 1 ? "M88 113 q12 -5 24 0" : "M84 114 q16 -10 32 0 q-16 4 -32 0"}
            stroke={hc}
            strokeWidth={c.moustache === 1 ? 3 : 5}
            fill={c.moustache === 2 ? hc : "none"}
            strokeLinecap="round"
          />
        )}

        {/* Mouth */}
        <Mouth v={c.mouth} mood={mood} />

        {/* Frustration sweat drop or angry vein if annoyed/tomato */}
        {mood === "angry" && (
          <g stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round">
            <path d="M136 72 l6 -6 m-2 8 l8 -2" />
          </g>
        )}

        {/* ======================================================== */}
        {/* 6. FRONT HAIR / HIJAB STYLES (DIVERSE & ELEGANT)         */}
        {/* ======================================================== */}
        {hijab ? (
          c.hijabStyle === 1 ? (
            /* Style 1: Khimar long drapé couvrant - gracefully wraps face & shoulders */
            <g fill={hijab}>
              {/* Forehead opening */}
              <path
                d="M52 102 q-2 -62 48 -62 q50 0 48 62 q-6 -42 -48 -46 q-42 4 -48 46 z"
                filter="url(#shadow-drape)"
              />
              {/* Flowing front chest draping with gentle V-folds */}
              <path
                d="M52 102 q4 52 48 58 q44 -6 48 -58 l18 138 h-134 z"
              />
              {/* Pleats / Fabric crease highlights */}
              <path d="M82 156 q18 42 18 84 M118 156 q-18 42 -18 84" stroke="#ffffff" strokeWidth="1.5" opacity="0.25" fill="none" />
            </g>
          ) : c.hijabStyle === 2 ? (
            /* Style 2: Turban chic moderne - high fashion & clinical comfort */
            <g fill={hijab}>
              {/* Forehead turban band with front criss-cross fold */}
              <path
                d="M56 86 q0 -46 44 -46 q44 0 44 46 q-14 -16 -44 -16 q-30 0 -44 16 z"
                filter="url(#shadow-drape)"
              />
              {/* Central turban knot twist */}
              <ellipse cx="100" cy="46" rx="14" ry="12" />
              <path d="M92 46 q8 -8 16 0 q-8 8 -16 0" stroke="#000000" strokeWidth="1.5" opacity="0.25" fill="none" />
              {/* Hairline under-cap */}
              <path d="M64 78 q36 -12 72 0 q-36 -4 -72 0" fill="#0f172a" opacity="0.4" />
            </g>
          ) : c.hijabStyle === 3 ? (
            /* Style 3: Châle style turc / koweïtien - pointed crisp peak & side drape */
            <g fill={hijab}>
              {/* Pointed peak forehead silhouette */}
              <path
                d="M52 102 q-2 -58 48 -66 q50 8 48 66 q-6 -44 -48 -48 q-42 4 -48 48 z"
                filter="url(#shadow-drape)"
              />
              {/* Peak fold line */}
              <path d="M100 36 v18" stroke="#ffffff" strokeWidth="1.8" opacity="0.35" />
              {/* Asymmetrical diagonal neck crossover */}
              <path
                d="M52 102 q4 50 48 56 q44 -6 48 -56 l10 32 q-16 48 -58 52 q-42 -4 -48 -44 z"
              />
              {/* Flowing scarf tail over left shoulder */}
              <path d="M60 180 q-10 32 -6 60 h22 q-4 -30 2 -60 z" />
            </g>
          ) : c.hijabStyle === 4 ? (
            /* Style 4: Bonnet bloc chirurgical / hijab de bloc - aerodynamic & professional */
            <g fill={hijab}>
              {/* Snug forehead coverage */}
              <path
                d="M54 100 q-2 -58 46 -58 q48 0 46 58 q-8 -38 -46 -40 q-38 2 -46 40 z"
              />
              {/* Clean fitted surgical collar tucked under scrubs */}
              <path
                d="M54 100 q4 48 46 52 q42 -4 46 -52 v18 q-12 34 -46 36 q-34 -2 -46 -36 z"
              />
              {/* Medical elastic brow band */}
              <path d="M60 74 q40 -12 80 0" stroke="#ffffff" strokeWidth="2.5" opacity="0.3" fill="none" />
            </g>
          ) : c.hijabStyle === 5 ? (
            /* Style 5: Foulard drapé d'épaule algérien - chic side-throw */
            <g fill={hijab}>
              {/* Soft oval forehead curve */}
              <path
                d="M52 102 q-2 -62 48 -62 q50 0 48 62 q-6 -40 -48 -44 q-42 4 -48 44 z"
                filter="url(#shadow-drape)"
              />
              {/* Base chin wrap */}
              <path
                d="M52 102 q4 50 48 56 q44 -6 48 -56 l8 26 q-12 42 -56 46 q-44 -4 -54 -42 z"
              />
              {/* Scarf draped stylishly over left shoulder */}
              <path
                d="M60 168 q-18 20 -14 72 h28 q-4 -36 10 -68 z"
                filter="url(#shadow-drape)"
              />
              <path d="M68 180 q-10 30 2 60" stroke="#ffffff" strokeWidth="1.5" opacity="0.25" fill="none" />
            </g>
          ) : (
            /* Style 0: Hijab médical classique élégant - clean, balanced, beautifully framed */
            <g fill={hijab}>
              {/* Gentle forehead frame */}
              <path
                d="M52 102 q-2 -62 48 -62 q50 0 48 62 q-6 -40 -48 -44 q-42 4 -48 44 z"
                filter="url(#shadow-drape)"
              />
              {/* Chin wrap & neat chest V-drape */}
              <path
                d="M52 102 q4 50 48 56 q44 -6 48 -56 l6 30 q-12 40 -54 44 q-42 -4 -54 -44 z"
              />
              {/* Soft central fold crease */}
              <path d="M100 158 v42" stroke="#ffffff" strokeWidth="1.8" opacity="0.3" />
            </g>
          )
        ) : (
          /* Front Hair Styles (non-hijab) */
          c.hair === 5 ? (
            <path d="M54 125 V88 q0 -45 46 -45 q46 0 46 45 v37 l-13 10 v-48 q-15 -18 -33 -18 q-24 17 -33 17 v49z" fill={hc} />
          ) : c.hair === 7 ? (
            <path d="M54 112 q-9 -65 46 -69 q55 4 46 69 l-15 -16 q-2 -27 -21 -26 q-8 16 -32 10 l-9 25z" fill={hc} />
          ) : c.hair === 8 ? (
            <g fill={hc}>
              <path d="M58 88 q0 -45 42 -45 q42 0 42 45 q-16 -20 -42 -22 q-26 2 -42 22z" />
              {[126, 140, 154, 168].map((y) => (
                <g key={y}>
                  <ellipse cx="61" cy={y} rx="8" ry="10" />
                  <ellipse cx="139" cy={y} rx="8" ry="10" />
                </g>
              ))}
            </g>
          ) : c.hair === 9 ? (
            <path d="M58 89 q0 -45 42 -45 q42 0 42 45 l-7 -4 v-15 q-19 -17 -40 3 q-16 7 -30 5 v11z" fill={hc} />
          ) : c.hair === 10 ? (
            <g fill={hc}>
              {[[64, 74], [80, 56], [100, 50], [120, 56], [136, 74], [58, 96], [142, 96]].map(([x, y]) => (
                <circle key={`${x}${y}`} cx={x} cy={y} r="18" />
              ))}
            </g>
          ) : c.hair === 11 ? (
            <path d="M58 90 q0 -46 42 -46 q46 0 44 44 q-34 -16 -76 20z" fill={hc} />
          ) : c.hair === 1 ? (
            <g fill={hc}>
              {[62, 76, 90, 104, 118, 132].map((x, i) => (
                <circle key={x} cx={x + 4} cy={62 - (i % 2) * 6} r="14" />
              ))}
            </g>
          ) : c.hair === 3 ? (
            <g fill={hc}>
              <circle cx="100" cy="38" r="16" />
              <path d="M58 92 q0 -46 42 -46 q42 0 42 46 q-14 -28 -42 -28 q-28 0 -42 28z" />
            </g>
          ) : (
            <path
              d={
                c.gender === "f" || c.hair === 2
                  ? "M56 100 q-4 -56 44 -56 q48 0 44 56 q-8 -30 -30 -34 q-10 14 -40 16 q-12 4 -18 18z"
                  : "M58 88 q0 -44 42 -44 q42 0 42 44 q-10 -20 -30 -22 q-20 10 -54 22z"
              }
              fill={hc}
            />
          )
        )}

        {/* Glasses - perfectly centered on pupils (cy=96, cx=84 & 116) */}
        {c.glasses === 1 && (
          /* Rondes dorées chic */
          <g stroke="#d97706" strokeWidth="2.4" fill="#ffffff" fillOpacity="0.2">
            <circle cx="84" cy="96" r="13" />
            <circle cx="116" cy="96" r="13" />
            <path d="M97 96 h6" strokeWidth="2.2" />
            <path d="M71 95 l-12 -3 M129 95 l12 -3" strokeWidth="2" />
          </g>
        )}
        {c.glasses === 2 && (
          /* Rectangulaires médicales */
          <g stroke="#1e293b" strokeWidth="2.5" fill="#ffffff" fillOpacity="0.2">
            <rect x="70" y="86" width="28" height="20" rx="4" />
            <rect x="102" y="86" width="28" height="20" rx="4" />
            <path d="M98 96 h4" strokeWidth="2.2" />
            <path d="M70 94 l-11 -3 M130 94 l11 -3" strokeWidth="1.8" />
          </g>
        )}
        {c.glasses === 3 && (
          /* Stylées noires modernes */
          <g stroke="#09090b" strokeWidth="3.2" fill="#ffffff" fillOpacity="0.15">
            <rect x="69" y="85" width="30" height="22" rx="6" />
            <rect x="101" y="85" width="30" height="22" rx="6" />
            <path d="M99 94 h2" strokeWidth="3" />
          </g>
        )}

        {/* Accessories */}
        {c.accessory === 1 && (
          /* Stéthoscope cardiologique réaliste autour du cou */
          <g fill="none" stroke="#0284c7" strokeWidth="4" strokeLinecap="round" filter="url(#shadow-drape)">
            <path d="M74 168 q-4 44 26 48 q30 -4 26 -48" />
            <circle cx="100" cy="216" r="8" fill="#e2e8f0" stroke="#0369a1" strokeWidth="2.5" />
            <circle cx="100" cy="216" r="3.5" fill="#0284c7" />
            {/* Ear pieces */}
            <path d="M72 166 q-4 -12 2 -24 M128 166 q4 -12 -2 -24" stroke="#64748b" strokeWidth="2.5" />
          </g>
        )}
        {c.accessory === 2 && !hijab && (
          /* Casquette étudiante moderne */
          <g fill="#1e293b">
            <ellipse cx="100" cy="54" rx="44" ry="14" />
            <path d="M60 54 q40 -20 80 0 l16 4 q-56 4 -112 0 z" fill="#0f172a" />
          </g>
        )}
        {c.accessory === 3 && (
          /* Écouteurs sans fil intra-auriculaires */
          <g fill="#ffffff" stroke="#cbd5e1" strokeWidth="1">
            <circle cx="62" cy="102" r="3" />
            <path d="M62 102 v7" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
            <circle cx="138" cy="102" r="3" />
            <path d="M138 102 v7" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
          </g>
        )}

        {/* ======================================================== */}
        {/* 7. REALISTIC 12-HOUR TOMATO SPLATTER & WIPING HAND       */}
        {/* ======================================================== */}
        {tomato && (
          <g id="tomato-splatter-layer">
            {/* Running tomato juice drips */}
            <path
              d="M74 92 q-4 28 -2 54 M126 96 q6 22 0 44 M96 126 q-2 18 2 36 M110 134 q3 16 0 30"
              stroke="#dc2626"
              strokeWidth="5"
              strokeLinecap="round"
              opacity="0.9"
            />
            {/* Drip drops */}
            <circle cx="72" cy="150" r="4.5" fill="#dc2626" />
            <circle cx="126" cy="144" r="4" fill="#dc2626" />
            <circle cx="98" cy="166" r="3.5" fill="#b91c1c" />

            {/* Main crushed tomato impact core (cheek & forehead) */}
            <path
              d="M66 68 q24 -22 46 0 q26 -10 30 18 q16 20 -8 32 q-6 24 -34 14 q-26 12 -34 -14 q-22 -16 -6 -34 q-2 -20 8 -16z"
              fill="url(#tomato-splat-grad)"
              filter="url(#shadow-drape)"
              opacity="0.95"
            />
            {/* Pulp texture & tomato seeds */}
            <circle cx="94" cy="84" r="5" fill="#b91c1c" opacity="0.8" />
            <circle cx="82" cy="98" r="4" fill="#991b1b" opacity="0.8" />
            <ellipse cx="88" cy="76" rx="2.5" ry="4" fill="#fef08a" />
            <ellipse cx="114" cy="94" rx="2.5" ry="4" fill="#fef08a" />
            <ellipse cx="104" cy="80" rx="2.5" ry="4" fill="#fef08a" />

            {/* Broken green tomato vine fragment */}
            <path d="M96 58 l6 -10 l6 10 M92 56 l14 -4" stroke="#15803d" strokeWidth="2.5" strokeLinecap="round" />

            {/* ANIMATED HAND WITH WHITE MEDICAL TISSUE WIPING FACE */}
            <g className="animate-wipe">
              {/* Doctor coat sleeve */}
              <path d="M148 150 l16 -30 l18 8 l-12 34 z" fill={o.color} stroke={o.trim} strokeWidth="2" />
              {/* Hand */}
              <ellipse cx="136" cy="108" rx="13" ry="10" fill={skin} stroke="#a16207" strokeWidth="1.5" />
              {/* White medical tissue */}
              <path
                d="M124 94 l24 -8 l8 20 l-26 12 z"
                fill="#ffffff"
                stroke="#cbd5e1"
                strokeWidth="1.5"
                filter="url(#shadow-drape)"
              />
              {/* Red tomato stain on the tissue from wiping */}
              <ellipse cx="134" cy="102" rx="6" ry="4" fill="#dc2626" opacity="0.85" />
            </g>
          </g>
        )}
      </svg>

      {/* Pet indicator */}
      {pet && (
        <span
          className="absolute -bottom-1 -right-2 text-[length:var(--pet)] drop-shadow"
          style={{ ["--pet" as string]: `${Math.round(size * 0.28)}px` }}
        >
          {petEmoji(pet)}
        </span>
      )}

      {/* 12-Hour Tomato Splatter Status Badge */}
      {tomato && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-tomato px-2.5 py-0.5 text-[10px] font-bold text-white shadow-md animate-pop flex items-center gap-1 border border-white/40">
          <span>🍅</span>
          <span>ملطخ بالطماطم ({tomatoHoursLeft ?? 12} س)</span>
        </div>
      )}
    </div>
  );
}
