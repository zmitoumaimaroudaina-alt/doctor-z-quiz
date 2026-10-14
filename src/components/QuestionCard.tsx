import type { Option, Question } from "@/lib/queries";

export function MistakeBadge({ m }: { m?: { corrected_at: string | null } }) {
  if (!m) return null;
  return m.corrected_at
    ? <span className="ar rounded-full bg-success/15 px-2 py-0.5 text-xs font-semibold text-success">✅ تم تصحيح الخطأ</span>
    : <span className="ar rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-semibold text-destructive">❌ خطأ سابق</span>;
}

export function QuestionCard({
  q, index, selected, onToggle, mistake, disabled, reveal, showSource,
}: {
  q: Question; index: number; selected: string[]; onToggle?: (k: string) => void;
  mistake?: { corrected_at: string | null }; disabled?: boolean; reveal?: string[] | null;
  showSource?: boolean;
}) {
  return (
    <div className="card-game p-4 sm:p-5" id={`q-${q.id}`}>
      {q.case_text && <div className="mb-3 whitespace-pre-line rounded-xl bg-secondary p-3 text-sm"><b>Cas clinique · </b>{q.case_text}</div>}
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <span className="rounded-lg bg-primary-soft px-2 py-0.5 text-xs font-bold text-primary">Q{index}</span>
        <div className="flex gap-1"><MistakeBadge m={mistake} />{q.needs_review && <span className="rounded-full bg-warning/30 px-2 py-0.5 text-[10px]">À vérifier</span>}</div>
      </div>
      <p