# タビコエ ドキュメント構成・進捗ダッシュボード

このファイルは、[requirement.md](requirement.md)（要件定義書）3.1の機能一覧を基準に、ユーザーストーリー・タスク分割の作成状況を一覧化したものです。**「完了」は文書化（ユーザーストーリー／タスク分割の作成）が完了していることを指し、実際のコード実装状況とは別軸です。** コード実装はまだごく初期段階（`src/app/login` 周辺のみ）のため、実装状況はこの表では管理していません。

## フォルダ構成

```
docs/
├── requirement.md         要件定義書（唯一の一次情報源）
├── request.md             要求定義書
├── rule.md                ドキュメント規約
├── README.md              このファイル
├── development-order.md   全ストーリーの実装順と実装状況（テーブル・コンポーネント依存に基づく。2026-09-11に実態へ改訂）
├── development-process.md タスク→Issue→実装→PRの進め方（ブランチ運用・コミット規約含む）
├── user-stories/          機能ごとのユーザーストーリー（受入条件つき）
│   ├── account/           F-AC アカウント管理
│   ├── posts/             F-PO 投稿
│   ├── map-search/        F-MP 地図・検索
│   ├── browsing/          F-VW 閲覧・交流
│   ├── records/           F-RC 記録・振り返り
│   ├── badges/            F-BG ステータスバッジ
│   ├── safety/            F-SF 安全・健全性維持
│   ├── notifications/     F-NT 通知
│   ├── admin/             F-AD 管理者機能
│   ├── shared-ui/         画面共通仕様（4.2, 4.5）
│   └── data-model/        データ設計の横断確認（5.2〜5.4）
└── tasks/                 ユーザーストーリーをタスクに分割したもの（各カテゴリ配下、user-storiesと同じ構成）
```

サブフォルダ名（例：`account/signup-login`）は要件定義書の機能ID（例：F-AC-01）に対応します。機能IDは各ファイルの見出し・`> 出典:` 行で確認できます。フォルダ名自体には機能IDを含めず、内容がひと目でわかる名前を採用しています。

## 機能カテゴリ別 進捗状況

要件定義書 3.1 に定義された **9カテゴリすべてでユーザーストーリー・タスク分割が完了** しました（2026年9月時点）。ドキュメント総数：ユーザーストーリー41件、タスクファイル226件（2026-09-15 に動画対応の追補 5 件を追加）。

| 機能ID | カテゴリ | 該当節 | 状況 | ストーリー数 | ドキュメント |
|---|---|---|---|---|---|
| F-AC | アカウント管理 | 3.2 | ✅ 完了 | 5 | [user-stories/account](user-stories/account/) / [tasks/account](tasks/account/) |
| F-PO | 投稿 | 3.3 | ✅ 完了 | 5 | [user-stories/posts](user-stories/posts/) / [tasks/posts](tasks/posts/) |
| F-MP | 地図・検索 | 3.4 | ✅ 完了 | 5 | [user-stories/map-search](user-stories/map-search/) / [tasks/map-search](tasks/map-search/) |
| F-VW | 閲覧・交流 | 3.5 | ✅ 完了 | 3 | [user-stories/browsing](user-stories/browsing/) / [tasks/browsing](tasks/browsing/) |
| F-RC | 記録・振り返り | 3.6 | ✅ 完了 | 5 | [user-stories/records](user-stories/records/) / [tasks/records](tasks/records/) |
| F-BG | ステータスバッジ | 3.7 | ✅ 完了 | 1 | [user-stories/badges](user-stories/badges/) / [tasks/badges](tasks/badges/) |
| F-SF | 安全・健全性維持 | 3.8 | ✅ 完了 | 2 | [user-stories/safety](user-stories/safety/) / [tasks/safety](tasks/safety/) |
| F-NT | 通知 | 3.9 | ✅ 完了 | 2 | [user-stories/notifications](user-stories/notifications/) / [tasks/notifications](tasks/notifications/) |
| F-AD | 管理者機能 | 3.10 | ✅ 完了 | 5 | [user-stories/admin](user-stories/admin/) / [tasks/admin](tasks/admin/) |

