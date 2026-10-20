-- Quiniela Worlds 2026 · esquema completo para Supabase
-- Ejecútalo entero en el editor SQL de Supabase. Se puede volver a ejecutar
-- sin perder datos (crea solo lo que falta y reemplaza funciones y vistas).

-- ───────────────────────── Tablas ─────────────────────────

create table if not exists config (
  id int primary key default 1 check (id = 1),
  group_code text not null,
  admin_code text not null
);
insert into config (id, group_code, admin_code)
values (1, 'worlds2026', 'admin2026')
on conflict (id) do nothing;

create table if not exists teams (
  id bigint generated always as identity primary key,
  name text not null,
  short text not null,
  region text not null default '',
  logo_url text not null default ''
);

create table if not exists players (
  id bigint generated always as identity primary key,
  name text not null unique,
  emoji text not null default '',
  color text not null default ''
);

create table if not exists matches (
  id bigint generated always as identity primary key,
  stage text not null check (stage in ('swiss', 'qf', 'sf', 'final')),
  round int check ((stage = 'swiss' and round between 1 and 5) or (stage <> 'swiss' and round is null)),
  team_a bigint not null references teams (id),
  team_b bigint not null references teams (id),
  best_of int not null check (best_of in (1, 3, 5)),
  start_time timestamptz not null,
  locked boolean not null default false,
  score_a int,
  score_b int,
  check (team_a <> team_b),
  check ((score_a is null) = (score_b is null))
);

create table if not exists predictions (
  player_id bigint not null references players (id) on delete cascade,
  match_id bigint not null references matches (id) on delete cascade,
  score_a int not null,
  score_b int not null,
  updated_at timestamptz not null default now(),
  primary key (player_id, match_id)
);

-- ─────────────────── Lectura pública (RLS) ───────────────────
-- Todo se puede leer menos la configuración (los códigos).
-- Las escrituras solo pasan por las funciones RPC de abajo.

alter table config enable row level security;
alter table teams enable row level security;
alter table players enable row level security;
alter table matches enable row level security;
alter table predictions enable row level security;

drop policy if exists "lectura" on teams;
drop policy if exists "lectura" on players;
drop policy if exists "lectura" on matches;
drop policy if exists "lectura" on predictions;
create policy "lectura" on teams for select using (true);
create policy "lectura" on players for select using (true);
create policy "lectura" on matches for select using (true);
create policy "lectura" on predictions for select using (true);

revoke all on config from anon, authenticated;
grant select on teams, players, matches, predictions to anon, authenticated;

-- ─────────────────────── Utilidades ───────────────────────

-- ¿Es un marcador final válido para ese formato? (Bo1 se guarda como 1-0 / 0-1)
create or replace function valid_score(p_best_of int, p_a int, p_b int)
returns boolean language sql immutable as $$
  select p_a is not null and p_b is not null
     and greatest(p_a, p_b) = (p_best_of + 1) / 2
     and least(p_a, p_b) >= 0
     and least(p_a, p_b) < (p_best_of + 1) / 2;
$$;

create or replace function assert_group(p_code text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from config where group_code = p_code) then
    raise exception 'Código de grupo incorrecto';
  end if;
end $$;

create or replace function assert_admin(p_code text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from config where admin_code = p_code) then
    raise exception 'Código de admin incorrecto';
  end if;
end $$;

-- ───────────────────── RPC de jugadores ─────────────────────

create or replace function check_group_code(p_code text)
returns boolean language sql security definer set search_path = public as $$
  select exists (select 1 from config where group_code = p_code);
$$;

create or replace function predict(p_code text, p_player bigint, p_match bigint, p_score_a int, p_score_b int)
returns void language plpgsql security definer set search_path = public as $$
declare m matches;
begin
  perform assert_group(p_code);
  select * into m from matches where id = p_match;
  if not found then raise exception 'Ese partido no existe'; end if;
  if m.locked or now() >= m.start_time or m.score_a is not null then
    raise exception 'El partido ya está cerrado';
  end if;
  if not valid_score(m.best_of, p_score_a, p_score_b) then
    raise exception 'Marcador no válido para Bo%', m.best_of;
  end if;
  insert into predictions (player_id, match_id, score_a, score_b, updated_at)
  values (p_player, p_match, p_score_a, p_score_b, now())
  on conflict (player_id, match_id)
  do update set score_a = excluded.score_a, score_b = excluded.score_b, updated_at = now();
end $$;

-- ─────────────────────── RPC de admin ───────────────────────

create or replace function check_admin_code(p_code text)
returns boolean language sql security definer set search_path = public as $$
  select exists (select 1 from config where admin_code = p_code);
$$;

create or replace function admin_save_team(p_code text, p_id bigint, p_name text, p_short text, p_region text, p_logo_url text)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  perform assert_admin(p_code);
  if p_id is null then
    insert into teams (name, short, region, logo_url)
    values (p_name, p_short, coalesce(p_region, ''), coalesce(p_logo_url, ''))
    returning id into v_id;
  else
    update teams set name = p_name, short = p_short, region = coalesce(p_region, ''), logo_url = coalesce(p_logo_url, '')
    where id = p_id returning id into v_id;
  end if;
  return v_id;
end $$;

