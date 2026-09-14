# Notre — Mac App (Swift)

Web版(リポジトリ直下の `*.html`)と同じ機能をネイティブMacアプリとして作る場所。
コードはWeb版とは別物（SwiftUI）だが、バックエンドの Supabase は共有する想定。

## Mac側でのセットアップ手順

1. Xcodeを開く → File > New > Project
2. macOS > App を選択、Interface は SwiftUI
3. Product Name: `Notre`、保存先はこの `mac-app/` フォルダ直下
   （Xcodeが `mac-app/Notre/` と `mac-app/Notre.xcodeproj` を作る）
4. Swift Package Manager で `supabase-swift` を追加
   https://github.com/supabase/supabase-swift
5. Supabaseの接続情報（URL・anon key）は `../supabase/` 配下の設定やWeb版の
   環境変数を参照。**シークレットはコミットしない**（`.gitignore` で
   `mac-app/Notre/Secrets.swift` 等を除外する運用にする）

## 参考にする機能仕様

Web版の各HTML（`index.html`, `points.html`, `shop.html`, `quiz.html` など）が
そのまま機能一覧・仕様書になる。UIの作り直しはSwiftUIで一から。

## 進め方

まずは1機能（例: ログイン→ポイント表示）だけ動かすところから。
一気に全部作り直さない。
