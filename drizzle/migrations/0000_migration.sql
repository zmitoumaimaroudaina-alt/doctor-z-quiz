
create type public.app_role as enum ('admin','user');
create schema if not exists private;
grant usage on schema private to authenticated, service_role;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  avatar jsonb not null default '{}'::jsonb,
  pet text,
  bubble text check (char_length(bubble) <= 60),
  xp int not null default 0,
  coins int not null default 0,
  streak int not null default 0,
  last_active_date date,
  sound_on boolean not null default true,
  onboarded boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique(user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;
create or replace function public.is_creator() returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(auth.uid(), 'admin')
$$;

create policy "read own roles" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.is_creator());
create policy "profiles readable by signed in" on public.profiles for select to authenticated using (true);
create policy "update own profile" on public.profiles for update to authenticated using (id = auth.uid() or public.is_creator());

create or replace function public.protect_profile_cols() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_creator() and current_user = 'authenticated' then
    new.xp := old.xp; new.coins := old.coins; new.streak := old.streak; new.last_active_date := old.last_active_date; new.email := old.email;
  end if;
  return new;
end $$;
create trigger trg_protect_profile before update on public.profiles for each row execute function public.protect_profile_cols();

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, email) values (new.id, new.email);
  insert into public.user_roles(user_id, role) values (new.id, 'user');
  if lower(new.email) = 'doctorzmit@gmail.com' then
    insert into public.user_roles(user_id, role) values (new.id, 'admin');
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.subjects (id serial primary key, slug text unique not null, name text not null, name_ar text, emoji text, sort int not null);
create table public.courses (id uuid primary key default gen_random_uuid(), subject_id int not null references public.subjects(id), title text not null, sort int not null, source_file text not null, unique(subject_id, title, source_file));
create table public.exams (id uuid primary key default gen_random_uuid(), title text not null, unit text, year int not null, source_file text not null, sort int not null default 0, unique(title, year, source_file));
create table public.exam_subjects (exam_id uuid references public.exams(id) on delete cascade, subject_id int references public.subjects(id), primary key(exam_id, subject_id));
create table public.questions (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid references public.exams(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade,
  subject_id int references public.subjects(id),
  pos int not null,
  case_text text,
  stem text not null,
  options jsonb not null,
  source_file text not null,
  source_page int,
  source_year text,
  needs_review boolean not null default false,
  review_reason text,
  created_at timestamptz not null default now(),
  check ((exam_id is null) <> (course_id is null))
);
create index on public.questions(exam_id, pos);
create index on public.questions(course_id, pos);
create table public.question_keys (
  question_id uuid primary key references public.questions(id) on delete cascade,
  correct text[] not null default '{}',
  explanation text,
  note text
);
grant select, insert, update, delete on public.subjects, public.courses, public.exams, public.exam_subjects, public.questions, public.question_keys to authenticated;
grant all on public.subjects, public.courses, public.exams, public.exam_subjects, public.questions, public.question_keys to service_role;
grant usage on sequence public.subjects_id_seq to authenticated, service_role;
alter table public.subjects enable row level security;
alter table public.courses enable row level security;
alter table public.exams enable row level security;
alter table public.exam_subjects enable row level security;
alter table public.questions enable row level security;
alter table public.question_keys enable row level security;
create policy "read" on public.subjects for select to authenticated using (true);
create policy "read" on public.courses for select to authenticated using (true);
create policy "read" on public.exams for select to authenticated using (true);
create policy "read" on public.exam_subjects for select to authenticated using (true);
create policy "read" on public.questions for select to authenticated using (true);
create policy "creator keys" on public.question_keys for select to authenticated using (public.is_creator());
create policy "creator write" on public.subjects for all to authenticated using (public.is_creator()) with check (public.is_creator());
create policy "creator write" on public.courses for all to authenticated using (public.is_creator()) with check (public.is_creator());
create policy "creator write" on public.exams for all to authenticated using (public.is_creator()) with check (public.is_creator());
create policy "creator write" on public.exam_subjects for all to authenticated using (public.is_creator()) with check (public.is_creator());
create policy "creator write" on public.questions for all to authenticated using (public.is_creator()) with check (public.is_creator());
create policy "creator write keys" on public.question_keys for all to authenticated using (public.is_creator()) with check (public.is_creator());

insert into public.subjects(slug,name,name_ar,emoji,sort) values
('biochimie','Biochimie','الكيمياء الحيوية','🧪',1),
('physiopathologie','Physiopathologie','الفيزيولوجيا المرضية','🫀',2),
('semiologie','Sémiologie','علم الأعراض','🩺',3),
('psychologie','Psychologie Médicale','علم النفس الطبي','🧠',4),
('radiologie','Radiologie','الأشعة','🩻',5),
('physiologie','Physiologie','الفيزيولوجيا','⚡',6),
('immunologie','Immunologie','المناعة','🛡️',7),
('anapath','Anatomopathologie (Anapath)','التشريح المرضي','🔬',8);

create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  exam_id uuid references public.exams(id) on delete cascade,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  duration_sec int,
  answers jsonb not null default '{}'::jsonb,
  total int, correct_count int, wrong_count int, unanswered_count int,
  score20 numeric(5,2),
  attempt_number int
);
create index on public.attempts(exam_id, user_id);
grant select on public.attempts to authenticated;
grant all on public.attempts to service_role;
alter table public.attempts enable row level security;
create policy "own attempts" on public.attempts for select to authenticated using (user_id = auth.uid() or public.is_creator());

