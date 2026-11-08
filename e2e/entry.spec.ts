import { expect, test } from "./fixtures/test";
import { SEED } from "./fixtures/seed";

/**
 * e2e-foundation Task 5（1/4）: 入口 ── ログインして都道府県から探し、一覧 → スポット → 投稿詳細まで開ける
 * 出典: docs/tasks/shared-ui/e2e-foundation/05-core-flows.md
 * 受入条件（要件定義書 8 章）: 4（ログイン後の着地点）・5（行き先の候補から投稿一覧へ）・45（スポット単位のカード → スポット別の投稿一覧）
 *
 * 【初心者向け】ここが壊れると、利用者は何もできません。だから 1 本目にしています。
 * 行き先は自由入力ではなく、**候補の「東京都 都道府県」を選んで**進みます（自由入力は Google の候補に頼るため。タスク文書）。
 * 要素は「見える文字」と「役割（ボタン・見出し…）」で探し、待つのは「出ること」で、時間では待ちません（約束 23）。
 */
test("ログインして都道府県から探し、一覧 → スポット → 投稿詳細まで開ける", async ({ loginAs, page }) => {
  await loginAs("user");

  // 着地点はホーム（行き先の入力欄がある）
  await page.goto("/");
  const destination = page.getByRole("combobox", { name: "行き先" });
  await expect(destination).toBeVisible();

  // 都道府県の候補を選ぶ → その都道府県の一覧（スポット単位のカード）
  await destination.fill("東京");
  await page.getByRole("button", { name: "東京都 都道府県" }).click();
  await expect(page.getByRole("heading", { name: "東京都", level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: /^東京タワー/ })).toBeVisible();

  // スポットのカード → スポット別の投稿一覧
  await page.getByRole("link", { name: /^浅草寺/ }).click();
  await expect(page.getByRole("heading", { name: "浅草寺", level: 1 })).toBeVisible();

  // 投稿のカード → 投稿詳細
  await page.getByRole("link", { name: new RegExp(`^${SEED.posts.sensoji.comment}`) }).click();
  await expect(page).toHaveURL(new RegExp(`/posts/${SEED.posts.sensoji.id}`));

  // 詳細に、写真・スポット名・費用・訪問日が出る
  const post = page.getByRole("article");
  await expect(post.getByRole("heading", { name: "浅草寺", level: 1 })).toBeVisible();
  await expect(post.getByText("¥1,000/人")).toBeVisible();
  await expect(post.getByText("2026/10/1")).toBeVisible();
  const photo = post.getByRole("img", { name: "浅草寺の写真 1" });
  await expect(photo).toBeVisible();
  // 写真の枠が出ているだけでなく、実際に画像が読み込まれている（Storage から届いている）
  await expect.poll(() => photo.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
});
