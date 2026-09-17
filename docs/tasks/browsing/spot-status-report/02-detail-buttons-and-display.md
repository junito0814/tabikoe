# Task 2: 投稿詳細の 2 ボタンと表示

> 出典: [spot-status-report.md](../../../user-stories/browsing/spot-status-report.md)
> インデックス: [spot-status-report](00-index.md)

## 依存

- Task 1
- post-detail-view-v3 Task 1

## 実装内容

- 投稿詳細に「この場所、まだありますか？」と「まだあった」「無くなっていた」を置き、自分の報告状態を選択表示にする。押すと Task 1 を呼んで即時反映
- 最新の報告を「9月にまだあった」「8月に無くなっていたとの報告」の形式（`format-status-label.ts`、JST の月）で表示する

## 成果物

- `src/components/spots/SpotStatusButtons.tsx`
- `src/lib/spots/format-status-label.ts`

## テスト要件

### 単体テスト
- ラベル整形（still_there／gone × 月）
- 自分の報告が選択状態で表示されること

### 結合テスト
- なし

### E2Eテスト
- なし（[Task 4: 受入テスト（E2E）](04-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 投稿詳細の「まだあった／無くなっていた」が 1 人 1 件で上書きでき、最新の報告が「9月にまだあった」のように投稿カードと詳細に表示され、投稿者に通知されないこと（受入条件55）
