alter table public.postes_pieges
  add column if not exists adresse text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists code_postal text;
