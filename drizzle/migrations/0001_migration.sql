
revoke select on public.profiles from authenticated;
grant select (id, display_name, avatar, pet, bubble, xp, coins, streak, last_active_date, sound_on, onboarded, created_at) on public.profiles to authenticated;
create or replace function public.creator_ids() returns setof uuid language sql stable security definer set search_path = public as $$
  select user_id from user_roles where role = 'admin'
$$;
create or replace function public.my_course_counts() returns table(course_id uuid, n bigint) language sql stable security definer set search_path = public as $$
  select course_id, count(*) from questions where course_id is not null group by course_id
$$;
