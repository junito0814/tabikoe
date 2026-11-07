import { expect, test } from "./fixtures/test";
import { GOOGLE_STUB_PORT, STUB_ANSWERS } from "./fixtures/google-api-stub.mts";
import { SEED } from "./fixtures/seed";

/**
 * e2e-foundation Task 4: Google を 1 回も呼ばずに、地図・候補・座標化・経路が動くこと
 * 出典: docs/tasks/shared-ui/e2e-foundation/04-maps-stub.md「テスト要件 › 結合テスト／E2E テスト」
 *
 * 【初心者向け】Google 宛の通信は、サーバー側は手元のスタブ（google-api-stub.mts）に向け、
 * ブラウザ側は maps-stub.ts で差し替えています。ここでは
 *   1. サーバー側: アプリの API を叩き、スタブの「決まった答え」がそのまま画面用の答えになって返ること
 *   2. ブラウザ側: 地図のある画面を開き、地図（の代わり）とピンが出て、Google への通信が 1 本も無いこと
 * を確かめます。
 */
const stub = `http://127.0.0.1:${GOOGLE_STUB_PORT}`;

test.beforeEach(async ({ request }) => {
  await request.post(`${stub}/__reset`);
});

test("スタブに向けたとき、スポット候補・座標化・経路が決まった答えを返す（結合テスト）", async ({ loginAs, context, request }) => {
  await loginAs("user");

  // スポット候補（Places Text Search）
  const candidates = await (await context.request.get(`/api/spots/candidates?query=${encodeURIComponent("雷門")}`)).json();
  expect(candidates.placesUnavailable).toBe(false);
  expect(candidates.candidates).toContainEqual(
    expect.objectContaining({ name: STUB_ANSWERS.place.name, placeId: STUB_ANSWERS.place.id, source: "places" })
  );

  // 座標化（住所→位置。Geocoding）
  const geocoded = await (await context.request.get(`/api/geocode?query=${encodeURIComponent("東京駅")}`)).json();
  expect(geocoded.place).toEqual(expect.objectContaining({ lat: STUB_ANSWERS.geocode.lat, lng: STUB_ANSWERS.geocode.lng }));

  // 経路（Routes。車で近くの投稿を探すと所要時間を Google に聞く）。スタブは 720 秒＝12 分と答える
  const { lat, lng } = SEED.spots.sensoji;
  const nearby = await (await context.request.get(`/api/posts/nearby?lat=${lat}&lng=${lng}&mode=car`)).json();
  expect(nearby.posts.length).toBeGreaterThan(0);
  for (const post of nearby.posts) expect(post.minutes).toBe(STUB_ANSWERS.routeSeconds / 60);

  // スタブが実際に呼ばれている（＝本物ではなくスタブが答えた）。知らない口は呼ばれていない
  const calls: Record<string, number> = await (await request.get(`${stub}/__calls`)).json();
  expect(calls["places:searchText"]).toBeGreaterThan(0);
  expect(calls["geocode:forward"]).toBeGreaterThan(0);
  expect(calls["routes:matrix"]).toBeGreaterThan(0);
  expect(Object.keys(calls).filter((key) => key.startsWith("unknown:"))).toEqual([]);
});

test("Google 宛の通信をすべて失敗させた状態で、地図を含む画面が開ける（E2E）", async ({ loginAs, page, google, request }) => {
  await loginAs("user");

  // 浅草寺のスポット別の画面。上 1/3 に地図、見出しの下に Google の公式情報（営業時間）が出る
  await page.goto(`/spots/${SEED.spots.sensoji.id}`);

  const map = page.getByTestId("map-stub");
  await expect(map).toBeVisible();
  await expect(map.getByTestId("map-stub-marker")).not.toHaveCount(0);
  // 公式情報はサーバーが Place Details（スタブ）に聞いた答え
  await expect(page.getByText("営業中")).toBeVisible();

  // 地図はスタブで答え、それ以外の Google 宛の通信は 1 本も出ていない
  expect(google.mapsScriptLoads).toBeGreaterThan(0);
  expect(google.blocked).toEqual([]);
  const calls: Record<string, number> = await (await request.get(`${stub}/__calls`)).json();
  expect(calls["places:details"]).toBeGreaterThan(0);
  expect(Object.keys(calls).filter((key) => key.startsWith("unknown:"))).toEqual([]);
});
