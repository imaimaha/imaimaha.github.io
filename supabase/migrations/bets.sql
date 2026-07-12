-- 賭け事機能: 2人の間でポイントを賭けて勝敗を記録
-- points はエスクロー: 起票時に起票者、承諾時に相手からそれぞれ -stake を引く
-- 結果確定時に勝者に +stake*2、引き分けなら両者に +stake を戻す
-- キャンセル/却下は起票者に +stake を戻す
-- 誤タップ救済: cancel_requested + resolver 承認/却下フロー (取り消し申請)

CREATE TABLE IF NOT EXISTS public.bets (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_by     uuid REFERENCES auth.users NOT NULL,
  opponent_id    uuid REFERENCES auth.users NOT NULL,
  title          text NOT NULL,
  description    text,
  stake          integer NOT NULL CHECK (stake > 0),
  status         text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','finished','cancelled','rejected')),
  result         text CHECK (result IN ('win_creator','win_opponent','draw') OR result IS NULL),
  result_by      uuid REFERENCES auth.users,       -- 結果を宣言したユーザー
  cancel_requested boolean DEFAULT false,          -- 結果の取り消し申請中フラグ
  cancel_by      uuid REFERENCES auth.users,       -- 取り消し申請者
  proposed_at    timestamptz DEFAULT now(),
  accepted_at    timestamptz,
  finished_at    timestamptz,
  ended_at       timestamptz                        -- cancelled/rejected の時刻
);

CREATE INDEX IF NOT EXISTS idx_bets_status_created ON public.bets(status, proposed_at DESC);
CREATE INDEX IF NOT EXISTS idx_bets_created_by     ON public.bets(created_by);
CREATE INDEX IF NOT EXISTS idx_bets_opponent_id    ON public.bets(opponent_id);

ALTER TABLE public.bets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bets_select ON public.bets;
CREATE POLICY bets_select ON public.bets
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS bets_insert ON public.bets;
CREATE POLICY bets_insert ON public.bets
  FOR INSERT WITH CHECK (auth.uid() = created_by);

-- UPDATE: 起票者 or 相手のいずれかが操作可能 (承諾・拒否・キャンセル・結果宣言・取消申請/承認)
DROP POLICY IF EXISTS bets_update ON public.bets;
CREATE POLICY bets_update ON public.bets
  FOR UPDATE USING (auth.uid() = created_by OR auth.uid() = opponent_id);

-- DELETE 禁止 (履歴として残す)
GRANT SELECT, INSERT, UPDATE ON public.bets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bets TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.bets_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.bets_id_seq TO service_role;
