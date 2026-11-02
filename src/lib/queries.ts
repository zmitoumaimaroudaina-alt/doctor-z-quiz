import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Subject = { id: number; slug: string; name: string; name_ar: string | null; emoji: string | null; sort: number };
export type Option = { key: string; text: string };
export type Question = { id: string; pos: number; case_text: string | null; stem: string; options: Option[]; source_file: string; source_page: number | null; source_year: string | null; needs_review: boolean; exam_id: string | null; course_id: string | null };



export function useSubjects() {
  return useQuery({
    queryKey: ["subjects"],
    queryFn: async () => {
      const { data } = await supabase.from("subjects").select("*").order("sort");
      return (data ?? []) as Subject[];
    },
    staleTime: Infinity,
  });
}

export function useExams() {
  return useQuery({
    queryKey: ["exams"],
    queryFn: async () => {
      const { data } = await supabase.from("exams").select("id,title,unit,year,source_file,sort,exam_subjects(subject_id)").order("year", { ascending: false });
      return (data ?? []) as unknown as { id: string; title: string; unit: string; year: number; source_file: string; exam_subjects: { subject_id: number }[] }[];
    },
  });
}

export async function fetchMistakesFor(ids: string[]) {
  if (!ids.length) return new Map<string, { corrected_at: string | null }>();
  const { data } = await supabase.from("question_mistakes").select("question_id, corrected_at").in("question_id", ids);
  return new Map((data ?? []).map((m) => [m.question_id, m]));
}