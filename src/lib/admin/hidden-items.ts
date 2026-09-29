import type { SupabaseClient } from "@supabase/supabase-js";
import { recordAdminAction, type AdminActionTargetType } from "./admin-actions";

/**
 * user-management Task 3: 非公開にしたものの一覧と復元（SC-25）
 * 出典: docs/tasks/admin/user-management/03-hidden-items.md
 *       要件定義書 3.10.10「非公開にしたものと復元」
 *
 * 【初心者向け】非公開の理由は 3 つ（hidden_reason）：
 *   auto       … 通報が重なって自動で隠れた（確認待ち）
 *   moderation … 管理者が通報対応で非公開化した（古い行は NULL。これも管理者の判断として扱う）
 *   suspension … アカウント停止に伴って隠れた
 * タブはこの 3 つ。復元は hidden_at と hidden_reason を消すだけ（削除したものは行が無いので出ない）。
 * 自動非公開を「問題なし・元に戻す」で復元したときは、その対象への未処理の通報も「問題なし」にする。
 */
export const HIDDEN_TABS = ["auto", "admin", "suspension"] as const;
export type HiddenTab = (typeof HIDDEN_TABS)[number];
export const HIDDEN_TAB_LABELS: Record<HiddenTab, string> = {
  auto: "自動で非公開（確認待ち）",
  admin: "管理者が非公開にしたもの",
  suspension: "停止で非公開になったもの",
};

export const HIDDEN_KINDS = ["post", "comment", "spot", "trip"] as const;
export type HiddenKind = (typeof HIDDEN_KINDS)[number];
const KIND_TABLE: Record<HiddenKind, string> = { post: "posts", comment: "comments", spot: "spots", trip: "trips" };
const KIND_LABEL: Record<HiddenKind, string> = { post: "投稿", comment: "コメント", spot: "スポット", trip: "アルバム" };

export const HIDDEN_PAGE_SIZE = 20;

export function parseHiddenTab(value: string | null | undefined): HiddenTab {
  return (HIDDEN_TABS as readonly string[]).includes(value ?? "") ? (value as HiddenTab) : "auto";
}

export function isHiddenKind(value: unknown): value is HiddenKind {
  return (HIDDEN_KINDS as readonly string[]).includes(String(value));
}

export interface HiddenItem {
  kind: HiddenKind;
  id: string;
  hiddenAt: string;
  /** 対象の言い方（投稿ならスポット名、コメントなら本文の冒頭） */
  label: string;
  /** 投稿者（スポットは登録者、無ければ null） */
  authorName: string | null;
  authorId: string | null;
  /** 理由（操作の記録の最新の note。自動なら「異なる通報者 N 人（…）」、管理者なら対応理由） */
  reason: string | null;
  /** 通報詳細へ（この対象への通報のうち最新） */
  reportId: string | null;
  /** 利用者向けの画面（新しいタブで見る） */
  href: string | null;
}

/**
 * タブ → hidden_reason の条件（PostgREST の or 句。純粋関数）。
 * admin は moderation と NULL（hidden_reason を足す前に非公開化した古い行）の両方
 */
export function reasonFilterOf(tab: HiddenTab): string {
  if (tab === "auto") return "hidden_reason.eq.auto";
  if (tab === "suspension") return "hidden_reason.eq.suspension";
  return "hidden_reason.is.null,hidden_reason.eq.moderation";
}

/** 4 テーブルの行を非公開になった順に並べ、ページを切る（純粋関数） */
export function paginateHidden(items: HiddenItem[], offset: number, limit = HIDDEN_PAGE_SIZE): { items: HiddenItem[]; nextOffset: number | null } {
  const sorted = [...items].sort((a, b) => b.hiddenAt.localeCompare(a.hiddenAt));
  const page = sorted.slice(offset, offset + limit);
  return { items: page, nextOffset: offset + limit < sorted.length ? offset + limit : null };
}

