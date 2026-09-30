# タビコエ ドキュメント構成・進捗ダッシュボード

このファイルは **`docs/` の案内図**です。「どのファイル・フォルダが何を担当しているか」「1 つの機能をどの順に読むか」「どの機能にどのストーリー・タスクがあるか」をまとめています。

- **仕様の一次情報源は [requirement.md](requirement.md)（要件定義書）**。この README と食い違ったら要件定義書が正
- **いま何が実装済みかは [development-order.md](development-order.md)**（Phase 1〜17）
- この README の表にある数字は**文書の数**であって、実装の進み具合ではありません

> 2026-09-29 時点：ユーザーストーリー **67 件**、タスクファイル **428 件**（ストーリーフォルダ 83 件）。

## docs/ の中身

```
docs/
├── requirement.md          要件定義書。仕様の唯一の一次情報源（機能・画面・データ・非機能・受入条件）
├── request.md              要求定義書。「何をしたいか」と、いつ何を変えたかの改訂表
├── wireframes.md           ワイヤーフレーム。画面の絵・遷移図・決定事項（要件定義書 4.3・4.4 の別紙）
├── rule.md                 命名規約とテストの書き方
├── development-process.md  タスク → Issue → 実装 → PR の進め方（ブランチ運用・コミット規約）
├── development-order.md    実装の順番と進み具合（Phase 別）。「いま何が終わっているか」はここ
├── deployment.md           Vercel への出し方・環境変数（本番／プレビュー）
├── source-structure.md     src/ のフォルダ構成。どのフォルダが何を担当しているか
├── README.md               このファイル
├── user-stories/           機能ごとの「誰が・何を・なぜ」と受入条件
└── tasks/                  ユーザーストーリーを実装できる単位に割ったもの（user-stories と同じカテゴリ構成）
```

進め方の約束（Claude への指示・やり取りで決まったルール）はリポジトリ直下の **[AGENTS.md](../AGENTS.md)** にあります。

### 目的別の早見表

| 知りたいこと | 見るファイル |
|---|---|
| 仕様（何が正しいか） | [requirement.md](requirement.md) |
| なぜそう決めたか・いつ変えたか | [request.md](request.md) の改訂表、[wireframes.md](wireframes.md) の決定事項 |
| 画面の見た目・画面遷移 | [wireframes.md](wireframes.md) |
| いま何が実装済みか・次に何をやるか | [development-order.md](development-order.md) |
| 実装の進め方・PR の書き方 | [development-process.md](development-process.md)、[rule.md](rule.md)、[AGENTS.md](../AGENTS.md) |
| デプロイ・環境変数 | [deployment.md](deployment.md) |
| コードのどこを見ればよいか | [source-structure.md](source-structure.md) |
| ある機能の詳しい仕様と作業単位 | `user-stories/` → `tasks/`（下記） |

## 1 つの機能をどう読むか

機能ごとに **ストーリー 1 ファイル ＋ タスク 1 フォルダ** が対になっています。読む順番は次の 3 段です。

```
docs/user-stories/<カテゴリ>/<スラッグ>.md      ① 何を作るか・なぜか・受入条件
docs/tasks/<カテゴリ>/<スラッグ>/00-index.md    ② タスクの一覧と依存関係（どれから着手するか）
docs/tasks/<カテゴリ>/<スラッグ>/01-〇〇.md     ③ タスク 1 件の中身（実装内容・テスト要件・関連する受入条件）
```

例：しおりの作成 → [user-stories/itinerary/itinerary-basics.md](user-stories/itinerary/itinerary-basics.md) →
[tasks/itinerary/itinerary-basics/00-index.md](tasks/itinerary/itinerary-basics/00-index.md) → `01-itineraries-table.md` …

### 各ファイルの中身

| ファイル | 決まった見出し |
|---|---|
| ストーリー（`<スラッグ>.md`） | `> 出典:`（要件定義書の該当節）／ユーザーストーリー／背景／詳細／**受入条件**（チェックリスト） |
| タスク一覧（`00-index.md`） | タスクの表（# ／タスク名へのリンク／**依存**）。依存の順に着手する |
| タスク（`01-〜.md`） | `> 出典:`（ストーリーとインデックスへのリンク）／実装内容／**テスト要件**／関連する受入条件 |

### フォルダ名の約束

