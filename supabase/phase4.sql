create table if not exists public.internship_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default 'Internship Report',
  introduction text,
  objectives text[] not null default '{}',
  work_completed text[] not null default '{}',
  challenges text[] not null default '{}',
  learnings text[] not null default '{}',
  growth_summary text,
  conclusion text,
  resume_bullets text[] not null default '{}',
  status text not null default 'draft'
    check (status in ('draft', 'generating', 'completed', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.internship_reports enable row level security;

create policy "Users can read own internship reports"
  on public.internship_reports for select
  using (auth.uid() = user_id);

create policy "Users can insert own internship reports"
  on public.internship_reports for insert
  with check (auth.uid() = user_id);

create policy "Users can update own internship reports"
  on public.internship_reports for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists internship_reports_user_created_idx
  on public.internship_reports (user_id, created_at desc);
