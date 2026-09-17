import type { SupabaseClient } from "@supabase/supabase-js";
import { createPostPhotoUrls } from "./signed-url";
import { UNNAMED_SPOT_NAME } from "@/lib/spots/finalize-spot";

/**
 * draft Task3: 下書きの取得（マイページの先頭・自分の地図のピン）
 * 出典: docs/tasks/posts/draft/03-draft-listing-and-publish.md
 *       要件定義書 v3.0 3.3.7・3.6.1
 *
 * 【初心者向け】下書きは本人にしか見せないので、必ず userId で絞る（service_role で読むため RLS に頼らない）。
 * 一覧に出すのは「スポット名（無ければ「名前のない場所」）・保存日時・サムネイル」だけ。
 */
export interface DraftSummary {
  id: string;
  spotName: string;
  lat: number | null;
  lng: number | null;
  updatedAt: string;
  thumbnailUrl: string | null;
}

export interface DraftListPage {
  drafts: DraftSummary[];
  total: number;
}

interface DraftRow {
  id: string;
  lat: number | null;
  lng: number | null;
  created_at: string;
  spots: { name: string } | { name: string }[] | null;
  post_photos: { storage_url: string | null; display_order: number }[];
}

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function getMyDrafts(admin: SupabaseClient, userId: string, limit = 50): Promise<DraftListPage> {
  const { data, error, count } = await admin
    .from("posts")
    .select("id, lat, lng, created_at, spots(name), post_photos(storage_url, display_order)", { count: "exact" })
    .eq("user_id", userId)
    .eq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  const rows = (data ?? []) as unknown as DraftRow[];
  const thumbnailPaths = rows.flatMap((row) => {
    const first = [...row.post_photos].sort((a, b) => a.display_order - b.display_order)[0];
    return first?.storage_url ? [first.storage_url] : [];
  });
  const signed = await createPostPhotoUrls(admin, thumbnailPaths);

  const drafts = rows.map((row) => {
    const first = [...row.post_photos].sort((a, b) => a.display_order - b.display_order)[0];
    return {
      id: row.id,
      spotName: one(row.spots)?.name ?? UNNAMED_SPOT_NAME,
      lat: row.lat,
      lng: row.lng,
      updatedAt: row.created_at,
      thumbnailUrl: first?.storage_url ? (signed.get(first.storage_url) ?? null) : null,
    };
  });
  return { drafts, total: count ?? drafts.length };
}
