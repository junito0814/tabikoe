import { expect, test } from "@playwright/test";
import { CATCHPHRASE } from "../src/lib/terms";

/**
 * e2e-foundation Task 1: 煙テスト（E2E が手元と CI の両方で動くことだけを確かめる）
 * 出典: docs/tasks/shared-ui/e2e-foundation/01-playwright.md
 *
 * 【初心者向け】「煙テスト」は、機械に電源を入れて煙が出ないかだけを見る、という意味の呼び名です。
 * ここでは**ログインも地図もデータベースも使わない**画面（未ログインのホーム）を開き、
 * 中身が出ることだけを確かめます。落ちたら「Playwright の設定か CI」の問題に絞れます。
 *
 * 未ログインのホームは、ログイン画面（SC-01）と同じ内容を出します（要件定義書 3.2.1）。
 * キャッチフレーズは画面と同じ定数を読み、文言を 2 か所に書かない（約束 14）。
 */
test("未ログインでホームを開くと、サービスの説明とログインボタンが出る", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "タビコエ" })).toBeVisible();
  await expect(page.getByText(CATCHPHRASE)).toBeVisible();
  await expect(page.getByRole("button", { name: "Google で続ける" })).toBeVisible();
});
