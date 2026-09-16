# Task 3: SC-03 の 1：2 レイアウトとシート挙動

> 出典: [post-creation.md](../../../user-stories/posts/post-creation.md)
> インデックス: [post-creation-v3](00-index.md)

## 依存

- Task 2
- spot-selection-v3 Task 1

## 実装内容

- `/posts/new`・`/posts/[id]/edit` を、上 1/3 に地図スロット（`PostLocationMap`）・下 2/3 に `PostForm` を置く `PostComposeScreen` に作り替える。下部に「投稿する」「下書きに保存」を固定表示する
- フォーム部分を上に引くと全画面（地図は隠れる）、下に引くと 1：2 に戻るシート挙動（ドラッグハンドル）
- パソコン幅では地図とフォームを左右 1：2 に並べる

## 成果物

- `src/components/posts/PostComposeScreen.tsx`
- `src/app/posts/new/page.tsx`
- `src/app/posts/[id]/edit/page.tsx`

## テスト要件

### 単体テスト
- 初期状態が 1：2 で、ハンドル操作で全画面／1：2 が切り替わること
- パソコン幅で左右配置になること

### 結合テスト
- なし

### E2Eテスト
- なし（[Task 5: 受入テスト（E2E）](05-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- SC-03 が上 1/3 の地図と下 2/3 のフォームで構成され、下部に「投稿する」「下書きに保存」が固定表示されること
