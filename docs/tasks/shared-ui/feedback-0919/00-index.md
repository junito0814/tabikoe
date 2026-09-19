# 画面遷移マップの見直しで出た追加要望（v3.2） — タスク分割

> 出典: [feedback-0919.md](../../../user-stories/shared-ui/feedback-0919.md)

v3.1（[mentoring-7](../mentoring-7/00-index.md)、#421）の後に行う。Task 1〜3 はそれぞれ独立。Task 4（返信）の上に Task 5（プレビュー）、Task 6（招待）は通知の追加を含む。Task 3（モーダル）と Task 7（移動手段）は v3.1 の Task 5・Task 7 の上に重ねる。シートのドラッグは v3.1 の [Task 11](../mentoring-7/11-sheet-drag.md) で作る共通部品を使う。

| # | タスク | 依存 |
|---|---|---|
| 1 | [滞在時間の 7 択と「宿泊施設」の自動入力](01-stay-time.md) | なし |
| 2 | [スポット登録バッジ（spots.created_by）](02-spot-badge.md) | なし |
| 3 | [写真タブのモーダル（情報バー＋この投稿を見る）](03-photo-modal.md) | v3.1 Task 5（#426） |
| 4 | [コメントへの返信（parent_id・表示・通知・削除の枠）](04-comment-reply.md) | なし |
| 5 | [投稿カードのコメントプレビュー](05-comment-preview.md) | Task 4 |
| 6 | [しおり・アルバムのアプリ内招待（候補・検索・通知）](06-in-app-invite.md) | なし |
| 7 | [探すモードの移動手段（徒歩／自転車／車）](07-travel-mode.md) | v3.1 Task 7（#428） |
| 8 | [受入テスト（E2E）](08-acceptance-e2e.md) | Task 1〜7 すべて |

各タスクファイルは「依存」「実装内容」「成果物」「テスト要件（単体／結合／E2E）」「関連する受入条件」の構成で統一している（[rule.md](../../../rule.md)のテストルール区分に準拠）。
