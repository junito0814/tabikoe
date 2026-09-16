# Task 2: タイムライン UI（カード・並び替え・絞り込みシート）

> 出典: [post-timeline.md](../../../user-stories/map-search/post-timeline.md)
> インデックス: [post-timeline](00-index.md)

## 依存

- Task 1
- theme Task 3
- media-layout-v3 Task 1

## 実装内容

- `PostCard` を縦一列のタイムライン用に作り替える：見出し＝スポット名（＋「タビコエだけの場所」）、投稿者・訪問日・徒歩 N 分、感想の冒頭 2 行、星評価（黄＋「星4」）、予算、カテゴリ、写真（`MediaGrid`）、「9月にまだあった」、いいね・コメント件数、「地図で見る」、「＋」
- 並び替えを「新着順 ▾」の 1 ボタン＋ドロップダウンにする
- 絞り込みを下からのシートにし、適用中の条件数を「絞り込み」ボタンに表示する。距離は基準点があるときだけ出す
- カード上のコメント展開は v1 のまま

## 成果物

- `src/components/posts/PostCard.tsx`
- `src/components/posts/PostSearchScreen.tsx`
- `src/components/posts/SortDropdown.tsx`
- `src/components/posts/FilterSheet.tsx`

## テスト要件

### 単体テスト
- カードに必須要素がすべて描画されること
- 並び替えドロップダウンで選択がボタン表示に反映されること
- 基準点が無いとき距離の絞り込みが出ないこと

### 結合テスト
- なし

### E2Eテスト
- なし（[Task 5: 受入テスト（E2E）](05-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 並び替えが 1 つのボタンのドロップダウンで、新着順／評価順／いいね順を切り替えられること
- 現在地が取れているときだけ「徒歩 N 分」が表示されること
