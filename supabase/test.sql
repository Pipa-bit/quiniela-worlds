-- Prueba del flujo completo contra una base de datos local con schema.sql cargado.
-- Uso: psql -v ON_ERROR_STOP=1 -f supabase/test.sql   (todo se deshace al final)
begin;
set local role anon;

do $$
declare
  t1 bigint; gen bigint; g2 bigint; blg bigint;
  ana bigint; bea bigint; carlos bigint;
  m_bo1 bigint; m_bo3 bigint; m_past bigint;
  r record;
  failed boolean;
begin
  -- Códigos
  assert check_group_code('worlds2026'), 'código de grupo';
  assert not check_group_code('mal'), 'código de grupo malo';
  assert check_admin_code('admin2026'), 'código admin';

  -- Admin con código incorrecto
  failed := false;
  begin perform admin_save_team('mal', null, 'X', 'X', '', ''); exception when others then failed := true; end;
  assert failed, 'admin con código malo debe fallar';

  -- Equipos y jugadores
  t1  := admin_save_team('admin2026', null, 'T1', 'T1', 'LCK', '');
  gen := admin_save_team('admin2026', null, 'Gen.G', 'GEN', 'LCK', '');
  g2  := admin_save_team('admin2026', null, 'G2 Esports', 'G2', 'LEC', '');
  blg := admin_save_team('admin2026', null, 'Bilibili Gaming', 'BLG', 'LPL', '');
  ana := admin_save_player('admin2026', null, 'Ana', '🐉', '');
  bea := admin_save_player('admin2026', null, 'Bea', '', '');
  carlos := admin_save_player('admin2026', null, 'Carlos', '', '');

  -- Partidos (hora de Madrid)
  m_bo1  := admin_save_match('admin2026', null, 'swiss', 1, t1, gen, 1, to_char((now() + interval '1 day') at time zone 'Europe/Madrid', 'YYYY-MM-DD HH24:MI'));
  m_bo3  := admin_save_match('admin2026', null, 'swiss', 3, g2, blg, 3, to_char((now() + interval '1 day') at time zone 'Europe/Madrid', 'YYYY-MM-DD HH24:MI'));
  m_past := admin_save_match('admin2026', null, 'swiss', 1, t1, g2, 1, to_char((now() - interval '1 minute') at time zone 'Europe/Madrid', 'YYYY-MM-DD HH24:MI'));

  -- La hora introducida es de Madrid
  assert (select abs(extract(epoch from start_time - (now() + interval '1 day'))) < 60 from matches where id = m_bo1), 'hora Madrid';

  -- Predicciones de dos (tres) jugadores
  perform predict('worlds2026', ana, m_bo1, 1, 0);
  perform predict('worlds2026', bea, m_bo1, 0, 1);
  perform predict('worlds2026', carlos, m_bo1, 1, 0);
  perform predict('worlds2026', ana, m_bo3, 2, 0);
  perform predict('worlds2026', ana, m_bo3, 2, 1);   -- editar
  perform predict('worlds2026', bea, m_bo3, 2, 0);
  perform predict('worlds2026', carlos, m_bo3, 1, 2);
  assert (select score_b from predictions where player_id = ana and match_id = m_bo3) = 1, 'edición';

  -- Marcadores imposibles
  failed := false;
  begin perform predict('worlds2026', ana, m_bo1, 2, 1); exception when others then failed := true; end;
  assert failed, 'Bo1 2-1 debe fallar';
  failed := false;
  begin perform predict('worlds2026', ana, m_bo3, 2, 2); exception when others then failed := true; end;
  assert failed, 'Bo3 2-2 debe fallar';
  failed := false;
  begin perform predict('mal', ana, m_bo3, 2, 0); exception when others then failed := true; end;
  assert failed, 'código de grupo malo debe fallar';

  -- No se puede predecir tras la hora de inicio
  failed := false;
  begin perform predict('worlds2026', ana, m_past, 1, 0); exception when others then failed := true; end;
  assert failed, 'partido empezado debe estar cerrado';

  -- Bloqueo manual y desbloqueo
  perform admin_set_locked('admin2026', m_bo1, true);
  failed := false;
  begin perform predict('worlds2026', ana, m_bo1, 1, 0); exception when others then failed := true; end;
  assert failed, 'partido bloqueado';
  perform admin_set_locked('admin2026', m_bo1, false);
  perform predict('worlds2026', ana, m_bo1, 1, 0);

  -- Resultados: T1 gana el Bo1, G2 gana 2-1 el Bo3
  perform admin_set_result('admin2026', m_bo1, 1, 0);
  perform admin_set_result('admin2026', m_bo3, 2, 1);
  failed := false;
  begin perform predict('worlds2026', ana, m_bo1, 0, 1); exception when others then failed := true; end;
  assert failed, 'con resultado ya no se predice';

  -- Puntos: Ana 1 (Bo1) + 2 (exacto) = 3; Bea 0 + 1 = 1; Carlos 1 + 0 = 1
  select * into r from leaderboard where player_id = ana;
  assert r.points = 3 and r.exacts = 1 and r.winners = 2, format('Ana %s', r);
  select * into r from leaderboard where player_id = bea;
  assert r.points = 1 and r.exacts = 0 and r.winners = 1, format('Bea %s', r);
  select * into r from leaderboard where player_id = carlos;
  assert r.points = 1 and r.exacts = 0 and r.winners = 1, format('Carlos %s', r);
  -- Bo1 nunca da exacto
  assert not (select exact_ok from prediction_scores where player_id = ana and match_id = m_bo1), 'Bo1 sin exacto';
  -- Orden: Ana, luego Bea y Carlos empatados → alfabético
  assert (select array_agg(name) from leaderboard) = array['Ana', 'Bea', 'Carlos'], 'orden';

  -- Corregir resultado recalcula: Ana 2 pts (0 exactos), Bea 2 pts (1 exacto) → Bea primera
  perform admin_set_result('admin2026', m_bo3, 2, 0);
  select * into r from leaderboard where player_id = bea;
  assert r.points = 2 and r.exacts = 1, 'Bea tras corrección';
  assert (select array_agg(name) from leaderboard) = array['Bea', 'Ana', 'Carlos'], 'desempate por exactos tras corrección';
  -- Borrar resultado
  perform admin_set_result('admin2026', m_bo3, null, null);
  assert (select points from leaderboard where player_id = bea) = 0, 'sin resultado';

  -- Resultado imposible
  failed := false;
  begin perform admin_set_result('admin2026', m_bo3, 3, 0); exception when others then failed := true; end;
  assert failed, 'Bo3 3-0 imposible';

  -- La configuración no se puede leer directamente
  failed := false;
  begin perform * from config; exception when insufficient_privilege then failed := true; end;
  assert failed, 'config debe ser privada';

  -- Escribir directamente en tablas está prohibido
  failed := false;
  begin update matches set score_a = 0; exception when insufficient_privilege then failed := true; end;
  assert failed, 'escritura directa prohibida';

  -- Cambiar códigos
  perform admin_set_codes('admin2026', 'nuevo', 'nuevoadmin');
  assert check_group_code('nuevo') and check_admin_code('nuevoadmin'), 'códigos nuevos';

  raise notice 'TODAS LAS PRUEBAS SQL OK';
end $$;

rollback;
