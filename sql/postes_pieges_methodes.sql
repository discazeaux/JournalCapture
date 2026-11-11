alter table public.postes_pieges
  add column if not exists methodes_piegeage jsonb not null default '[]'::jsonb;

update public.postes_pieges as poste
set methodes_piegeage = poste.methodes_piegeage || coalesce((
  select jsonb_agg(standard.methode)
  from jsonb_array_elements('[
    {"nom":"DPR","defaut":false},
    {"nom":"Piège","defaut":false},
    {"nom":"Raquette électrique","defaut":false},
    {"nom":"Harpe","defaut":false}
  ]'::jsonb) as standard(methode)
  where not exists (
    select 1
    from jsonb_array_elements(poste.methodes_piegeage) as existante(methode)
    where existante.methode->>'nom' = standard.methode->>'nom'
  )
), '[]'::jsonb);

update public.postes_pieges as poste
set methodes_piegeage = (
  select jsonb_agg(
    jsonb_set(
      methode,
      '{defaut}',
      to_jsonb(ordinalite = coalesce(
        (
          select min(existante.ordinalite)
          from jsonb_array_elements(poste.methodes_piegeage) with ordinality as existante(methode, ordinalite)
          where existante.methode->>'defaut' = 'true'
        ),
        (
          select min(existante.ordinalite)
          from jsonb_array_elements(poste.methodes_piegeage) with ordinality as existante(methode, ordinalite)
          where existante.methode->>'nom' = 'Raquette électrique'
        )
      )),
      true
    ) order by ordinalite
  )
  from jsonb_array_elements(poste.methodes_piegeage) with ordinality as elements(methode, ordinalite)
);
