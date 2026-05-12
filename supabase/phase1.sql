create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  email text,
  company text,
  role text,
  goal text,
  duration text,
  created_at timestamptz not null default now()
);

create table if not exists public.daily_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  task text not null,
  learning text not null default '',
  challenge text not null default '',
  solution text not null default '',
  productivity integer not null check (productivity between 1 and 10),
  confidence integer not null check (confidence between 1 and 10),
  stress integer not null check (stress between 1 and 10),
  tomorrow_plan text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.ai_analysis (
  id uuid primary key default gen_random_uuid(),
  log_id uuid not null references public.daily_logs(id) on delete cascade,
  professional_summary text,
  skills text[] default '{}',
  weaknesses text[] default '{}',
  suggestions text[] default '{}',
  resume_bullet text,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed')),
  created_at timestamptz not null default now(),
  unique (log_id)
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, email)
  values (
    new.id,
    new.raw_user_meta_data->>'name',
    new.email
  )
  on conflict (id) do update
    set name = excluded.name,
        email = excluded.email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.daily_logs enable row level security;
alter table public.ai_analysis enable row level security;

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Users can read own logs"
  on public.daily_logs for select
  using (auth.uid() = user_id);

create policy "Users can insert own logs"
  on public.daily_logs for insert
  with check (auth.uid() = user_id);

create policy "Users can update own logs"
  on public.daily_logs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own logs"
  on public.daily_logs for delete
  using (auth.uid() = user_id);

create policy "Users can read own analysis"
  on public.ai_analysis for select
  using (
    exists (
      select 1 from public.daily_logs
      where daily_logs.id = ai_analysis.log_id
        and daily_logs.user_id = auth.uid()
    )
  );

create policy "Users can insert own analysis"
  on public.ai_analysis for insert
  with check (
    exists (
      select 1 from public.daily_logs
      where daily_logs.id = ai_analysis.log_id
        and daily_logs.user_id = auth.uid()
    )
  );

create policy "Users can update own analysis"
  on public.ai_analysis for update
  using (
    exists (
      select 1 from public.daily_logs
      where daily_logs.id = ai_analysis.log_id
        and daily_logs.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.daily_logs
      where daily_logs.id = ai_analysis.log_id
        and daily_logs.user_id = auth.uid()
    )
  );

create index if not exists daily_logs_user_created_idx
  on public.daily_logs (user_id, created_at desc);

create index if not exists ai_analysis_log_idx
  on public.ai_analysis (log_id);
