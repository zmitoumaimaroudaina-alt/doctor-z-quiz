import type { Option, Question } from "@/lib/queries";

export function MistakeBadge({ m }: { m?: { corrected_at: string | null } }) {
  if (!m) return null;
  return m.corrected_at
    ? <span className="ar rounded-full bg-success/15 px-2 py-0.5 text-xs font-semibold text-success">✅ تم تصحيح الخطأ</span>
    : <span className="ar rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-semibold text-destructive">❌ خطأ سابق</span>;
}

export function QuestionCard({
  q, index, selected, onToggle, mistake, disabled, reveal,
}: {
  q: Question; index: number; selected: string[]; onToggle?: (k: string) => void;
  mistake?: { corrected_at: string | null }; disabled?: boolean; reveal?: string[] | null;
}) {
  return (
    <div className="card-game p-4 sm:p-5" id={`q-${q.id}`}>
      {q.case_text && <div className="mb-3 whitespace-pre-line rounded-xl bg-secondary p-3 text-sm"><b>Cas clinique · </b>{q.case_text}</div>}
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <span className="rounded-lg bg-primary-soft px-2 py-0.5 text-xs font-bold text-primary">Q{index}</span>
        <div className="flex gap-1"><MistakeBadge m={mistake} />{q.needs_review && <span className="rounded-full bg-warning/30 px-2 py-0.5 text-[10px]">À vérifier</span>}</div>
      </div>
      <p className="whitespace-pre-line font-medium">{q.stem}</p>
      <div className="mt-3 space-y-2">
        {(q.options as Option[]).map((o) => {
          const on = selected.includes(o.key);
          const ok = reveal?.includes(o.key);
          return (
            <button key={o.key} type="button" disabled={disabled} onClick={() => onToggle?.(o.key)}
              className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left text-sm transition
                ${reveal ? (ok ? "border-success bg-success/10" : on ? "border-destructive bg-destructive/10" : "") : on ? "border-primary bg-primary-soft" : "hover:bg-muted"}`}>
              <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border text-xs font-bold ${on ? "bg-primary text-primary-foreground border-primary" : ""}`}>{o.key}</span>
              <span>{o.text}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">Source : {q.source_file}{q.source_page ? ` · p.${q.source_page}` : ""}</p>
    </div>
  );
}
