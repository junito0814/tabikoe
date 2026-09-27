import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { canRequestSpotFix, requestSpotFix, updateOwnSpot, validateSpotFixInput } from "./spot-fix";

/** 出典: docs/tasks/safety/strike-system/06-spot-fix-request.md 単体テスト */
describe("canRequestSpotFix / validateSpotFixInput", () => {
  it("スポットへの「情報の誤り」で、タビコエだけの場所に登録者が居るときだけ依頼できる", () => {
    const report = { targetType: "spot", reason: "wrong_spot_info" };
    expect(canRequestSpotFix(report, { source: "manual", createdBy: "u1" })).toBe(true);
    expect(canRequestSpotFix(report, { source: "places", createdBy: "u1" })).toBe(false);
    expect(canRequestSpotFix(report, { source: "manual", createdBy: null })).toBe(false);
    expect(canRequestSpotFix({ targetType: "spot", reason: "spam" }, { source: "manual", createdBy: "u1" })).toBe(false);
    expect(canRequestSpotFix({ targetType: "post", reason: "wrong_spot_info" }, { source: "manual", createdBy: "u1" })).toBe(false);
  });

  it("入力規則: 名前必須・100 文字・都道府県はリストの値・座標の範囲", () => {
    expect(validateSpotFixInput({ name: " 路地裏の喫茶店 ", prefecture: "京都府", lat: 35.0, lng: 135.7 })).toEqual({ ok: true, fields: { name: "路地裏の喫茶店", prefecture: "京都府", lat: 35.0, lng: 135.7 } });
    expect(validateSpotFixInput({ name: "", lat: 0, lng: 0 })).toEqual({ ok: false, error: "name_required" });
    expect(validateSpotFixInput({ name: "a".repeat(101), lat: 0, lng: 0 })).toEqual({ ok: false, error: "name_too_long" });
    expect(validateSpotFixInput({ name: "x", prefecture: "火星", lat: 0, lng: 0 })).toEqual({ ok: false, error: "invalid_prefecture" });
    expect(validateSpotFixInput({ name: "x", prefecture: "", lat: 0, lng: 0 })).toMatchObject({ ok: true, fields: { prefecture: null } });
    expect(validateSpotFixInput({ name: "x", lat: 91, lng: 0 })).toEqual({ ok: false, error: "invalid_position" });
  });
});

function fakeAdmin(spot: Record<string, unknown> | null, report: Record<string, unknown> | null = null) {
  const calls: string[] = [];
  const client = {
    from: (table: string) => ({
      select: () => {
        const c: Record<string, unknown> = {};
        c.eq = () => c;
        c.maybeSingle = async () => ({ data: table === "spots" ? spot : table === "reports" ? report : { display_name: "x" }, error: null });
        c.then = (resolve: (v: unknown) => void) => resolve({ data: [], error: null });
        return c;
      },
      update: (payload: Record<string, unknown>) => {
        const c: Record<string, unknown> = {};
        const filters: string[] = [];
        for (const f of ["eq", "in"]) c[f] = (...a: unknown[]) => { filters.push(`${f}:${a[0]}`); return c; };
        c.select = async () => { calls.push(`${table}.update:${Object.keys(payload).join(",")}[${filters.join(",")}]`); return { data: [{ id: "r1" }], error: null }; };
        c.then = (resolve: (v: unknown) => void) => { calls.push(`${table}.update:${Object.keys(payload).join(",")}[${filters.join(",")}]`); resolve({ error: null }); };
        return c;
      },
      insert: async (payload: Record<string, unknown>) => { calls.push(`${table}.insert:${payload.type ?? payload.action}`); return { error: null }; },
    }),
  } as unknown as SupabaseClient;
  return { client, calls };
}
const manualSpot = { id: "s1", name: "路地裏の喫茶店", prefecture: "京都府", lat: 35, lng: 135.7, source: "manual", created_by: "u1" };

describe("requestSpotFix", () => {
  beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it("通報を確認中にし、登録者に通知し、記録を残す。ストライクは付けない", async () => {
    const { client, calls } = fakeAdmin(manualSpot, { id: "r1", target_type: "spot", target_id: "s1", reason: "wrong_spot_info", status: "unconfirmed" });
    expect(await requestSpotFix(client, { adminId: "admin-1", reportId: "r1", note: "住所の確認をお願いします" })).toEqual({ ok: true });
    expect(calls.filter((c) => !c.startsWith("operation_logs."))).toEqual(["reports.update:status[eq:id,in:status]", "admin_actions.insert:spot_fix_request", "notifications.insert:spot_fix_request"]);
    expect(calls.some((c) => c.includes("strikes"))).toBe(false);
  });

  it("Google 由来のスポットや理由が違う通報には依頼できない", async () => {
    const { client } = fakeAdmin({ ...manualSpot, source: "places" }, { id: "r1", target_type: "spot", target_id: "s1", reason: "wrong_spot_info", status: "unconfirmed" });
    expect(await requestSpotFix(client, { adminId: "admin-1", reportId: "r1", note: "x" })).toEqual({ ok: false, error: "not_applicable" });
  });
});

describe("updateOwnSpot", () => {
  it("本人の手動スポットは更新でき、関連する通報が問題なしになる", async () => {
    const { client, calls } = fakeAdmin(manualSpot);
    const result = await updateOwnSpot(client, { userId: "u1", spotId: "s1", fields: { name: "路地裏の喫茶店（本店）", prefecture: "京都府", lat: 35.01, lng: 135.71 } });
    expect(result).toEqual({ ok: true, resolvedReports: 1 });
    expect(calls).toEqual(["spots.update:name,prefecture,lat,lng[eq:id]", "reports.update:status,resolved_at,resolution_note[eq:target_type,eq:target_id,eq:reason,in:status]"]);
  });

  it("他人のスポット・Google 由来のスポットは forbidden、無ければ not_found", async () => {
    expect(await updateOwnSpot(fakeAdmin(manualSpot).client, { userId: "u2", spotId: "s1", fields: { name: "x", prefecture: null, lat: 0, lng: 0 } })).toEqual({ ok: false, error: "forbidden" });
    expect(await updateOwnSpot(fakeAdmin({ ...manualSpot, source: "places" }).client, { userId: "u1", spotId: "s1", fields: { name: "x", prefecture: null, lat: 0, lng: 0 } })).toEqual({ ok: false, error: "forbidden" });
    expect(await updateOwnSpot(fakeAdmin(null).client, { userId: "u1", spotId: "s1", fields: { name: "x", prefecture: null, lat: 0, lng: 0 } })).toEqual({ ok: false, error: "not_found" });
  });
});
