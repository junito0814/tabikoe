# Task 1: Playwright を入れ、CI で動かす

> 出典: [e2e-foundation.md](../../../user-stories/shared-ui/e2e-foundation.md)
> インデックス: [e2e-foundation](00-index.md)

## 依存

- なし

**ここだけはアプリの事情を持ち込まない。** 「Playwright が手元と CI の両方で動く」ことだけを確かめる。ログインも地図もデータベースも使わない。

## 実装内容

- `@playwright/test` を開発用の依存として入れる。ブラウザは **Chromium だけ**を取得する（WebKit は動かせることの確認に 1 回だけ使い、常用しない。[ストーリー](../../../user-stories/shared-ui/e2e-foundation.md)の「やらないこと」）
- `playwright.config.ts` を置く。`webServer` で `next build` 済みのアプリを `next start` で立ち上げ、`baseURL` をそれに向ける（開発サーバーではなく**本番ビルド**で回す。開発サーバーは初回描画が遅く、待ち時間のゆらぎが大きい）
- `e2e/` を作り、煙テスト 1 本を置く: **未ログインで `/` を開き、サービスの説明とログインボタンが出ること**（未ログインで見える画面なので、ログインの土台が無くても書ける）
- `npm run test:e2e` を追加する
- 単体テスト（Vitest）が `e2e/` を拾わないようにする（`vitest.config.mts` の `include` は `src/**` なので既に拾わないが、**`e2e/` を `exclude` に明記して固定する**）
- `.github/workflows/ci.yml` に **E2E のジョブを足す**。既存の `tsc / eslint / vitest / build` のジョブは触らない
  - `continue-on-error: true` を付ける（**落ちてもマージを止めない**。要件 9 章 No.12 の決着）
  - 失敗したときは Playwright の report を成果物として残す（落ちた記録を消さない）
  - ブラウザの取得をキャッシュする

## 成果物

- `playwright.config.ts`
- `e2e/smoke.spec.ts`
- `package.json`（`test:e2e` と依存）
- `vitest.config.mts`（`exclude` に `e2e/`）
- `.github/workflows/ci.yml`（E2E のジョブ）
- `.gitignore`（`playwright-report/`・`test-results/`）

## テスト要件

### 単体テスト

- なし（設定だけで、分岐するロジックが無い）

### 結合テスト

- なし

### E2Eテスト

- 未ログインで `/` を開き、サービスの説明とログインボタンが見えること（煙テスト）

## 関連する受入条件

- `npm run test:e2e` で E2E が走って結果が出ること
- CI に E2E のジョブがあり、落ちても他のジョブとマージを止めないこと
