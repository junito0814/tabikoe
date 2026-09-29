# Task 7: 重い操作の前の再確認（10 分）

> 出典: [admin-login.md](../../../user-stories/admin/admin-login.md)
> インデックス: [admin-login](00-index.md)

## 依存

- [Task 4: 二段階確認の判定を純粋関数に切り出す](04-mfa-decision-rules.md)
- [Task 5: 管理者の二段階確認画面（SC-32）](05-mfa-screen.md)
- [Task 6: 関所で `aal2` と 60 分を必須にする](06-proxy-aal2-gate.md)

## 実装内容

取り消せない操作・影響が大きい操作は、確定の直前に**直近 10 分以内の 6 桁**を求める（要件 3.10.1）。関所ではなく**操作ごとの API の中**で確かめる（GET で閲覧するだけの API には求めない）。

### 対象の API

| API | 条件 |
|---|---|
| `POST /api/admin/reports/[id]/action` | **`delete` のときだけ**。`hide`（非公開化）・`dismiss`（問題なし）は復元できるので求めない |
| `POST /api/admin/users/[id]/suspend` | つねに |
| `POST /api/admin/users/[id]/unsuspend` | つねに |
| `POST /api/admin/users/[id]/confirm-suspension` | つねに（仮停止の確定・取り消しの両方） |
| `POST /api/admin/strikes/[id]/revoke` | つねに |
| `POST /api/admin/legal/[id]/publish` | つねに（全利用者に再同意を求める操作のため） |

`src/lib/admin/require-step-up.ts` に共通の関門を置き、各 API の先頭で呼ぶ。Task 4 の `needsStepUp` を使う。

### 足りないときの返し方

- **409 と `error: "step_up_required"`** を返す（401 だと「ログインが切れた」と区別できない）。
- 画面側はその場で 6 桁の入力を出し、入れ直したら**同じ操作をもう一度送る**。SC-32 へ画面ごと転送しない（入力した理由メモを失わせない）。
- 6 桁の確認は `challenge()` → `verify()` を通し、成功したら Task 5 の Cookie の時刻を更新する。

### 記録

再確認を求めたこと・通ったことは操作の記録（3.10.12）には残さない。残すのは**実行された操作そのもの**だけ（記録の読みやすさを保つ）。ただし 6 桁が続けて失敗した場合の扱いは Supabase Auth 側の制限に任せ、自前のカウンタは置かない（要件 7.3）。

## 成果物

- `src/lib/admin/require-step-up.ts`
- 上の表の 6 つの Route Handler（先頭に関門を追加）
- `src/components/admin/StepUpDialog.tsx`（その場で 6 桁を入れる小窓）
- 各ファイルのテスト

## テスト要件

### 単体テスト
- `require-step-up` が、9 分前に確認済みなら通し、11 分前・未確認なら 409 と `step_up_required` を返すこと
- `reports/[id]/action` が `delete` のときだけ関門を通り、`hide`・`dismiss` では通らないこと
- 6 桁が違うときに操作が実行されないこと（DB への書き込みが起きないこと）
- 小窓で 6 桁を入れ直したあと、**最初に入力した理由メモを付けたまま**同じ操作が再送されること

### 結合テスト
- 11 分前に確認したセッションで停止を送ると 409 になり、6 桁を入れてから送り直すと成功して `admin_actions` に 1 行増えること
- 同じ流れで、`admin_actions` に「再確認」という行が増えていないこと

### E2Eテスト
- なし（[Task 9](09-acceptance-e2e-mfa.md) でまとめて検証する）

## 関連する受入条件

- 削除／停止・解除・仮停止の確定・取り消し／ストライクの取り消し／規約の公開を確定するとき、直近 10 分以内に 6 桁を入れていなければ確定前に聞き直され、間違った 6 桁では操作が実行されないこと
