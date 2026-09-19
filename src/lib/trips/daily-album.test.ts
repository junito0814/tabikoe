import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DAILY_ALBUM_TITLE, getOrCreateDailyTripId, isDailyTrip } from "./daily-album";
import { resolveTripId } from "./resolve-trip";

/**
 * 出典: docs/tasks/shared-ui/mentoring-7/02-daily-album.md 単体テスト
 * - 空のアルバム欄で「日常」が返ること（既存があればそれ、無ければ作る。ユーザーごとに 1 つ）
 * - 仮タイトルが作られないこと
 *
 * 【初心者向け】Supabase のクライアントを「呼ばれた順に答えを返す偽物」に差し替えて、
 * SELECT → INSERT の流れだけを検証する（DB には触らない）。
 */
type Step = { data: unknown; error: { message: string } | null };

function fakeSupabase(steps: Step[]) {
  const calls: { op: string; payload?: unknown }[] = [];
  const chain = () => {
    const c: Record<string, unknown> = {};
    for (const op of ["select", "eq", "insert", "update"]) {
      c[op] = (payload?: unknown) => {
        if (op === "insert" || op === "update") calls.push({ op, payload });
        return c;
      };
    }
    c.maybeSingle = () => Promise.resolve(steps.shift() ?? { data: null, error: null });
    c.single = () => Promise.resolve(steps.shift() ?? { data: null, error: null });
    // update(...).eq(...) は await される（結果は最後の step）
    c.then = (resolve: (value: Step) => void) => resolve(steps.shift() ?? { data: null, error: null });
    return c;
  };
  return { client: { from: () => chain() } as unknown as SupabaseClient, calls };
}

describe("getOrCreateDailyTripId", () => {
  it("既に「日常」があればそれを返し、作らない", async () => {
    const { client, calls } = fakeSupabase([{ data: { id: "daily-1" }, error: null }]);
    expect(await getOrCreateDailyTripId(client, "u1")).toBe("daily-1");
    expect(calls.filter((c) => c.op === "insert")).toHaveLength(0);
  });

  it("無ければ is_daily=true で作る", async () => {
    const { client, calls } = fakeSupabase([
      { data: null, error: null }, // is_daily の検索
      { data: null, error: null }, // title='日常' の検索
      { data: { id: "daily-new" }, error: null }, // insert
    ]);
    expect(await getOrCreateDailyTripId(client, "u1")).toBe("daily-new");
    expect(calls.find((c) => c.op === "insert")?.payload).toEqual({ user_id: "u1", title: DAILY_ALBUM_TITLE, is_daily: true });
  });

  it("「日常」という名前の旅行を自分で作っていた人は、それを昇格させる", async () => {
    const { client, calls } = fakeSupabase([
      { data: null, error: null },
      { data: { id: "named" }, error: null },
      { data: null, error: null }, // update の結果
    ]);
    expect(await getOrCreateDailyTripId(client, "u1")).toBe("named");
    expect(calls.find((c) => c.op === "update")?.payload).toEqual({ is_daily: true });
  });
});

describe("resolveTripId と「日常」", () => {
  it("allowDaily で空のアルバム欄は「日常」に解決され、仮タイトルの旅行は作られない", async () => {
    const { client, calls } = fakeSupabase([{ data: { id: "daily-1" }, error: null }]);
    expect(await resolveTripId(client, "u1", "   ", { allowDaily: true })).toBe("daily-1");
    expect(calls.filter((c) => c.op === "insert")).toHaveLength(0);
  });

  it("「日常」と入力しても同じ「日常」に解決される", async () => {
    const { client } = fakeSupabase([{ data: { id: "daily-1" }, error: null }]);
    expect(await resolveTripId(client, "u1", "日常", { allowDaily: true })).toBe("daily-1");
  });

  it("allowDaily が無いときは空文字を拒否する（しおり作成など）", async () => {
    const { client } = fakeSupabase([]);
    await expect(resolveTripId(client, "u1", "")).rejects.toThrow("trip_title_required");
  });
});

describe("isDailyTrip", () => {
  it("is_daily の値を boolean で返す", async () => {
    const { client } = fakeSupabase([{ data: { is_daily: true }, error: null }]);
    expect(await isDailyTrip(client, "t1")).toBe(true);
    const missing = fakeSupabase([{ data: null, error: null }]);
    expect(await isDailyTrip(missing.client, "t2")).toBe(false);
  });
});

