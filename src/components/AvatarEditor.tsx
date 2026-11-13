import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Avatar, type AvatarConfig, SKINS, HAIR_COLORS, HIJAB_COLORS, OUTFITS, OPTIONS } from "./Avatar";
import { PETS } from "@/lib/game";
import { play } from "@/lib/sound";

type Props = {
  initial: AvatarConfig;
  pet: string | null;
  level: number;
  unlockAll: boolean;
  onSave: (a: AvatarConfig, pet: string | null) => void;
  saving?: boolean;
};

const STYLE_PRESETS = [
  {
    name: "🩺 طبيب رسمي",
    sub: "Blouse Blanche Classique",
    cfg: { gender: "m" as const, skin: 1, eyes: 0, nose: 0, mouth: 0, hair: 0, hairColor: 0, hijab: 0, hijabStyle: 0, outfit: 0, accessory: 1, glasses: 0, beard: 0, moustache: 0 },
    pet: "cat",
  },
  {
    name: "🧕 طبيبة بحجاب كلاسيكي",
    sub: "Hijab Médical Blanc",
    cfg: { gender: "f" as const, skin: 1, eyes: 1, nose: 0, mouth: 2, hair: 2, hairColor: 0, hijab: 1, hijabStyle: 0, outfit: 0, accessory: 1, glasses: 0, beard: 0, moustache: 0 },
    pet: "cat",
  },
  {
    name: "🧕 خمار شرعي منسدل",
    sub: "Khimar Couvrant & Élégant",
    cfg: { gender: "f" as const, skin: 1, eyes: 0, nose: 0, mouth: 0, hair: 2, hairColor: 0, hijab: 3, hijabStyle: 1, outfit: 0, accessory: 1, glasses: 1, beard: 0, moustache: 0 },
    pet: "cat",
  },
  {
    name: "🧕 توربان عصري أنيق",
    sub: "Turban Chic Moderne",
    cfg: { gender: "f" as const, skin: 2, eyes: 2, nose: 1, mouth: 2, hair: 2, hairColor: 0, hijab: 4, hijabStyle: 2, outfit: 1, accessory: 1, glasses: 2, beard: 0, moustache: 0 },
    pet: "owl",
  },
  {
    name: "🧕 شال تركي بقمة مثلثة",
    sub: "Châle Style Turc Pointu",
    cfg: { gender: "f" as const, skin: 0, eyes: 1, nose: 0, mouth: 0, hair: 2, hairColor: 0, hijab: 5, hijabStyle: 3, outfit: 0, accessory: 1, glasses: 0, beard: 0, moustache: 0 },
    pet: "rabbit",
  },
  {
    name: "🏥 جراحة ببوني العمليات",
    sub: "Bonnet Chirurgical de Bloc",
    cfg: { gender: "f" as const, skin: 2, eyes: 3, nose: 2, mouth: 3, hair: 4, hairColor: 0, hijab: 7, hijabStyle: 4, outfit: 1, accessory: 1, glasses: 0, beard: 0, moustache: 0 },
    pet: "dog",
  },
  {
    name: "🧕 شال منسدل على الكتف",
    sub: "Foulard Drapé d'Épaule",
    cfg: { gender: "f" as const, skin: 2, eyes: 1, nose: 0, mouth: 2, hair: 2, hairColor: 0, hijab: 8, hijabStyle: 5, outfit: 0, accessory: 1, glasses: 1, beard: 0, moustache: 0 },
    pet: "fox",
  },
  {
    name: "🏥 جراح العمليات (رجالي)",
    sub: "Scrubs Bloc Vert",
    cfg: { gender: "m" as const, skin: 2, eyes: 0, nose: 2, mouth: 0, hair: 4, hairColor: 1, hijab: 0, hijabStyle: 0, outfit: 2, accessory: 1, glasses: 1, beard: 0, moustache: 0 },
    pet: "dog",
  },
  {
    name: "👑 أسلوب Doctor Z",
    sub: "Style Créateur Officiel",
    cfg: { gender: "m" as const, skin: 1, eyes: 2, nose: 0, mouth: 2, hair: 9, hairColor: 0, hijab: 0, hijabStyle: 0, outfit: 0, accessory: 1, glasses: 1, beard: 1, moustache: 0 },
    pet: "lion",
  },
];

