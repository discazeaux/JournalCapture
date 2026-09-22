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
