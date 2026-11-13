import { pageMetadata } from "@/lib/metadata";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, PageTitle } from "@/components/AppShell";
import { normalizeExamTitle, getBundledExam } from "@/lib/medicalData";
import { useMe } from "@/hooks/useMe";
import {
  consumeHeart,
  formatHeartCountdown,
  renderHeartsVisual,
  resolveHeartKey,
  useHearts,
} from "@/lib/heartsStore";
import { play } from "@/lib/sound";

export const Route = createFileRoute("/_authenticated/exam/$examId")({
  head: () => pageMetadata("Commencer un examen", "Examen médical de Blida : 60 minutes et système de cœurs."),
  component: ExamIntro,
});

function ExamIntro() {
  const { examId } = Route.useParams();
  const nav = useNavigate();
  const { data: me } = useMe();
  const [busy, setBusy] = useState(false);

  const heartKey = resolveHeartKey(me?.email, me?.id);
  const heartStatus = useHearts(me?.email, me?.id, !!me?.isCreator);

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
          supabase.from("questions").select("id", { count: "exact", head: true }).eq("exam_id", examId),
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
    if (!heartStatus.canPlay) {
      toast.error(
        `لا توجد قلوب متبقية! يتجدد قلب بعد ${formatHeartCountdown(heartStatus.secondsToNext)}`,
      );
      return;
    }

    try {
      setBusy(true);
      const consumed = consumeHeart(heartKey, !!me?.isCreator);
      if (!consumed.ok) {
        toast.error("لا توجد قلوب متبقية! انتظر تجدد القلوب كل ساعتين.");
        setBusy(false);
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

        {!heartStatus.unlimited && heartStatus.secondsToNext > 0 && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-center text-xs font-semibold text-amber-900">
            ⏳ يتجدد القلب التالي تلقائياً خلال:{" "}
            <span className="font-mono text-sm">{formatHeartCountdown(heartStatus.secondsToNext)}</span>{" "}
            (كل ساعتين +1 ❤️)
          </div>
        )}

        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>الاختبار يشمل جميع المواد في مدة 60 دقيقة (soumission automatique à 00:00).</li>
          <li>لديك محاولتان (قلبان ❤️❤️) تستهلك محاولة عند البدء، ويتجدد كل قلب كل ساعتين.</li>
          <li>يمكن لحساب المصمم إضافة قلوب إضافية لأي طالب من لوحة Creator.</li>
        </ul>

        {locked ? (
          <div className="rounded-xl bg-destructive/10 border border-destructive/30 p-4 text-center text-sm font-medium text-destructive">
            🔒 نفدت قلوبك (🤍🤍). يتجدد قلب جديد بعد{" "}
            <b className="font-mono">{formatHeartCountdown(heartStatus.secondsToNext)}</b>
          </div>
        ) : (
          <button
            disabled={busy}
            onClick={start}
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