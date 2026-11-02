create or replace function public.exam_duration_seconds() returns integer language sql immutable as $$ select 3600 $$;
grant execute on function public.exam_duration_seconds() to authenticated, service_role;
create or replace function public.start_attempt(_exam uuid) returns uuid language plpgsql security definer set search_path = public as $$
declare s record; aid uuid; open_id uuid;
begin
 if auth.uid() is null then raise exception 'auth required'; end if;
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text || _exam::text));
 select id into open_id from attempts where user_id=auth.uid() and exam_id=_exam and submitted_at is null order by started_at desc limit 1;
 if open_id is not null then return open_id; end if;
 select * into s from public.exam_status(_exam);
 if not s.unlimited and (s.hearts_left<=0 or s.locked_until>now()) then raise exception 'EXAM_LOCKED'; end if;
 insert into attempts(user_id,exam_id) values(auth.uid(),_exam) returning id into aid;
 return aid;
end $$;
create or replace function public.save_exam_answers(_attempt uuid, _answers jsonb) returns void language plpgsql security definer set search_path=public as $$
declare a record;
begin
 select * into a from attempts where id=_attempt and user_id=auth.uid() for update;
 if not found then raise exception 'not found'; end if;
 if a.submitted_at is not null or now()>=a.started_at+make_interval(secs=>public.exam_duration_seconds()) then raise exception 'EXAM_EXPIRED'; end if;
 if jsonb_typeof(_answers)<>'object' then raise exception 'invalid answers'; end if;
 update attempts set answers=_answers where id=_attempt;
end $$;
grant execute on function public.save_exam_answers(uuid,jsonb) to authenticated;
create or replace function public.submit_attempt(_attempt uuid,_answers jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare a record; q record; tot int:=0; c int:=0; w int:=0; u int:=0; sel text[]; ok boolean; dur int; num int; sc numeric; effective jsonb;
begin
 if auth.uid() is null then raise exception 'auth required'; end if;
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
 select * into a from attempts where id=_attempt and user_id=auth.uid() for update;
 if not found then raise exception 'not found'; end if;
 if a.submitted_at is not null then return jsonb_build_object('attempt_id',a.id); end if;
 effective:=case when now()>=a.started_at+make_interval(secs=>public.exam_duration_seconds()) then a.answers else _answers end;
 if jsonb_typeof(effective)<>'object' then raise exception 'invalid answers'; end if;
 for q in select id from questions where exam_id=a.exam_id loop
 tot:=tot+1;
 sel:=array(select jsonb_array_elements_text(coalesce(effective->q.id::text,'[]'::jsonb)));
 if cardinality(sel)=0 then u:=u+1; perform private.record_result(auth.uid(),q.id,false);
 else ok:=private.is_correct(q.id,sel); if ok then c:=c+1; else w:=w+1; end if; perform private.record_result(auth.uid(),q.id,ok); end if;
 end loop;
 dur:=least(public.exam_duration_seconds(),greatest(0,extract(epoch from now()-a.started_at)::int));
 select count(*)+1 into num from attempts where user_id=auth.uid() and exam_id=a.exam_id and submitted_at is not null;
 sc:=case when tot=0 then 0 else round(c::numeric*20/tot,2) end;
 update attempts set submitted_at=now(),duration_sec=dur,answers=effective,total=tot,correct_count=c,wrong_count=w,unanswered_count=u,score20=sc,attempt_number=num where id=_attempt;
 if not public.is_creator() then
 insert into exam_hearts(user_id,exam_id,used) values(auth.uid(),a.exam_id,1) on conflict(user_id,exam_id) do update set used=exam_hearts.used+1,locked_until=case when exam_hearts.used+1>=2 then now()+interval '24 hours' else exam_hearts.locked_until end;
 end if;
 perform private.grant_xp(auth.uid(),20+c*2,5+c);
 return jsonb_build_object('attempt_id',_attempt);
end $$;
create table public.practice_attempts (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 question_ids uuid[] not null, answers jsonb not null default '{}'::jsonb,
 started_at timestamptz not null default now(),submitted_at timestamptz,
 total integer,correct_count integer,wrong_count integer,unanswered_count integer,score20 numeric(5,2)
);
grant select on public.practice_attempts to authenticated;
grant all on public.practice_attempts to service_role;
alter table public.practice_attempts enable row level security;
create policy "own practice" on public.practice_attempts for select to authenticated using(user_id=auth.uid());
create or replace function public.start_practice(_questions uuid[]) returns uuid language plpgsql security definer set search_path=public as $$
declare aid uuid;
begin
 if auth.uid() is null then raise exception 'auth required'; end if;
 if cardinality(_questions)=0 or cardinality(_questions)>2000 or (select count(distinct id) from questions where id=any(_questions))<>cardinality(_questions) then raise exception 'invalid questions'; end if;
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
 select id into aid from practice_attempts where user_id=auth.uid() and question_ids=_questions and submitted_at is null order by started_at desc limit 1;
 if aid is not null then return aid; end if;
 insert into practice_attempts(user_id,question_ids) values(auth.uid(),_questions) returning id into aid;
 return aid;
end $$;
create or replace function public.answer_practice(_attempt uuid,_q uuid,_sel text[]) returns jsonb language plpgsql security definer set search_path=public as $$
declare a record; k record; ok boolean;
begin
 select * into a from practice_attempts where id=_attempt and user_id=auth.uid() for update;
 if not found or a.submitted_at is not null or not(_q=any(a.question_ids)) then raise exception 'invalid attempt'; end if;
 select * into k from question_keys where question_id=_q;
 ok:=private.is_correct(_q,_sel);
 if not(a.answers ? _q::text) then perform private.record_result(auth.uid(),_q,ok); end if;
 update practice_attempts set answers=jsonb_set(answers,array[_q::text],to_jsonb(_sel),true) where id=_attempt;
 return jsonb_build_object('correct',ok,'official',k.correct,'explanation',k.explanation,'note',k.note);
end $$;
create or replace function public.finish_practice(_attempt uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare a record; q uuid; c int:=0; w int:=0; u int:=0; sel text[]; errors uuid[]:='{}';
begin
 select * into a from practice_attempts where id=_attempt and user_id=auth.uid() for update;
 if not found then raise exception 'not found'; end if;
 foreach q in array a.question_ids loop
 sel:=array(select jsonb_array_elements_text(coalesce(a.answers->q::text,'[]'::jsonb)));
 if cardinality(sel)=0 then u:=u+1; errors:=array_append(errors,q); if a.submitted_at is null then perform private.record_result(auth.uid(),q,false); end if;
 elsif private.is_correct(q,sel) then c:=c+1; else w:=w+1; errors:=array_append(errors,q); end if;
 end loop;
 if a.submitted_at is null then update practice_attempts set submitted_at=now(),total=cardinality(a.question_ids),correct_count=c,wrong_count=w,unanswered_count=u,score20=round(c::numeric*20/cardinality(a.question_ids),2) where id=_attempt; end if;
 return jsonb_build_object('id',a.id,'total',cardinality(a.question_ids),'correct',c,'wrong',w,'unanswered',u,'score20',round(c::numeric*20/cardinality(a.question_ids),2),'errors',errors);
end $$;
grant execute on function public.start_practice(uuid[]),public.answer_practice(uuid,uuid,text[]),public.finish_practice(uuid) to authenticated;