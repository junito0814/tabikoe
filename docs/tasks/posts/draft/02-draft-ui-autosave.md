# Task 2: 「下書きに保存」と自動保存の UI

> 出典: [draft.md](../../../user-stories/posts/draft.md)
> インデックス: [draft](00-index.md)

## 依存

- Task 1
- post-creation-v3 Task 3

## 実装内容

- `PostComposeScreen` の「下書きに保存」で Task 1 を呼び、保存後はマイページへ戻る（トースト「下書きに保存しました」）
- 戻る・閉じる・`beforeunload` 時に、入力があれば自動で下書きを保存する（確認は出さない）。既に下書き ID があれば PATCH
- 下書きを開いた状態（`/posts/new?draft=<id>`）で保存時の内容を復元する

## 成果物

- `src/components/posts/PostComposeScreen.tsx`
- `src/lib/posts/use-draft-autosave.ts`

## テスト要件

### 単体テスト
- 未入力では自動保存が走らないこと
- 入力後に離脱すると保存 API が呼ばれること
- 既存の下書きは PATCH になること

### 結合テスト
- なし

### E2Eテスト
- なし（[Task 4: 受入テスト（E2E）](04-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 必須項目が空のまま「下書きに保存」でき、途中で閉じても下書きが残り、自分の地図の破線ピンとマイページの先頭から続きを書けること（受入条件51）