create table public.exam_hearts (
  user_id uuid not null references public.profiles(id) on delete cascade,
  exam_id uuid not null references public.exams(id) on delete cascade,
  used int not null default 0,
  locked_until timestamptz,
  primary key(user_id, exam_id)
);
grant select, update, delete on public.exam_hearts to authenticated;
grant all on public.exam_hearts to service_role;
alter table public.exam_hearts enable row level security;
create policy "own hearts" on public.exam_hearts for select to authenticated using (user_id = auth.uid() or public.is_creator());
create policy "creator manage hearts" on public.exam_hearts for all to authenticated using (public.is_creator()) with check (public.is_creator());

create table public.question_mistakes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  wrong_count int not null default 1,
  first_wrong_at timestamptz not null default now(),
  last_wrong_at timestamptz not null default now(),
  corrected_at timestamptz,
  primary key(user_id, question_id)
);
grant select on public.question_mistakes to authenticated;
grant all on public.question_mistakes to service_role;
alter table public.question_mistakes enable row level security;
create policy "own mistakes" on public.question_mistakes for select to authenticated using (user_id = auth.uid());

create table public.tomatoes (
  id uuid primary key default gen_random_uuid(),
  thrower_id uuid not null references public.profiles(id) on delete cascade,
  target_id uuid not null references public.profiles(id) on delete cascade,
  exam_id uuid not null references public.exams(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours'
);
grant select on public.tomatoes to authenticated;
grant all on public.tomatoes to service_role;
alter table public.tomatoes enable row level security;
create policy "read tomatoes" on public.tomatoes for select to authenticated using (true);

create table public.mission_claims (
  user_id uuid not null references public.profiles(id) on delete cascade,
  mission_key text not null,
  period_key text not null,
  claimed_at timestamptz not null default now(),
  primary key(user_id, mission_key, period_key)
);
grant select on public.mission_claims to authenticated;
grant all on public.mission_claims to service_role;
alter table public.mission_claims enable row level security;
create policy "own claims" on public.mission_claims for select to authenticated using (user_id = auth.uid());

alter publication supabase_realtime add table public.attempts;
alter publication supabase_realtime add table public.tomatoes;

create or replace function private.grant_xp(_uid uuid, _xp int, _coins int) returns void language plpgsql security definer set search_path = public as $$
declare d date := (now() at time zone 'Africa/Algiers')::date;
begin
  update profiles set xp = xp + _xp, coins = coins + _coins,
    streak = case when last_active_date = d then streak when last_active_date = d - 1 then streak + 1 else 1 end,
    last_active_date = d where id = _uid;
end $$;

create or replace function private.is_correct(_q uuid, _sel text[]) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select cardinality(correct) > 0 and array(select x from unnest(correct) x order by 1) = array(select y from unnest(_sel) y order by 1) from question_keys where question_id = _q), false)
$$;

