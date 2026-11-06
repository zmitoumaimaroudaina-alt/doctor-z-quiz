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
    (SELECT count(*) FROM practice_attempts pa WHERE pa.user_id = p.id AND pa.submitted_at IS NOT NULL),
    (SELECT count(*) FROM question_mistakes m WHERE m.user_id = p.id AND m.corrected_at IS NULL),
    GREATEST((SELECT max(a.started_at) FROM attempts a WHERE a.user_id = p.id), (SELECT max(pa.started_at) FROM practice_attempts pa WHERE pa.user_id = p.id))
  FROM profiles p ORDER BY p.created_at DESC;
END $$;

CREATE OR REPLACE FUNCTION public.apply_question_correction(_id uuid, _accept boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c question_corrections; q questions; k question_keys;
BEGIN
  IF NOT public.is_creator() THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO c FROM question_corrections WHERE id = _id AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'not pending'; END IF;
  IF NOT _accept THEN
    UPDATE question_corrections SET status = 'rejected', reviewed_at = now() WHERE id = _id; RETURN;
  END IF;
  SELECT * INTO q FROM questions WHERE id = c.question_id;
  SELECT * INTO k FROM question_keys WHERE question_id = c.question_id;
  UPDATE question_corrections SET status = 'applied', reviewed_at = now(),
    original = jsonb_build_object('stem', q.stem, 'case_text', q.case_text, 'options', q.options, 'correct', k.correct) WHERE id = _id;
  UPDATE questions SET stem = coalesce(c.proposed_stem, stem), case_text = coalesce(c.proposed_case_text, case_text),
    options = coalesce(c.proposed_options, options), needs_review = false, review_reason = null WHERE id = c.question_id;
  IF c.proposed_correct IS NOT NULL AND cardinality(c.proposed_correct) > 0 THEN
    INSERT INTO question_keys (question_id, correct) VALUES (c.question_id, c.proposed_correct)
    ON CONFLICT (question_id) DO UPDATE SET correct = excluded.correct;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.apply_question_correction(uuid, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.apply_question_correction(uuid, boolean) TO authenticated;