# Task 3: 再同意（SC-30）：新しい版の公開後、同意するまで止める

> 出典: [legal-documents.md](../../../user-stories/admin/legal-documents.md)
> インデックス: [legal-documents](00-index.md)
> 要件定義書 3.10.11「再同意」

## 実装内容

- `src/lib/auth/reconsent.ts`（純粋関数）：`needsReconsent(publishedVersions, userConsents)` … 公開中の版のうち、本人が同意していない kind があるか
- `proxy.ts`：ログイン済みで `needsReconsent` が真なら、`/consent/renew`（SC-30）と認証・規約の API 以外は SC-30 へ送る。API は 401 `reconsent_required`（登録途中を止めている `pending-signup` と同じ形）
  - 判定に必要な「公開中の版」と「本人の同意」は毎リクエスト取りに行かず、**Cookie に同意済みの版を持ち**、公開中の版と違うときだけ DB を見る（往復を増やさない）
- `src/app/consent/renew/page.tsx` と `ReconsentScreen`：wireframes SC-30 のとおり。変更の要点・全文へのリンク・チェック・「同意して続ける」。`POST /api/legal/consent` で `user_consents` に記録し、元いた画面へ戻す
- 【初心者向け】「次にアプリを開いたとき」＝ proxy が最初に通るとき。ここで止めれば画面ごとに書かなくて済む

## テスト要件

### 単体テスト
- `needsReconsent`：未同意の kind があれば真、全部同意済みなら偽
- proxy：再同意が要るとき SC-30 に送られ、同意後は通ること。API は 401
- 画面：変更の要点と全文リンク、チェックしないと押せないこと

## 関連する受入条件

- legal-documents.md の受入条件 3・4
