<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# タビコエの進め方（Claude 向けの約束）

手順そのもの（Issue 化・ブランチ運用・テストの書き方・マイグレーション・PR の書式）は
[docs/development-process.md](docs/development-process.md) と [docs/rule.md](docs/rule.md) にある。
ここには**そこに書いていない、やり取りの中で決まった約束**だけを書く（2026-09-26 時点で 23 項目）。

## 進め方

1. **ドキュメント → Issue → 実装 の順で進める。**
   - まず **ドキュメントを直して PR を出す**（要求定義書 → 要件定義書 → ユーザーストーリー → タスク → ワイヤーフレーム）。**ドキュメントには Issue を立てない**（相談して決まったその場で書くので、立てた瞬間に閉じることになる）
   - 次に **実装の Issue を立てる**（タスク文書 1 つ＝ Issue 1 つ。ラベルは `category:*` ＋ `type:task`、Project 2 に追加）。**この工程に PR は無い**
   - 最後に **実装の PR を出す**（`Closes #N`）
   - 実装から始めない。**ドキュメントの PR と実装の PR は必ず分ける**
2. **勝手に作業に入らない。** 質問にはまず答え、承認を得てから着手する。相談された内容をそのまま実装しない
3. **バグは修正前に Issue にする。** タイトルは `[<story-slug>] Bug N: <現象>`、ラベルは `bug` ＋ `category:*`、`gh project item-add 2 --owner junito0814` で Project に追加する。本文には「何が起きているか／原因／直し方／受入条件」を書く
4. **未マージの PR があれば、その上に積む（stacked）。** PR 本文の先頭にマージ順を書く。base の PR がマージ済みなら base を `main` に切り替える
5. **依存のあるタスクは順番を守る。** Task 1 を入れて実機で確かめてから Task 2 に進む
6. **作業範囲の外に問題を見つけたら、勝手に直さず報告して判断を仰ぐ。** 直す価値があると思っても、まず「見つけたこと」として伝える
7. **見た目を決めるものは、実装前に Artifact で見せて選んでもらう。** ロゴ・ピンのように選択肢があるものは、実寸で比較できるページを作る
8. **メンタリングのフィードバックは「返信 → 合意 → ドキュメント反映」の順。** いきなり docs を書き換えない
9. **大きな書き換え（v3 系）は `<story>-v3` フォルダと別 Epic を作り、旧 Epic は触らない**

## 読んで理解できる形にする

ユーザーは自分ではコードを書かず、**PR を読んで理解する**方針（2026-09-16 決定）。

10. **ファイル冒頭に出典コメントを書く。** どのタスク文書のどの項目か、このファイルが何を担当するかを日本語で書く
11. **込み入った箇所に【初心者向け】コメントを付ける。** 「なぜこう書くのか」を前提から噛み砕く
12. **PR 本文に「読む順番」と各ファイルの一言説明を付ける。** 1 つの PR は 1 タスク程度に収め、読める量にする
13. **判断（ルール）は純粋関数に切り出す。** 画面やデータの取り方が変わっても、そこだけテストすれば済むようにする
14. **同じものを 2 か所に書かない。** 同じ絵・同じ部品の写しができたら 1 つにまとめる（片方だけ直してズレるのを防ぐ。`AppLogo`・`pin-shapes` がその例）

## ドキュメントの書き方

15. **新しい決定は既存の並びに合わせて足す。** ワイヤーフレームの決定事項は番号の大きいものが上、要求定義書の改訂表は新しいものを表の末尾に降順で、要件定義書 4.5.x は新しい節を上に置く
16. **決定には日付と「なぜそうしたか」を必ず書く。** 廃止したものは消さず取り消し線（`~~…~~`）で残し、「→ 2026-09-26 に廃止」と追記する
    - ~~`docs/wireframes.md` を直したら、**同じターンでキャンバス**（Artifact `RDnjT2hrJSih3f9jJp4FDc`）も更新する~~ → **2026-09-30 に廃止**。あのキャンバスは生成スクリプトから作っていたが、そのスクリプトが失われて更新する手段が無くなった。実際に決定事項 49 以降が反映されないまま、ドキュメントだけが「常に同じ内容に保つ」と言い続けていた。**利用者向けの画面は `docs/wireframes.md` が唯一の正**（要件定義書 4.1）
    - **管理画面のキャンバス**（Artifact `KoY91teZdaTPQahdk2LEhM`）だけは今も正。管理画面まわり（要件定義書 3.10・ワイヤーフレームの「管理画面」）を直したら、**同じターンでこちらも更新する**
17. **日付は絶対日付で書く**（「先週」ではなく `2026-09-26`）

## 書式

18. **コミットメッセージの末尾に `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`、PR 本文の末尾に `🤖 Generated with [Claude Code](https://claude.com/claude-code)` を付ける。** PR 本文に `Closes #N` を書く（複数なら `Closes` を繰り返す。カンマ区切りは先頭しか効かない）
19. **コメント・Issue・PR・コミットはすべて日本語で書く**

## 確認と安全

20. **コミット前に `npx tsc --noEmit` / `npx eslint src --max-warnings=0` / `npx vitest run` を通す。** ただし **`next build` はユーザーの開発サーバーが動いている間は走らせない**（Turbopack のキャッシュが壊れる。2026-09-22 に実際に壊した）
21. **API キー・秘密情報を出力せず、できていないことを隠さない。** 環境変数の値は画面に出さない（必要なら「設定されているか」だけを確かめる）。実機で確認できていないこと、タスク文書と違えたこと、後回しにしたことは PR 本文に明記する
22. **見た目は実機サイズ（390 × 844）のスクリーンショットで、ライトとダークの両方を確認する。** 一時ファイル・確認用スクリプトは scratchpad に置き、リポジトリに混ぜない

## 事実関係

23. **ユーザーの前提が事実と違うときは、遠慮せず訂正する。** 思い込みのまま進めるより、根拠（コードの該当箇所・実際の表示）を示して早めに直す