export async function listHiddenItems(admin: SupabaseClient, tab: HiddenTab, offset: number): Promise<{ items: HiddenItem[]; nextOffset: number | null }> {
  const reasonFilter = reasonFilterOf(tab);
  const one = <T>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

  const [posts, comments, spots, trips] = await Promise.all([
    admin.from("posts").select("id, hidden_at, user_id, spots(name), users(display_name)").not("hidden_at", "is", null).or(reasonFilter).order("hidden_at", { ascending: false }).limit(200),
    admin.from("comments").select("id, hidden_at, user_id, body, post_id, users(display_name)").not("hidden_at", "is", null).or(reasonFilter).order("hidden_at", { ascending: false }).limit(200),
    // スポット・アルバムは管理者の判断でしか隠れない（自動・停止の対象外）
    tab === "admin" ? admin.from("spots").select("id, hidden_at, name, created_by").not("hidden_at", "is", null).order("hidden_at", { ascending: false }).limit(200) : Promise.resolve({ data: [], error: null }),
    tab === "admin" ? admin.from("trips").select("id, hidden_at, title, user_id, users(display_name)").not("hidden_at", "is", null).order("hidden_at", { ascending: false }).limit(200) : Promise.resolve({ data: [], error: null }),
  ]);
  for (const r of [posts, comments, spots, trips]) if (r.error) throw r.error;

  const items: HiddenItem[] = [
    ...((posts.data ?? []) as { id: string; hidden_at: string; user_id: string; spots: unknown; users: unknown }[]).map((p) => ({
      kind: "post" as const,
      id: p.id,
      hiddenAt: p.hidden_at,
      label: `投稿「${one(p.spots as { name: string } | { name: string }[] | null)?.name ?? "（スポットなし）"}」`,
      authorName: one(p.users as { display_name: string | null } | { display_name: string | null }[] | null)?.display_name ?? null,
      authorId: p.user_id,
      reason: null,
      reportId: null,
      href: `/posts/${p.id}`,
    })),
    ...((comments.data ?? []) as { id: string; hidden_at: string; user_id: string; body: string; post_id: string; users: unknown }[]).map((c) => ({
      kind: "comment" as const,
      id: c.id,
      hiddenAt: c.hidden_at,
      label: `コメント「${c.body.slice(0, 30)}${c.body.length > 30 ? "…" : ""}」`,
      authorName: one(c.users as { display_name: string | null } | { display_name: string | null }[] | null)?.display_name ?? null,
      authorId: c.user_id,
      reason: null,
      reportId: null,
      href: `/posts/${c.post_id}`,
    })),
    ...((spots.data ?? []) as { id: string; hidden_at: string; name: string; created_by: string | null }[]).map((s) => ({
      kind: "spot" as const,
      id: s.id,
      hiddenAt: s.hidden_at,
      label: `スポット「${s.name}」`,
      authorName: null,
      authorId: s.created_by,
      reason: null,
      reportId: null,
      href: `/spots/${s.id}`,
    })),
    ...((trips.data ?? []) as { id: string; hidden_at: string; title: string; user_id: string; users: unknown }[]).map((t) => ({
      kind: "trip" as const,
      id: t.id,
      hiddenAt: t.hidden_at,
      label: `アルバム「${t.title}」`,
      authorName: one(t.users as { display_name: string | null } | { display_name: string | null }[] | null)?.display_name ?? null,
      authorId: t.user_id,
      reason: null,
      reportId: null,
      href: `/albums/${t.id}`,
    })),
  ];

  const page = paginateHidden(items, offset);
  await attachReasons(admin, page.items, tab);
  return page;
}

/** 理由（操作の記録の最新 note）と通報詳細へのリンクを付ける */
async function attachReasons(admin: SupabaseClient, items: HiddenItem[], tab: HiddenTab): Promise<void> {
  if (items.length === 0) return;
  const ids = items.map((i) => i.id);
  const ownerIds = [...new Set(items.map((i) => i.authorId).filter((v): v is string => !!v))];
  const [actions, reports, userActions] = await Promise.all([
    admin.from("admin_actions").select("target_id, note, created_at").in("target_id", ids).in("action", ["auto_hide", "report_hide"]).order("created_at", { ascending: false }),
    admin.from("reports").select("id, target_id, created_at").in("target_id", ids).order("created_at", { ascending: false }),
    tab === "suspension" && ownerIds.length > 0
      ? admin.from("admin_actions").select("target_id, note, created_at").in("target_id", ownerIds).in("action", ["user_suspend", "user_provisional_suspend"]).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);
  const noteByTarget = new Map<string, string>();
  for (const a of (actions.data ?? []) as { target_id: string; note: string | null }[]) if (a.note && !noteByTarget.has(a.target_id)) noteByTarget.set(a.target_id, a.note);
  const noteByOwner = new Map<string, string>();
  for (const a of (userActions.data ?? []) as { target_id: string; note: string | null }[]) if (a.note && !noteByOwner.has(a.target_id)) noteByOwner.set(a.target_id, a.note);
  const reportByTarget = new Map<string, string>();
  for (const r of (reports.data ?? []) as { id: string; target_id: string }[]) if (!reportByTarget.has(r.target_id)) reportByTarget.set(r.target_id, r.id);
  for (const item of items) {
    item.reason = noteByTarget.get(item.id) ?? (item.authorId ? (noteByOwner.get(item.authorId) ?? null) : null);
    item.reportId = reportByTarget.get(item.id) ?? null;
  }
}

/** 復元。自動非公開だった場合は、その対象への未処理の通報を「問題なし」にする */
export async function restoreHiddenItem(
  admin: SupabaseClient,
  input: { adminId: string; kind: HiddenKind; id: string; note: string; now?: Date }
): Promise<{ restored: boolean; wasAuto: boolean }> {
  const now = input.now ?? new Date();
  const table = KIND_TABLE[input.kind];
  const { data: before, error: readError } = await admin.from(table).select("id, hidden_at, hidden_reason").eq("id", input.id).maybeSingle();
  if (readError) throw readError;
  if (!before || !before.hidden_at) return { restored: false, wasAuto: false };
  const wasAuto = before.hidden_reason === "auto";

  const payload: Record<string, unknown> = { hidden_at: null };
  if (input.kind === "post" || input.kind === "comment") payload.hidden_reason = null;
  const { error } = await admin.from(table).update(payload).eq("id", input.id);
  if (error) throw error;

  if (wasAuto) {
    const targetTypes = input.kind === "post" ? ["post", "post_review"] : ["comment"];
    const { error: reportError } = await admin
      .from("reports")
      .update({ status: "no_issue", resolved_by: input.adminId, resolved_at: now.toISOString(), resolution_note: `復元（${input.note}）` })
      .eq("target_id", input.id)
      .in("target_type", targetTypes)
      .in("status", ["unconfirmed", "in_review"]);
    if (reportError) throw reportError;
  }

  await recordAdminAction(admin, {
    actorId: input.adminId,
    action: "hidden_restore",
    target: { type: input.kind as AdminActionTargetType, id: input.id, label: `${KIND_LABEL[input.kind]} ${input.id.slice(0, 8)}` },
    note: input.note,
  });
  return { restored: true, wasAuto };
}
