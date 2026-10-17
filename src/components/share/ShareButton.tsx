"use client";

import { useState } from "react";
import { Toast, type ToastMessage } from "@/components/ui/Toast";
import { shareClipboardText, type ShareContent } from "@/lib/share/share-text";

/**
 * #953（2026-10-17）: 共有ボタン（SC-04・SC-05）
 * 出典: Issue #953、要件定義書 4.5.18、ワイヤーフレーム決定事項 96
 *
 * 【初心者向け】押すと**端末の共有シート**（LINE・メール・コピー…が並ぶ、あの画面）が開きます。
 * あのシートは **OS が出すもので、こちらでは作れません**。並ぶアプリもアイコンも順番も、
 * その端末に入っているものがそのまま出ます。
 *
 * 実装で気をつけたことが 3 つあります（要件 4.5.18）。
 *
 * 1. **使えない環境がある。** iPhone の Safari・Android の Chrome では動きますが、
 *    **パソコンの Firefox には `navigator.share` がありません**。無いときは URL を
 *    コピーして「コピーしました」のトーストに落とします。**ここだけが本サービスの出す画面**です
 * 2. **「共有しました」とは出しません。** どのアプリを選んだか、実際に送ったかは
 *    アプリ側から取れません（途中でやめても同じ）。シートを出すところまでで終わりにします
 * 3. **出る前提の文言を書きません。** Instagram は「文字と URL」の共有を受け取らない場面が多く、
 *    「LINE や X で送れます」のような書き方はしません
 *
 * 置き場所は**いいね・「＋」と同じ操作行**です。「⋯」の中には入れません
 * （あそこは通報・削除の場所で、**広めたい操作を隠す場所ではない**ため）。
 */
export function ShareButton({
  content,
  share = defaultShare,
  copy = defaultCopy,
  className,
}: {
  /** 共有する中身。URL は相対でよい（押したときに `location.origin` を足す） */
  content: ShareContent;
  /** 差し替え口（単体テスト用）。共有シートを開けたら true */
  share?: (content: ShareContent) => Promise<boolean>;
  /** 差し替え口（単体テスト用）。コピーできたら true */
  copy?: (text: string) => Promise<boolean>;
  className?: string;
}) {
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const handleClick = async () => {
    // 相対 URL のまま渡されたら、ここで絶対 URL にする（共有先では `/posts/xxx` は意味を成さない）
    const absolute = { ...content, url: new URL(content.url, window.location.origin).toString() };
    if (await share(absolute)) return;
    setToast({ text: (await copy(shareClipboardText(absolute))) ? "コピーしました" : "コピーできませんでした" });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void handleClick()}
        aria-label="共有する"
        data-share-button
        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-ink ${className ?? ""}`}
      >
        {/* 四角から矢印が出る印（iOS・Android どちらの「共有」とも読める形） */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M12 4v11M12 4l-4 4M12 4l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      <Toast toast={toast} onClose={() => setToast(null)} />
    </>
  );
}

/**
 * 端末の共有シートを開く。開けたら true、使えない環境なら false。
 *
 * 【初心者向け】利用者が途中でやめても `navigator.share` は例外を投げます（`AbortError`）。
 * これは「失敗」ではなく「やめた」なので、**コピーには落としません**（false を返さない）。
 */
async function defaultShare(content: ShareContent): Promise<boolean> {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") return false;
  try {
    await navigator.share({ title: content.title, text: content.text, url: content.url });
  } catch {
    // やめた場合も、送れなかった場合も、ここに来る。どちらかは取れないので何も出さない
  }
  return true;
}

/** クリップボードへコピー。使えない環境（古いブラウザ・http）では false */
async function defaultCopy(text: string): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.clipboard) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
