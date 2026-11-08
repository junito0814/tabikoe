import sharp from "sharp";
import { expect, test } from "./fixtures/test";

/**
 * e2e-foundation Task 5（2/4）: 投稿 ── 必須項目が空では公開できず、埋めると公開されて一覧に出る
 * 出典: docs/tasks/shared-ui/e2e-foundation/05-core-flows.md
 * 受入条件（要件定義書 8 章）: 7（必須項目を入力した投稿の作成。日付の初期値が今日）
 *
 * 【初心者向け】タビコエの中心です。投稿できなければ中身が増えません。
 * スポットは**手入力（新しい場所）**で作ります。Google の候補を選ぶ道は、スタブの出来に結果が左右されるため（タスク文書）。
 * 位置は地図の中心（＝位置情報。東京駅に固定）で決まり、都道府県はサーバーが逆引き（スタブ。東京都）で入れます。
 *
 * 写真はその場で作った JPEG を、実際にアップロードします（ローカルの Storage に置かれ、サーバーで縮小される）。
 */
const SPOT_NAME = "E2E の展望台";
const COMMENT = "E2E で投稿した感想です。";

test("必須項目が空では公開できず、埋めると公開されて都道府県の一覧に出る", async ({ loginAs, page }) => {
  await loginAs("user");
  await page.goto("/posts/new");
  // 地図（の代わり）が出た＝画面の処理が動き出した。これより前に操作すると、押しても受け取られない
  await expect(page.getByTestId("map-stub")).toBeVisible();

  const publish = page.getByRole("button", { name: "投稿する" });
  // 何も入れていない状態では公開できない
  await expect(publish).toBeDisabled();
  // 日付の初期値は今日（受入条件 7）。日本時間の今日と比べる
  const todayInJapan = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(new Date());
  await expect(page.getByLabel("日付 *")).toHaveValue(todayInJapan);

  await page.getByLabel("新しい場所の名前（任意）").fill(SPOT_NAME);
  await page.getByLabel("カテゴリ *").selectOption("自然・景勝地");
  await page.getByLabel("滞在時間 *").selectOption("30分以内");
  await page.getByRole("radio", { name: "4" }).click();
  await page.getByLabel("費用（円・1人あたり）").fill("500");
  await page.getByLabel("感想（任意）").fill(COMMENT);
  // 写真がまだ無いので、ほかを全部埋めても公開できない（写真は必須）
  await expect(publish).toBeDisabled();

  const photo = await sharp({ create: { width: 640, height: 480, channels: 3, background: { r: 90, g: 150, b: 110 } } })
    .jpeg()
    .toBuffer();
  await page.getByLabel("写真・動画を選択").setInputFiles({ name: "e2e-photo.jpg", mimeType: "image/jpeg", buffer: photo });
  await expect(page.getByRole("button", { name: "e2e-photo.jpgを外す" })).toBeVisible();

  // 必須項目がそろったので公開できる
  await expect(publish).toBeEnabled();
  await publish.click();

  /*
   * 自宅を守るための確認（要件 3.3.5「自宅の保護」）は、「現在地から開いた・地図を動かしていない・新しい場所」の
   * 3 つがそろったときに出る。「現在地から開いた」は位置情報が画面に届いた時点で決まるので、
   * 押したのがそれより前か後かで、出たり出なかったりする（利用者にとっては正しい動き）。
   * そこで「確認が出た」か「投稿画面を離れた」かのどちらかになるまで待ち、確認が出ていれば進める。
   * 決まった時間は待たない（最初は「押した直後に 1 回だけ見る」書き方で、遅れて出た確認を見逃して落ちた）
   */
  const confirm = page.getByRole("dialog", { name: "この位置を公開しますか？" });
  await expect.poll(async () => (await confirm.isVisible()) || !page.url().includes("/posts/new"), { timeout: 15_000 }).toBe(true);
  if (await confirm.isVisible()) {
    await confirm.getByRole("button", { name: "投稿する" }).click();
  }

  // 公開した投稿が、都道府県（逆引きで東京都）の一覧に出る。写真の処理を待つので長めに見る
  await expect(page).not.toHaveURL(/\/posts\/new/, { timeout: 15_000 });
  await page.goto(`/search?pref=${encodeURIComponent("東京都")}`);
  await expect(page.getByRole("link", { name: new RegExp(`^${SPOT_NAME}`) })).toBeVisible();
});