create or replace function private.record_result(_uid uuid, _q uuid, _ok boolean) returns void language plpgsql security definer set search_path = public as $$
begin
  if _ok then
    update question_mistakes set corrected_at = coalesce(corrected_at, now()) where user_id = _uid and question_id = _q;
  else
    insert into question_mistakes(user_id, question_id) values (_uid, _q)
    on conflict (user_id, question_id) do update set wrong_count = question_mistakes.wrong_count + 1, last_wrong_at = now(), corrected_at = null;
  end if;
end $$;

create or replace function public.exam_status(_exam uuid)
returns table(hearts_left int, locked_until timestamptz, unlimited boolean)
language plpgsql security definer set search_path = public as $$
declare h record;
begin
  if public.is_creator() then return query select 999, null::timestamptz, true; return; end if;
  select * into h from exam_hearts eh where eh.user_id = auth.uid() and eh.exam_id = _exam;
  if not found then return query select 2, null::timestamptz, false; return; end if;
  if h.locked_until is not null and h.locked_until <= now() then
    update exam_hearts eh set used = 0, locked_until = null where eh.user_id = auth.uid() and eh.exam_id = _exam;
    return query select 2, null::timestamptz, false; return;
  end if;
  return query select greatest(0, 2 - h.used), h.locked_until, false;
end $$;

