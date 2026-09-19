# Task 2: 「日常」アルバム（仮タイトルの廃止）

> 出典: [mentoring-7.md](../../../user-stories/shared-ui/mentoring-7.md)
> インデックス: [mentoring-7](00-index.md)
> 要件: [requirement.md](../../../requirement.md) v3.1 の改訂表

## 依存

- Task 1

## 実装内容

- マイグレーション：`trips.is_daily boolean not null default false` と部分ユニーク索引 `(user_id) where is_daily`。既存の仮タイトル「今日の投稿（M/D）」の旅行を各ユーザーの「日常」に統合する（投稿の trip_id を付け替え、空になった旅行は削除）
- `resolve-trip.ts`：アルバム欄が空のときは仮タイトルを作らず、その利用者の「日常」（無ければ作る）を返す。`provisional-title.ts` と付け直し促し（`RenameTripDialog` の呼び出し）を削除
- API：`is_daily` の旅行に対する タイトル変更（PATCH /api/trips/[id]）・削除・招待発行・しおり作成 を 400 で拒否する
- 画面：アルバム一覧の先頭に「日常」を固定表示（投稿 0 件でも出す）。アルバム画面で「日常」は名前変更・招待の操作を出さない。投稿画面のアルバム欄の初期値を「日常」にする（既存のアルバムから選べる）

## 成果物

- `supabase/migrations/2026MMDD000001_daily_album.sql`
- `src/lib/trips/resolve-trip.ts`・`src/lib/trips/daily-album.ts`（新設）
- `src/app/api/trips/[id]/route.ts`・`src/app/api/trips/[id]/invitations/route.ts`・`src/app/api/itineraries/route.ts`
- `src/lib/albums/get-album.ts`・`src/components/albums/AlbumListScreen.tsx`・`AlbumScreen.tsx`
- `src/components/posts/TripTitleInput.tsx`・`src/lib/posts/compose-initial-state.ts`

## テスト要件

### 単体テスト
- 空のアルバム欄で「日常」が返ること（既存があればそれ、無ければ作る。ユーザーごとに 1 つ）
- `is_daily` の旅行のタイトル変更・削除・招待・しおり作成が 400 になること
- 仮タイトルが作られないこと（`provisionalTripTitle` の削除）

### 結合テスト
- なし

### E2Eテスト
- なし（[Task 10: 受入テスト（E2E）](10-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- アルバム欄を空で投稿すると「日常」アルバムに入り、「日常」は名前変更・削除・招待・しおり作成ができないこと
