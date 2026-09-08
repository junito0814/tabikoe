/** IPアドレスを特定できなかった場合に使う共通のsubject。 */
export const UNKNOWN_CLIENT_IP = "unknown";

/**
 * リバースプロキシ経由で付与されるヘッダーからクライアントIPを取得する。
 * 複数ホップの場合は先頭（クライアントに最も近いもの）を使う。
 *
 * どのヘッダーも無い場合はUNKNOWN_CLIENT_IPを返す。この場合レート制限は
 * 「全リクエストが1つのカウンタを共有する」フェイルクローズ動作になるため、
 * x-forwarded-forを付与しない環境へデプロイすると全ユーザーが
 * まとめて制限に掛かる点に注意すること（Vercelでは常に付与される）。
 */
export function getClientIp(request: Request): string {
  const candidates = [
    request.headers.get("x-vercel-forwarded-for"),
    request.headers.get("x-forwarded-for"),
    request.headers.get("x-real-ip"),
  ];

  for (const candidate of candidates) {
    const first = candidate?.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }

  return UNKNOWN_CLIENT_IP;
}