create or replace function admin_delete_team(p_code text, p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform assert_admin(p_code);
  delete from teams where id = p_id;
exception when foreign_key_violation then
  raise exception 'Ese equipo tiene partidos; bórralos antes';
end $$;

create or replace function admin_save_player(p_code text, p_id bigint, p_name text, p_emoji text, p_color text)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  perform assert_admin(p_code);
  if p_id is null then
    insert into players (name, emoji, color) values (p_name, coalesce(p_emoji, ''), coalesce(p_color, ''))
    returning id into v_id;
  else
    update players set name = p_name, emoji = coalesce(p_emoji, ''), color = coalesce(p_color, '')
    where id = p_id returning id into v_id;
  end if;
  return v_id;
end $$;

create or replace function admin_delete_player(p_code text, p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform assert_admin(p_code);
  delete from players where id = p_id;
end $$;

-- p_start_local es la hora de Madrid, p. ej. '2026-10-23 18:00'
create or replace function admin_save_match(
  p_code text, p_id bigint, p_stage text, p_round int, p_team_a bigint, p_team_b bigint,
  p_best_of int, p_start_local text
) returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint; v_start timestamptz;
begin
  perform assert_admin(p_code);
  v_start := p_start_local::timestamp at time zone 'Europe/Madrid';
  if p_stage <> 'swiss' then p_round := null; end if;
  if p_id is null then
    insert into matches (stage, round, team_a, team_b, best_of, start_time)
    values (p_stage, p_round, p_team_a, p_team_b, p_best_of, v_start)
    returning id into v_id;
  else
    update matches set stage = p_stage, round = p_round, team_a = p_team_a, team_b = p_team_b,
      best_of = p_best_of, start_time = v_start
    where id = p_id returning id into v_id;
    -- Si cambia el formato, las predicciones que ya no encajan dejan de valer
    delete from predictions pr using matches m
    where pr.match_id = m.id and m.id = v_id and not valid_score(m.best_of, pr.score_a, pr.score_b);
  end if;
  return v_id;
end $$;

create or replace function admin_delete_match(p_code text, p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform assert_admin(p_code);
  delete from matches where id = p_id;
end $$;

-- p_score_a / p_score_b a null borran el resultado
create or replace function admin_set_result(p_code text, p_id bigint, p_score_a int, p_score_b int)
returns void language plpgsql security definer set search_path = public as $$
declare m matches;
begin
  perform assert_admin(p_code);
  select * into m from matches where id = p_id;
  if not found then raise exception 'Ese partido no existe'; end if;
  if p_score_a is not null and not valid_score(m.best_of, p_score_a, p_score_b) then
    raise exception 'Marcador no válido para Bo%', m.best_of;
  end if;
  update matches set score_a = p_score_a, score_b = case when p_score_a is null then null else p_score_b end
  where id = p_id;
end $$;

create or replace function admin_set_locked(p_code text, p_id bigint, p_locked boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform assert_admin(p_code);
  update matches set locked = p_locked where id = p_id;
end $$;

create or replace function admin_set_codes(p_code text, p_group_code text, p_admin_code text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform assert_admin(p_code);
  if coalesce(trim(p_group_code), '') = '' or coalesce(trim(p_admin_code), '') = '' then
    raise exception 'Los códigos no pueden estar vacíos';
  end if;
  update config set group_code = trim(p_group_code), admin_code = trim(p_admin_code) where id = 1;
end $$;

-- ───────────────────── Puntuación (vistas) ─────────────────────
-- Nada se guarda a mano: corregir un resultado recalcula todo.

create or replace view prediction_scores with (security_invoker = true) as
select
  p.player_id,
  p.match_id,
  (sign(p.score_a - p.score_b) = sign(m.score_a - m.score_b)) as winner_ok,
  (m.best_of > 1 and p.score_a = m.score_a and p.score_b = m.score_b) as exact_ok,
  (case when sign(p.score_a - p.score_b) = sign(m.score_a - m.score_b) then 1 else 0 end
   + case when m.best_of > 1 and p.score_a = m.score_a and p.score_b = m.score_b then 1 else 0 end) as points
from predictions p
join matches m on m.id = p.match_id
where m.score_a is not null;

create or replace view leaderboard with (security_invoker = true) as
select
  pl.id as player_id,
  pl.name,
  coalesce(sum(s.points), 0)::int as points,
  count(*) filter (where s.exact_ok)::int as exacts,
  count(*) filter (where s.winner_ok)::int as winners
from players pl
left join prediction_scores s on s.player_id = pl.id
group by pl.id, pl.name
order by points desc, exacts desc, winners desc, name asc;

grant select on prediction_scores, leaderboard to anon, authenticated;

-- ─────────────────────── Permisos RPC ───────────────────────

revoke execute on function assert_group(text), assert_admin(text) from public, anon, authenticated;
grant execute on function
  valid_score(int, int, int),
  check_group_code(text),
  predict(text, bigint, bigint, int, int),
  check_admin_code(text),
  admin_save_team(text, bigint, text, text, text, text),
  admin_delete_team(text, bigint),
  admin_save_player(text, bigint, text, text, text),
  admin_delete_player(text, bigint),
  admin_save_match(text, bigint, text, int, bigint, bigint, int, text),
  admin_delete_match(text, bigint),
  admin_set_result(text, bigint, int, int),
  admin_set_locked(text, bigint, boolean),
  admin_set_codes(text, text, text)
to anon, authenticated;
