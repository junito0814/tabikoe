/**
 * F-AC-02 Task5: フロントエンドの透過的セッション継続UX
 * 出典: docs/tasks/account/session-management/05-frontend-seamless-session-ux.md
 *
 * アクセストークンの期限切れ自体はサーバー側（src/proxy.ts）で毎リクエスト透過的に
 * リフレッシュされるため、フロントエンドが個別にリトライする必要はない。
 * ここで扱うのは、リフレッシュトークン自体が失効した（F-AC-02 Task3の30日ルール等）場合のみ：
 * その場合だけAPIが401を返すので、ログイン画面へ誘導する。それ以外は呼び出し元に委ねる。
 */
export class UnauthorizedError extends Error {}

export async function fetchWithAuthRedirect(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const response = await fetch(input, init);

  if (response.status === 401) {
    const redirectTo = encodeURIComponent(window.location.pathname);
    // 素のユーティリティ関数のためuseRouter()は使えない。
    // 認証切れ時はクライアント側の状態も確実に破棄したいのでフルリロードでよい。
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = `/login?redirect_to=${redirectTo}`;
    throw new UnauthorizedError();
  }

  return response;
}
