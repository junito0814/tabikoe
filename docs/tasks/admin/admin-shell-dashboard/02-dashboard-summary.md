# Task 2: ダッシュボードに「対応が要るもの」「数字」「最近の動き」を出す

> 出典: [admin-shell-dashboard.md](../../../user-stories/admin/admin-shell-dashboard.md)
> インデックス: [admin-shell-dashboard](00-index.md)
> 要件定義書 3.10.3

## 実装内容

- `src/lib/admin/dashboard.ts`（新規）：ダッシュボードに出す数字を **1 つの関数** `loadAdminDashboard(admin)` で集める。問い合わせは `Promise.all` で並列にし、往復を増やさない
  - 未対応の通報：件数と最古の `created_at`
  - 自動で非公開・確認待ち：件数（strike-system Task3 の `auto_hidden_at` を見る。無ければ 0）
  - 仮停止の確認待ち：件数（strike-system Task4。無ければ 0）
  - 利用者：累計と今週（`created_at >= 今週の月曜`）。投稿・スポットも同じ。スポットは `source = manual` の数も
  - 使った人：Task 3 で入る（それまでは「—」）
  - 最近の投稿 5 件・最近のスポット 5 件・通報が集中している対象（同じ対象への**異なる通報者**の数が多い順）
- `src/app/admin/page.tsx` を Server Component で作り直し、`AdminDashboardScreen`（表示だけ）に渡す
- 上段の帯は 0 件でも消さず、緑で「ありません」
- 「見る」「開く」の行き先：投稿は `/posts/<id>`（新しいタブ）、通報は `/admin/reports?status=open`、非公開は `/admin/hidden`

## テスト要件

### 単体テスト
- `loadAdminDashboard` の集計（未対応の件数と最古の日数・今週の増分・タビコエだけの場所の数）が正しいこと（Supabase は差し替え）
- 「通報が集中している対象」が異なる通報者の数で並ぶこと（同じ人の重複は 1 人）
- 画面：0 件のとき緑の帯、N 件のとき赤い帯と最古の日数

## 関連する受入条件

- admin-shell-dashboard.md の受入条件 2〜4
