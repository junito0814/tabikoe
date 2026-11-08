import { expect, test } from "./fixtures/test";
import { SEED } from "./fixtures/seed";

/**
 * e2e-foundation Task 5（3/4）: しおり ── 投稿詳細からしおりに入れ、しおり詳細の Day に並ぶ
 * 出典: docs/tasks/shared-ui/e2e-foundation/05-core-flows.md
 * 受入条件（要件定義書 8 章）: 13（「＋」から保存先シートが開き、チェックだけで保存。期間があれば Day を選べる）・58（Day のタブ）
 *
 * 【初心者向け】操作は**マウス**で行います。このテストを書いていて、シートの中をマウスで押しても反応しない
 * 不具合が見つかりました（#1069。指のタップでは動いていた）。直したので、ここがその再発を見張ります。
 * しおりは種データの「東京旅行」（期間 2026-11-20〜22 の 3 日間）を使います。
 */
test("投稿詳細からしおりに入れ、Day を選ぶと、しおり詳細のその Day に並ぶ", async ({ loginAs, page }) => {
  await loginAs("user");
  await page.goto(`/posts/${SEED.posts.sensoji.id}`);
  await expect(page.getByTestId("map-stub")).toBeVisible();

  // 「行きたい」（＋）→ 保存先シート
  await page.getByRole("button", { name: "行きたい" }).click();
  const sheet = page.getByRole("dialog", { name: "行きたい・しおりに入れる" });
  await expect(sheet).toBeVisible();

  // チェックだけでしおりに入る。期間があるので Day を選べる（既定は日付なし）
  const itinerary = sheet.getByRole("checkbox", { name: /^東京旅行/ });
  await itinerary.click();
  await expect(itinerary).toBeChecked();
  const days = sheet.getByRole("radiogroup", { name: "東京旅行 の Day" });
  await expect(days.getByRole("radio", { name: "日付なし" })).toBeChecked();
  await days.getByRole("radio", { name: "Day 2" }).click();
  await expect(days.getByRole("radio", { name: "Day 2" })).toBeChecked();

  await sheet.getByRole("button", { name: "完了" }).click();
  await expect(sheet).toBeHidden();

  // しおり詳細の Day 2 に浅草寺が並ぶ（Day 1 には無い）。行は「〈スポット名〉 を行った場所にする」のチェックで見分ける
  // （行の名前は「1 浅草寺」のように訪問順の番号が付くため、名前の文字だけでは探さない）
  await page.goto(`/itineraries/${SEED.itinerary.id}`);
  const tabs = page.getByRole("tablist", { name: "Day" });
  const sensojiRow = (day: string) => page.getByRole("region", { name: day }).getByRole("checkbox", { name: "浅草寺 を行った場所にする" });
  await tabs.getByRole("tab", { name: /^Day 2/ }).click();
  await expect(sensojiRow("Day 2")).toBeVisible();
  // Day 1 は空（空の Day は枠を出さず、この一文だけになる）
  await tabs.getByRole("tab", { name: /^Day 1/ }).click();
  await expect(page.getByText("この日のスポットはまだありません")).toBeVisible();
  await expect(sensojiRow("Day 1")).toHaveCount(0);
});
