-- Los 16 equipos de la fase suiza de Worlds 2026. Ejecutar en el SQL Editor de Supabase.
-- No duplica: si ya existe un equipo con las mismas siglas, lo salta.
insert into teams (name, short, region)
select v.name, v.short, v.region
from (values
  ('Gen.G', 'GEN', 'LCK'),
  ('Hanwha Life Esports', 'HLE', 'LCK'),
  ('T1', 'T1', 'LCK'),
  ('Dplus KIA', 'DK', 'LCK'),
  ('Anyone''s Legend', 'AL', 'LPL'),
  ('Bilibili Gaming', 'BLG', 'LPL'),
  ('Top Esports', 'TES', 'LPL'),
  ('Invictus Gaming', 'IG', 'LPL'),
  ('G2 Esports', 'G2', 'LEC'),
  ('Movistar KOI', 'MKOI', 'LEC'),
  ('Karmine Corp', 'KC', 'LEC'),
  ('Team Liquid Alienware', 'TL', 'LCS'),
  ('LYON', 'LYON', 'LCS'),
  ('LØS', 'LØS', 'CBLOL'),
  ('Team Secret Whales', 'TSW', 'LCP'),
  ('CTBC Flying Oyster', 'CFO', 'LCP')
) as v(name, short, region)
where not exists (select 1 from teams t where t.short = v.short);
