-- expenses: 割り勘の支出記録
-- settlements: 精算履歴
CREATE TABLE IF NOT EXISTS public.expenses (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  paid_by       uuid REFERENCES auth.users NOT NULL,  -- 立て替えた人
  amount        integer NOT NULL,                     -- 総額 (円)
  category      text,                                 -- 食費/光熱費/家賃/デート/交通/日用品/その他
  description   text,                                 -- メモ
  split_ratio   numeric DEFAULT 0.5,                  -- 相手が負担すべき割合 (0.5=折半, 1.0=相手全額, 0.0=私全額)
  spent_at      date NOT NULL DEFAULT CURRENT_DATE,   -- 実際に支払った日
  settled_at    timestamptz,                          -- 精算済みならその時刻
  settlement_id bigint,                               -- 一括精算グループID
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expenses_paid_by_settled ON public.expenses(paid_by, settled_at);
CREATE INDEX IF NOT EXISTS idx_expenses_spent_at        ON public.expenses(spent_at DESC);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS expenses_select ON public.expenses;
CREATE POLICY expenses_select ON public.expenses FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS expenses_insert ON public.expenses;
CREATE POLICY expenses_insert ON public.expenses FOR INSERT WITH CHECK (auth.uid() = paid_by);

DROP POLICY IF EXISTS expenses_update ON public.expenses;
CREATE POLICY expenses_update ON public.expenses FOR UPDATE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS expenses_delete ON public.expenses;
CREATE POLICY expenses_delete ON public.expenses FOR DELETE USING (auth.uid() = paid_by);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.expenses_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.expenses_id_seq TO service_role;


CREATE TABLE IF NOT EXISTS public.settlements (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  settled_by   uuid REFERENCES auth.users NOT NULL,  -- 精算を実行した人
  net_amount   integer NOT NULL,                     -- 精算額 (常に正の絶対値)
  payer_id     uuid REFERENCES auth.users NOT NULL,  -- 実際にお金を渡した人
  receiver_id  uuid REFERENCES auth.users NOT NULL,  -- 実際にお金を受け取った人
  period_from  date,
  period_to    date,
  memo         text,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_settlements_created_at ON public.settlements(created_at DESC);

ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS settlements_select ON public.settlements;
CREATE POLICY settlements_select ON public.settlements FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS settlements_insert ON public.settlements;
CREATE POLICY settlements_insert ON public.settlements FOR INSERT WITH CHECK (auth.uid() = settled_by);

DROP POLICY IF EXISTS settlements_delete ON public.settlements;
CREATE POLICY settlements_delete ON public.settlements FOR DELETE USING (auth.uid() = settled_by);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.settlements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.settlements TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.settlements_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.settlements_id_seq TO service_role;
