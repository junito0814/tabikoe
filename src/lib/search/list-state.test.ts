import { describe, expect, it } from "vitest";
import { appendBackHref, buildMapHrefWithBack, clearListState, listStateKey, loadListState, parseBackHref, resolveListBack, saveListState } from "./list-state";

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key) => map.get(key) ?? null,
    key: (index) => Array.from(map.keys())[index] ?? null,
    removeItem: (key) => void map.delete(key),
    setItem: (key, value) => void map.set(key, value),
  };
}

describe("list-state", () => {
  it("URL をキーに保存・復元できる", () => {
    const storage = memoryStorage();
    saveListState("/search?pref=大阪府", { scrollY: 1200, loadedPages: 3 }, storage);
    expect(loadListState("/search?pref=大阪府", storage)).toEqual({ scrollY: 1200, loadedPages: 3 });
    // 条件が違えば復元しない
    expect(loadListState("/search?pref=京都府", storage)).toBeNull();
  });

  it("ハッシュはキーに含めない", () => {
    expect(listStateKey("/search?spot=1#top")).toBe(listStateKey("/search?spot=1"));
  });

  it("30 分を過ぎたものは使わない", () => {
    const storage = memoryStorage();
    saveListState("/search", { scrollY: 10, loadedPages: 1 }, storage);
    expect(loadListState("/search", storage, Date.now() + 31 * 60 * 1000)).toBeNull();
  });

  it("壊れた値は無視する", () => {
    const storage = memoryStorage();
    storage.setItem(listStateKey("/search"), "{oops");
    expect(loadListState("/search", storage)).toBeNull();
  });

  it("clear で消える", () => {
    const storage = memoryStorage();
    saveListState("/search", { scrollY: 10, loadedPages: 1 }, storage);
    clearListState("/search", storage);
    expect(loadListState("/search", storage)).toBeNull();
  });

  it("storage が無くても例外にならない", () => {
    expect(loadListState("/search", undefined)).toBeNull();
    expect(() => saveListState("/search", { scrollY: 0, loadedPages: 1 }, undefined)).not.toThrow();
  });
});

describe("buildMapHrefWithBack / parseBackHref", () => {
  it("back に一覧の URL を埋め込む", () => {
    const href = buildMapHrefWithBack({ spot: "s1", lat: 34.7, lng: 135.5, empty: null }, "/search?pref=大阪府");
    expect(href).toBe("/map?spot=s1&lat=34.7&lng=135.5&back=%2Fsearch%3Fpref%3D%E5%A4%A7%E9%98%AA%E5%BA%9C");
    expect(parseBackHref(new URL(`https://example.com${href}`).searchParams.get("back"))).toBe("/search?pref=大阪府");
  });

  it("外部 URL は back として受け付けない", () => {
    expect(parseBackHref("https://evil.example")).toBeNull();
    expect(parseBackHref("//evil.example")).toBeNull();
    expect(parseBackHref(null)).toBeNull();
  });
});

describe("appendBackHref / resolveListBack（Bug #469: スポット別一覧の戻るは検索結果へ）", () => {
  it("リンクに back= を付け、次の画面はそれを自分の戻り先にできる（数珠つなぎ）", () => {
    const spotList = appendBackHref("/search?spot=s1", "/search?pref=東京都&sort=rating");
    expect(spotList).toBe("/search?spot=s1&back=%2Fsearch%3Fpref%3D%E6%9D%B1%E4%BA%AC%E9%83%BD%26sort%3Drating");
    const detail = appendBackHref("/posts/p1", spotList);
    expect(parseBackHref(new URL(`https://example.com${detail}`).searchParams.get("back"))).toBe(spotList);
    expect(appendBackHref("/posts/p1", null)).toBe("/posts/p1");
  });

  it("back の URL から戻り先の画面名を出す。無ければ null（呼び出し側が「地図」に倒す）", () => {
    expect(resolveListBack("/search?pref=東京都")).toEqual({ href: "/search?pref=東京都", label: "東京都" });
    expect(resolveListBack("/search?q=東京駅&lat=35.6&lng=139.7")).toEqual({ href: "/search?q=東京駅&lat=35.6&lng=139.7", label: "東京駅" });
    expect(resolveListBack("/")).toEqual({ href: "/", label: "ホーム" });
    expect(resolveListBack(undefined)).toBeNull();
    expect(resolveListBack("https://evil.example")).toBeNull();
  });
});
