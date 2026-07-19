-- ポイント再付与バグ修正: 付与済み記録 (awarded) を保存し、
-- チェック外し→付け直し / 写真削除→再アップでの再付与を防ぐ
ALTER TABLE bingo_sessions ADD COLUMN IF NOT EXISTS awarded jsonb;
ALTER TABLE color_hunts   ADD COLUMN IF NOT EXISTS awarded jsonb;

-- 既存カラーハントは現状の写真状態を「付与済み」として初期化
UPDATE color_hunts SET awarded = jsonb_build_object(
  'positions', COALESCE((SELECT jsonb_agg(p->'position') FROM jsonb_array_elements(COALESCE(photos,'[]'::jsonb)) p), '[]'::jsonb),
  'complete', jsonb_array_length(COALESCE(photos,'[]'::jsonb)) >= 8,
  'half',     jsonb_array_length(COALESCE(photos,'[]'::jsonb)) >= 4
) WHERE awarded IS NULL;

-- bingo_sessions はライン判定がクライアント実装のため、初回操作時にクライアント側で初期化する

-- 既存ビンゴカードも現状のチェック状態を「付与済み」として一括初期化
-- (detectBingo と同一ロジック: 行/列/対角2本、フリーマスなし)
CREATE OR REPLACE FUNCTION _tmp_bingo_lines(checks jsonb, n int) RETURNS int AS $$
DECLARE
  size int := round(sqrt(n))::int;
  checked int[];
  lines int := 0;
  ok boolean;
  r int; c int; i int;
BEGIN
  IF n IS NULL OR n < 9 THEN RETURN 0; END IF;
  SELECT COALESCE(array_agg((e->>'index')::int), '{}') INTO checked
    FROM jsonb_array_elements(COALESCE(checks, '[]'::jsonb)) e;
  FOR r IN 0..size-1 LOOP
    ok := true;
    FOR c IN 0..size-1 LOOP
      IF NOT (r*size + c = ANY(checked)) THEN ok := false; EXIT; END IF;
    END LOOP;
    IF ok THEN lines := lines + 1; END IF;
  END LOOP;
  FOR c IN 0..size-1 LOOP
    ok := true;
    FOR r IN 0..size-1 LOOP
      IF NOT (r*size + c = ANY(checked)) THEN ok := false; EXIT; END IF;
    END LOOP;
    IF ok THEN lines := lines + 1; END IF;
  END LOOP;
  ok := true;
  FOR i IN 0..size-1 LOOP
    IF NOT (i*size + i = ANY(checked)) THEN ok := false; EXIT; END IF;
  END LOOP;
  IF ok THEN lines := lines + 1; END IF;
  ok := true;
  FOR i IN 0..size-1 LOOP
    IF NOT (i*size + (size-1-i) = ANY(checked)) THEN ok := false; EXIT; END IF;
  END LOOP;
  IF ok THEN lines := lines + 1; END IF;
  RETURN lines;
END $$ LANGUAGE plpgsql;

UPDATE bingo_sessions SET awarded = jsonb_build_object(
  'cells', COALESCE((SELECT jsonb_agg((e->>'index')::int) FROM jsonb_array_elements(COALESCE(checks,'[]'::jsonb)) e), '[]'::jsonb),
  'lines', _tmp_bingo_lines(checks, jsonb_array_length(COALESCE(items,'[]'::jsonb))),
  'complete', jsonb_array_length(COALESCE(items,'[]'::jsonb)) > 0
              AND jsonb_array_length(COALESCE(checks,'[]'::jsonb)) >= jsonb_array_length(COALESCE(items,'[]'::jsonb))
) WHERE awarded IS NULL;

DROP FUNCTION _tmp_bingo_lines(jsonb, int);