### カテゴリ詳細

| 機能ID | 内容 | ユーザーストーリー | タスク数 |
|---|---|---|---|
| F-AC-01 | サインアップ・ログイン | [signup-login.md](user-stories/account/signup-login.md) | 8 |
| F-AC-02 | セッション管理 | [session-management.md](user-stories/account/session-management.md) | 6 |
| F-AC-03 | ログアウト | [logout.md](user-stories/account/logout.md) | 3 |
| F-AC-04 | プロフィール編集 | [profile-edit.md](user-stories/account/profile-edit.md) | 6 |
| F-AC-05 | 退会 | [account-deletion.md](user-stories/account/account-deletion.md) | 6 |
| F-PO-01 | 投稿作成（3.3.1） | [post-creation.md](user-stories/posts/post-creation.md) | 6 |
| F-PO-01 | 動画対応（3.3.1・5.4、追補） | [post-creation.md](user-stories/posts/post-creation.md) / [tasks/posts/video-upload](tasks/posts/video-upload/00-index.md) | 4 |
| F-PO-01 | 旅行タイトル仕様（3.3.4） | [trip-title.md](user-stories/posts/trip-title.md) | 6 |
| F-PO-01 | スポット指定仕様（3.3.5） | [spot-selection.md](user-stories/posts/spot-selection.md) | 7 |
| F-PO-02 | 投稿編集 | [post-edit.md](user-stories/posts/post-edit.md) | 4 |
| F-PO-03 | 投稿削除 | [post-delete.md](user-stories/posts/post-delete.md) | 5 |
| F-MP-01 | 地図表示 | [map-display.md](user-stories/map-search/map-display.md) | 6 |
| F-MP-02 | 地名検索 | [place-search.md](user-stories/map-search/place-search.md) | 3 |
| F-MP-03 | ピン操作 | [pin-interaction.md](user-stories/map-search/pin-interaction.md) | 4 |
| F-MP-04 | 投稿検索・絞り込み | [post-filter.md](user-stories/map-search/post-filter.md) | 3 |
| F-MP-05 | スポット写真一覧 | [spot-photo-gallery.md](user-stories/map-search/spot-photo-gallery.md) | 5 |
| F-VW-01 | 投稿詳細閲覧 | [post-detail-view.md](user-stories/browsing/post-detail-view.md) | 4 |
| F-VW-02 | いいね | [likes.md](user-stories/browsing/likes.md) | 4 |
| F-VW-03 | コメント | [comments.md](user-stories/browsing/comments.md) | 7 |
| F-RC-01 | マイページ | [my-page.md](user-stories/records/my-page.md) | 5 |
| F-RC-02 | アルバム | [album.md](user-stories/records/album.md) | 5 |
| F-RC-03 | アルバム共同編集・招待 | [album-collaboration.md](user-stories/records/album-collaboration.md) | 8 |
| F-RC-05 | 「行きたい」保存 | [wishlist.md](user-stories/records/wishlist.md) | 4 |
| F-RC-06 | マイマップ | [my-map.md](user-stories/records/my-map.md) | 4 |
| F-BG | ステータスバッジ | [status-badges.md](user-stories/badges/status-badges.md) | 6 |
| F-SF-01 | 通報 | [reporting.md](user-stories/safety/reporting.md) | 5 |
| F-SF-02 | ブロック | [blocking.md](user-stories/safety/blocking.md) | 4 |
| F-NT-01 | 通知の発生条件 | [notification-triggers.md](user-stories/notifications/notification-triggers.md) | 3 |
| F-NT-02 | 通知一覧画面 | [notification-list.md](user-stories/notifications/notification-list.md) | 6 |
| F-AD-01 | 管理者ログイン | [admin-login.md](user-stories/admin/admin-login.md) | 3 |
| F-AD-02 | 管理者ダッシュボード | [admin-dashboard.md](user-stories/admin/admin-dashboard.md) | 2 |
| F-AD-03 | お知らせ管理 | [announcement-management.md](user-stories/admin/announcement-management.md) | 4 |
| F-AD-04 | 通報一覧 | [report-list.md](user-stories/admin/report-list.md) | 3 |
| F-AD-05 | 通報対応操作 | [report-handling.md](user-stories/admin/report-handling.md) | 4 |

