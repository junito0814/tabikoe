# Task 6: 逆ジオコーディングによる都道府県判定の統合

> 出典: [spot-selection.md](../../../user-stories/posts/spot-selection.md)、[requirement.md](../../../requirement.md) 3.7
> インデックス: [spot-selection](00-index.md)

## 依存

- [Task 5: スポット手動登録 Route Handler（重複防止ロジック含む）](05-manual-spot-registration-handler.md)

## 実装内容

- スポット登録時（`/api/spots/{id}/geocode`）にGoogle Maps Geocoding APIをサーバー側で呼び出し、逆ジオコーディングの結果を`spots.prefecture`に一度だけ保存する
- APIキーはサーバー側のみで保持し、フロントエンドには一切露出させない
- この結果はステータスバッジ機能（3.7、F-BG）の都道府県判定で利用される

## 成果物

- `app/api/spots/[id]/geocode/route.ts`
- スポット登録処理（Task5）からの呼び出し組み込み

## テスト要件

### 単体テスト
- Geocoding APIレスポンス（モック）から都道府県名を抽出するパースロジックを検証する
- APIエラー時のハンドリング（`prefecture`を未設定のままにする等）を検証する

### 結合テスト
- テスト用のGeocoding APIレスポンスを用いて、実際に`spots.prefecture`が保存されることを確認する
- 既に`prefecture`が設定済みのスポットに対して再実行しても上書きされない（一度だけ保存）ことを確認する

### E2Eテスト
- なし（[Task 7: 受入テスト（E2E）](07-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- なし（本タスクの効果は3.7 都道府県バッジの受入条件で検証される）
