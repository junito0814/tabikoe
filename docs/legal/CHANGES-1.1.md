# 版 1.1 の変更点（1.0 から）

> 出典: Issue #630（利用規約・個人情報保護方針を書き直す）
> 2026-10-02 作成。確認は #629 で行う

## なぜ書き直したか

1.0 は条文の数が少なく、**抜けがありました**。タビコエと似た機能を持つサービス（X・Instagram・Google マップ）の規約を調べ、観点を拾って埋めました。

**大手の規約は丸写しできません**（事業規模も体制も違います）。構成と観点だけを参考にし、文面はタビコエの実装に合わせて書いています。

## 調べたこと

| サービス | 拾った観点 | 分かったこと |
|---|---|---|
| **X** | 投稿物のライセンス、段階的な制限、年齢 | 「権利は投稿者のもの」と明記したうえで、運営に必要な範囲の許諾を受ける形。13 歳以上。ただし X は「あらゆる媒体・あらゆる目的で」「再許諾の権利付き」という**非常に広い**許諾を取っている |
| **Instagram** | 写真・動画の権利、削除したものがいつ消えるか | 同じく「権利は投稿者のもの」。**許諾はコンテンツが削除された時点で終わる**と明記。削除後もバックアップに一定期間残ることを正直に書いている。13 歳以上 |
| **Google マップ** | 地図を使うアプリに課される義務 | **アプリ自身の規約とプライバシーポリシーに、Google の規約を取り込む義務がある**（下記） |

### X・Instagram と同じにしなかったところ

両社の許諾は「あらゆる媒体」「あらゆる目的」「再許諾の権利付き」と**非常に広い**ものです。タビコエはそこまで要りません。そこで**用途を 3 つに限定して列挙**し（画面への表示・縮小画像の作成・バックアップ）、さらに次の 2 つを明記しました。

- 投稿を**本サービスの外（広告・他の媒体）で使わない**
- 他の利用者に**再利用を許諾しない**

許諾が終わる時点については、**Instagram の書き方を採りました**（削除した時点で終わる。ただしバックアップに一定期間残る）。利用者にとって分かりやすく、実装と一致しています。

## Google マップの必須表示（いちばん大事）

Google Maps Platform の規約により、**地図を使うアプリは自分の規約とプライバシーポリシーに Google の規約を取り込む義務があります。**

> The Customer Application's terms of service must (A) notify users that the Customer Application includes Google Maps features and content; and (B) state that use of Google Maps features and content is subject to the then-current versions of the Google Maps End User Additional Terms of Service and Google Privacy Policy.
> — Google Maps Platform Terms of Service

