# Task 1: アルバム写真一覧取得 Route Handler

> 出典: [album-photos.md](../../../user-stories/records/album-photos.md)
> インデックス: [album-photos](00-index.md)

## 依存

- spot-photo-gallery [Task 1](../../map-search/spot-photo-gallery/01-spot-photos-handler.md)（`mergeSpotMedia`・署名付きURLの付与）
- album-collaboration Task 2（`getAlbumRole` によるメンバー判定）

## 実装内容

- `GET /api/trips/[id]/photos?offset=` を実装する。`getAlbumMediaPage(admin, viewerId, tripId, offset)` が本体
- メンバー（オーナー・編集者・閲覧者）以外、および管理者が非公開化したアルバム（オーナー以外）には null → 404
- `posts.trip_id = tripId` かつ `hidden_at is null` の投稿を新着順に取り、`mergeSpotMedia(rows, { includePrivate: true })` で写真・動画を1列に統合する（非公開投稿も含める。写真単位の `hidden_at` は落とす）
- ブロック関係による除外は行わない（3.8.2 の例外）
- 1ページ40点。署名付きURL（サムネイル・動画本体）の付与はスポット写真一覧と共通の `buildMediaPage` を使う

## 成果物

- `src/lib/albums/album-photos.ts`
- `app/api/trips/[id]/photos/route.ts`
- `mergeSpotMedia` の `includePrivate` オプション、`buildMediaPage` の切り出し

## テスト要件

### 単体テスト
- `mergeSpotMedia` が `includePrivate` で非公開投稿の写真を含め、無指定では従来どおり落とすことを検証する
- Route Handler が未ログインで401、メンバー以外で404、メンバーで1ページ返すことを検証する

### 結合テスト
- 公開・非公開の投稿が混在するアルバムで、メンバーには両方の写真が返り、非メンバーには404になることを確認する

### E2Eテスト
- なし（[Task 3](03-acceptance-e2e.md) でまとめて検証する）

## 関連する受入条件

- メンバー以外は 404 になること
- 管理者が非公開化した投稿・写真が含まれないこと