create or replace function public.start_attempt(_exam uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare s record; aid uuid; open_id uuid;
begin
  if auth.uid() is null then raise exception 'auth required'; end if;
  select * into s from public.exam_status(_exam);
  if not s.unlimited and (s.hearts_left <= 0 or (s.locked_until is not null and s.locked_until > now())) then
    raise exception 'EXAM_LOCKED';
  end if;
  select id into open_id from attempts where user_id = auth.uid() and exam_id = _exam and submitted_at is null and started_at > now() - interval '31 minutes' order by started_at desc limit 1;
  if open_id is not null then return open_id; end if;
  insert into attempts(user_id, exam_id) values (auth.uid(), _exam) returning id into aid;
  return aid;
end $$;

create or replace function public.check_answer(_q uuid, _sel text[], _record boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare ok boolean; k record;
begin
  if auth.uid() is null then raise exception 'auth required'; end if;
  ok := private.is_correct(_q, _sel);
  if not _record then return jsonb_build_object('correct', ok); end if;
  perform private.record_result(auth.uid(), _q, ok);
  select * into k from question_keys where question_id = _q;
  return jsonb_build_object('correct', ok, 'official', k.correct, 'explanation', k.explanation, 'note', k.note);
end $$;

create or replace function public.submit_attempt(_attempt uuid, _answers jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a record; q record; tot int := 0; c int := 0; w int := 0; u int := 0; sel text[]; ok boolean; dur int; num int; sc numeric;
begin
  select * into a from attempts where id = _attempt and user_id = auth.uid();
  if not found then raise exception 'not found'; end if;
  if a.submitted_at is not null then return jsonb_build_object('attempt_id', a.id); end if;
  for q in select id from questions where exam_id = a.exam_id loop
    tot := tot + 1;
    sel := array(select jsonb_array_elements_text(coalesce(_answers -> q.id::text, '[]'::jsonb)));
    if cardinality(sel) = 0 then u := u + 1; perform private.record_result(auth.uid(), q.id, false);
    else ok := private.is_correct(q.id, sel); if ok then c := c + 1; else w := w + 1; end if; perform private.record_result(auth.uid(), q.id, ok);
    end if;
  end loop;
  dur := least(1800, greatest(0, extract(epoch from now() - a.started_at)::int));
  select count(*) + 1 into num from attempts where user_id = auth.uid() and exam_id = a.exam_id and submitted_at is not null;
  sc := case when tot = 0 then 0 else round(c::numeric * 20 / tot, 2) end;
  update attempts set submitted_at = now(), duration_sec = dur, answers = _answers, total = tot, correct_count = c, wrong_count = w, unanswered_count = u, score20 = sc, attempt_number = num where id = _attempt;
  if not public.is_creator() then
    insert into exam_hearts(user_id, exam_id, used) values (auth.uid(), a.exam_id, 1)
    on conflict (user_id, exam_id) do update set used = exam_hearts.used + 1,
      locked_until = case when exam_hearts.used + 1 >= 2 then now() + interval '24 hours' else exam_hearts.locked_until end;
  end if;
  perform private.grant_xp(auth.uid(), 20 + c * 2, 5 + c);
  return jsonb_build_object('attempt_id', _attempt);
end $$;

create or replace function public.attempt_review(_attempt uuid)
returns table(question_id uuid, pos int, case_text text, stem text, options jsonb, selected jsonb, official text[], explanation text, note text, source_file text, source_page int, ok boolean)
language sql stable security definer set search_path = public as $$
  select q.id, q.pos, q.case_text, q.stem, q.options, coalesce(a.answers -> q.id::text, '[]'::jsonb), k.correct, k.explanation, k.note, q.source_file, q.source_page,
    private.is_correct(q.id, array(select jsonb_array_elements_text(coalesce(a.answers -> q.id::text, '[]'::jsonb))))
  from attempts a join questions q on q.exam_id = a.exam_id left join question_keys k on k.question_id = q.id
  where a.id = _attempt and a.submitted_at is not null and (a.user_id = auth.uid() or public.is_creator())
  order by q.pos
$$;

create or replace function public.leaderboard(_exam uuid)
returns table(user_id uuid, display_name text, avatar jsonb, pet text, bubble text, best_score numeric, best_time int, rnk bigint, tomato_until timestamptz)
language sql stable security definer set search_path = public as $$
  with best as (
    select distinct on (a.user_id) a.user_id, a.score20, a.duration_sec
    from attempts a where a.exam_id = _exam and a.submitted_at is not null
    order by a.user_id, a.score20 desc, a.duration_sec asc
  )
  select b.user_id, p.display_name, p.avatar, p.pet, p.bubble, b.score20, b.duration_sec,
    rank() over (order by b.score20 desc, b.duration_sec asc),
    (select max(t.expires_at) from tomatoes t where t.target_id = b.user_id and t.expires_at > now())
  from best b join profiles p on p.id = b.user_id
  order by 8
$$;

create or replace function public.throw_tomato(_exam uuid, _target uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r bigint; lastt timestamptz; creator boolean := public.is_creator();
begin
  if _target = auth.uid() then raise exception 'NO_SELF'; end if;
  if not exists (select 1 from attempts where exam_id = _exam and user_id = _target and submitted_at is not null) then raise exception 'TARGET_NOT_IN_BOARD'; end if;
  if not creator then
    select l.rnk into r from public.leaderboard(_exam) l where l.user_id = auth.uid();
    if r is null or r > 5 then raise exception 'TOP5_ONLY'; end if;
    select max(created_at) into lastt from tomatoes where thrower_id = auth.uid();
    if lastt is not null and lastt > now() - interval '10 minutes' then raise exception 'COOLDOWN'; end if;
    if exists (select 1 from tomatoes where thrower_id = auth.uid() and target_id = _target and created_at > now() - interval '24 hours') then raise exception 'ALREADY_HIT'; end if;
  end if;
  insert into tomatoes(thrower_id, target_id, exam_id) values (auth.uid(), _target, _exam);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.claim_mission(_key text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare d date := (now() at time zone 'Africa/Algiers')::date; wk text := to_char((now() at time zone 'Africa/Algiers')::date, 'IYYY-IW'); period text; done boolean; cnt int; xp int; coins int;
begin
  if _key = 'daily_exam' then period := d::text; select count(*) into cnt from attempts where user_id = auth.uid() and submitted_at::date = d; done := cnt >= 1; xp := 30; coins := 10;
  elsif _key = 'daily_review' then period := d::text; select count(*) into cnt from question_mistakes where user_id = auth.uid() and corrected_at::date = d; done := cnt >= 3; xp := 40; coins := 15;
  elsif _key = 'weekly_exams' then period := wk; select count(*) into cnt from attempts where user_id = auth.uid() and submitted_at >= date_trunc('week', now()); done := cnt >= 5; xp := 150; coins := 60;
  elsif _key = 'weekly_streak' then period := wk; select streak >= 5 into done from profiles where id = auth.uid(); xp := 120; coins := 50;
  else raise exception 'unknown'; end if;
  if not coalesce(done,false) and not public.is_creator() then raise exception 'NOT_DONE'; end if;
  insert into mission_claims(user_id, mission_key, period_key) values (auth.uid(), _key, period);
  perform private.grant_xp(auth.uid(), xp, coins);
  return jsonb_build_object('xp', xp, 'coins', coins);
end $$;
