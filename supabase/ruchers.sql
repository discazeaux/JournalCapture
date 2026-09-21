create table if not exists public.ruchers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nom text not null check (char_length(trim(nom)) > 0),
  nombre_ruches integer not null default 0 check (nombre_ruches >= 0),
  nombre_ruchettes integer not null default 0 check (nombre_ruchettes >= 0),
  created_at timestamptz not null default now()
);

alter table public.ruchers enable row level security;

drop policy if exists "Users can view their own ruchers" on public.ruchers;
create policy "Users can view their own ruchers"
  on public.ruchers for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create their own ruchers" on public.ruchers;
create policy "Users can create their own ruchers"
  on public.ruchers for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own ruchers" on public.ruchers;
create policy "Users can update their own ruchers"
  on public.ruchers for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own ruchers" on public.ruchers;
create policy "Users can delete their own ruchers"
  on public.ruchers for delete
  using (auth.uid() = user_id);

create table if not exists public.traitements_ruchers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  rucher_id uuid not null references public.ruchers(id) on delete cascade,
  intitule text not null check (char_length(trim(intitule)) > 0),
  date_traitement date not null,
  rappel_necessaire boolean not null default false,
  date_rappel date,
  rappel_fait boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.traitements_ruchers
  add column if not exists rappel_necessaire boolean not null default false;

alter table public.traitements_ruchers
  add column if not exists date_rappel date;

alter table public.traitements_ruchers
  add column if not exists rappel_fait boolean not null default false;

alter table public.traitements_ruchers enable row level security;

drop policy if exists "Users can view their own treatments" on public.traitements_ruchers;
create policy "Users can view their own treatments"
  on public.traitements_ruchers for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create their own treatments" on public.traitements_ruchers;
create policy "Users can create their own treatments"
  on public.traitements_ruchers for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own treatments" on public.traitements_ruchers;
create policy "Users can update their own treatments"
  on public.traitements_ruchers for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own treatments" on public.traitements_ruchers;
create policy "Users can delete their own treatments"
  on public.traitements_ruchers for delete
  using (auth.uid() = user_id);