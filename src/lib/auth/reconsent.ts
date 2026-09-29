import type { LegalKind } from "@/lib/legal/legal-documents";

/**
 * legal-documents Task 3: 再同意（新しい版の公開後、同意するまで止める）の判断（純粋関数）
 * 出典: docs/tasks/admin/legal-documents/03-reconsent.md
 *       要件定義書 3.10.11「再同意」
 *
 * 【初心者向け】「次にアプリを開いたとき」＝関所（proxy.ts）が最初に通るとき。ここで止めれば画面ごとに書かなくて済む。
 * 毎リクエスト user_consents を読みに行かないよう、同意済みの版を Cookie（tabikoe-consented = terms:1.2|privacy:1.0）に持ち、
 * Cookie が公開中の版と一致していれば DB に触らない。違うときだけ user_consents を見る（版が上がった直後の 1 回）。
 */
export const RECONSENT_PATH = "/consent/renew";
export const CONSENT_COOKIE = "tabikoe-consented";

export type PublishedVersions = Partial<Record<LegalKind, string>>;

/** 公開中の版のうち、本人が同意していない種類 */
export function missingConsents(published: PublishedVersions, consents: readonly { kind: string; version: string }[]): LegalKind[] {
  const agreed = new Set(consents.map((c) => `${c.kind}:${c.version}`));
  return (Object.entries(published) as [LegalKind, string][]).filter(([kind, version]) => !agreed.has(`${kind}:${version}`)).map(([kind]) => kind);
}

export function needsReconsent(published: PublishedVersions, consents: readonly { kind: string; version: string }[]): boolean {
  return missingConsents(published, consents).length > 0;
}

/** Cookie の値（terms:1.2|privacy:1.0）。種類の順を固定して比較できるようにする */
export function encodeConsentCookie(published: PublishedVersions): string {
  return (Object.keys(published) as LegalKind[])
    .sort()
    .map((kind) => `${kind}:${published[kind]}`)
    .join("|");
}

/** Cookie が公開中の版と一致しているか（一致していれば DB を見ない） */
export function cookieCoversPublished(cookieValue: string | undefined | null, published: PublishedVersions): boolean {
  if (Object.keys(published).length === 0) return true;
  return cookieValue === encodeConsentCookie(published);
}

/** 再同意が要る人でも開ける場所。同意画面・規約の本文・認証まわり */
export function isAllowedWhileReconsentPending(pathname: string): boolean {
  if (pathname === RECONSENT_PATH || pathname === "/terms" || pathname === "/privacy" || pathname === "/login" || pathname === "/signup") return true;
  return pathname.startsWith("/api/auth/") || pathname.startsWith("/api/legal/");
}

export function reconsentAction(pathname: string, search = ""): { kind: "pass" } | { kind: "api_denied" } | { kind: "redirect"; to: string } {
  if (isAllowedWhileReconsentPending(pathname)) return { kind: "pass" };
  if (pathname.startsWith("/api/")) return { kind: "api_denied" };
  const redirectTo = pathname + search;
  return { kind: "redirect", to: redirectTo === "/" ? RECONSENT_PATH : `${RECONSENT_PATH}?redirect_to=${encodeURIComponent(redirectTo)}` };
}

export function consentCookieOptions(secure: boolean) {
  // 版が上がれば値が変わって不一致になるので、期限は長くてよい（1 年）
  return { httpOnly: true, secure, sameSite: "lax" as const, path: "/", maxAge: 365 * 24 * 60 * 60 };
}