- カテゴリ名は要件定義書 3.1 の分類を平易な英語にしたもの（`account`・`posts`・`map-search` など）。略号（`f-ac` など）は使わない
- スラッグには機能 ID を入れず、内容が分かる名前にする（例：`signup-login`）。機能 ID との対応はファイル冒頭の見出しと、この README の表で管理する
- 1 つの機能 ID が複数のストーリーに分かれてよい（例：F-PO-01 は 4 ストーリー）
- **`<スラッグ>-v3`**（例：`tasks/posts/post-creation-v3`）は、v3.0 で作り直したときのタスク。**v1 のフォルダは履歴として残してある**ので、実装するときは新しい方（`-v3`）を見る
- `tasks/map-search/` の `place-search`・`post-filter`・`spot-photo-gallery` は v1 のタスクで、ストーリーはそれぞれ `search-top`・`post-timeline`・`photo-view` に改名済み（フォルダだけ残している）

## 機能カテゴリ別の一覧

要件定義書 3.1 の 10 カテゴリすべてで、ユーザーストーリーとタスク分割ができています。

| 機能ID | カテゴリ | 該当節 | ストーリー数 | ドキュメント |
|---|---|---|---|---|
| F-AC | アカウント管理 | 3.2 | 5 | [user-stories/account](user-stories/account/) / [tasks/account](tasks/account/) |
| F-PO | 投稿 | 3.3 | 7 | [user-stories/posts](user-stories/posts/) / [tasks/posts](tasks/posts/) |
| F-MP | 地図・検索 | 3.4 | 9 | [user-stories/map-search](user-stories/map-search/) / [tasks/map-search](tasks/map-search/) |
| F-VW | 閲覧・交流 | 3.5 | 4 | [user-stories/browsing](user-stories/browsing/) / [tasks/browsing](tasks/browsing/) |
| F-RC | 記録・振り返り | 3.6 | 6 | [user-stories/records](user-stories/records/) / [tasks/records](tasks/records/) |
| F-BG | ステータスバッジ | 3.7 | 1 | [user-stories/badges](user-stories/badges/) / [tasks/badges](tasks/badges/) |
| F-SF | 安全・健全性維持 | 3.8、3.10.7〜3.10.8 | 3 | [user-stories/safety](user-stories/safety/) / [tasks/safety](tasks/safety/) |
| F-NT | 通知 | 3.9 | 2 | [user-stories/notifications](user-stories/notifications/) / [tasks/notifications](tasks/notifications/) |
| F-AD | 管理者機能 | 3.10 | 8 | [user-stories/admin](user-stories/admin/) / [tasks/admin](tasks/admin/) |
| F-IT | しおり | 3.11 | 7 | [user-stories/itinerary](user-stories/itinerary/) / [tasks/itinerary](tasks/itinerary/) |
| （横断） | 画面共通仕様 | 4.2、4.5 | 13 | [user-stories/shared-ui](user-stories/shared-ui/) / [tasks/shared-ui](tasks/shared-ui/) |
| （横断） | データ設計の確認 | 5.2〜5.4 | 3 | [user-stories/data-model](user-stories/data-model/) / [tasks/data-model](tasks/data-model/) |

## カテゴリ詳細（全 67 ストーリー）

タスク数は `00-index.md` を除いた数。「＋v3 N」は `-v3` フォルダにある作り直し分。

### F-AC アカウント管理（3.2）

| 機能ID | ストーリー | 内容 | タスク |
|---|---|---|---|
| F-AC-01 | [signup-login](user-stories/account/signup-login.md) | サインアップ・ログイン（Google 1 回で登録） | 9（＋v3 2） |
| F-AC-02 | [session-management](user-stories/account/session-management.md) | セッション管理（検証・更新・30 日失効） | 6 |
| F-AC-03 | [logout](user-stories/account/logout.md) | ログアウト | 3 |
| F-AC-04 | [profile-edit](user-stories/account/profile-edit.md) | プロフィール編集 | 6 |
| F-AC-05 | [account-deletion](user-stories/account/account-deletion.md) | 退会 | 6 |

### F-PO 投稿（3.3）

| 機能ID | ストーリー | 内容 | タスク |
|---|---|---|---|
| F-PO-01 | [post-creation](user-stories/posts/post-creation.md) | 投稿作成（SC-03） | 6（＋v3 5） |
| F-PO-01 | [trip-title](user-stories/posts/trip-title.md) | 旅行タイトル（アルバム名）によるグルーピング | 6（＋v3 3） |
| F-PO-01 | [spot-selection](user-stories/posts/spot-selection.md) | 位置とスポットの指定（中央固定ピン） | 7（＋v3 5） |
| F-PO-01 | [post-entry-points](user-stories/posts/post-entry-points.md) | 投稿の起点（各画面からの入口） | 3 |
| F-PO-02 | [post-edit](user-stories/posts/post-edit.md) | 投稿編集 | 4（＋v3 2） |
| F-PO-03 | [post-delete](user-stories/posts/post-delete.md) | 投稿削除 | 5 |
| F-PO-04 | [draft](user-stories/posts/draft.md) | 下書き | 4 |

