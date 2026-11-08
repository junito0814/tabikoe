import { expect, test } from "./fixtures/test";

/**
 * e2e-foundation Task 3: 結合テスト（テスト専用のログイン経路を、本物のアプリとローカルの Supabase で通す）
 * 出典: docs/tasks/shared-ui/e2e-foundation/03-test-login.md「テスト要件 › 結合テスト」
 *
 * 【初心者向け】「本人として扱われる」は、ログインしたあとで「自分の」情報を返す API（/api/users/me/summary）を叩いて確かめます。
 * 種データでは、たろう（user）の公開投稿は 2 件、管理者（admin）は 0 件なので、返ってきた件数で誰として扱われたかが分かります。
 * 「設定していなければ 404」は、アプリを E2E_TEST=1 で動かしているここでは確かめられないので、単体テスト（src/lib/e2e/enabled.test.ts）で固定しています。
 */
test('"user" でログインすると、以後のリクエストがたろう本人として扱われる', async ({ loginAs, context }) => {
  // ログイン前は本人として扱われない
  expect((await context.request.get("/api/users/me/summary")).status()).toBe(401);

  await loginAs("user");

  const response = await context.request.get("/api/users/me/summary");
  expect(response.status()).toBe(200);
  expect((await response.json()).summary.postCount).toBe(2);
});

test('"admin" でログインすると、管理者として扱われる（たろうとは別人）', async ({ loginAs, context }) => {
  await loginAs("admin");

  const response = await context.request.get("/api/users/me/summary");
  expect(response.status()).toBe(200);
  expect((await response.json()).summary.postCount).toBe(0);
});

test("種データ以外の指定（任意のメールアドレス・ID）は断られ、ログインもされない", async ({ context }) => {
  for (const data of [{ as: "someone@example.com" }, { email: "taro@e2e.invalid" }, { as: "00000000-0000-4000-8000-0000000000e1" }]) {
    const response = await context.request.post("/api/e2e/login", { data });
    expect(response.status()).toBe(400);
  }
  expect((await context.request.get("/api/users/me/summary")).status()).toBe(401);
});
