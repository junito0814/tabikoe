# Task 3: 写真タブのモーダル（情報バー＋この投稿を見る）

> 出典: [feedback-0919.md](../../../user-stories/shared-ui/feedback-0919.md)
> インデックス: [feedback-0919](00-index.md)
> 要件: [requirement.md](../../../requirement.md) v3.2 の改訂表

## 依存

- v3.1 Task 5（#426。写真タブが投稿詳細へ直接遷移する状態）

## 実装内容

- `GET /api/posts/photos` の各写真に、情報バー用の項目（spotName・isManualSpot・rating・duration・cost・authorName・visitDate・postId）を含める
- `PhotoGrid`：写真のタップで `MediaModal` を開く（v3.1 で外した動きを戻す）。モーダルはグリッド全体の写真を 1 列として前後へ送れる（40 件ずつの追加読み込みと連動）
- `MediaModal` に `info` スロットを足し、写真タブから開いたときだけ下部に情報バー（スポット名・タビコエだけの場所・★＋「星4」・滞在・費用・投稿者・訪問日）と「この投稿を見る →」（`/posts/[id]`）を出す。投稿詳細から開いたときは従来どおり（情報バー無し）
- 動画はモーダル内で再生。× ・Esc・背景タップで閉じる。「N / 全枚数」の表示

## 成果物

- `src/lib/posts/search-photos.ts`・`src/app/api/posts/photos/route.ts`
- `src/components/media/PhotoGrid.tsx`・`MediaModal.tsx`

## テスト要件

### 単体テスト
- 写真タブの写真のタップでモーダルが開き、情報バーに スポット名・星・滞在・費用 と「この投稿を見る」リンク（`/posts/<id>`）が出ること
- 投稿詳細から開いたモーダルには情報バーが出ないこと
- 投稿カード内の写真のタップは引き続き `/posts/<id>` への遷移であること

### 結合テスト
- なし

### E2Eテスト
- なし（[Task 8: 受入テスト（E2E）](08-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 受入条件73
