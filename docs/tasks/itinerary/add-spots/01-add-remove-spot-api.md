# Task 1: スポット追加・削除 API

> 出典: [add-spots.md](../../../user-stories/itinerary/add-spots.md)
> インデックス: [add-spots](00-index.md)

## 依存

- itinerary-basics Task 1

## 実装内容

- `POST /api/itineraries/[id]/spots`（spot_id・day_index 任意）：メンバーのみ。重複は 200 で既存を返す（冪等）。sort_order は末尾
- `DELETE /api/itineraries/[id]/spots/[spotId]`
- `GET /api/itineraries?spot=<id>` の「入っているか」フラグ（itinerary-basics Task 1）と整合させる

## 成果物

- `src/app/api/itineraries/[id]/spots/route.ts`

## テスト要件

### 単体テスト
- 重複追加が冪等であること
- メンバー以外が 403 になること

### 結合テスト
- 同じ (itinerary_id, spot_id) が 1 行のままであること

### E2Eテスト
- なし（[Task 3: 受入テスト（E2E）](03-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- 同じスポットを同じしおりに 2 回入れられないこと
