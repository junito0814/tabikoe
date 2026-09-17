# Task 3: 権限制御とアルバムメンバーとの分離・オーナー継承

> 出典: [itinerary-sharing.md](../../../user-stories/itinerary/itinerary-sharing.md)
> インデックス: [itinerary-sharing](00-index.md)

## 依存

- Task 2
- table-catalog-v3 Task 3

## 実装内容

- 全しおり API で `membership.ts` により オーナー／メンバー／非メンバー を判定し、メンバーは追加・削除・Day・時刻・メモ・チェック、オーナーはさらに招待・メンバー削除・期間・タイトル・削除、非メンバーは 404 とする。RLS と二重に守る
- アルバムのメンバーであってもしおりのメンバーでなければ `GET /api/itineraries/[id]` が 404 になり、アルバム画面の「しおりを見る」が出ないこと
- オーナー退会時の継承（table-catalog-v3 Task 3 の関数）を退会フローから呼ぶ。ブロック関係でもしおり内の操作結果は見える

## 成果物

- `src/lib/itineraries/membership.ts`（権限表）
- 各 Route Handler の権限チェック
- `src/app/api/users/me/deactivate/route.ts`（継承の呼び出し）

## テスト要件

### 単体テスト
- 権限表（操作 × 役割）の判定

### 結合テスト
- 非メンバーの直接アクセスが 404、authenticated キーでの直接 SELECT が 0 行
- オーナー退会後に新オーナーが操作できること

### E2Eテスト
- なし（[Task 4: 受入テスト（E2E）](04-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- メンバーがスポットの追加・Day・時刻・メモ・チェックを操作でき、招待・メンバー削除・期間変更・しおり削除はできないこと
- オーナーが退会すると、アルバムと同じ継承ルールでしおりのオーナーが移ること
