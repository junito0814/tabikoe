# Task 1: 見出し・導線・本人メニューの変更

> 出典: [post-detail-view.md](../../../user-stories/browsing/post-detail-view.md)
> インデックス: [post-detail-view-v3](00-index.md)

## 依存

- theme Task 3
- spot-selection-v3 Task 3
- wishlist-v3 Task 1
- post-entry-points Task 1

## 実装内容

- 見出しをスポット名（→ `/spots/[id]`）＋「タビコエだけの場所」ラベルにし、都道府県・カテゴリ・星・訪問日・滞在・費用を並べる
- 「いいね」「＋」（保存先シート）「地図で見る」（`/map?spot=`）「自分も投稿する」（`/posts/new?spot=`）を置く。非公開投稿ではいいね・コメント欄を出さない
- 本人の「⋯」に編集・削除（削除は右端）、他人には「通報」。写真のタップは `MediaModal`
- 「まだあった」の 2 ボタンの枠を用意する（中身は spot-status-report Task 2）

## 成果物

- `src/components/posts/PostDetailScreen.tsx`
- `src/lib/posts/post-detail.ts`（source・都道府県）

## テスト要件

### 単体テスト
- 見出しがスポット名でリンクになること
- 非公開投稿でいいね・コメント欄が無いこと
- 本人と他人でメニューが変わること

### 結合テスト
- なし

### E2Eテスト
- なし（[Task 2: 受入テスト（E2E）](02-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 「地図で見る」「＋」「自分も投稿する」のそれぞれから、地図・保存先シート・スポット確定済みの SC-03 へ遷移すること（受入条件56）
