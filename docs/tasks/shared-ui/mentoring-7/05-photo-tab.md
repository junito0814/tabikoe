# Task 5: 写真タブの上限と写真からの遷移

> 出典: [mentoring-7.md](../../../user-stories/shared-ui/mentoring-7.md)
> インデックス: [mentoring-7](00-index.md)
> 要件: [requirement.md](../../../requirement.md) v3.1 の改訂表

## 依存

- Task 3

## 実装内容

- `GET /api/posts/photos`：検索結果（pref／nearby）では 1 スポットにつき新しい投稿から最大 5 枚に制限し、スポットの順（Task 3 の並び替え）で並べる。スポット別（spot）は従来どおり全部
- `PhotoGrid`：写真のタップで `MediaModal` を開かず `/posts/[id]` へ遷移する。グリッドのセルにスポット名を小さく重ねる（検索結果のとき）
- `PostCard` の `MediaGrid`：タップで `/posts/[id]`（モーダルを開かない）。`MediaGrid` に `onOpen` 差し替え口を足す
- モーダルを使うのは `PostDetailScreen` だけにする

## 成果物

- `src/lib/posts/search-photos.ts`・`src/app/api/posts/photos/route.ts`
- `src/components/media/PhotoGrid.tsx`・`MediaGrid.tsx`
- `src/components/posts/PostCard.tsx`

## テスト要件

### 単体テスト
- 1 スポット 6 枚以上の写真があっても検索結果では 5 枚になること
- 写真のタップで投稿詳細へのリンクになること（モーダルが開かないこと）

### 結合テスト
- なし

### E2Eテスト
- なし（[Task 10: 受入テスト（E2E）](10-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 検索結果の写真タブが 1 スポット 5 枚までで、写真のタップで投稿詳細が開くこと
