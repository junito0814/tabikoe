# 開発プロセス

`docs/tasks/`（タスク分割）を起点に、GitHub Issue → 実装 → Pull Requestへとつなげる際の運用手順。[rule.md](rule.md)（命名規則・テスト区分・ドキュメント形式）と役割が異なり、こちらは「どう進めるか」の手順そのものを定める。

## 1. タスクをIssue化する

- `docs/tasks/<category>/<story>/00-index.md` 1件 → **エピックIssue**（ラベル: `category:<category>`, `type:epic`）
- `docs/tasks/<category>/<story>/NN-*.md` 1件 → **タスクIssue**（ラベル: `category:<category>`, `type:task`）
- エピックIssue本文には子タスクのチェックリスト（`- [ ] #123 Task N: ...`）を、タスクIssue本文末尾には`**Parent Epic:** #<epic番号>`を記載し、相互リンクする。
- ファイルの見出し・本文をそのままIssueのタイトル・本文に反映する（要約・改変しない）。

## 2. 着手するIssueを選ぶ

- `docs/development-order.md` のPhase構成が実装順序の根拠。指定されたIssue番号がどのPhaseに属するか、まず確認する。
- 各ストーリーの`00-index.md`の「依存」列、および各タスクファイルの「## 依存」節を確認し、**未実装の前提タスクがあれば、指定範囲外でも合わせて実装する**（依存先が無いと動かないコードにしないため）。
- 前提として合わせて実装したタスクは、対応するIssue番号を記録しておき、後述のPR本文で「Refs」として明記する。

## 3. ブランチ運用

- `main`から都度 `feature/<内容が分かる名前>` ブランチを切る。1つのブランチ＝1つのPRに対応する、意味的にまとまった単位（1エピック、または関連する複数エピックの前提込みセット）とする。
- 作業前に必ず`main`を最新化してから分岐する（他PRが先にマージされている場合があるため）。

## 4. 実装時の確認事項

- `npx tsc --noEmit` / `npm run build` / `npx eslint src` / `npm test` を実装のたびに実行し、エラーがないことを確認する。
- Next.jsのバージョンアップに伴う非推奨化・破壊的変更は`node_modules/next/dist/docs/`を確認し、警告が出た規約変更（例：`middleware.ts`→`proxy.ts`）には追従する（[AGENTS.md](../AGENTS.md)参照）。
- 新しいnpm依存を追加した際は`npm audit`を実行し、既知の脆弱性があれば修正済みバージョンへ上げる。

### テスト

[rule.md](rule.md)の「test rule」は単体・結合・E2Eの3区分で、各タスクファイルの「テスト要件」もこの区分で書かれている。現時点で整備済みなのは**単体テストのみ**。

| 区分 | 状況 | 実行方法 |
|---|---|---|
| 単体テスト | 整備済み（Vitest + React Testing Library、`jsdom`） | `npm test`（`npm run test:watch`で監視） |
| 結合テスト | 未整備。Supabaseを実際に叩くため**ローカルSupabase（CLI + Docker）**が必要 | — |
| E2Eテスト | 未整備。Playwright等のブラウザ環境が必要。画面が揃うPhase 5〜6以降で導入を判断する | — |

単体テストの書き方:

- テストファイルは対象と同じディレクトリに `<対象>.test.ts(x)` で置く（`vitest.config.mts`の`include`が`src/**/*.test.{ts,tsx}`）。
- ファイル冒頭のコメントに、**どのタスクファイルの「単体テスト」要件に対応するか**を出典として書く。テスト名はその要件の文言に寄せる（例：「200文字超過時に保存ボタンが無効化される」）。これで「タスクの完了条件を満たしたか」がテストファイルから追える。
- Supabase・`fetch`・`next/navigation`・`next/font`など外部に依存する箇所は`vi.mock`で差し替える。コンポーネントが取得関数を prop で受け取る形（`fetchSuggestions`・`searchSpots`等）にしてあるものは、モックを注入して検証する。
- **Route Handler・`async` Server Component は単体テストの対象外**（Vitestが非同期Server Componentを扱えない。Next.js同梱ドキュメントもE2Eを推奨）。これらのロジックは、純粋関数（`validatePostInput`・`resolveTripId`の正規化部分等）に切り出してからテストする。
- 新しいタスクを実装するときは、タスクファイルの「単体テスト」に列挙された項目を、同じPRでテストとして書く。テスト要件が未実施のままの場合は、PRの Test plan にその旨を明記し `Closes` にしない（6章参照）。

