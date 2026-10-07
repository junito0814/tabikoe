import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { __resetOverlayStackForTest } from "@/lib/ui/use-close-on-back";

// 各テスト後にDOMを片付け、テスト間で描画結果が漏れないようにする
afterEach(() => {
  cleanup();
  /*
   * #884 で入れた「重なったシートの数え上げ」は**モジュールの変数**なので、
   * 同じファイルの中ではテストをまたいで残ります。
   *
   * 【初心者向け】`window.history.back()` が出す `popstate` は**非同期**です。
   * あるテストがシートを閉じた後片づけで `back()` を呼ぶと、その `popstate` が
   * **次のテストの最中に届く**ことがあります。数え上げがずれると、次のテストで
   * 戻るキーが効かなくなったり、出ているはずのシートが閉じたりします。
   * 実際、全体実行のときだけ別々のファイルで 3 回ゆらぎました。
   * 各テストの終わりに必ず 0 に戻して、持ち越さないようにします。
   */
  __resetOverlayStackForTest();
});
