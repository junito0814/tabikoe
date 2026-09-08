# F-AC-04 プロフィール編集 — タスク分割

> 出典: [profile-edit.md](../../../user-stories/account/profile-edit.md)

各タスクの詳細・テスト要件は個別ファイルを参照。ユーザー名編集系（Task1・2）と画像アップロード系（Task3〜5）は独立して並行着手できる。Task 6は全体の結合後に実施する。

なお本ストーリーは、F-AC-02（セッション検証Middleware）で確立済みの認証基盤を前提とする。またTask3の画像アップロード共通処理は、将来的に投稿の写真アップロード（F-PO）でも再利用する想定の共通モジュールとして設計する。

| # | タスク | 依存 |
|---|---|---|
| 1 | [ユーザー名更新 Route Handler実装](01-display-name-update-handler.md) | F-AC-02 Task1 |
| 2 | [ユーザー名編集UI実装（SC-07）](02-display-name-edit-ui.md) | 1 |
| 3 | [画像アップロード共通処理（EXIF除去・向き補正・縮小画像生成）の実装](03-image-upload-processing-common.md) | なし |
| 4 | [アイコン画像アップロード Route Handler実装](04-avatar-upload-handler.md) | 3, F-AC-02 Task1 |
| 5 | [アイコン画像アップロードUI実装（SC-07）](05-avatar-upload-ui.md) | 4 |
| 6 | [受入テスト（E2E）](06-acceptance-e2e.md) | 1〜5すべて |

各タスクファイルは「依存」「実装内容」「成果物」「テスト要件（単体／結合／E2E）」「関連する受入条件」の構成で統一している（[rule.md](../../../rule.md)のテストルール区分に準拠）。
