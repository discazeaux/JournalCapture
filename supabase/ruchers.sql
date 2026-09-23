alter table public.ruchers
  add column if not exists etat_sante text not null default 'equilibree';

alter table public.ruchers
  add column if not exists sante_ruches jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ruchers_etat_sante_check'
      and conrelid = 'public.ruchers'::regclass
  ) then
    alter table public.ruchers
      add constraint ruchers_etat_sante_check
      check (etat_sante in ('tres_populeuse', 'populeuse', 'equilibree', 'faible', 'a_surveiller', 'critique'));
  end if;
end $$;

notify pgrst, 'reload schema';

alter table public.traitements_ruchers
  add column if not exists date_changement_lanieres date;

alter table public.traitements_ruchers
  add column if not exists date_retrait_lanieres date;

alter table public.traitements_ruchers
  add column if not exists changement_lanieres_fait boolean not null default false;

alter table public.traitements_ruchers
  add column if not exists retrait_lanieres_fait boolean not null default false;

alter table public.traitements_ruchers
  add column if not exists changement_lanieres_fait_le date;

alter table public.traitements_ruchers
  add column if not exists retrait_lanieres_fait_le date;

alter table public.traitements_ruchers enable row level security;

drop policy if exists "Users can update their own treatments" on public.traitements_ruchers;
create policy "Users can update their own treatments"
  on public.traitements_ruchers for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

update public.traitements_ruchers
set date_changement_lanieres = coalesce(date_changement_lanieres, date_rappel),
    date_retrait_lanieres = coalesce(date_retrait_lanieres, date_rappel + interval '21 days')::date
where date_rappel is not null;

notify pgrst, 'reload schema';

create table if not exists public.pertes_colonies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  rucher_id uuid not null references public.ruchers(id) on delete cascade,
  date_constat date not null,
  colonie text not null check (char_length(trim(colonie)) > 0),
  cause_probable text not null check (char_length(trim(cause_probable)) > 0),
  etat text not null check (char_length(trim(etat)) > 0),
  mesures text not null check (char_length(trim(mesures)) > 0),
  created_at timestamptz not null default now()
);

alter table public.pertes_colonies enable row level security;

drop policy if exists "Users can view their own colony losses" on public.pertes_colonies;
create policy "Users can view their own colony losses"
  on public.pertes_colonies for select using (auth.uid() = user_id);

drop policy if exists "Users can create their own colony losses" on public.pertes_colonies;
create policy "Users can create their own colony losses"
  on public.pertes_colonies for insert with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own colony losses" on public.pertes_colonies;
create policy "Users can delete their own colony losses"
  on public.pertes_colonies for delete using (auth.uid() = user_id);

notify pgrst, 'reload schema';