## 横断ドキュメント（機能カテゴリに属さないもの）

| 種別 | 該当節 | ドキュメント | 備考 |
|---|---|---|---|
| 画面共通仕様 | 4.2, 4.5 | [user-stories/shared-ui](user-stories/shared-ui/) / [tasks/shared-ui](tasks/shared-ui/) | メニューバー・写真動画レイアウト・アップロード注意文・ピン表示ルール・エラー表示の5ストーリー |
| データ設計の横断確認 | 5.2〜5.4 | [user-stories/data-model](user-stories/data-model/) / [tasks/data-model](tasks/data-model/) | `table-catalog`＝どの機能ストーリーにも属さない共有テーブル（rate_limits, album_members, notifications, badges, comments/likes/wishlist/blocks, operation_logs）を定義。`design-principles`・`media-handling`＝5.3/5.4の設計方針の一貫適用を確認するストーリー（新規タスク不要） |

## テーブル定義の分担（5.2 17テーブル）

各機能が自らの中核テーブルを定義し、複数機能から参照される横断的なテーブルのみ`data-model/table-catalog`が担う、という分担です。

| 分担 | テーブル |
|---|---|
| 機能ストーリーが自ら定義 | users（F-AC-01）／trips・spots・posts・post_photos（F-PO-01）／album_invitations（F-RC-03）／reports（F-SF-01）／system_announcements（F-AD-03） |
| data-model/table-catalogが補完 | rate_limits／album_members／notifications／badges／comments・likes・wishlist・blocks／operation_logs |

## 作成時に判明した設計上の補足・要確認事項

ユーザーストーリー作成の過程で、要件定義書だけでは判断できず実装時に確認が必要な点がいくつか見つかりました。各該当ストーリーに記載済みですが、横断的なものをここにも記します。

- **ブロック管理画面**：要件定義書の画面一覧（4.1）に専用の画面IDがないため、`blocking`ストーリーではプロフィール編集画面（SC-07）内に配置する設計判断をしています（要件定義書には明記がない設計判断である旨を明記済み）。
- **通知の90日経過後の扱い**（9章 未決定事項#3）：`notification-list`ストーリーでは「非表示のみ（物理削除しない）」を暫定方針として記載していますが、要件定義書9章の未決定事項として最終確認が必要です。
- **operation_logsの保存期間経過後の扱い**：90日超のレコードを物理削除するか否かは本ドキュメントでは未確定のまま残しています（9章と同様の運用上の論点）。
- **RLSだけでは塞げない2経路**（要件定義書v2.7で反映済み）：Phase 0/1の実装監査で、RLSポリシーだけでは(1)本人による`is_admin`等の列の書き換え、(2)`security definer`関数の公開鍵からの実行、の2経路を塞げないことが判明しました。要件定義書5.3に「列単位のアクセス制御」「DB関数の実行権限」として追加済みです。詳細は[design-principles](user-stories/data-model/design-principles.md)の補足を参照してください。
- **退会したアルバムオーナーのメンバーシップの扱い**（要件定義書v2.7で反映済み）：オーナー継承後、退会者を閲覧者へ降格して残す扱いを3.6.3に追加しました。退会後も投稿がアルバムに残るためメンバーからは除外しない、という判断に基づきます。実装時に別の運用が必要になった場合は3.6.3の見直しが必要です。

## フォルダ命名の指針

- トップレベルは要件定義書3.1の分類を平易な英語にしたもの（`account`、`posts`、`map-search`等）。略号（`f-ac`等）は使わない。
- サブフォルダ・ファイル名は機能IDを含めず、内容がわかる名前にする（例：`signup-login`）。機能IDとの対応はファイル冒頭の見出しおよびこの`README.md`の表で管理する。
- 1つの機能ID（例：F-PO-01）が複数ストーリーに分かれる場合も、フォルダ名は各ストーリーの内容で命名する（機能IDは重複してよい）。
