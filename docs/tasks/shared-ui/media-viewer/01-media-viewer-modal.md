# Task 1: MediaViewerModal 共通コンポーネント

> 出典: [media-viewer.md](../../../user-stories/shared-ui/media-viewer.md)
> インデックス: [media-viewer](00-index.md)

## 依存

- media-layout [Task 1](../media-layout/01-grid-layout-component.md)（`MediaItem` 型・`MediaThumbnail`）

## 実装内容

- `MediaViewerModal({ items, index, onIndexChange, onClose, link? })` を実装する。全画面の黒背景に、写真は `object-contain`、動画は `<video controls autoPlay playsInline>` で表示する
- 複数点の移動: 画面上の←→ボタン、`ArrowLeft`／`ArrowRight` キー、左右スワイプ（横移動 50px 以上）。端では止まる（ボタンを無効化）。現在位置「n / N」を表示。1点のみなら←→を出さない
- 閉じる: ×ボタン、`Escape`、背景タップ（写真・動画・ボタン自体のタップでは閉じない）
- `role="dialog"` `aria-modal`、開いた時に閉じるボタンへフォーカス、表示中は `body` のスクロールを止め、閉じたら戻す（7.7）
- `link(item, index)` で位置ごとの導線（スポット写真一覧の「この投稿を見る」）を差し込める

## 成果物

- `src/components/media/MediaViewerModal.tsx`

## テスト要件

### 単体テスト
- ←→ボタン・矢印キー・スワイプで前後に移動し、端では止まる（ループしない）ことを検証する
- Esc・閉じるボタン・背景タップで閉じ、写真自体のタップでは閉じないことを検証する
- 動画の位置では `<video>` が出ることを検証する
- 1点のみで←→が出ないこと、`link` が位置ごとに変わることを検証する

### 結合テスト
- 対象外（Task 2〜4 の組み込み先で確認する）

### E2Eテスト
- なし（[Task 5](05-acceptance-e2e.md) でまとめて検証する）

## 関連する受入条件

- 複数点ある場合に←→ボタン・矢印キー・左右スワイプで前後に移動でき、端で止まること
- 動画がモーダル内で再生されること
- ×ボタン・Esc・背景タップで閉じ、元の画面の位置に戻ること
