-- わたしえらい！: 個人目標 + サブタスク(ステップ) + 相手からの「えらい！」褒め
-- ステップ達成/目標達成は本人のみに付与。相手の「えらい！」は相手の残高を減らさず、本人にpt付与するシステム贈呈
CREATE TABLE IF NOT EXISTS goals (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL,
  title      text NOT NULL,
  period     text,               -- 自由記述の期限目安 (例: "7月の目標")
  status     text NOT NULL DEFAULT 'active' CHECK (status IN ('active','done')),
  created_at timestamptz NOT NULL DEFAULT now(),
  done_at    timestamptz
);

CREATE TABLE IF NOT EXISTS goal_steps (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id    uuid NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL,       -- goals.user_id と同じ (RLSを単純にするため非正規化)
  title      text NOT NULL,
  done       boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  done_at    timestamptz
);

-- 「えらい！」記録。step_id が null なら目標達成そのものへの褒め
CREATE TABLE IF NOT EXISTS goal_praises (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id      uuid NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  step_id      uuid REFERENCES goal_steps(id) ON DELETE CASCADE,
  from_user_id uuid NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
-- 1step / 1goal完了 につき褒めは一度きり (INSERT...ON CONFLICT DO NOTHINGで排他制御)
CREATE UNIQUE INDEX IF NOT EXISTS goal_praises_step_uniq ON goal_praises(step_id) WHERE step_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS goal_praises_goal_uniq ON goal_praises(goal_id) WHERE step_id IS NULL;

ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_praises ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS goals_select ON goals;
CREATE POLICY goals_select ON goals FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS goals_insert ON goals;
CREATE POLICY goals_insert ON goals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS goals_update ON goals;
CREATE POLICY goals_update ON goals FOR UPDATE TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS goals_delete ON goals;
CREATE POLICY goals_delete ON goals FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS goal_steps_select ON goal_steps;
CREATE POLICY goal_steps_select ON goal_steps FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS goal_steps_insert ON goal_steps;
CREATE POLICY goal_steps_insert ON goal_steps FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS goal_steps_update ON goal_steps;
CREATE POLICY goal_steps_update ON goal_steps FOR UPDATE TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS goal_steps_delete ON goal_steps;
CREATE POLICY goal_steps_delete ON goal_steps FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS goal_praises_select ON goal_praises;
CREATE POLICY goal_praises_select ON goal_praises FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS goal_praises_insert ON goal_praises;
CREATE POLICY goal_praises_insert ON goal_praises FOR INSERT TO authenticated WITH CHECK (auth.uid() = from_user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON goals TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON goals TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON goal_steps TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON goal_steps TO service_role;
GRANT SELECT, INSERT ON goal_praises TO authenticated;
GRANT SELECT, INSERT ON goal_praises TO service_role;