## 5. DBマイグレーション

- `supabase/migrations/` にタイムスタンプ接頭辞（`YYYYMMDDHHMMSS_<内容>.sql`）でファイルを追加する。既存ファイルより新しい日時にする。
- ファイル冒頭のコメントに、出典タスクファイルのパスを記載する（例：`-- 出典: docs/tasks/account/signup-login/02-users-table-migration.md`）。
- `create policy` はガードが無いと再実行でエラーになるため、必ず直前に `drop policy if exists ... ;` を書く（テーブル・インデックスは `if not exists`、関数は `create or replace` で冪等になる）。
- 本セッション時点ではSupabase CLI・ローカル環境が未整備のため、**マイグレーションは実際には未適用・未検証**。適用・検証は別途対応する。

### セキュリティ確認項目（Phase 0/1の監査で実際に穴が見つかった箇所）

Supabaseは`public`スキーマのテーブル・関数をPostgRESTのAPIとしてそのまま公開し、ブラウザに配布されるpublishable（anon）キーで到達できる。RLSポリシーを書いただけでは以下は塞げないため、マイグレーション作成時に毎回確認する。

- **`security definer`関数を追加したら、EXECUTE権限を絞ったか**。既定ではPUBLICにEXECUTEが付くため、`revoke execute ... from public, anon, authenticated` の上で`service_role`にのみ付与する。絞り忘れると、RLSを回避する関数を誰でも任意の引数で実行できる。
- **本人が更新してはいけない列を、列単位のGRANTで守ったか**。RLSは行単位の制御しかできないため、`is_admin`のような権限に関わる列は`revoke update`＋`grant update (許可する列)`で限定する。
- **アクセス制御をアプリ側（Route Handlers・Proxy）にしか書いていないものは無いか**。同じ操作がPostgREST経由で直接呼べないかを確認する。

## 6. コミット・PR

- コミットメッセージ本文に、そのコミットで完全に完了したIssueは`Closes #N, #M, ...`、前提として部分実装・未検証のまま残したIssueは`Refs #N, ...`として明記する。
- PR本文には最低限「Summary」「Test plan」を含め、Test planには実施したチェック（tsc/build/eslint等）と、**未実施のもの**（自動テスト・E2E・実DB検証など）の両方をチェックリストで示す。「できたこと」だけでなく「できていないこと」も必ず書く。
- `Closes`は、そのタスクファイルの「実装内容」「成果物」が実装されたIssueにのみ使う。「テスト要件」（単体／結合／E2E）が未実施の場合はその旨をPR本文に明記し、安易に`Closes`しない。
- **注意（実際にハマった落とし穴）**：`Closes #12, #13, #16` のようにキーワードを1回だけ書いてカンマ区切りで複数Issueを並べても、GitHubは**先頭の1件しかクローズ用参照として認識しない**（`gh pr view <PR番号> --json closingIssuesReferences`で実際に確認できる）。複数Issueをまとめて閉じたい場合は、Issueごとに`Closes #12`, `Closes #13`, `Closes #16` とキーワードを繰り返すか、マージ後に`gh issue close <番号>`で個別にクローズする。

## 7. 既知のギャップ（2026-09-11時点）

- **結合テスト・E2Eテストが未整備**。単体テスト（Vitest）は導入済みで、Phase 0〜2の既存ロジック・コンポーネントの単体テスト要件はコード化した。結合テストにはローカルSupabase、E2EにはPlaywright等が必要で、いずれも未導入。
- **Supabase CLI未導入**。本番のSupabaseプロジェクトへのマイグレーションは、結合したSQLファイルをダッシュボードのSQL Editorに貼る手順で適用している（`supabase db push`で自動化できていない）。
- **動画アップロード（ffmpeg）未対応**。要件定義書9章#5「Vercel上での動作検証」が未了のため、投稿の写真パスのみ実装している。
- 上記はいずれも今後のIssue／PRで解消する。着手する場合は本ファイルを更新すること。
