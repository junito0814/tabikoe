import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * 出典: #739（公式情報が出ない。検索結果からの経路に差し込んでいない）単体テスト
 * 要件定義書 3.4.2「公式情報」
 *
 * 【初心者向け】スポット別の一覧には**入口が 2 つ**ある。
 *   - `/spots/[id]`      … 地図のピンの吹き出しから
 *   - `/search?spot=<id>` … **検索結果のスポットカードから**（普段の導線）
 * #701 では前者にしか差し込んでいなかったので、普段の経路では何も出ていなかった。
 * 画面を描く部分は本物の Google が要るので試せない。**両方の入口が差し込んでいるか**をここで見る。
 */
const read = (path: string) => readFileSync(path, "utf8");

describe("公式情報は 2 つの入口の両方から出す（#739）", () => {
  it("地図のピンからの経路（/spots/[id]）", () => {
    expect(read("src/app/spots/[id]/page.tsx")).toContain("official={officialInfoSlot(");
  });

  it("検索結果のカードからの経路（/search?spot=）", () => {
    expect(read("src/app/search/page.tsx")).toContain("official={officialInfoSlot(");
  });

  /** 同じものを 2 か所に書かない（約束 14）。中身は 1 つの関数にまとめる */
  it("差し込む中身は 1 か所にまとまっている", () => {
    const source = read("src/components/spots/OfficialInfo.tsx");
    expect(source).toContain("export function officialInfoSlot");
    // 画面側は <OfficialInfo> を直接書かない（まとめた関数を呼ぶ）
    for (const path of ["src/app/spots/[id]/page.tsx", "src/app/search/page.tsx"]) {
      expect(read(path), path).not.toContain("<OfficialInfo");
    }
  });

  it("スポットカードの行き先は /search?spot=（この経路が普段使われる）", () => {
    expect(read("src/components/posts/SpotCard.tsx")).toContain("/search?spot=");
  });
});
