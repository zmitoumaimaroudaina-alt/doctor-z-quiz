import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Avatar, type AvatarConfig, SKINS, HAIR_COLORS, HIJAB_COLORS, OUTFITS, OPTIONS } from "./Avatar";
import { PETS } from "@/lib/game";
import { play } from "@/lib/sound";

type Props = { initial: AvatarConfig; pet: string | null; level: number; unlockAll: boolean; onSave: (a: AvatarConfig, pet: string | null) => void; saving?: boolean };

export function AvatarEditor({ initial, pet: initialPet, level, unlockAll, onSave, saving }: Props) {
  const [c, setC] = useState<AvatarConfig>({ gender: "m", skin: 1, accessory: 1, ...initial });
  const [pet, setPet] = useState<string | null>(initialPet ?? "cat");
  const set = (k: keyof AvatarConfig, v: number | string) => { play("select"); setC((p) => ({ ...p, [k]: v })); };
  const locked = (lvl: number) => !unlockAll && level < lvl;

  const Row = ({ label, k, items, lockAt = [] as number[] }: { label: string; k: keyof AvatarConfig; items: string[]; lockAt?: number[] }) => (
    <div>
      <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((it, i) => {
          const lk = lockAt[i] ? locked(lockAt[i]) : false;
          return (
            <Button variant="outline" key={it} type="button" disabled={lk} onClick={() => set(k, i)}
              className={`rounded-lg border px-2.5 py-1 text-xs ${c[k] === i ? "border-primary bg-primary-soft text-primary" : "bg-card"} disabled:opacity-40`}>
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
        {colors.map((col, i) => i < start ? null : (
          <Button variant="outline" key={i} type="button" onClick={() => set(k, i)} aria-label={`${label} ${i}`}
            className={`h-8 w-8 p-0 rounded-full border-2 ${c[k] === i ? "border-primary ring-2 ring-primary/30" : "border-border"}`} style={{ background: col || "transparent" }} />
        ))}
      </div>
    </div>
  );

  return (
    <div className="grid gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
      <div className="flex flex-col items-center justify-center p-4 md:sticky md:top-20 md:self-start">
        <Avatar config={c} mood="happy" size={180} pet={pet} />
      </div>
      <div className="min-w-0 space-y-4 p-4">
        <div className="text-xs font-semibold text-muted-foreground">Genre</div>
        <div className="flex flex-wrap gap-1.5">
          {(["m", "f"] as const).map((g) => (
            <Button variant="outline" key={g} type="button" onClick={() => set("gender", g)} className={`rounded-lg border px-3 py-1 text-xs ${c.gender === g ? "border-primary bg-primary-soft text-primary" : ""}`}>{g === "m" ? "👦 Garçon" : "👧 Fille"}</Button>
          ))}
        </div>
        <Swatches label="Teint" k="skin" colors={SKINS} />
        <Row label="Yeux" k="eyes" items={OPTIONS.eyes} />
        <Row label="Nez" k="nose" items={OPTIONS.nose} />
        <Row label="Bouche / expression" k="mouth" items={OPTIONS.mouth} />
        <Row label="Coiffure" k="hair" items={OPTIONS.hair} />
        <Swatches label="Couleur cheveux" k="hairColor" colors={HAIR_COLORS} />
        <div>
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Hijab</div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" type="button" onClick={() => set("hijab", 0)} className={`rounded-lg border px-2.5 py-1 text-xs ${!c.hijab ? "border-primary bg-primary-soft" : ""}`}>Aucun</Button>
            {HIJAB_COLORS.slice(1).map((col, i) => (
              <Button variant="outline" key={i} type="button" onClick={() => set("hijab", i + 1)} className={`h-8 w-8 p-0 rounded-full border-2 ${c.hijab === i + 1 ? "border-primary" : "border-border"}`} style={{ background: col }} aria-label={`Hijab ${i + 1}`} aria-pressed={c.hijab === i + 1} />
            ))}
          </div>
        </div>
        {!!c.hijab && <Row label="Style du hijab" k="hijabStyle" items={OPTIONS.hijabStyle} />}
        <Row label="Tenue (blouse, jellaba…)" k="outfit" items={OUTFITS.map((o) => o.name)} lockAt={[0, 0, 0, 3, 6]} />
        <Row label="Barbe" k="beard" items={OPTIONS.beard} />
        <Row label="Moustache" k="moustache" items={OPTIONS.moustache} />
        <Row label="Lunettes" k="glasses" items={OPTIONS.glasses} lockAt={[0, 2, 4]} />
        <Row label="Accessoire" k="accessory" items={OPTIONS.accessory} lockAt={[0, 0, 4, 8]} />
        <div>
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Animal de compagnie</div>
          <div className="flex flex-wrap gap-2">
            {PETS.map((p) => {
              const lk = locked(p.level);
              return (
                <Button variant="outline" key={p.id} type="button" disabled={lk} onClick={() => { play("unlock"); setPet(p.id); }}
                  className={`rounded-xl border px-3 py-1.5 text-sm ${pet === p.id ? "border-primary bg-primary-soft" : "bg-card"} disabled:opacity-40`}>
                  {p.emoji} {p.name}{lk ? ` 🔒Nv${p.level}` : ""}
                </Button>
              );
            })}
          </div>
        </div>
        <Button disabled={saving} onClick={() => { play("submit"); onSave(c, pet); }} className="w-full rounded-xl bg-hero py-3 font-semibold text-primary-foreground shadow-pop disabled:opacity-60">
          {saving ? "…" : "Enregistrer mon avatar ✨"}
        </Button>
      </div>
    </div>
  );
}
