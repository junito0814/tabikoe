import type { SupabaseClient } from "@supabase/supabase-js";
import { createPostPhotoUrls } from "@/lib/posts/signed-url";
import type { ReportTargetType } from "@/lib/reports/constants";
import type { ReportListItem } from "./report-filters";

/**
 * F-AD-04 Task1: 通報された対象の内容（管理者の確認用）
 * 出典: docs/tasks/admin/report-list/01-report-list-handler.md
 *
 * 種別ごとに必要最小限の内容を取り、既に消えている場合は `exists: false`。
 *
 * 【初心者向け】通報の対象は 7 種類（投稿・感想・写真・コメント・ユーザー・スポット・アルバム）あり、
 * それぞれテーブルも「非公開化された」の判定列も違う。`loadTargetContent` の switch で種別ごとに取り方を分け、
 * 画面には共通の形（ReportTargetContent）で渡す。写真の URL は非公開バケットなので署名付き URL に変換する。
 */
export interface ReportTargetContent {
  exists: boolean;
  /** 画面で見せる要約行 */
  summary: string;
  /** 本文（投稿の感想・コメント本文など） */
  text: string | null;
  /** 写真（署名付きURL） */
  imageUrls: string[];
  /** 対象の所有者（匿名性のため通報者には返さない。管理者のみ） */
  ownerId: string | null;
  /** 既に非公開化・停止済みか */
  hidden: boolean;
  /** アプリ内でのリンク（存在する場合） */
  href: string | null;
}

export interface ReportDetail extends ReportListItem {
  reporterId: string;
  resolvedBy: string | null;
  target: ReportTargetContent;
}

export async function getReportDetail(admin: SupabaseClient, reportId: string): Promise<ReportDetail | null> {
  const { data, error } = await admin
    .from("reports")
    .select(
      "id, reporter_id, target_type, target_id, reason, detail, status, created_at, resolved_by, resolved_at, resolution_note"
    )
    .eq("id", reportId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const target = await loadTargetContent(admin, data.target_type as ReportTargetType, data.target_id as string);

  return {
    id: data.id,
    reporterId: data.reporter_id,
    targetType: data.target_type,
    targetId: data.target_id,
    reason: data.reason,
    detail: data.detail,
    status: data.status,
    createdAt: data.created_at,
    resolvedBy: data.resolved_by,
    resolvedAt: data.resolved_at,
    resolutionNote: data.resolution_note,
    target,
  };
}

const missing = (summary: string): ReportTargetContent => ({
  exists: false,
  summary,
  text: null,
  imageUrls: [],
  ownerId: null,
  hidden: false,
  href: null,
});

async function loadTargetContent(
  admin: SupabaseClient,
  targetType: ReportTargetType,
  targetId: string
): Promise<ReportTargetContent> {
  switch (targetType) {
    case "post":
    case "post_review": {
      const { data } = await admin
        .from("posts")
        .select("id, user_id, category, comment, visibility, hidden_at, review_hidden_at, spots(name), post_photos(storage_url, display_order)")
        .eq("id", targetId)
        .maybeSingle();
      if (!data) return missing("投稿は既に削除されています");
      const spot = (Array.isArray(data.spots) ? data.spots[0] : data.spots) as { name: string } | null;
      const paths = ((data.post_photos ?? []) as { storage_url: string | null; display_order: number }[])
        .sort((a, b) => a.display_order - b.display_order)
        .flatMap((p) => (p.storage_url ? [p.storage_url] : []));
      const urls = await createPostPhotoUrls(admin, paths);
      return {
        exists: true,
        summary: `投稿: ${spot?.name ?? ""}（${data.category}${data.visibility === "private" ? "・非公開" : ""}）`,
        text: data.comment,
        imageUrls: targetType === "post" ? paths.flatMap((p) => (urls.get(p) ? [urls.get(p)!] : [])) : [],
        ownerId: data.user_id,
        hidden: targetType === "post" ? data.hidden_at !== null : data.review_hidden_at !== null || data.comment === null,
        href: `/posts/${data.id}`,
      };
    }
    case "post_photo": {
      const { data } = await admin
        .from("post_photos")
        .select("id, storage_url, media_type, hidden_at, post:posts!inner(id, user_id)")
        .eq("id", targetId)
        .maybeSingle();
      if (!data) return missing("写真・動画は既に削除されています");
      const post = (Array.isArray(data.post) ? data.post[0] : data.post) as { id: string; user_id: string } | null;
      const urls = data.storage_url ? await createPostPhotoUrls(admin, [data.storage_url]) : new Map<string, string>();
      return {
        exists: true,
        summary: `写真・動画（${data.media_type}）`,
        text: null,
        imageUrls: data.storage_url && urls.get(data.storage_url) ? [urls.get(data.storage_url)!] : [],
        ownerId: post?.user_id ?? null,
        hidden: data.hidden_at !== null,
        href: post ? `/posts/${post.id}` : null,
      };
    }
    case "comment": {
      const { data } = await admin
        .from("comments")
        .select("id, user_id, body, post_id, hidden_at")
        .eq("id", targetId)
        .maybeSingle();
      if (!data) return missing("コメントは既に削除されています");
      return {
        exists: true,
        summary: "コメント",
        text: data.body,
        imageUrls: [],
        ownerId: data.user_id,
        hidden: data.hidden_at !== null,
        href: `/posts/${data.post_id}`,
      };
    }
    case "user": {
      const { data } = await admin
        .from("users")
        .select("id, display_name, avatar_url, is_deleted, suspended_at")
        .eq("id", targetId)
        .maybeSingle();
      if (!data || data.is_deleted) return missing("ユーザーは退会済みです");
      return {
        exists: true,
        summary: `ユーザー: ${data.display_name ?? "（名前なし）"}`,
        text: null,
        imageUrls: data.avatar_url ? [data.avatar_url] : [],
        ownerId: data.id,
        hidden: data.suspended_at !== null,
        href: `/users/${data.id}`,
      };
    }
    case "spot": {
      const { data } = await admin.from("spots").select("id, name, prefecture, hidden_at").eq("id", targetId).maybeSingle();
      if (!data) return missing("スポットは存在しません");
      return {
        exists: true,
        summary: `スポット: ${data.name}（${data.prefecture ?? "都道府県未設定"}）`,
        text: null,
        imageUrls: [],
        ownerId: null,
        hidden: data.hidden_at !== null,
        href: `/spots/${data.id}`,
      };
    }
    case "trip": {
      const { data } = await admin.from("trips").select("id, user_id, title, hidden_at").eq("id", targetId).maybeSingle();
      if (!data) return missing("アルバムは存在しません");
      return {
        exists: true,
        summary: `アルバム: ${data.title}`,
        text: null,
        imageUrls: [],
        ownerId: data.user_id,
        hidden: data.hidden_at !== null,
        href: `/albums/${data.id}`,
      };
    }
  }
}
