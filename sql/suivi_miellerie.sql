create table if not exists public.miellerie_recoltes (
  id uuid primary key default gen_random_uuid(),
  groupe_id uuid not null default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  annee integer not null check (annee between 1900 and 2100),
  periode text check (periode is null or length(trim(periode)) > 0),
  date_recolte date,
  date_mise_en_pot date,
  commentaire text not null default '',
  gout text not null default '',
  appellation text not null default '',
  nom_ruche text not null default '',
  taille_pot_g integer not null check (taille_pot_g > 0),
  quantite integer not null check (quantite > 0),
  reste integer not null check (reste between 0 and quantite),
  created_at timestamptz not null default now(),
  check (date_mise_en_pot is null or date_recolte is null or date_mise_en_pot >= date_recolte)
);

alter table public.miellerie_recoltes
  add column if not exists groupe_id uuid;

alter table public.miellerie_recoltes
  alter column groupe_id set default gen_random_uuid();

alter table public.miellerie_recoltes
  add column if not exists commentaire text not null default '',
  add column if not exists gout text not null default '',
  add column if not exists appellation text not null default '';

update public.miellerie_recoltes
set gout = commentaire
where gout = '' and commentaire <> '';

alter table public.miellerie_recoltes
  add column if not exists date_recolte date,
  add column if not exists date_mise_en_pot date,
  alter column periode drop not null;

with groupes_anciens as (
  select
    user_id,
    annee,
    periode,
    date_recolte,
    date_mise_en_pot,
    commentaire,
    gout,
    appellation,
    nom_ruche,
    gen_random_uuid() as groupe_id
  from public.miellerie_recoltes
  where groupe_id is null
  group by user_id, annee, periode, date_recolte, date_mise_en_pot,
    commentaire, gout, appellation, nom_ruche
)
update public.miellerie_recoltes as recolte
set groupe_id = groupes_anciens.groupe_id
from groupes_anciens
where recolte.groupe_id is null
  and recolte.user_id = groupes_anciens.user_id
  and recolte.annee = groupes_anciens.annee
  and recolte.periode is not distinct from groupes_anciens.periode
  and recolte.date_recolte is not distinct from groupes_anciens.date_recolte
  and recolte.date_mise_en_pot is not distinct from groupes_anciens.date_mise_en_pot
  and recolte.commentaire is not distinct from groupes_anciens.commentaire
  and recolte.gout is not distinct from groupes_anciens.gout
  and recolte.appellation is not distinct from groupes_anciens.appellation
  and recolte.nom_ruche is not distinct from groupes_anciens.nom_ruche;

update public.miellerie_recoltes
set groupe_id = gen_random_uuid()
where groupe_id is null;

alter table public.miellerie_recoltes
  alter column groupe_id set not null;

create index if not exists miellerie_recoltes_user_groupe_idx
  on public.miellerie_recoltes (user_id, groupe_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'miellerie_recoltes_dates_coherentes'
      and conrelid = 'public.miellerie_recoltes'::regclass
  ) then
    alter table public.miellerie_recoltes
      add constraint miellerie_recoltes_dates_coherentes
      check (date_mise_en_pot is null or date_recolte is null or date_mise_en_pot >= date_recolte);
  end if;
end $$;

create index if not exists miellerie_recoltes_user_annee_idx
  on public.miellerie_recoltes (user_id, annee, periode);

create table if not exists public.miellerie_recoltes_ruchers (
  recolte_id uuid not null references public.miellerie_recoltes(id) on delete cascade,
  rucher_id uuid not null references public.ruchers(id) on delete cascade,
  primary key (recolte_id, rucher_id)
);

create table if not exists public.miellerie_tailles_pots (
  user_id uuid not null references auth.users(id) on delete cascade,
  taille_pot_g integer not null check (taille_pot_g between 1 and 50000),
  created_at timestamptz not null default now(),
  primary key (user_id, taille_pot_g)
);

create table if not exists public.miellerie_appellations (
  user_id uuid not null references auth.users(id) on delete cascade,
  appellation text not null check (length(trim(appellation)) between 1 and 80),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (user_id, appellation)
);

alter table public.miellerie_recoltes enable row level security;
alter table public.miellerie_recoltes_ruchers enable row level security;
alter table public.miellerie_tailles_pots enable row level security;
alter table public.miellerie_appellations enable row level security;

drop policy if exists "Users manage their honey appellations" on public.miellerie_appellations;
create policy "Users manage their honey appellations"
  on public.miellerie_appellations
  for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Users manage their jar sizes" on public.miellerie_tailles_pots;
create policy "Users manage their jar sizes"
  on public.miellerie_tailles_pots
  for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Users manage their honey harvests" on public.miellerie_recoltes;
create policy "Users manage their honey harvests"
  on public.miellerie_recoltes
  for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Users read their harvest apiary links" on public.miellerie_recoltes_ruchers;
create policy "Users read their harvest apiary links"
  on public.miellerie_recoltes_ruchers
  for select
  to authenticated
  using (
    exists (
      select 1 from public.miellerie_recoltes r
      where r.id = recolte_id and r.user_id = (select auth.uid())
    )
  );

drop policy if exists "Users link their harvests to their apiaries" on public.miellerie_recoltes_ruchers;
create policy "Users link their harvests to their apiaries"
  on public.miellerie_recoltes_ruchers
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.miellerie_recoltes r
      where r.id = recolte_id and r.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.ruchers ru
      where ru.id = rucher_id and ru.user_id = (select auth.uid())
    )
  );

drop policy if exists "Users unlink their harvest apiaries" on public.miellerie_recoltes_ruchers;
create policy "Users unlink their harvest apiaries"
  on public.miellerie_recoltes_ruchers
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.miellerie_recoltes r
      where r.id = recolte_id and r.user_id = (select auth.uid())
    )
  );