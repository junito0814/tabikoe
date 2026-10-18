import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * 出典: 2026-10-18 のセキュリティ確認
 *
 * 【初心者向け】この画面は「あとで消す」前提の開発用ページでしたが、消し忘れたまま
 * **本番で誰でも開ける状態**になっていました。中身が見えることが問題なのではなく、
 * **この画面が地図を読み込む**ことが問題です ── 地図の読み込みは使った回数で枠を消費するので、
 * ログインの要らない画面を外から何度も開かれると、こちらの枠が削られます。
 *
 * 守りが黙って外れないように、ここで押さえます。
 */
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
// 地図は読み込まない（テストで外へ通信しないため）
vi.mock("@/components/map/GoogleMap", () => ({ GoogleMap: () => null }));

import ComponentPreviewPage from "./page";

/** `NODE_ENV` は呼ばれたときに読むので、差し替えだけで足りる（モジュールを読み直さない） */
const setNodeEnv = (value: string) => {
  (process.env as Record<string, string | undefined>).NODE_ENV = value;
};
const original = process.env.NODE_ENV;
afterEach(() => setNodeEnv(original ?? "test"));

describe("開発用の確認ページ", () => {
  it("本番のビルドでは、存在しない扱いにする", () => {
    setNodeEnv("production");
    expect(() => ComponentPreviewPage()).toThrow("NEXT_NOT_FOUND");
  });

  it("開発中は今までどおり出す", () => {
    setNodeEnv("development");
    expect(() => ComponentPreviewPage()).not.toThrow();
  });
});
