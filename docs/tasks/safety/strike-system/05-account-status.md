# Task 5: マイページ「アカウントの状態」（SC-28）

> 出典: [strike-system.md](../../../user-stories/safety/strike-system.md)
> インデックス: [strike-system](00-index.md)
> 要件定義書 3.10.13

## 実装内容

- `GET /api/users/me/account-status`：有効なストライク数・しきい値・今の制限（解除日）・次の措置・履歴（失効分も「失効」として。取り消し分は出さない）
- `src/app/account/status/page.tsx` と `AccountStatusScreen`：wireframes SC-28 のとおり。制限中は上に青い帯（解除日・使えること）。ストライクの丸 5 つ。履歴の各行に理由と規約の該当条へのリンク（legal-documents Task 1 の `/terms`）
- マイページ（SC-06）に「アカウントの状態」への導線を足す（制限中はマイページの先頭にも帯）
- 【初心者向け】通知は流れて見逃されるので、自分の状態を**いつでも自分で確かめられる場所**を作る（Meta の Account Status と同じ考え方）

## テスト要件

### 単体テスト
- API：有効なストライク数と失効分の区別、制限中の解除日
- 画面：制限中の帯・丸の数・履歴の理由とリンク

## 関連する受入条件

- strike-system.md の受入条件 3・9