export function AvatarEditor({ initial, pet: initialPet, level, unlockAll, onSave, saving }: Props) {
  const [c, setC] = useState<AvatarConfig>({ gender: "m", skin: 1, accessory: 1, ...initial });
  const [pet, setPet] = useState<string | null>(initialPet ?? "cat");

  const set = (k: keyof AvatarConfig, v: number | string) => {
    play("select");
    setC((p) => ({ ...p, [k]: v }));
  };
  const locked = (lvl: number) => !unlockAll && level < lvl;

  function applyPreset(preset: typeof STYLE_PRESETS[number]) {
    play("unlock");
    setC({ ...preset.cfg });
    if (preset.pet) setPet(preset.pet);
  }

  const Row = ({ label, k, items, lockAt = [] as number[] }: { label: string; k: keyof AvatarConfig; items: string[]; lockAt?: number[] }) => (
    <div>
      <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((it, i) => {
          const lk = lockAt[i] ? locked(lockAt[i]) : false;
          return (
            <Button
              variant="outline"
              key={it}
              type="button"
              disabled={lk}
              onClick={() => set(k, i)}
              className={`rounded-lg border px-2.5 py-1 text-xs ${
                c[k] === i ? "border-primary bg-primary-soft text-primary font-bold shadow-sm" : "bg-card"
              } disabled:opacity-40`}
            >
              {lk ? "🔒 " : ""}{it}{lk ? ` (Nv ${lockAt[i]})` : ""}
            </Button>
          );
        })}
      </div>
    </div>
  );

  const Swatches = ({ label, k, colors, start = 0 }: { label: string; k: keyof AvatarConfig; colors: string[]; start?: number }) => (
    <div>
      <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="flex flex-wrap gap-2">
        {colors.map((col, i) =>
          i < start ? null : (
            <Button
              variant="outline"
              key={col}
              type="button"
              onClick={() => set(k, i)}
              className={`h-8 w-8 p-0 rounded-full border-2 transition-transform ${
                c[k] === i ? "border-primary ring-2 ring-primary/40 scale-110" : "border-border"
              }`}
              style={{ background: col }}
              aria-label={`${label} ${i}`}
              aria-pressed={c[k] === i}
            />
          )
        )}
      </div>
    </div>
  );

  return (
    <div className="card-game p-5 shadow-sm border border-border/80">
      <div className="flex flex-col sm:flex-row items-center gap-6 border-b border-border/60 pb-6">
        <div className="flex flex-col items-center">
          <Avatar config={c} pet={pet} size={130} />
          <span className="mt-2 text-xs font-bold text-muted-foreground">معاينة شخصيتك الطبية</span>
        </div>
        <div className="flex-1 w-full text-center sm:text-left">
          <h2 className="font-display text-xl font-bold">صمّم شخصيتك الطبية (Avatar)</h2>
          <p className="text-xs text-muted-foreground mt-1">
            خصص مظهر طبيبك، اختر أسلوب الحجاب المتناسق والزي الطبي، واحفظ تعديلاتك ليرى زملاؤك تميزك في قائمة الأوائل.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 justify-center sm:justify-start">
            <Button
              onClick={() => onSave(c, pet)}
              disabled={saving}
              className="rounded-xl px-5 text-sm font-semibold shadow-pop hover:brightness-105"
            >
              {saving ? "جاري الحفظ… ⏳" : "حفظ المظهر الجديد ✨"}
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-5">
        {/* Presets */}
        <div>
          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-primary">
            ⚡ أساليب جاهزة بنقرة واحدة (Styles & Hijabs Prédéfinis) :
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {STYLE_PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => applyPreset(p)}
                className="flex flex-col items-start rounded-xl border border-border bg-card p-2.5 text-left hover:border-primary hover:bg-primary-soft/30 transition-all text-xs"
              >
                <span className="font-bold text-foreground">{p.name}</span>
                <span className="text-[10px] text-muted-foreground">{p.sub}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Gender */}
        <div className="border-t border-border pt-3">
          <div className="text-xs font-semibold text-muted-foreground mb-1.5">Genre · الجنس</div>
          <div className="flex flex-wrap gap-2">
            {(["m", "f"] as const).map((g) => (
              <Button
                variant="outline"
                key={g}
                type="button"
                onClick={() => set("gender", g)}
                className={`rounded-xl border px-4 py-1.5 text-xs font-medium ${
                  c.gender === g ? "border-primary bg-primary-soft text-primary font-bold shadow-sm" : ""
                }`}
              >
                {g === "m" ? "👦 Garçon (طالب)" : "👧 Fille (طالبة)"}
              </Button>
            ))}
          </div>
        </div>

        {/* Hijab Options (Prominent & Refined) */}
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-3">
          <div>
            <div className="mb-1.5 text-xs font-bold uppercase tracking-wide text-primary">
              🧕 لون الحجاب (Couleur du Hijab) :
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                type="button"
                onClick={() => set("hijab", 0)}
                className={`rounded-lg border px-3 py-1 text-xs ${!c.hijab ? "border-primary bg-primary text-primary-foreground font-bold" : ""}`}
              >
                بدون حجاب (Sans Hijab)
              </Button>
              {HIJAB_COLORS.slice(1).map((col, i) => (
                <Button
                  variant="outline"
                  key={i}
                  type="button"
                  onClick={() => set("hijab", i + 1)}
                  className={`h-8 w-8 p-0 rounded-full border-2 transition-transform ${
                    c.hijab === i + 1 ? "border-primary ring-2 ring-primary/40 scale-110" : "border-border"
                  }`}
                  style={{ background: col }}
                  aria-label={`Hijab ${i + 1}`}
                  aria-pressed={c.hijab === i + 1}
                />
              ))}
            </div>
          </div>

          {!!c.hijab && (
            <Row
              label="طريقة لف وتصميم الحجاب (Modèle du Hijab) :"
              k="hijabStyle"
              items={OPTIONS.hijabStyle}
            />
          )}
        </div>

        <Swatches label="Teint de peau (لون البشرة)" k="skin" colors={SKINS} />
        <Row label="Yeux (العينين)" k="eyes" items={OPTIONS.eyes} />
        <Row label="Nez (الأنف)" k="nose" items={OPTIONS.nose} />
        <Row label="Bouche & expression (الفم والابتسامة)" k="mouth" items={OPTIONS.mouth} />

        {!c.hijab && (
          <>
            <Row label="Coiffure (قصة الشعر)" k="hair" items={OPTIONS.hair} />
            <Swatches label="Couleur cheveux (لون الشعر)" k="hairColor" colors={HAIR_COLORS} />
            <Row label="Barbe (اللحية)" k="beard" items={OPTIONS.beard} />
            <Row label="Moustache (الشارب)" k="moustache" items={OPTIONS.moustache} />
          </>
        )}

        <Row label="Tenue médicale (الملابس والزي الطبي)" k="outfit" items={OUTFITS.map((o) => o.name)} />
        <Row label="Lunettes (النظارات)" k="glasses" items={OPTIONS.glasses} />
        <Row label="Accessoire médical (السماعة والملحقات)" k="accessory" items={OPTIONS.accessory} />

        {/* Pet */}
        <div className="border-t border-border pt-3">
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Animal de compagnie (الحيوان المرافق)
          </div>
          <div className="flex flex-wrap gap-2">
            {PETS.map((p) => {
              const lk = locked(p.level);
              return (
                <Button
                  variant="outline"
                  key={p.id}
                  type="button"
                  disabled={lk}
                  onClick={() => {
                    play("select");
                    setPet(p.id);
                  }}
                  className={`rounded-xl border px-3 py-1.5 text-xs flex items-center gap-1.5 ${
                    pet === p.id ? "border-primary bg-primary-soft text-primary font-bold shadow-sm" : ""
                  } disabled:opacity-40`}
                >
                  <span className="text-base">{p.emoji}</span>
                  <span>{p.name}</span>
                  {lk && <span className="text-[10px] text-muted-foreground">(Nv {p.level})</span>}
                </Button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
