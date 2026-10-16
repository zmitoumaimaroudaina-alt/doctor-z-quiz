import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/Avatar";
import { QuestionCard } from "@/components/QuestionCard";
import { useMe } from "@/hooks/useMe";
import { fetchMistakesFor, type Question } from "@/lib/queries";
import { fmtTime, moodFrom } from "@/lib/game";
import { play } from "@/lib/sound";

export const Route = createFileRoute("/_authenticated/play/$attemptId")({
  component: Play,
});

const LIMIT = 3600;

function Play() {
  const { attemptId } = Route.useParams();
  const nav = useNavigate();
  const { data: me } = useMe();
  const storeKey = `zqcm-ans-${attemptId}`;
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [left, setLeft] = useState(LIMIT);
  const [streak, setStreak] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const submitted = useRef(false);
  const verdicts = useRef<Record<string, boolean>>({});

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["play", attemptId],
    queryFn: async () => {
      const { data: a, error: aErr } = await supabase
        .from("attempts")
        .select("*")
        .eq("id", attemptId)
        .maybeSingle();

      if (aErr || !a) throw new Error("Tentative introuvable");

      const [{ data: qs }, { data: exam }] = await Promise.all([
        supabase.from("questions").select("*").eq("exam_id", a.exam_id!).order("pos"),
        supabase.from("exams").select("title").eq("id", a.exam_id!).maybeSingle(),
      ]);

      let mistakes = new Map();
      try {
        if (qs && qs.length > 0) {
          const res = await fetchMistakesFor(qs.map((q) => q.id));
          if (res) mistakes = res;
        }
      } catch (e) {
        console.warn("Could not fetch mistakes:", e);
      }

      return { a, qs: (qs ?? []) as unknown as Question[], exam, mistakes };
    },
    staleTime: Infinity,
  });

  useEffect(() => {
    const s = localStorage.getItem(storeKey);
    if (s) {
      try {
        setAnswers(JSON.parse(s));
      } catch {
        setAnswers({});
      }
    }
  }, [storeKey]);

  useEffect(() => {
    if (data?.a?.submitted_at) {
      nav({ to: "/results/$attemptId", params: { attemptId } });
    }
  }, [data, nav, attemptId]);

  const submit = useCallback(
    async (auto = false) => {
      if (submitted.current) return;
      submitted.current = true;
      setSubmitting(true);
      play("submit");
      const cur = JSON.parse(localStorage.getItem(storeKey) || "{}");
      const { error } = await supabase.rpc("submit_attempt", {
        _attempt: attemptId,
        _answers: cur,
      });
      if (error) {
        submitted.current = false;
        setSubmitting(false);
        return toast.error(error.message);
      }
      localStorage.removeItem(storeKey);
      if (auto) toast("⏰ Temps écoulé — copie soumise automatiquement");
      nav({ to: "/results/$attemptId", params: { attemptId } });
    },
    [attemptId, nav