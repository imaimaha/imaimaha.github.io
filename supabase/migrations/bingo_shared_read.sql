-- ビンゴ履歴を2人で共有: SELECTは認証済み全員、書き込みは本人のみ
DROP POLICY IF EXISTS "bingo_own_records" ON bingo_sessions;

CREATE POLICY "bingo_select_all"  ON bingo_sessions FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "bingo_insert_own"  ON bingo_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "bingo_update_own"  ON bingo_sessions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "bingo_delete_own"  ON bingo_sessions FOR DELETE USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON bingo_sessions TO authenticated;
