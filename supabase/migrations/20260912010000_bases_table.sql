-- ふたりの拠点 (おうち/会社) を location.html のベタ書きから DB へ移動
-- 理由: リポジトリが公開 + GitHub Pages は HTML を認証なしで配信するため、
--       コードに町名を書くと外部から見える。DB なら authenticated しか読めない
-- ⚠️ シード (実際の町名の行) はこのファイルに書かず、直接 SQL で投入する

CREATE TABLE IF NOT EXISTS public.bases (
  town  text PRIMARY KEY,          -- Nominatim が返す suburb 名
  kind  text NOT NULL CHECK (kind IN ('home','office')),
  emoji text NOT NULL DEFAULT '🏠',
  owner text,                      -- profiles の name ('nick'/'hedgehog')。会社等は NULL
  label text NOT NULL              -- 相手の家として表示する時のラベル (例: 「nickのおうち」)
);

ALTER TABLE public.bases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bases_authenticated_all ON public.bases;
CREATE POLICY bases_authenticated_all ON public.bases
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT ALL ON public.bases TO authenticated;
GRANT ALL ON public.bases TO service_role;
-- anon には一切 GRANT しない (未ログインから見えないことが目的)
