-- ふたりの日記: 自分のエントリを削除できるように (UIに削除ボタンを追加したため)
DROP POLICY IF EXISTS diary_entries_delete ON diary_entries;
CREATE POLICY diary_entries_delete ON diary_entries FOR DELETE TO authenticated USING (auth.uid() = user_id);
GRANT DELETE ON diary_entries TO authenticated;
GRANT DELETE ON diary_entries TO service_role;
