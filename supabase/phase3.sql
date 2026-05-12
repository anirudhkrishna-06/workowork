create table if not exists public.mentor_feedback (
  id uuid primary key default gen_random_uuid(),
  log_id uuid not null references public.daily_logs(id) on delete cascade,
  feedback text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.weekly_reflections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  week_number integer not null,
  log_count integer not null,
  period_start timestamptz,
  period_end timestamptz,
  weekly_summary text,
  improvements text[] not null default '{}',
  recurring_weaknesses text[] not null default '{}',
  suggestions text[] not null default '{}',
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed')),
  created_at timestamptz not null default now(),
  unique (user_id, week_number)
);

alter table public.mentor_feedback enable row level security;
alter table public.weekly_reflections enable row level security;

create policy "Users can read own mentor feedback"
  on public.mentor_feedback for select
  using (
    exists (
      select 1
      from public.daily_logs
      where daily_logs.id = mentor_feedback.log_id
        and daily_logs.user_id = auth.uid()
    )
  );

create policy "Users can insert own mentor feedback"
  on public.mentor_feedback for insert
  with check (
    exists (
      select 1
      from public.daily_logs
      where daily_logs.id = mentor_feedback.log_id
        and daily_logs.user_id = auth.uid()
    )
  );

create policy "Users can update own mentor feedback"
  on public.mentor_feedback for update
  using (
    exists (
      select 1
      from public.daily_logs
      where daily_logs.id = mentor_feedback.log_id
        and daily_logs.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.daily_logs
      where daily_logs.id = mentor_feedback.log_id
        and daily_logs.user_id = auth.uid()
    )
  );

create policy "Users can delete own mentor feedback"
  on public.mentor_feedback for delete
  using (
    exists (
      select 1
      from public.daily_logs
      where daily_logs.id = mentor_feedback.log_id
        and daily_logs.user_id = auth.uid()
    )
  );

create policy "Users can read own weekly reflections"
  on public.weekly_reflections for select
  using (auth.uid() = user_id);

create policy "Users can insert own weekly reflections"
  on public.weekly_reflections for insert
  with check (auth.uid() = user_id);

create policy "Users can update own weekly reflections"
  on public.weekly_reflections for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists mentor_feedback_log_created_idx
  on public.mentor_feedback (log_id, created_at desc);

create index if not exists weekly_reflections_user_week_idx
  on public.weekly_reflections (user_id, week_number desc);
