import Link from "next/link";

/**
 * #765（2026-10-06）: 見つからないページ（404）
 * 出典: Issue #765「Bug 2: 404 が Next.js の素の英語ページ」
 *
 * 【初心者向け】このファイルが無いと、Next.js の既定の
 * 「404 | This page could not be found.」という**英語の素のページ**が出ます。
 * 戻る手段もメニューバーだけでした。
 *
 * **タブ名について**: ここに `metadata` は書けません（Next.js の app router は
 * `not-found.tsx` の `metadata` を読みません）。結果としてタブ名は既定の「タビコエ」になり、
 * **スポット名などが漏れない**ので、#785 の狙いとも合っています。
 *
 * **理由を言い分けません。** 「下書きなので見られません」「非公開です」と書くと、
 * **そこに何かが在ることが分かってしまいます**（他人の下書きの URL を順に試せば、
 * どの ID が存在するか当てられる）。見つからない・見られないは、どれも同じ文面にします。
 */
export default function NotFound() {
  return (
    <main className="flex min-h-[70dvh] flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="flex flex-col gap-2">
        <h1 className="text-[20px] font-bold text-ink">ページが見つかりません</h1>
        <p className="text-[13px] leading-[1.9] text-muted">
          URL が間違っているか、
          <br />
          削除されたか、見られない投稿かもしれません。
        </p>
      </div>
      <Link href="/" className="flex h-11 items-center rounded-full bg-accent px-6 text-[14px] font-bold text-white">
        ホームへ戻る
      </Link>
    </main>
  );
}
