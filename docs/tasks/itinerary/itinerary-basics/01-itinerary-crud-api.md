# Task 1: しおりの作成・取得・更新・削除 API

> 出典: [itinerary-basics.md](../../../user-stories/itinerary/itinerary-basics.md)
> インデックス: [itinerary-basics](00-index.md)

## 依存

- table-catalog-v3 Task 2
- table-catalog-v3 Task 3

## 実装内容

- `POST /api/itineraries`（title・start_date・end_date）：`resolve-trip.ts` で旅行を解決し（同名の自分の旅行があればそれ、無ければ新規）、旅行のオーナーでなければ 403、既にしおりがあれば 409。作成者を `itinerary_members` に owner で追加
- `GET /api/itineraries`（自分がオーナーまたはメンバー。`?spot=` で入っているかのフラグ付き）、`GET /api/itineraries/[id]`（Day・スポット・メンバー・同じ旅行のアルバム投稿数）、`PATCH`（期間はオーナーのみ）、`DELETE`（オーナーのみ。trips は残す）
- 権限判定を `src/lib/itineraries/membership.ts` に集約する（`albums/membership.ts` と同型）

## 成果物

- `src/app/api/itineraries/route.ts`
- `src/app/api/itineraries/[id]/route.ts`
- `src/lib/itineraries/membership.ts`
- `src/lib/itineraries/get-itinerary.ts`

## テスト要件

### 単体テスト
- オーナー以外の作成が 403、2 つ目が 409 になること
- 権限判定関数（owner／member／none）

### 結合テスト
- 作成時に itineraries と itinerary_members(owner) が同時に作られること
- 削除しても trips と posts が残ること

### E2Eテスト
- なし（[Task 5: 受入テスト（E2E）](05-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 旅行のオーナー以外がその旅行のしおりを作れないこと。1 つの旅行に 2 つ目のしおりを作れないこと
- しおりを削除しても同じ旅行のアルバム（投稿）と、他のしおり・行きたいのスポットが残ること
