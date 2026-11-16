import { pageMetadata } from "@/lib/metadata";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, PageTitle } from "@/components/AppShell";
import { normalizeExamTitle, getBundledExam } from "@/lib/medicalData";
import { useMe } from "@/hooks/useMe";
import { consumeHeart, renderHeartsVisual, useHearts } from "@/lib/heartsStore";
import { play } from "@/lib/sound";

export const Route = createFileRoute("/_authenticated/exam/$examId")({
  head: () =>
    pageMetadata(
      "Commencer un examen",
      "Examen médical de Blida : 60 minutes et système de cœurs.",
    ),
  component: ExamIntro,
});

function ExamIntro() {
  const { examId } = Route.useParams();
  const nav = useNavigate();
  const { data: me } = useMe();
  const [busy, setBusy] = useState(false);

  const heartStatus = useHearts(me?.email, me?.id, !!me?.isCreator);

  // Auto-redirect to /renew-hearts when hearts reach 0
  useEffect(() => {
    if (me && !me.isCreator && !heartStatus.canPlay) {
      toast.info("💔 نفدت قلوبك! تم نقلك إلى صفحة تجديد القلوب بالأذكار.");
      nav({
        to: "/renew-hearts",
        search: { returnTo: `/exam/${examId}` } as never,
      });
    }
  }, [me, heartStatus.canPlay, examId, nav]);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["exam-intro", examId],
    queryFn: async () => {
      const bundled = getBundledExam(examId);
      if (examId.startsWith("exam-uei1-2025") && bundled.exam) {
        return {
          exam: bundled.exam,
          count: bundled.questions.length,
        };
      }

      try {
        const [{ data: exam }, { count }] = await Promise.all([
          supabase.from("exams").select("*").eq("id", examId).maybeSingle(),
          supabase
            .from("questions")
            .select("id", { count: "exact", head: true })
            .eq("exam_id", examId),
        ]);

        if (exam) {
          return {
            exam: {
              ...exam,
              title: normalizeExamTitle(exam),
            },
            count: count ?? bundled.questions.length,
          };
        }
      } catch {
        // fallback
      }

      if (bundled.exam) {
        return {
          exam: bundled.exam,
          count: bundled.questions.length,
        };
      }

      throw new Error("Examen introuvable");
    },
  });

  async function start() {
    if (!me) return;
    if (!heartStatus.canPlay) {
      toast.error("💔 نفدت قلوبك! انتقل لتجديد القلوب.");
      nav({
        to: "/renew-hearts",
        search: { returnTo: `/exam/${examId}` } as never,
      });
      return;
    }

    try {
      setBusy(true);
      const consumed = await consumeHeart(me.id, !!me.isCreator);
      if (!consumed.ok) {
        toast.error("💔 نفدت قلوبك! يمكنك تجديدها عبر الأذكار.");
        setBusy(false);
        nav({
          to: "/renew-hearts",
          search: { returnTo: `/exam/${examId}` } as never,
        });
        return;
      }

      let attemptId: string | null = null;
      if (!examId.startsWith("exam-uei1-2025")) {
        try {
          const { data: id, error } = await supabase.rpc("start_attempt", { _exam: examId });
          if (!error && id) attemptId = String(id);
        } catch {
          // fallback
        }
      }

      if (!attemptId) {
        attemptId = `local_exam_${examId}_${Date.now()}`;
        const initialAttempt = {
          id: attemptId,
          exam_id: examId,
          started_at: new Date().toISOString(),
          answers: {},
          duration_sec: 3600,
        };
        localStorage.setItem(`attempt_${attemptId}`, JSON.stringify(initialAttempt));
      }

      play("submit");
      nav({
        to: "/play/$attemptId",
        params: { attemptId },
      });
    } catch (e) {
      console.error("Start attempt error:", e);
      toast.error("Une erreur s'est produite lors du lancement.");
      setBusy(false);
    }
  }

  if (isLoading) {
    return (
      <AppShell>
        <div className="p-8 text-center font-semibold">Chargement de l'examen… ⏳</div>
      </AppShell>
    );
  }

  if (isError || !data?.exam) {
    return (
      <AppShell>
        <div className="p-8 text-center text-destructive">
          {(error as Error)?.message || "Impossible de charger cet examen."}
        </div>
      </AppShell>
    );
  }

  const { exam } = data;
  const locked = !heartStatus.canPlay;

  return (
    <AppShell>
      <PageTitle title={exam.title} ar="اختبار شامل (60 دقيقة)" />
      <div className="card-game space-y-4 p-6">
        <div className="grid grid-cols-3 gap-3 text-center">
          <Stat label="Questions" value={String(data.count)} />
          <Stat label="Durée" value="60:00" />
          <Stat
            label="Cœurs"
            value={renderHeartsVisual(heartStatus.hearts, heartStatus.unlimited)}
          />
        </div>

        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>الاختبار يشمل جميع المواد في مدة 60 دقيقة (soumission automatique à 00:00).</li>
          <li>لديك قلبان (محاولتان ❤️❤️) وتُستهلك محاولة واحدة عند بدء الاختبار.</li>
          <li>عند نفاد القلوب، يمكنك تجديدها فوراً من صفحة الأذكار (حتى 5 قلوب كحد أقصى).</li>
        </ul>

        {locked ? (
          <button
            type="button"
            onClick={() =>
              nav({
                to: "/renew-hearts",
                search: { returnTo: `/exam/${examId}` } as never,
              })
            }
            className="w-full rounded-xl bg-hero py-3 text-base font-bold text-primary-foreground shadow-pop"
          >
            🤲 تجديد القلوب بالأذكار
          </button>
        ) : (
          <button
            disabled={busy}
            onClick={() => void start()}
            className="w-full rounded-xl bg-hero py-3 text-lg font-semibold text-primary-foreground shadow-pop transition active:scale-95"
          >
            {busy ? "Lancement…" : "Commencer l'examen · ابدأ (-1 ❤️)"}
          </button>
        )}
      </div>
    </AppShell>
  );
}

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xl bg-primary-soft p-3">
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className="font-display text-xl font-bold">{value}</div>
  </div>
);
