# Task 1: 通報一覧取得・絞り込み Route Handler

> 出典: [report-list.md](../../../user-stories/admin/report-list.md)
> インデックス: [report-list](00-index.md)

## 依存

- safety/reporting Task1: reportsテーブルのスキーマ定義・マイグレーション（`docs/tasks/safety/reporting/`、F-SF-01側で作成予定）
- admin-login [Task1: 管理画面ルートMiddlewareの実装（is_admin判定・404）](../../admin/admin-login/01-admin-route-middleware.md)

## 実装内容

- `reports`テーブルから通報一覧を取得するAPIを実装する
- 対応状態（未確認／確認中／対応済み（非公開化）／対応済み（削除）／問題なし）・通報理由・対象種別・通報日時での絞り込みに対応する
- 通報された対象（投稿・写真・動画・コメント等）の内容を取得する詳細取得APIを実装する

## 成果物

- `app/api/admin/reports/route.ts`（一覧・絞り込み）
- `app/api/admin/reports/[id]/route.ts`（詳細取得）

## テスト要件

### 単体テスト
- 対応状態・通報理由・対象種別・日時の各絞り込み条件が正しくクエリに反映されることを検証する
- 複数条件を組み合わせた絞り込みが正しく動作することを検証する

### 結合テスト
- テスト用DBに複数の通報レコード（対応状態・対象種別が異なるもの）を用意し、絞り込み結果が期待通りであることを確認する
- 通報対象の詳細取得APIが、対象種別に応じた元データ（投稿・コメント等）を正しく返すことを確認する

### E2Eテスト
- なし（[Task 3: 受入テスト（E2E）](03-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 対応状態・通報理由・対象種別・通報日時で通報一覧を絞り込めること
- 一覧から通報対象（投稿・写真・動画・コメント等）の内容を確認する画面へ遷移できること
