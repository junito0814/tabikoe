/**
 * F-AC-02 Task5: フロントエンドの透過的セッション継続UX
 * 出典: docs/tasks/account/session-management/05-frontend-seamless-session-ux.md
 *
 * アクセストークンの期限切れ自体はサーバー側（src/proxy.ts）で毎リクエスト透過的に
 * リフレッシュされるため、フロントエンドが個別にリトライする必要はない。
 * ここで扱うのは、リフレッシュトークン自体が失効した（F-AC-02 Task3の30日ルール等）場合のみ：
 * その場合だけAPIが401を返すので、ログイン画面へ誘導する。それ以外は呼び出し元に委ねる。
 *
 * 【初心者向け】ブラウザ側で API を呼ぶときは `fetch` の代わりに必ずこれを使う。401 が返ったら
 * 行くべき画面へ飛ばし、`UnauthorizedError` を投げる。呼び出し側は catch でこのエラーなら何もしない
 * （画面はもう遷移しているため）。各コンポーネントに `if (error instanceof UnauthorizedError) return;` があるのはそのため。
 *
 * 401 は「セッション切れ」だけではない（#583）。関所（src/proxy.ts）は、登録待ち・再同意待ちの人が
 * API を呼んだときも 401 を返す。これを一律でログイン画面に飛ばすと、規約を読もうとしただけの人が
 * 締め出されてしまうので、本文の `error` を見て行き先を変える。
 */
import { buildAdminMfaPath } from "@/lib/admin/mfa-redirect";

export class UnauthorizedError extends Error {}

/** 401 の `error` → 送る先（純粋関数。単体テストの対象） */
export function loginRedirectFor(error: string | undefined, currentPath: string): string {
  // 認証は済んでいるが、まだ同意していない人。ログインし直しても解決しないので同意の画面へ送る
  if (error === "reconsent_required") return "/consent/renew";
  if (error === "signup_required") return "/signup";
  // admin-login Task 6: 管理者だが二段階確認がまだ（未登録・期限切れ）。ログイン画面ではなく SC-32 へ
  if (error === "admin_mfa_required") return buildAdminMfaPath(currentPath);
  return `/login?redirect_to=${encodeURIComponent(currentPath)}`;
}

export async function fetchWithAuthRedirect(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const response = await fetch(input, init);

  if (response.status === 401) {
    // 本文は JSON とは限らない（空の 401 もある）ので、読めなければ「セッション切れ」として扱う
    const body = (await response
      .clone()
      .json()
      .catch(() => null)) as { error?: string } | null;
    // 素のユーティリティ関数のためuseRouter()は使えない。
    // 認証切れ時はクライアント側の状態も確実に破棄したいのでフルリロードでよい。
    window.location.href = loginRedirectFor(body?.error, window.location.pathname);
    throw new UnauthorizedError();
  }

  return response;
}