### F-MP 地図・検索（3.4）

| 機能ID | ストーリー | 内容 | タスク |
|---|---|---|---|
| F-MP-01 | [map-display](user-stories/map-search/map-display.md) | 地図表示（SC-02） | 6（＋v3 4） |
| F-MP-02 | [search-top](user-stories/map-search/search-top.md) | 検索トップ＝ハブ（SC-00。旧 地名検索） | 5 |
| F-MP-03 | [pin-interaction](user-stories/map-search/pin-interaction.md) | ピン操作と地図からの投稿 | 4（＋v3 4） |
| F-MP-03 | [map-restore](user-stories/map-search/map-restore.md) | 地図の状態の復元と吹き出しの導線 | 3 |
| F-MP-04 | [post-timeline](user-stories/map-search/post-timeline.md) | 投稿一覧（旧 投稿検索・絞り込み） | 5 |
| F-MP-05 | [photo-view](user-stories/map-search/photo-view.md) | 写真の切替（旧 スポット写真一覧） | 3 |
| F-MP-06 | [explore-mode](user-stories/map-search/explore-mode.md) | 探すモード（近くのスポット） | 3 |
| F-MP-06 | [travel-time](user-stories/map-search/travel-time.md) | 所要時間の実測（Routes API・移動手段） | 3 |
| — | [map-current-location](user-stories/map-search/map-current-location.md) | スポット一覧から開いた地図にも現在地を出す | 1 |

### F-VW 閲覧・交流（3.5）

| 機能ID | ストーリー | 内容 | タスク |
|---|---|---|---|
| F-VW-01 | [post-detail-view](user-stories/browsing/post-detail-view.md) | 投稿詳細閲覧（SC-05） | 4（＋v3 2） |
| F-VW-02 | [likes](user-stories/browsing/likes.md) | いいね | 4 |
| F-VW-03 | [comments](user-stories/browsing/comments.md) | コメント（返信を含む） | 7 |
| F-VW-04 | [spot-status-report](user-stories/browsing/spot-status-report.md) | 「まだあった」報告 | 4 |

### F-RC 記録・振り返り（3.6）

| 機能ID | ストーリー | 内容 | タスク |
|---|---|---|---|
| F-RC-01 | [my-page](user-stories/records/my-page.md) | マイページ（SC-06） | 5（＋v3 3） |
| F-RC-02 | [album](user-stories/records/album.md) | アルバム（SC-09） | 5 |
| F-RC-02 | [album-photos](user-stories/records/album-photos.md) | アルバム写真一覧（SC-21） | 3 |
| F-RC-03 | [album-collaboration](user-stories/records/album-collaboration.md) | アルバムの共同編集・招待 | 8 |
| F-RC-05 | [wishlist](user-stories/records/wishlist.md) | 保存先の 2 択と「行きたい」（SC-08） | 4（＋v3 3） |
| F-RC-06 | [my-map](user-stories/records/my-map.md) | あしあと（SC-12。旧 マイマップ） | 4（＋v3 2） |

### F-BG ステータスバッジ（3.7）

| 機能ID | ストーリー | 内容 | タスク |
|---|---|---|---|
| F-BG | [status-badges](user-stories/badges/status-badges.md) | バッジの獲得・一覧（SC-10） | 6 |

### F-SF 安全・健全性維持（3.8、3.10.7〜3.10.8）

| 機能ID | ストーリー | 内容 | タスク |
|---|---|---|---|
| F-SF-01 | [reporting](user-stories/safety/reporting.md) | 通報 | 5 |
| F-SF-02 | [blocking](user-stories/safety/blocking.md) | ブロック（相互非表示） | 4 |
| F-SF-03 | [strike-system](user-stories/safety/strike-system.md) | ストライク制と自動対応（2026-09-27 新設） | 6 |

### F-NT 通知（3.9）

