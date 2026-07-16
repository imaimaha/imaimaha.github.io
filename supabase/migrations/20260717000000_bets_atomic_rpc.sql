-- 賭け事の状態遷移 + ポイント移動をアトミックにする RPC 群
-- 背景: クライアント側の UPDATE + points INSERT の 2 段階だと、
--       2人が同時に操作した場合に二重配当・二重返却が起きうる。
--       UPDATE ... WHERE status = '<期待状態>' のガード + RETURNING で
--       「遷移を勝ち取った方だけ」がポイントを動かす。

-- ─────────────────────────────────────────
-- 起票: pending 作成 + 起票者から stake エスクロー
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION create_bet(
  p_title text,
  p_description text,
  p_stake int,
  p_opponent uuid
) RETURNS bets
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_bet bets;
  v_balance bigint;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION '認証が必要です'; END IF;
  IF p_stake IS NULL OR p_stake < 1 THEN RAISE EXCEPTION '掛け金が不正です'; END IF;
  IF p_title IS NULL OR length(trim(p_title)) = 0 THEN RAISE EXCEPTION 'お題を入力してください'; END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_balance FROM points WHERE user_id = auth.uid();
  IF v_balance < p_stake THEN
    RAISE EXCEPTION 'ポイントが足りません (残高 %pt)', v_balance;
  END IF;

  INSERT INTO bets (created_by, opponent_id, title, description, stake, status)
  VALUES (auth.uid(), p_opponent, p_title, p_description, p_stake, 'pending')
  RETURNING * INTO v_bet;

  INSERT INTO points (user_id, amount, reason)
  VALUES (auth.uid(), -p_stake, 'bet_stake');

  RETURN v_bet;
END;
$$;

-- ─────────────────────────────────────────
-- 承諾: pending → active + 受けた側から stake エスクロー
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION accept_bet(p_bet_id bigint) RETURNS bets
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_bet bets;
  v_balance bigint;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO v_balance FROM points WHERE user_id = auth.uid();

  UPDATE bets SET status = 'active', accepted_at = now()
  WHERE id = p_bet_id AND status = 'pending' AND opponent_id = auth.uid()
  RETURNING * INTO v_bet;

  IF v_bet.id IS NULL THEN
    RAISE EXCEPTION 'この賭け事はすでに処理済みです';
  END IF;

  IF v_balance < v_bet.stake THEN
    RAISE EXCEPTION 'ポイントが足りません (残高 %pt)', v_balance;
    -- 例外で全体ロールバックされるので active 遷移も巻き戻る
  END IF;

  INSERT INTO points (user_id, amount, reason)
  VALUES (auth.uid(), -v_bet.stake, 'bet_stake');

  RETURN v_bet;
END;
$$;

-- ─────────────────────────────────────────
-- 拒否: pending → rejected + 起票者に返却
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION reject_bet(p_bet_id bigint) RETURNS bets
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_bet bets;
BEGIN
  UPDATE bets SET status = 'rejected', ended_at = now()
  WHERE id = p_bet_id AND status = 'pending' AND opponent_id = auth.uid()
  RETURNING * INTO v_bet;

  IF v_bet.id IS NULL THEN
    RAISE EXCEPTION 'この賭け事はすでに処理済みです';
  END IF;

  INSERT INTO points (user_id, amount, reason)
  VALUES (v_bet.created_by, v_bet.stake, 'bet_return');

  RETURN v_bet;
END;
$$;

-- ─────────────────────────────────────────
-- 取下: pending → cancelled + 起票者に返却
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION cancel_bet(p_bet_id bigint) RETURNS bets
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_bet bets;
BEGIN
  UPDATE bets SET status = 'cancelled', ended_at = now()
  WHERE id = p_bet_id AND status = 'pending' AND created_by = auth.uid()
  RETURNING * INTO v_bet;

  IF v_bet.id IS NULL THEN
    RAISE EXCEPTION 'この賭け事はすでに処理済みです';
  END IF;

  INSERT INTO points (user_id, amount, reason)
  VALUES (v_bet.created_by, v_bet.stake, 'bet_return');

  RETURN v_bet;
END;
$$;

-- ─────────────────────────────────────────
-- 結果確定: active → finished + 配当
-- p_choice: 'me' | 'you' | 'draw' (呼び出しユーザー視点)
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION settle_bet(p_bet_id bigint, p_choice text) RETURNS bets
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_bet bets;
  v_result text;
  v_winner uuid;
