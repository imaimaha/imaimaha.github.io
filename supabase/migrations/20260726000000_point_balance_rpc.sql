-- ポイント残高をDB側で合計するRPC。
-- 背景: PostgRESTのselectはデフォルト最大1000行のため、points行数が1000を超えたユーザー(nick)の
-- クライアント側合計(select amount → reduce)が取りこぼして残高表示がズレるバグが発生した。
-- 残高はこの関数経由で取得する(points テーブルが唯一の真実、残高カラムは持たない)。
CREATE OR REPLACE FUNCTION point_balance(uid uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(amount), 0)::integer FROM points WHERE user_id = uid;
$$;

GRANT EXECUTE ON FUNCTION point_balance(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION point_balance(uuid) TO service_role;

-- points.html の「獲得/消費」内訳もDB側で集計する (同じく1000行キャップ対策)
CREATE OR REPLACE FUNCTION point_summary(uid uuid)
RETURNS TABLE(earned integer, spent integer, total integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(SUM(amount) FILTER (WHERE amount >= 0), 0)::integer AS earned,
    COALESCE(SUM(amount) FILTER (WHERE amount < 0), 0)::integer  AS spent,
    COALESCE(SUM(amount), 0)::integer                             AS total
  FROM points WHERE user_id = uid;
$$;

GRANT EXECUTE ON FUNCTION point_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION point_summary(uuid) TO service_role;