| 機能ID | ストーリー | 内容 | タスク |
|---|---|---|---|
| F-NT-01 | [notification-triggers](user-stories/notifications/notification-triggers.md) | 通知の発生条件 | 3 |
| F-NT-02 | [notification-list](user-stories/notifications/notification-list.md) | 通知一覧画面（SC-14） | 6 |

### F-AD 管理者機能（3.10）

| 機能ID | ストーリー | 内容 | タスク |
|---|---|---|---|
| F-AD-01 | [admin-login](user-stories/admin/admin-login.md) | 管理者ログイン（SC-15）・二段階確認（SC-32。2026-09-29 で追加） | 9 |
| F-AD-02 | [admin-dashboard](user-stories/admin/admin-dashboard.md) | 管理者ダッシュボード（v1。2 ボタンだけの版） | 2 |
| F-AD-02 | [admin-shell-dashboard](user-stories/admin/admin-shell-dashboard.md) | 管理画面の枠とダッシュボード（2026-09-27 の作り直し。3.10.2・3.10.3） | 4 |
| F-AD-03 | [announcement-management](user-stories/admin/announcement-management.md) | お知らせ管理（SC-17） | 4 |
| F-AD-04 | [report-list](user-stories/admin/report-list.md) | 通報一覧（SC-18） | 3 |
| F-AD-05 | [report-handling](user-stories/admin/report-handling.md) | 通報対応操作 | 4 |
| F-AD-06・07・09 | [user-management](user-stories/admin/user-management.md) | 利用者の管理（SC-24）・非公開の復元（SC-25）・操作の記録（SC-27） | 4 |
| F-AD-08 | [legal-documents](user-stories/admin/legal-documents.md) | 規約管理（SC-26）・本文の公開ページ（SC-31）・再同意（SC-30） | 3 |

### F-IT しおり（3.11）

| 機能ID | ストーリー | 内容 | タスク |
|---|---|---|---|
| F-IT-01 | [itinerary-basics](user-stories/itinerary/itinerary-basics.md) | しおりの作成・一覧・削除（SC-22・SC-23） | 5 |
| F-IT-02 | [itinerary-days](user-stories/itinerary/itinerary-days.md) | 期間と Day | 3 |
| F-IT-03 | [arrival-time](user-stories/itinerary/arrival-time.md) | 到着予定時刻と並び順・メモ | 4 |
| F-IT-04 | [add-spots](user-stories/itinerary/add-spots.md) | スポットの追加と追加モード | 3 |
| F-IT-05 | [itinerary-check](user-stories/itinerary/itinerary-check.md) | チェック（行った場所） | 4 |
| F-IT-06 | [itinerary-map-and-post](user-stories/itinerary/itinerary-map-and-post.md) | しおりの地図表示と投稿 | 3 |
| F-IT-07 | [itinerary-sharing](user-stories/itinerary/itinerary-sharing.md) | しおりの共有・招待 | 4 |

### 画面共通仕様（shared-ui。4.2・4.5）

機能 ID は持たず、複数画面にまたがる部品と、メンタリング・見直しでまとめて入れた変更が入っています。

| ストーリー | 内容 | タスク |
|---|---|---|
| [menu-bar](user-stories/shared-ui/menu-bar.md) | 共通メニューバー（4 項目・PC は左サイドバー） | 4（＋v3 3） |
| [media-layout](user-stories/shared-ui/media-layout.md) | 写真・動画の表示レイアウトとモーダル | 4（＋v3 3） |
| [pin-display-rules](user-stories/shared-ui/pin-display-rules.md) | ピンの表示ルール（種別・優先順位） | 3（＋v3 3） |
| [pin-categories](user-stories/shared-ui/pin-categories.md) | しずく型ピンとカテゴリ色（2026-09-26） | 2 |
| [upload-notice](user-stories/shared-ui/upload-notice.md) | 投稿時の注意喚起 | 2 |
| [error-display](user-stories/shared-ui/error-display.md) | 共通エラー表示 | 3 |
| [theme](user-stories/shared-ui/theme.md) | 配色とダークモード | 4 |
| [brand-logo](user-stories/shared-ui/brand-logo.md) | ロゴとファビコン | 2 |
| [map-sheet](user-stories/shared-ui/map-sheet.md) | 上部の地図の操作とシートの 3 段階 | 2 |
| [performance](user-stories/shared-ui/performance.md) | 性能改善（通信回数・ストリーミング） | 3 |
| [loading-feedback](user-stories/shared-ui/loading-feedback.md) | 読み込み中の見せ方（2026-09-30。管理画面は保留） | 3 |
| [mentoring-7](user-stories/shared-ui/mentoring-7.md) | メンタリング 7 回目の反映（v3.1） | 11 |
| [feedback-0919](user-stories/shared-ui/feedback-0919.md) | 画面遷移マップの見直しで出た追加要望（v3.2） | 8 |

