# F-AC-03 ログアウト — タスク分割

> 出典: [logout.md](../../../user-stories/account/logout.md)

各タスクの詳細・テスト要件は個別ファイルを参照。本ストーリーはF-AC-01（ログイン時のCookie発行）・F-AC-02（セッション検証Middleware）で確立済みの基盤に乗る、比較的小規模なストーリーのため3タスクに分割する。

| # | タスク | 依存 |
|---|---|---|
| 1 | [ログアウト Route Handler（/api/auth/logout）](01-logout-route-handler.md) | F-AC-02 Task1, F-AC-01 Task4 |
| 2 | [プロフィール編集画面（SC-07）のログアウトUI実装](02-profile-screen-logout-ui.md) | 1 |
| 3 | [受入テスト（E2E）](03-acceptance-e2e.md) | 1, 2 |

各タスクファイルは「依存」「実装内容」「成果物」「テスト要件（単体／結合／E2E）」「関連する受入条件」の構成で統一している（[rule.md](../../../rule.md)のテストルール区分に準拠）。
