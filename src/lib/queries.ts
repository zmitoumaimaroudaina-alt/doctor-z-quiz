import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  getBundledSubjects,
  getBundledExams,
  normalizeExamTitle,
  UNIFIED_EXAM_NAME,
  type MedicalExam,
} from "./medicalData";

export type Subject = { id: number; slug: string; name: string; name_ar: string | null; emoji: string | null; sort: number };
export type Option = { key: string; text: string };
export type Question = {
  id: string;
  pos: number;
  case_text: string | null;
  stem: string;
  options: Option[];
  source_file: string;
  source_page: number | null;
  source_year: string | null;
  needs_review: boolean;
  exam_id: string | null;
  course_id: string | null;
};

export function useSubjects() {
  return useQuery({
    queryKey: ["subjects"],
    queryFn: async () => {
      const bundled = getBundledSubjects();
      try {
        const { data } = await supabase.from("subjects").select("*").order("sort");
        if (data && data.length > 0) {
          const remote = data as Subject[];
          const ids = new Set(remote.map((s) => s.id));
          return [...remote, ...bundled.filter((b) => !ids.has(b.id))];
        }
      } catch {
        // use fallback
      }
      return bundled;
    },
    staleTime: Infinity,
  });
}

export function useExams() {
  return useQuery({
    queryKey: ["exams"],
    queryFn: async () => {
      const bundled = getBundledExams();
      try {
        const { data } = await supabase
          .from("exams")
          .select("id,title,unit,year,source_file,sort,exam_subjects(subject_id)")
          .order("year", { ascending: false });
        if (data && data.length > 0) {
          const remote = (data as unknown as MedicalExam[]).map((ex) => ({
            ...ex,
            title: normalizeExamTitle(ex),
            unit: UNIFIED_EXAM_NAME,
          }));
          const remoteIds = new Set(remote.map((r) => r.id));
          return [...bundled.filter((b) => !remoteIds.has(b.id)), ...remote].sort(
            (a, b) => b.year - a.year || (a.sort ?? 99) - (b.sort ?? 99),
          );
        }
      } catch {
        // use fallback
      }
      return bundled;
    },
  });
}

export async function fetchMistakesFor(ids: string[]) {
  if (!ids.length) return new Map<string, { corrected_at: string | null }>();
  try {
    const { data } = await supabase.from("question_mistakes").select("question_id, corrected_at").in("question_id", ids);
    if (data && data.length) return new Map((data ?? []).map((m) => [m.question_id, m]));
  } catch {
    // fallback to local storage
  }
  return new Map<string, { corrected_at: string | null }>();
}