### データ設計の確認（data-model。5.2〜5.4）

| ストーリー | 内容 | タスク |
|---|---|---|
| [table-catalog](user-stories/data-model/table-catalog.md) | どの機能にも属さない共有テーブルの定義と整合性 | 7（＋v3 6） |
| [design-principles](user-stories/data-model/design-principles.md) | 主要な設計方針（RLS・列単位の権限など）の一貫適用の確認 | 0（確認のみ） |
| [media-handling](user-stories/data-model/media-handling.md) | 画像・動画の取り扱いの共通実装の確認 | 0（確認のみ） |

## テーブル定義の分担

各機能が自分の中核テーブルを定義し、複数機能から参照される横断的なテーブルだけを `data-model/table-catalog` が担う、という分担です（要件定義書 5.2）。

| 分担 | テーブル |
|---|---|
| 機能ストーリーが自ら定義 | users（F-AC-01）／trips・spots・posts・post_photos（F-PO-01）／album_invitations（F-RC-03）／itineraries・itinerary_spots・itinerary_members・itinerary_invitations（F-IT）／spot_status_reports（F-VW-04）／reports（F-SF-01）／system_announcements（F-AD-03） |
| data-model/table-catalog が補完 | rate_limits／album_members／notifications／badges／comments・likes・wishlist・blocks／operation_logs |

## バージョンの履歴

どの版で何を変えたかは [request.md](request.md) の改訂表、実装の順番は [development-order.md](development-order.md) が正です。ここは対応関係の目次だけ。

| 版 | 内容 | Phase |
|---|---|---|
| v1 | 最初の実装（9 カテゴリ・41 ストーリー） | 1〜9 |
| v3.0（2026-09-16） | コンセプト「インスタ × Google マップ」。検索トップ＝ハブ、しおり、下書き、探すモード、ダークモード。書き換えたストーリーのタスクは `<スラッグ>-v3` | 10〜14 |
| v3.1（2026-09-18） | メンタリング 7 回目の反映（[mentoring-7](user-stories/shared-ui/mentoring-7.md)） | 15 |
| v3.2（2026-09-19） | 画面遷移マップの見直しで出た追加要望（[feedback-0919](user-stories/shared-ui/feedback-0919.md)） | 16 |
| （2026-09-20〜26） | 戻る・シート・ログイン作り直し・ロゴ・ピンのカテゴリ色・性能改善など。Phase 番号は付けていない | — |
| 管理画面の作り直し（2026-09-27） | ストライク制・利用者管理・復元・操作の記録・規約管理（[strike-system](user-stories/safety/strike-system.md)・[admin-shell-dashboard](user-stories/admin/admin-shell-dashboard.md)・[user-management](user-stories/admin/user-management.md)・[legal-documents](user-stories/admin/legal-documents.md)） | 17 |

## 設計上の補足・要確認事項

ユーザーストーリーを書く過程で、要件定義書だけでは判断できず実装時に確認が必要と分かった点です。各ストーリーにも書いてありますが、横断的なものをここにも残します。

- **ブロック管理画面**：要件定義書の画面一覧（4.1）に専用の画面 ID が無いため、`blocking` ではプロフィール編集画面（SC-07）内に置く設計判断をしています（要件定義書に明記が無い判断である旨をストーリーにも記載）。
- **通知の 90 日経過後の扱い**（9 章 未決定事項 #3）：`notification-list` では「非表示のみ（物理削除しない）」を暫定方針にしていますが、最終確認が必要です。
- **operation_logs の保存期間経過後の扱い**：90 日超のレコードを物理削除するかは未確定のままです。
- **RLS だけでは塞げない 2 経路**（要件定義書 v2.7 で反映済み）：(1) 本人による `is_admin` 等の列の書き換え、(2) `security definer` 関数の公開鍵からの実行。要件定義書 5.3 に「列単位のアクセス制御」「DB 関数の実行権限」として追加済み。詳細は [design-principles](user-stories/data-model/design-principles.md)。
- **退会したアルバムオーナーのメンバーシップ**（要件定義書 v2.7 で反映済み）：オーナー継承後、退会者を閲覧者へ降格して残します（退会後も投稿がアルバムに残るためメンバーからは外さない）。
