-- 削除・編集の権限を「支払った人(paid_by)」ではなく「記録した人(created_by)」基準にする。
-- 相手が払った記録を自分がつけた場合、paid_by基準だと自分では削除できず相手しか削除できない逆転が起きていたため。
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS created_by uuid;

-- 既存行は記録者不明なので、暫定的に paid_by を引き継ぐ (旧来の挙動を維持)
UPDATE expenses SET created_by = paid_by WHERE created_by IS NULL;

DROP POLICY IF EXISTS expenses_delete ON expenses;
CREATE POLICY expenses_delete ON expenses
  FOR DELETE TO authenticated
  USING (auth.uid() = created_by);
