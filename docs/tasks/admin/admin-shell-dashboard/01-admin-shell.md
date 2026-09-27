# Task 1: 管理画面の共通の枠を作り、既存の 3 画面を入れる

> 出典: [admin-shell-dashboard.md](../../../user-stories/admin/admin-shell-dashboard.md)
> インデックス: [admin-shell-dashboard](00-index.md)
> 要件定義書 3.10.2

## 実装内容

- `src/app/admin/layout.tsx` を新設し、`/admin` 配下の全ページを包む
  - パソコン（md 以上）：左 220px のメニュー（7 項目）＋上のバー（画面名・管理者名・ログアウト）＋本体
  - スマホ：本体と同じ作りの下のメニューバー（5 項目：ダッシュボード／通報／利用者／お知らせ／その他）。「その他」は一覧ページ（`/admin/more`）
  - 利用者向けの `AppMenuBar` は `/admin` 配下では出さない（今の判定を活かす）
- メニューの通報・非公開に未対応件数を出す（`layout` でサーバー側に数える。件数は `reports.status in (unconfirmed, in_review)`、自動非公開の確認待ち）
- 既存の `AnnouncementManager`・`ReportListScreen`・`ReportDetailScreen` を枠に入れ、中央寄せ（`max-w-[360px]`）をやめてパソコン幅に広げる。**中身は変えない**（並べ方だけ）
- 【初心者向け】`layout.tsx` はその配下のページ全部の外枠になる。ここに 1 回書けば 7 画面すべてに同じメニューが付く

## テスト要件

### 単体テスト
- 管理画面の枠に 7 項目のメニューが出て、現在のページが選択状態になること
- 通報の未対応件数がメニューに出ること（0 のときは出さない）
- スマホ幅で 5 項目のバーになり、「その他」に 3 項目＋サイトへ戻るがあること

## 関連する受入条件

- admin-shell-dashboard.md の受入条件 1
