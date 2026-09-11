import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// 各テスト後にDOMを片付け、テスト間で描画結果が漏れないようにする
afterEach(() => {
  cleanup();
});
