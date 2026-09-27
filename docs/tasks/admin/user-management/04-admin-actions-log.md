# Task 4: 操作の記録（admin_actions）と画面（SC-27）

> 出典: [user-management.md](../../../user-stories/admin/user-management.md)
> インデックス: [user-management](00-index.md)
> 要件定義書 3.10.12

## 実装内容

- マイグレーション：`admin_actions`（id, actor_id（null＝自動）, action, target_type, target_id, target_label, note, created_at）。**UPDATE・DELETE を誰にも許可しない**（service_role でも INSERT のみ。RLS と GRANT で）
- `src/lib/admin/record-action.ts`（新規）：`recordAdminAction(admin, { actorId, action, target, note })`。他のタスク（通報対応・停止・復元・取り消し・規約の公開・お知らせ・自動処理）はすべてこれを呼ぶ
- `GET /api/admin/actions?actor=&action=&from=&to=&offset=`：新しい順。20 件ずつ
- `src/app/admin/actions/page.tsx` と `AdminActionsScreen`：wireframes SC-27 のとおり。自動は「自動」と表示
- 【初心者向け】管理者は他人のデータを消したりアカウントを止めたりできる。**後から説明できる記録**が無いと、間違えたときに何が起きたか辿れない。だから消せない作りにする

## テスト要件

### 単体テスト
- `recordAdminAction` が 1 行作り、`actorId` 無しなら自動として残ること
- API の絞り込み（管理者・操作・期間）
- （結合の代わりに）マイグレーションの文面で UPDATE・DELETE の権限が無いことを確認するテスト（SQL を読んで `grant update` が無いこと）

## 関連する受入条件

- user-management.md の受入条件 5
