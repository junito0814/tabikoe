# Task 6: スポット情報の誤りは登録者に修正を依頼する（SC-29）

> 出典: [strike-system.md](../../../user-stories/safety/strike-system.md)
> インデックス: [strike-system](00-index.md)
> 要件定義書 3.10.6「スポット情報の誤り」・3.10.13

## 実装内容

- 通報詳細：対象が `spot` で理由が `wrong_spot_info` のとき、主ボタンを「登録者に修正を依頼する」にする（非公開化・問題なしは残す）。対象が Google 由来（`source != manual`）なら依頼ボタンは出さない
- `POST /api/admin/reports/[id]/request-fix`：通報を `in_review` にし、`spots.created_by` の利用者に通知（種類 `spot_fix_request`。管理者のメモを載せる）。ストライクは付けない。操作の記録に残す
- `PATCH /api/spots/[id]`（新規）：**本人が登録した `source = manual` のスポットだけ**、名前・都道府県・座標を更新できる。更新したら、そのスポットへの `wrong_spot_info` の未処理の通報を `no_issue`（対応理由「登録者が修正」）にする
- `src/app/spots/[id]/edit/page.tsx` と `SpotFixScreen`：通知から開く。wireframes SC-29 のとおり（名前・都道府県・地図でピンを動かす）
- 【初心者向け】管理者が全部直すのは回らないので、直せる人（登録者）に返す。Google 由来のスポットは Google のデータなのでこちらでは直せない

## テスト要件

### 単体テスト
- 依頼で登録者に通知が作られ、ストライクが付かないこと
- `PATCH /api/spots/[id]`：他人・Google 由来のスポットは 403。本人の手動スポットは更新でき、関連する通報が対応済みになること
- 通報詳細：条件を満たすときだけ依頼ボタンが出ること

## 関連する受入条件

- strike-system.md の受入条件 10
