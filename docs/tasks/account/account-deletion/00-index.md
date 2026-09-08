# F-AC-05 退会 — タスク分割

> 出典: [account-deletion.md](../../../user-stories/account/account-deletion.md)

各タスクの詳細・テスト要件は個別ファイルを参照。Task 1が土台（退会処理の中核）で、Task 2・3はTask 1に依存しつつ並行して着手できる。Task 4（UI）はTask 1・3の完了後、Task 5はTask 1に依存し、Task 6は全体の結合後に実施する。

なお本ストーリーは、F-AC-02（セッション検証Middleware）・F-AC-03（ログアウト処理）で確立済みの基盤を前提とする。アルバムオーナー継承ルール（Task2）の詳細は要件定義書3.6.3に準拠する。管理者引き継ぎの具体的な運用手順（Task3）は9章の未決定事項であり、本タスク群では「確認を必須にする仕組み」のみを実装範囲とする。

| # | タスク | 依存 |
|---|---|---|
| 1 | [退会実行 Route Handler（ユーザー匿名化・関連データ削除）](01-deactivation-handler.md) | F-AC-02 Task1 |
| 2 | [アルバムオーナー継承ロジックの実装（3.6.3準拠）](02-album-owner-succession.md) | 1 |
| 3 | [管理者退会時の引き継ぎ確認フロー](03-admin-handover-confirmation.md) | 1 |
| 4 | [退会確認ダイアログUI実装](04-deletion-confirmation-dialog-ui.md) | 1, 3 |
| 5 | [退会後のプロフィール非表示処理](05-profile-visibility-after-deletion.md) | 1, F-AC-03 Task1 |
| 6 | [受入テスト（E2E）](06-acceptance-e2e.md) | 1〜5すべて |

各タスクファイルは「依存」「実装内容」「成果物」「テスト要件（単体／結合／E2E）」「関連する受入条件」の構成で統一している（[rule.md](../../../rule.md)のテストルール区分に準拠）。
