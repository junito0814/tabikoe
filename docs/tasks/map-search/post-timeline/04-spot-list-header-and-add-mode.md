# Task 4: スポット別一覧の見出しと追加モードバナー

> 出典: [post-timeline.md](../../../user-stories/map-search/post-timeline.md)
> インデックス: [post-timeline](00-index.md)

## 依存

- Task 2
- add-spots Task 2

## 実装内容

- `SpotPostListScreen` の見出しをスポット名＋「地図で見る」「＋」「投稿する」にし、投稿が無ければ「まだ投稿がありません」
- `?itinerary=<id>&day=<n>` があるとき画面上部に固定バナー「〈旅行タイトル〉 Day n に追加中 [完了]」を出し、カードの「＋」をしおり直接追加に切り替える（add-spots Task 2 の部品）

## 成果物

- `src/components/posts/SpotPostListScreen.tsx`
- `src/components/posts/AddModeBanner.tsx`

## テスト要件

### 単体テスト
- バナーの表示条件と「完了」の遷移先

### 結合テスト
- なし

### E2Eテスト
- なし（[Task 5: 受入テスト（E2E）](05-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 投稿一覧が縦一列のタイムラインで、各カードにスポット名（見出し）・星評価・予算・訪問日・写真・「地図で見る」・「＋」が表示され、20 件ずつ追加読み込みされること（受入条件45）
