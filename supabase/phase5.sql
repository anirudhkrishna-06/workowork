alter table public.profiles
  add column if not exists internship_start_date date,
  add column if not exists internship_end_date date,
  add column if not exists department text,
  add column if not exists reporting_manager text;

alter table public.weekly_reflections
  add column if not exists tasks_accomplishments text[] not null default '{}',
  add column if not exists tools_technologies text[] not null default '{}',
  add column if not exists challenges_blockers text[] not null default '{}',
  add column if not exists goals_next_week text[] not null default '{}',
  add column if not exists day_summaries jsonb not null default '[]'::jsonb;

alter table public.daily_logs
  drop constraint if exists daily_logs_productivity_check,
  drop constraint if exists daily_logs_confidence_check,
  drop constraint if exists daily_logs_stress_check;

update public.daily_logs
set
  productivity = least(5, greatest(1, ceiling(productivity::numeric / 2)::integer)),
  confidence = least(5, greatest(1, ceiling(confidence::numeric / 2)::integer)),
  stress = least(5, greatest(1, ceiling(stress::numeric / 2)::integer))
where productivity not between 1 and 5
   or confidence not between 1 and 5
   or stress not between 1 and 5;

alter table public.daily_logs
  add constraint daily_logs_productivity_check check (productivity between 1 and 5),
  add constraint daily_logs_confidence_check check (confidence between 1 and 5),
  add constraint daily_logs_stress_check check (stress between 1 and 5);

create table if not exists public.growth_activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  activity_title text not null,
  category text not null,
  completed_at timestamptz not null default now()
);

alter table public.growth_activity_logs enable row level security;

create policy "Users can read own growth activity logs"
  on public.growth_activity_logs for select
  using (auth.uid() = user_id);

create policy "Users can insert own growth activity logs"
  on public.growth_activity_logs for insert
  with check (auth.uid() = user_id);

create index if not exists growth_activity_logs_user_completed_idx
  on public.growth_activity_logs (user_id, completed_at desc);
