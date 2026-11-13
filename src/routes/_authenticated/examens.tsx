import { pageMetadata } from "@/lib/metadata";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, PageTitle } from "@/components/AppShell";
import { useExams, useSubjects } from "@/lib/queries";
import { UNIFIED_EXAM_NAME, type MedicalExam } from "@/lib/medicalData";
import { play } from "@/lib/sound";

export const Route = createFileRoute("/_authenticated/examens")({
  head: () => pageMetadata("QCM Examens", "Examens de médecine de Blida par année et par matière."),
  component: Examens,
});

function Examens() {
  const { data: subjects } = useSubjects();
  const { data: exams } = useExams();
  const [tab, setTab] = useState<"years" | "subjects">("years");
  const [sel, setSel] = useState<number | null>(null);
  const [year, setYear] = useState<number | null>(null);

  const allExams = (exams ?? []) as MedicalExam[];
  const allYears = [...new Set(allExams.map((e) => e.year))].sort((a, b) => b - a);
  const yearExams = year ? allExams.filter((e) => e.year === year) : [];

  const subj = subjects?.find((s) => s.id === sel);
  const inSubj = allExams.filter((e) => e.exam_subjects?.some((x) => x.subject_id === sel));
  const subjYears = [...new Set(inSubj.map((e) => e.year))].sort((a, b) => b - a);

  return (
    <AppShell>
      <PageTitle
        title="📝 QCM Examens"
        ar="الامتحانات الشاملة (60 دقيقة)"
        sub={`${UNIFIED_EXAM_NAME} · اختبار شامل لكل المواد في 60 دقيقة`}
      />

      {/* Mode Switch: Par Année vs Par Matière */}
      <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl bg-muted p-1.5">
        <button
          type="button"
          onClick={() => {
            play("click");
            setTab("years");
            setSel(null);
            setYear(null);
          }}
          className={`rounded-xl py-2.5 px-3 text-sm font-bold transition ${
            tab === "years" ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          📅 حسب السنوات (2025 – 2021)
        </button>
        <button
          type="button"
          onClick={() => {
            play("click");
            setTab("subjects");
            setSel(null);
            setYear(null);
          }}
          className={`rounded-xl py-2.5 px-3 text-sm font-bold transition ${
            tab === "subjects" ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          📚 حسب المادة (Par Matière)
        </button>
      </div>

      {/* TAB 1: BY YEAR */}
      {tab === "years" && (
        <>
          <Crumbs items={[UNIFIED_EXAM_NAME, year?.toString()]} onBack={() => setYear(null)} />

          {!year ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {allYears.map((y) => {
                const list = allExams.filter((e) => e.year === y);
                const mainExam = list[0];
                const is2025 = y === 2025;
                if (!mainExam) return null;
                return (
                  <Link
                    key={y}
                    to="/exam/$examId"
                    params={{ examId: mainExam.id }}
                    onClick={() => play("click")}
                    className={`card-game flex items-center justify-between gap-3 p-4 text-left hover:shadow-pop transition ${
                      is2025 ? "sm:col-span-2 border-2 border-primary/40 bg-primary/5" : ""
                    }`}
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display text-2xl font-bold text-primary">{y}</span>
                        {is2025 && (
                          <span className="rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-bold text-primary-foreground">
                            🆕 2025/2026
                          </span>
                        )}
                        <span className="rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-semibold text-success">
                          🔓 مفتوح
                        </span>
                      </div>
                      <div className="mt-1 text-sm font-semibold">{mainExam.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {mainExam.n ?? 60} QCM · كل المواد · ⏱️ 60 دقيقة
                      </div>
                    </div>
                    <span className="shrink-0 font-semibold text-primary">ابدأ →</span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
              {yearExams.map((e) => (
                <Link
                  key={e.id}
                  to="/exam/$examId"
                  params={{ examId: e.id }}
                  className="card-game flex items-center justify-between gap-3 p-4 hover:shadow-pop transition"
                >
                  <div>
                    <span className="block font-semibold">{e.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {e.n ?? 60} QCM · كل المواد · ⏱️ 60 min
                    </span>
                  </div>
                  <span className="shrink-0 font-semibold text-primary">Ouvrir →</span>
                </Link>
              ))}
            </div>
          )}
        </>
      )}

      {/* TAB 2: BY SUBJECT */}
      {tab === "subjects" && (
        <>
          <Crumbs
            items={["Matière", subj?.name, year?.toString()]}
            onBack={(i) => {
              if (i === 0) {
                setSel(null);
                setYear(null);
              }
              if (i === 1) setYear(null);
            }}
          />
          {!subj && (
            <div className="grid gap-3 sm:grid-cols-2">
              {subjects?.map((s) => {
                const n = allExams.filter((e) => e.exam_subjects?.some((x) => x.subject_id === s.id)).length;
                return (
                  <button
                    key={s.id}
                    onClick={() => {
                      play("click");
                      setSel(s.id);
                    }}
                    className="card-game flex items-center gap-3 p-4 text-left hover:shadow-pop"
                  >
                    <span className="text-3xl">{s.emoji}</span>
                    <span className="flex-1">
                      <span className="block font-semibold">{s.name}</span>
                      <span className="ar text-xs text-muted-foreground">{s.name_ar}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {n} examen{n > 1 ? "s" : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {subj && !year && (
            subjYears.length ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {subjYears.map((y) => (
                  <button
                    key={y}
                    onClick={() => {
                      play("click");
                      setYear(y);
                    }}
                    className="card-game p-5 text-center hover:shadow-pop"
                  >
                    <div className="font-display text-2xl font-bold text-primary">{y}</div>
                    <div className="mt-1 text-[11px] font-semibold text-success">🔓 مفتوح</div>
                  </button>
                ))}
              </div>
            ) : (
              <Empty text="Aucun examen disponible pour cette matière." />
            )
          )}
          {subj && year && (
            <div className="space-y-3">
              {inSubj
                .filter((e) => e.year === year)
                .map((e) => (
                  <Link
                    key={e.id}
                    to="/exam/$examId"
                    params={{ examId: e.id }}
                    className="card-game flex items-center justify-between gap-3 p-4 hover:shadow-pop"
                  >
                    <div>
                      <span className="block font-semibold">{e.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {e.n ?? 60} QCM · ⏱️ 60 min (كل المواد)
                      </span>
                    </div>
                    <span className="shrink-0 font-semibold text-primary">Ouvrir →</span>
                  </Link>
                ))}
            </div>
          )}
        </>
      )}

      <div className="mt-6 rounded-2xl border border-border bg-card/70 p-4 text-center text-xs text-muted-foreground">
        💡 للتمرن على أسئلة كل مادة منفصلة (بما فيها مواد 2025)، افتح قسم{" "}
        <Link to="/cours" className="font-bold text-primary hover:underline">
          📚 QCM par Cours
        </Link>
      </div>
    </AppShell>
  );
}

export function Crumbs({ items, onBack }: { items: (string | undefined)[]; onBack: (i: number) => void }) {
  const shown = items.filter(Boolean) as string[];
  if (shown.length < 2) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
      {shown.map((t, i) => (
        <span key={i} className="flex items-center gap-2">
          {i > 0 && <span className="text-muted-foreground">›</span>}
          {i < shown.length - 1 ? (
            <button onClick={() => onBack(i)} className="text-primary hover:underline">
              {t}
            </button>
          ) : (
            <span className="font-semibold">{t}</span>
          )}
        </span>
      ))}
    </div>
  );
}
export const Empty = ({ text }: { text: string }) => <div className="card-game p-8 text-center text-muted-foreground">{text}</div>;