BEGIN
  IF p_choice NOT IN ('me', 'you', 'draw') THEN
    RAISE EXCEPTION '結果の指定が不正です';
  END IF;

  UPDATE bets SET status = 'finished', result_by = auth.uid(), finished_at = now()
  WHERE id = p_bet_id AND status = 'active'
    AND (created_by = auth.uid() OR opponent_id = auth.uid())
  RETURNING * INTO v_bet;

  IF v_bet.id IS NULL THEN
    RAISE EXCEPTION 'この賭け事はすでに確定済みです';
  END IF;

  IF p_choice = 'draw' THEN
    v_result := 'draw';
    v_winner := NULL;
  ELSIF (p_choice = 'me') = (v_bet.created_by = auth.uid()) THEN
    v_result := 'win_creator';
    v_winner := v_bet.created_by;
  ELSE
    v_result := 'win_opponent';
    v_winner := v_bet.opponent_id;
  END IF;

  UPDATE bets SET result = v_result WHERE id = p_bet_id;
  v_bet.result := v_result;

  IF v_result = 'draw' THEN
    INSERT INTO points (user_id, amount, reason) VALUES
      (v_bet.created_by,  v_bet.stake, 'bet_draw'),
      (v_bet.opponent_id, v_bet.stake, 'bet_draw');
  ELSE
    INSERT INTO points (user_id, amount, reason)
    VALUES (v_winner, v_bet.stake * 2, 'bet_win');
  END IF;

  RETURN v_bet;
END;
$$;

-- ─────────────────────────────────────────
-- 取り消し承認:
--   finished → active (配当を巻き戻す)
--   active   → cancelled (両者に掛け金返却)
-- 申請者本人は承認できない
-- ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION approve_bet_cancel(p_bet_id bigint) RETURNS bets
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_bet bets;
  v_winner uuid;
BEGIN
  -- 先に行ロックを取り、状態を見てから分岐する
  SELECT * INTO v_bet FROM bets
  WHERE id = p_bet_id AND cancel_requested = true
    AND cancel_by <> auth.uid()
    AND (created_by = auth.uid() OR opponent_id = auth.uid())
  FOR UPDATE;

  IF v_bet.id IS NULL THEN
    RAISE EXCEPTION 'この申請はすでに処理済みです';
  END IF;

  IF v_bet.status = 'finished' THEN
    IF v_bet.result = 'draw' THEN
      INSERT INTO points (user_id, amount, reason) VALUES
        (v_bet.created_by,  -v_bet.stake, 'bet_undo'),
        (v_bet.opponent_id, -v_bet.stake, 'bet_undo');
    ELSE
      v_winner := CASE WHEN v_bet.result = 'win_creator' THEN v_bet.created_by ELSE v_bet.opponent_id END;
      INSERT INTO points (user_id, amount, reason)
      VALUES (v_winner, -v_bet.stake * 2, 'bet_undo');
    END IF;
    UPDATE bets SET status = 'active', result = NULL, result_by = NULL,
      finished_at = NULL, cancel_requested = false, cancel_by = NULL
    WHERE id = p_bet_id
    RETURNING * INTO v_bet;
  ELSIF v_bet.status = 'active' THEN
    INSERT INTO points (user_id, amount, reason) VALUES
      (v_bet.created_by,  v_bet.stake, 'bet_return'),
      (v_bet.opponent_id, v_bet.stake, 'bet_return');
    UPDATE bets SET status = 'cancelled', ended_at = now(),
      cancel_requested = false, cancel_by = NULL
    WHERE id = p_bet_id
    RETURNING * INTO v_bet;
  ELSE
    RAISE EXCEPTION 'この状態からは取り消せません (%)', v_bet.status;
  END IF;

  RETURN v_bet;
END;
$$;

-- 認証ユーザーだけが呼べる (anon には出さない)
REVOKE ALL ON FUNCTION create_bet(text, text, int, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION accept_bet(bigint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION reject_bet(bigint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION cancel_bet(bigint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION settle_bet(bigint, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION approve_bet_cancel(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION create_bet(text, text, int, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION accept_bet(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION reject_bet(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_bet(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION settle_bet(bigint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION approve_bet_cancel(bigint) TO authenticated;
