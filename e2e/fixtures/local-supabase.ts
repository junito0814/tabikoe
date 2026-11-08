import { execFileSync } from "node:child_process";

/**
 * e2e-foundation Task 2: ローカルの Supabase（E2E 用の使い捨て）の繋ぎ先を読む
 * 出典: docs/tasks/shared-ui/e2e-foundation/02-local-supabase.md
 *
 * 【初心者向け】`npx supabase status -o json` は、手元で動いている Supabase の URL と鍵を返します。
 * 鍵はローカル専用の決まった値ですが、それでも**画面やログには出しません**（約束 21）。
 *
 * **繋ぎ先が手元（127.0.0.1 / localhost）でなければ止めます。** E2E はデータを全部消して入れ直すので、
 * 万一ここが本番や開発用を指していたら取り返しがつきません。「気をつける」ではなく、仕組みで止めます。
 */
export interface LocalSupabase {
  url: string;
  publishableKey: string;
  secretKey: string;
}

/** 手元のアドレスか（純粋関数） */
export function isLocalUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname === "127.0.0.1" || hostname === "localhost";
  } catch {
    return false;
  }
}

/** 動いていなければ null（例外を投げない。呼び出し側が理由を出して止める） */
export function readLocalSupabase(): LocalSupabase | null {
  let raw: string;
  try {
    raw = execFileSync("npx", ["supabase", "status", "-o", "json"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return null;
  }
  const status = JSON.parse(raw) as Record<string, string>;
  const url = status.API_URL;
  if (!url || !status.PUBLISHABLE_KEY || !status.SECRET_KEY) return null;
  if (!isLocalUrl(url)) {
    throw new Error(`E2E の Supabase が手元を向いていません（${new URL(url).hostname}）。データを消すので止めます`);
  }
  return { url, publishableKey: status.PUBLISHABLE_KEY, secretKey: status.SECRET_KEY };
}

/** テストの中から使う。動いていなければ理由を出して止める */
export function requireLocalSupabase(): LocalSupabase {
  const local = readLocalSupabase();
  if (!local) {
    throw new Error("ローカルの Supabase が動いていません。`npm run test:e2e` から動かしてください（起動まで面倒を見ます）");
  }
  return local;
}

/** Docker の中のデータベースのコンテナ名（supabase/config.toml の project_id から決まる） */
export const DB_CONTAINER = "supabase_db_tabikoe";