> Applications using the Maps JavaScript API must provide publicly accessible Terms of Use and a Privacy Policy that incorporates Google's Terms of Service and Privacy Policy, respectively.
> — [Policies and attributions for Maps JavaScript API](https://developers.google.com/maps/documentation/javascript/policies)

**1.0 にはこれが 1 文字もありませんでした。** 規約違反の状態です。1.1 で両方に入れました。

- 利用規約 第9条（地図とスポット情報）
- 個人情報保護方針 8.（地図の利用について）

リンク先は日本語版を指しています。

- [Google マップ／Google Earth 追加利用規約](https://www.google.com/intl/ja/help/terms_maps/)
- [Google プライバシーポリシー](https://policies.google.com/privacy?hl=ja)

## 埋めた抜け（7 つ）

| 項目 | 1.0 | 1.1 |
|---|---|---|
| Google マップの必須表示 | **無し** | 規約 第9条・方針 8. |
| 投稿物の権利の扱い | 1 文だけ | 規約 第4条（用途を 3 つに限定、外部利用の禁止を明記） |
| 年齢・未成年 | 無し | 規約 第2条・方針 13.（13 歳以上、18 歳未満は保護者の同意） |
| 開示・訂正・削除の請求 | 無し | 方針 11.（5 種類の請求、本人確認の方法、2 週間、手数料なし） |
| 保存期間 | 無し | 方針 5.（表で一覧） |
| Cookie・端末に保存するもの | 無し | 方針 6.（5 種類を表で列挙） |
| 裁判管轄 | 準拠法のみ | 規約 第15条（東京地方裁判所） |

## タビコエ固有で書いたこと（実装を確認済み）

文面を書く前に、**すべてコードとマイグレーションで確認しました。**

| 内容 | 確認した場所 |
|---|---|
| 端末の位置そのものは保存しない | 要件 7.4、`docs/requirement.md:1590` |
| 最終利用日は 1 日 1 回 | `supabase/migrations/20260927000004_last_active_at.sql`、`src/proxy.ts:143`（Cookie で 1 日 1 回に抑える） |
| ストライクは 90 日で失効 | `moderation_settings.strike_expiry_days = '90'` |
| 制限の段階（警告・3 日・7 日・30 日・停止） | `moderation_settings.restriction_days = '[0, 3, 7, 30]'`、`strikes_to_suspend = '5'` |
| 異なる通報者 3 人で自動非公開 | `moderation_settings.auto_hide_reporters = '3'` |
| 事実と異なる通報を繰り返す人は数えない | `moderation_settings.unreliable_reporter_no_issue = '3'`（**1.0 には書いていなかった**ので足しました） |
| 下書きは本人以外に一切配信しない | 要件 7.4 |
| アルバムとしおりの招待は別々 | `docs/requirement.md:1039` |
| 退会時にオーナーを自動で選び直す | `docs/requirement.md:293`・3.6.3 |
| 通知は 90 日 | `src/lib/notifications/feed.ts:15`（`NOTIFICATION_RETENTION_DAYS = 90`） |
| 運営者の対応の記録は消さない | `docs/requirement.md:1416`（`admin_actions` は書き換え・削除ができない） |

## 1.0 に書いてあって、実装と食い違っていたもの

**「操作の記録（操作ログ）。90 日で消します」が、実装では消えていません。**

要件 7.5 には「保存期間 90 日」とありますが、マイグレーションにこう書かれています。

```sql
-- 90日超の物理削除バッチは本タスクの対象外（運用上の未決定事項、9章に準じる）。
-- supabase/migrations/20260911000002_create_operation_logs_table.sql:10
```

つまり**今は消えていません。** 公開中の 1.0 は、実際には行っていないことを書いている状態です。

1.1 の文面は要件どおり「90 日」と書いていますが、**これは実装すべき宿題です。** 別の Issue を立てるべきかどうか、#629 でご判断ください（削除の仕組みを入れるか、文面を実態に合わせるかの二択です）。

## 入れなかったもの（理由つき）

| 検討したが入れなかったもの | なぜ |
|---|---|
| 広告・解析に関する条項 | 使っていません。使っていないものについて書くと、かえって誤解を招きます |
| 有料プラン・課金の条項 | ありません |
| 大手にある「異議申し立ての専用手続」 | 体制がありません。代わりに**お問い合わせ窓口で受ける**と書きました（規約 第8条 5 項） |
| 「あらゆる媒体・あらゆる目的」の広い許諾 | 要りません（上記のとおり用途を限定しました） |
| 運営者の住所をページに載せること | 個人情報保護法は「本人の知り得る状態」であればよく、**請求に応じて遅滞なく回答する体制**でも足ります。卒業制作のため、運営者ご自身の住所を公開しない形にしました（方針 1.） |

## 埋めていただく必要がある箇所（3 つ）

文面の中に、私では決められない箇所が残っています。

| 箇所 | 入れるもの | 調べ方 |
|---|---|---|
| 方針 1.「運営者」 | 運営者の氏名 | — |
| 規約 第13条・方針 1.・11. | 連絡先メールアドレス | — |
| 方針 7.「Supabase」の所在 | 本番の Supabase のリージョン | Supabase → Settings → General に出ます |
| 両方の末尾 | 制定日（公開する日） | — |

**リージョンについて** ── `docs/user-stories/shared-ui/performance.md:18` に「約 50ms（東京リージョン）」とあるので東京だと思われますが、**これは速度の記述からの推測**です。法務文書に推測を書くわけにはいかないので、管理画面の実際の値をご確認ください。日本国内か国外かで、方針の書き方が変わります。

**連絡先について** ── 普段お使いのメールアドレスをそのまま載せると、公開の場に出ます。**この用途だけの新しいアドレスを作ることをおすすめします。**

## 文面に入れた外部リンク（実在を確認済み・2026-10-02）

| リンク | 応答 |
|---|---|
| [Google マップ／Google Earth 追加利用規約](https://www.google.com/intl/ja/help/terms_maps/) | 200 |
| [Google プライバシーポリシー](https://policies.google.com/privacy?hl=ja) | 200 |
| [Supabase Privacy Policy](https://supabase.com/privacy) | 200 |
| [Vercel Privacy Policy](https://vercel.com/legal/privacy-policy) | 200 |

## 公開の手順

1. #629 でこの文面を読み、直したいところを伝える
2. 上の 3 箇所を埋める
3. 管理画面 → 規約管理（SC-26）から、**版 1.1 として新規作成 → 公開**
4. 公開すると、利用者は次に開いたときに再同意を求められる（`user_consents` に版ごとに記録される）

**マイグレーションの初期データ（`20260927000010_legal_documents.sql`）は触りません。** あれは 1.0 の初期データで、新しい版は管理画面から入れる作りになっています。
