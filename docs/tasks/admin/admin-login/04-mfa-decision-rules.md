# Task 4: 二段階確認の判定を純粋関数に切り出す

> 出典: [admin-login.md](../../../user-stories/admin/admin-login.md)
> インデックス: [admin-login](00-index.md)

## 依存

- なし（この関数だけで完結する。以降の Task 5〜8 がこれを使う）

## 実装内容

「二段階確認を求めるか／どこへ送るか」の判断を、画面もデータの取り方も知らない純粋関数にまとめる（[rule.md](../../../rule.md) の「判断は純粋関数に切り出す」）。関所・画面・操作 API の 3 か所が同じ判断を共有するため、ここだけをテストすれば足りるようにする。

`src/lib/admin/mfa-gate.ts` に次の関数を置く。

| 関数 | 入力 | 返り値 |
|---|---|---|
| `adminGateDecision` | `{ isAdmin, aal, verifiedAt, now, hasFactor }` | `"not_found"`（404）／`"enroll"`（SC-32 の登録）／`"verify"`（SC-32 の 6 桁）／`"allow"` |
| `needsStepUp` | `{ lastVerifiedAt, now }` | 直近 10 分以内に 6 桁を入れていなければ `true` |
| `ADMIN_SESSION_MAX_AGE_SECONDS` | ― | 3600（60 分） |
| `ADMIN_STEP_UP_MAX_AGE_SECONDS` | ― | 600（10 分） |

判断の順番を固定する（先に `is_admin` を見ることで、管理者でない人に二段階確認の画面の存在を知らせない）。

1. `isAdmin` が false → `"not_found"`
2. `hasFactor` が false → `"enroll"`
3. `aal` が `aal2` でない → `"verify"`
4. `verifiedAt` から 60 分を過ぎている → `"verify"`
5. それ以外 → `"allow"`

しきい値（60 分・10 分）は定数として持ち、判定の中に直書きしない（要件 3.10.1）。

## 成果物

- `src/lib/admin/mfa-gate.ts`
- `src/lib/admin/mfa-gate.test.ts`

## テスト要件

### 単体テスト
- `isAdmin` が false のとき、`hasFactor` や `aal` がどんな値でも `"not_found"` になること（管理者判定が最優先であること）
- `hasFactor` が false なら `"enroll"`、登録済みで `aal1` なら `"verify"` になること
- `aal2` かつ `verifiedAt` が 59 分前なら `"allow"`、61 分前なら `"verify"` になること（境界）
- `verifiedAt` が未来・不正な値・null のときに `"allow"` を返さないこと（安全側に倒す）
- `needsStepUp` が 9 分前で false、11 分前と null で true になること（境界）

### 結合テスト
- なし（依存が無いため単体で足りる）

### E2Eテスト
- なし（[Task 9: 受入テスト（E2E）](09-acceptance-e2e-mfa.md) でまとめて検証する）

## 関連する受入条件

- SC-32 を含む `/admin` 配下・`/api/admin` 配下のすべてで、`is_admin` が false と未ログインは 404 になること
- 二段階確認から 60 分を過ぎると管理画面で聞き直されること
