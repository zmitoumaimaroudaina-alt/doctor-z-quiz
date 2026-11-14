import { pageMetadata } from "@/lib/metadata";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, PageTitle } from "@/components/AppShell";
import { Practice } from "@/components/Practice";
import type { Question } from "@/lib/queries";
import { useMe } from "@/hooks/useMe";
import {
  consumeHeart,
  formatHeartCountdown,
  renderHeartsVisual,
  resolveHeartKey,
  useHearts,
} from "@/lib/heartsStore";
import { play } from "@/lib/sound";

export const Route = createFileRoute("/_authenticated/course/$courseId")({
  head: () => pageMetadata("Entraînement par cours", "QCM de médecine par cours et résultats sauvegardés."),
  component: Course,
});

function Course() {
  const { courseId } = Route.useParams();
  const { data: me } = useMe();
  const [started, setStarted] = useState(false);

  const heartKey = resolveHeartKey(me?.email, me?.id);
  const heartStatus = useHearts(me?.email, me?.id, !!me?.isCreator);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["course", courseId],
    queryFn: async () => {
      if (!courseId.startsWith("course-uei1-2025")) {
        try {
          const [{ data: c }, { data: qs }] = await Promise.all([
            supabase.from("courses").select("title, subjects(name)").eq("id", courseId).maybeSingle(),
            supabase.from("questions").select("*").eq("course_id", courseId).order("pos"),
          ]);
          if (c && qs && qs.length > 0) {
            const { getQuestionOverride } = await import("@/lib/questionOverrides");
            const merged = (qs as unknown as Question[]).map((item) => {
              const ov = getQuestionOverride(item.id);
              return ov ? { ...item, ...ov } : item;
            });
            return { c, qs: merged };
          }
        } catch {
          // use fallback
        }
      }

      const { getBundledCourse } = await import("@/lib/medicalData");
      const bundled = getBundledCourse(courseId);
      if (bundled.course) {
        return { c: bundled.course, qs: bundled.questions };
      }

      throw new Error("Cours introuvable");
    },
  });

  function startCourse() {
    if (!heartStatus.canPlay) {
      toast.error(
        `لا توجد قلوب متبقية! يتجدد قلب بعد ${formatHeartCountdown(heartStatus.secondsToNext)}`,
      );
      return;
    }
    const res = consumeHeart(heartKey, !!me?.isCreator);
    if (!res.ok) {
      toast.error("نفدت القلوب! انتظر ساعتين لتجدد قلب.");
      return;
    }
    play("submit");
    setStarted(true);
  }

  if (isLoading) {
    return (
      <AppShell wide>
        <div className="p-8 text-center font-semibold">Chargement du cours… ⏳</div>
      </AppShell>
    );
  }

  if (isError || !data?.c) {
    return (
      <AppShell wide>
        <div className="p-8 text-center text-destructive">
          {(error as Error)?.message || "Impossible de charger ce cours."}
        </div>
      </AppShell>
    );
  }

  const { c, qs } = data;
  const subjectName = (c.subjects as { name: string } | null)?.name ?? "";

  return (
    <AppShell wide>
      <PageTitle title={c.title ?? ""} sub={subjectName} />

      {!started ? (
        <div className="card-game max-w-2xl space-y-4 p-6">
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="rounded-xl bg-primary-soft p-3">
              <div className="text-xs text-muted-foreground">Questions</div>
              <div className="font-display text-xl font-bold">{qs.length}</div>
            </div>
            <div className="rounded-xl bg-primary-soft p-3">
              <div className="text-xs text-muted-foreground">Cœurs</div>
              <div className="font-display text-xl font-bold">
                {renderHeartsVisual(heartStatus.hearts, heartStatus.unlimited)}
              </div>
            </div>
          </div>

          {!heartStatus.unlimited && heartStatus.secondsToNext > 0 && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-center text-xs font-semibold text-amber-900">
              ⏳ يتجدد القلب التالي تلقائياً خلال:{" "}
              <span className="font-mono text-sm">{formatHeartCountdown(heartStatus.secondsToNext)}</span>{" "}
              (كل ساعتين +1 ❤️)
            </div>
          )}

          <p className="ar text-sm text-muted-foreground">
            ❤️ لديك محاولتان (قلبان) لكل التمارين بالمواد أو الاختبارات، ويتجدد كل قلب كل ساعتين تلقائياً.
          </p>

          {!heartStatus.canPlay ? (
            <div className="rounded-xl bg-destructive/10 border border-destructive/30 p-4 text-center text-sm font-medium text-destructive">
              🔒 نفدت قلوبك (🤍🤍). يتجدد قلب جديد بعد{" "}
              <b className="font-mono">{formatHeartCountdown(heartStatus.secondsToNext)}</b>
            </div>
          ) : (
            <button
              type="button"
              onClick={startCourse}
              className="w-full rounded-xl bg-hero py-3 text-lg font-semibold text-primary-foreground shadow-pop transition active:scale-95"
            >
              Commencer les QCM · ابدأ التمرين (-1 ❤️)
            </button>
          )}
        </div>
      ) : (
        <>
          <Practice
            key={courseId}
            questions={qs}
            challengeId={courseId}
            challengeTitle={c.title ?? ""}
            onRequestNewAttempt={() => {
              if (!heartStatus.canPlay) {
                toast.error(
                  `نفدت القلوب! يتجدد قلب بعد ${formatHeartCountdown(heartStatus.secondsToNext)}`,
                );
                return false;
              }
              const res = consumeHeart(heartKey, !!me?.isCreator);
              if (!res.ok) {
                toast.error("نفدت القلوب! انتظر ساعتين لتجدد قلب.");
                return false;
              }
              return true;
            }}
          />
          <PracticeHistory questionIds={qs.map((q) => q.id)} />
        </>
      )}
    </AppShell>
  );
}

function PracticeHistory({ questionIds }: { questionIds: string[] }) {
  const { data } = useQuery({
    queryKey: ["practice-history", questionIds],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("practice_attempts")
          .select("id,question_ids,submitted_at,score20,correct_count,wrong_count,unanswered_count")
          .not("submitted_at", "is", null)
          .order("submitted_at", { ascending: false })
          .limit(100);
        if (error) return [];
        return (data ?? []).filter(
          (a) => a.question_ids.length === questionIds.length && a.question_ids.every((id, i) => id === questionIds[i]),
        );
      } catch {
        return [];
      }
    },
    refetchInterval: 5000,
  });
  return (
    <section className="mt-8 border-t py-4">
      <h2 className="font-display text-lg font-bold">Mes tentatives enregistrées</h2>
      {data?.map((a) => (
        <div key={a.id} className="flex flex-wrap justify-between gap-2 border-b py-3 text-sm">
          <span>{new Date(a.submitted_at ?? "").toLocaleString("fr-DZ")}</span>
          <strong>{Number(a.score20).toFixed(2)}/20</strong>
          <span>
            ✓ {a.correct_count} · ✕ {a.wrong_count} · Sans réponse {a.unanswered_count}
          </span>
        </div>
      ))}
    </section>
  );
}
