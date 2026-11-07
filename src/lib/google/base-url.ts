/**
 * e2e-foundation Task 4: サーバーから Google を呼ぶときの基点（URL の前半）を 1 か所で決める
 * 出典: docs/tasks/shared-ui/e2e-foundation/04-maps-stub.md
 *
 * 【初心者向け】サーバーが Google に問い合わせる先は 3 つあります（地図系 maps・場所 places・経路 routes）。
 * 4 つのファイル（places.ts・place-details.ts・geocoding.ts・routes.ts）がそれぞれ URL を直書きしていたので、
 * ここを通して組み立てるようにしました。こうすると、E2E のときだけ**手元の小さな偽物（スタブ）**に向け直せます。
 * 本物を呼ぶと、課金され、答えが毎回変わるためです。
 *
 * 向け直すのは `GOOGLE_API_BASE_URL` を設定したときだけ（普段は未設定＝本物）。
 * **手元のアドレス（127.0.0.1 / localhost）でなければ無視して本物を使います。**
 * 向け直した先には API キーも一緒に送られるので、万一本番で設定を間違えても、
 * 外のサーバーにキーが渡らないようにするためです。
 */
export type GoogleApiHost = "maps" | "places" | "routes";

function isLocalBase(base: string): boolean {
  try {
    const { protocol, hostname } = new URL(base);
    return protocol === "http:" && (hostname === "127.0.0.1" || hostname === "localhost");
  } catch {
    return false;
  }
}

/**
 * 例: googleApiUrl("places", "/v1/places:searchText")
 *   未設定 → https://places.googleapis.com/v1/places:searchText
 *   http://127.0.0.1:3199 → http://127.0.0.1:3199/places/v1/places:searchText
 */
export function googleApiUrl(host: GoogleApiHost, path: string, base: string | undefined = process.env.GOOGLE_API_BASE_URL): string {
  const trimmed = base?.trim();
  if (trimmed && isLocalBase(trimmed)) {
    return `${trimmed.replace(/\/+$/, "")}/${host}${path}`;
  }
  return `https://${host}.googleapis.com${path}`;
}
