-- closer_gauge / settings が RLS 無効 + anon 権限付きで、
-- 未ログインでも publishable キーだけで読み書きできた穴を塞ぐ (2026-09-12 セキュリティ点検で発見)
-- 方針: 他テーブルと同じ「authenticated なら全操作可」の2人信頼モデルに揃え、anon は全面 revoke

ALTER TABLE public.closer_gauge ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS closer_gauge_authenticated_all ON public.closer_gauge;
CREATE POLICY closer_gauge_authenticated_all ON public.closer_gauge
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS settings_authenticated_all ON public.settings;
CREATE POLICY settings_authenticated_all ON public.settings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

REVOKE ALL ON public.closer_gauge FROM anon;
REVOKE ALL ON public.settings FROM anon;

-- Edge Functions (service key) は RLS を通らないので影響なし
GRANT ALL ON public.closer_gauge TO service_role;
GRANT ALL ON public.settings TO service_role;
