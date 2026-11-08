import { expect, test } from "./fixtures/test";
import { installGoogleBrowserStub } from "./fixtures/maps-stub";
import { SEED } from "./fixtures/seed";

/**
 * e2e-foundation Task 5（4/4）: 共有 ── 公開した投稿の共有リンクを、ログアウトした状態で開くと投稿が見える
 * 出典: docs/tasks/shared-ui/e2e-foundation/05-core-flows.md
 * 受入条件: 8 章に当たる番号は無い（要件定義書 4.5.18「未ログインで開ける画面」・#951）
 *
 * 【初心者向け】他人に送ったリンクが開けないと、気づきにくいうえに、影響が外に出ます。
 * リンクはテストに直書きせず、**アプリの「共有する」が実際に渡したもの**を使います。
 * 端末の共有シート（navigator.share）はブラウザや OS によって有無が変わるので、テストでは受け取り役に差し替えて、
 * 渡された中身（URL）を読みます。
 */
test("公開した投稿の共有リンクを、ログアウトした状態で開くと投稿が見える", async ({ loginAs, page, browser }) => {
  await loginAs("user");
  // 端末の共有シートの代わりに、渡された中身を控える
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data: ShareData) => {
        (window as unknown as { __shared?: ShareData }).__shared = data;
      },
    });
  });
  await page.goto(`/posts/${SEED.posts.sensoji.id}`);
  await expect(page.getByTestId("map-stub")).toBeVisible();
  await page.getByRole("button", { name: "共有する" }).click();
  const shared = await expect
    .poll(() => page.evaluate(() => (window as unknown as { __shared?: ShareData }).__shared?.url ?? null))
    .not.toBeNull()
    .then(() => page.evaluate(() => (window as unknown as { __shared?: ShareData }).__shared!.url!));
  expect(shared).toContain(`/posts/${SEED.posts.sensoji.id}`);

  // ログインしていない、まっさらなブラウザで開く（地図はここでもスタブにする）
  const guest = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "ja-JP" });
  const google = await installGoogleBrowserStub(guest);
  const guestPage = await guest.newPage();
  await guestPage.goto(shared);

  const post = guestPage.getByRole("article");
  await expect(post.getByRole("heading", { name: "浅草寺", level: 1 })).toBeVisible();
  await expect(post.getByText(SEED.posts.sensoji.comment)).toBeVisible();
  // 未ログインなので、ログインへ誘う帯が出ている（ログイン画面へ飛ばされてはいない）
  await expect(guestPage.getByRole("link", { name: "はじめる" })).toBeVisible();
  expect(guestPage.url()).not.toContain("/login");
  expect(google.blocked).toEqual([]);
  await guest.close();
});
