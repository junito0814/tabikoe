# Task 1: 地名検索 Route Handler（/api/geocode）

> 出典: [place-search.md](../../../user-stories/map-search/search-top.md)
> インデックス: [place-search](00-index.md)

## 依存

なし（土台タスク）

## 実装内容

- `GET /api/geocode?query=...`を実装し、Google Maps Geocoding APIのジオコーディング機能をサーバー側で呼び出す
- 入力された地名から緯度経度を取得し、フロントエンドへ返す
- APIキーはサーバー側の環境変数としてのみ保持し、フロントエンドには一切露出させない

## 成果物

- `app/api/geocode/route.ts`

## テスト要件

### 単体テスト
- Geocoding APIレスポンス（モック）から緯度経度を抽出するロジックを検証する
- APIエラー時に適切なエラーレスポンスを返すことを検証する

### 結合テスト
- テスト用のGeocoding APIレスポンスを用いて、実際に緯度経度が返ることを確認する

### E2Eテスト
- なし（[Task 3: 受入テスト（E2E）](03-acceptance-e2e.md)でまとめて検証する）

## 関連する受入条件

- Geocoding APIキーがフロントエンドのビルド成果物・ブラウザの開発者ツールから確認できないこと
