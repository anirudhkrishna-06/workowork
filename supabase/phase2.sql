create table if not exists public.ai_analysis (
  id uuid primary key default gen_random_uuid(),
  log_id uuid not null unique references public.daily_logs(id) on delete cascade,
  professional_summary text,
  skills text[] not null default '{}',
  weaknesses text[] not null default '{}',
  suggestions text[] not null default '{}',
  resume_bullet text,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed')),
  created_at timestamptz not null default now()
);

alter table public.ai_analysis enable row level security;

create policy "Users can read own AI analysis"
  on public.ai_analysis for select
  using (
    exists (
      select 1
      from public.daily_logs
      where daily_logs.id = ai_analysis.log_id
        and daily_logs.user_id = auth.uid()
    )
  );

create policy "Users can insert own AI analysis"
  on public.ai_analysis for insert
  with check (
    exists (
      select 1
      from public.daily_logs
      where daily_logs.id = ai_analysis.log_id
        and daily_logs.user_id = auth.uid()
    )
  );

create policy "Users can update own AI analysis"
  on public.ai_analysis for update
  using (
    exists (
      select 1
      from public.daily_logs
      where daily_logs.id = ai_analysis.log_id
        and daily_logs.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.daily_logs
      where daily_logs.id = ai_analysis.log_id
        and daily_logs.user_id = auth.uid()
    )
  );

create index if not exists ai_analysis_log_id_idx
  on public.ai_analysis (log_id);

create index if not exists ai_analysis_status_created_idx
  on public.ai_analysis (status, created_at desc);
