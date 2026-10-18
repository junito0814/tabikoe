import { describe, expect, it } from "vitest";
import { unknownPostFields } from "./post-request-body";

/**
 * 出典: #993 の受入条件「スキーマに無いキーを含む送信が断られる」
 * 方針: 要件定義書 7.2「入力の検証」の 5 番（画面に無い項目を足して送る形）
 *
 * 【初心者向け】投稿 API は 1 つの JSON で、投稿の項目のほかに
 * アルバム名・スポット・写真の保存先も受け取ります。そのため「余りのキーは全部だめ」
 * にはできません。**受け付けるキーの名前を書き並べて、それ以外を断る**形にしています。
 */
describe("投稿 API が受け取るキー（#993）", () => {
  it("画面が送る形はそのまま通る", () => {
    // src/components/posts/compose-payload.ts の buildComposePayload が作る形
    expect(
      unknownPostFields({
        status: "published",
        tripTitle: "北海道旅行",
        spotId: null,
        spotName: "小樽運河",
        category: "観光スポット",
        visitDate: "2026-10-18",
        duration: "1時間以内",
        cost: 0,
        rating: 5,
        comment: "",
        visibility: "public",
        visitFindings: [],
        lat: 43.2,
        lng: 141,
        media: [],
      }),
    ).toBeNull();
  });

  it("v1 の写真の渡し方（photoPaths）も通る", () => {
    expect(unknownPostFields({ photoPaths: ["a.jpg"], lat: 0, lng: 0 })).toBeNull();
  });

  it("一部だけ送る形も通る（下書きの部分更新）", () => {
    expect(unknownPostFields({ status: "draft", lat: 0, lng: 0 })).toBeNull();
    expect(unknownPostFields({})).toBeNull();
  });

  it("知らないキーが混ざっていたら、その名前を返す", () => {
    expect(unknownPostFields({ lat: 0, lng: 0, isAdmin: true })).toEqual(["isAdmin"]);
    expect(unknownPostFields({ user_id: "他人の id", status: "published" })).toEqual(["user_id"]);
    // 複数混ざっていたら全部返す（サーバーのログに出すため。応答には出さない）
    expect(unknownPostFields({ a: 1, b: 2 })?.sort()).toEqual(["a", "b"]);
  });

  it("キーの名前が少し違うだけでも断る（通ってしまうと黙って捨てられる）", () => {
    // 【初心者向け】zod の既定は「知らないキーを黙って捨てる」です。捨てられるので
    // 保存はされませんが、**送った側は成功したと思い込みます**。断れば気づけます。
    expect(unknownPostFields({ visit_date: "2026-10-18" })).toEqual(["visit_date"]);
    expect(unknownPostFields({ Comment: "大文字" })).toEqual(["Comment"]);
  });
});
