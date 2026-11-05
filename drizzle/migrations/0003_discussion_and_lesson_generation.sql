CREATE TABLE public.discussion_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE DEFAULT auth.uid(),
  kind text NOT NULL DEFAULT 'chat' CHECK (kind IN ('chat','feedback')),
  body text NOT NULL CHECK (char_length(trim(body)) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.discussion_messages TO authenticated;
GRANT ALL ON public.discussion_messages TO service_role;
ALTER TABLE public.discussion_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read discussion" ON public.discussion_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "post own message" ON public.discussion_messages FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "delete own or creator" ON public.discussion_messages FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.is_creator());
ALTER PUBLICATION supabase_realtime ADD TABLE public.discussion_messages;

CREATE TABLE public.lesson_quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  qtype text NOT NULL CHECK (qtype IN ('QCM','QCS')),
  questions jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, DELETE ON public.lesson_quizzes TO authenticated;
GRANT ALL ON public.lesson_quizzes TO service_role;
ALTER TABLE public.lesson_quizzes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own quizzes" ON public.lesson_quizzes FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "delete own quizzes" ON public.lesson_quizzes FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "upload own lessons" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'lesson-pdfs' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "read own lessons" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'lesson-pdfs' AND (storage.foldername(name))[1] = auth.uid()::text);