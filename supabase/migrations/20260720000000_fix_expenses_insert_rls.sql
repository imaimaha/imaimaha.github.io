-- expenses.html は「支払った人」を自分/相手どちらでも選んで記録できる仕様のため、
-- paid_by = 相手 のとき auth.uid() が paid_by と一致せず INSERT が弾かれていた。
-- points テーブルと同じ「2人だけの信頼モデル」に合わせ、authenticated なら誰の分でも INSERT 可にする。
DROP POLICY IF EXISTS expenses_insert ON expenses;
CREATE POLICY expenses_insert ON expenses
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
