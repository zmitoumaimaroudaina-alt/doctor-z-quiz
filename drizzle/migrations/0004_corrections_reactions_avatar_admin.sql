CREATE TABLE public.question_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE UNIQUE,
  issue text NOT NULL,
  proposed_stem text,
  proposed_case_text text,
  proposed_options jsonb,
  proposed_correct text[],
  justification text,
  confidence text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','applied','rejected')),
  original jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.question_corrections TO authenticated;
GRANT ALL ON public.question_corrections TO service_role;
ALTER TABLE public.question_corrections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "creator all" ON public.question_corrections FOR ALL TO authenticated USING (public.is_creator()) WITH CHECK (public.is_creator());

CREATE TABLE public.discussion_reactions (
  message_id uuid NOT NULL REFERENCES public.discussion_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  emoji text NOT NULL CHECK (emoji IN ('happy','veryHappy','sad','angry','love','shock')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id, emoji)
);
GRANT SELECT, INSERT, DELETE ON public.discussion_reactions TO authenticated;
GRANT ALL ON public.discussion_reactions TO service_role;
ALTER TABLE public.discussion_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read reactions" ON public.discussion_reactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "add own reaction" ON public.discussion_reactions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "remove own reaction" ON public.discussion_reactions FOR DELETE TO authenticated USING (user_id = auth.uid());
ALTER PUBLICATION supabase_realtime ADD TABLE public.discussion_reactions;

CREATE TABLE public.avatar_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  disabled jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.avatar_settings (id) VALUES (1);
GRANT SELECT, UPDATE ON public.avatar_settings TO authenticated;
GRANT ALL ON public.avatar_settings TO service_role;
ALTER TABLE public.avatar_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read avatar settings" ON public.avatar_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "creator updates avatar settings" ON public.avatar_settings FOR UPDATE TO authenticated USING (public.is_creator()) WITH CHECK (public.is_creator());

CREATE OR REPLACE FUNCTION public.admin_student_stats()
RETURNS TABLE(user_id uuid, display_name text, avatar jsonb, xp int, coins int, streak int, created_at timestamptz,
  exams_done bigint, avg_score numeric, best_score numeric, practice_done bigint, mistakes_open bigint, last_active timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_creator() THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  SELECT p.id, p.display_name, to_jsonb(p.avatar), p.xp, p.coins, p.streak, p.created_at,
    (SELECT count(*) FROM attempts a WHERE a.user_id = p.id AND a.submitted_at IS NOT NULL),
    (SELECT round(avg(a.score20)::numeric, 2) FROM attempts a WHERE a.user_id = p.id AND a.submitted_at IS NOT NULL),
    (SELECT max(a.score20)::numeric FROM attempts a WHERE a.user_id = p.id AND a.submitted_at IS NOT NULL),
    (SELECT count(*) FROM practice_attempts pa WHERE pa.user_id = p.id AND pa.finished_at IS NOT NULL),
    (SELECT count(*) FROM question_mistakes m WHERE m.user_id = p.id AND m.corrected_at IS NULL),
    GREATEST((SELECT max(a.started_at) FROM attempts a WHERE a.user_id = p.id), (SELECT max(pa.created_at) FROM practice_attempts pa WHERE pa.user_id = p.id))
  FROM profiles p ORDER BY p.created_at DESC;
END $$;
REVOKE ALL ON FUNCTION public.admin_student_stats() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_student_stats() TO authenticated;