import type { SupabaseClient } from "@supabase/supabase-js";
import type { PublishedVersions } from "@/lib/auth/reconsent";
import type { LegalKind } from "./legal-documents";

/**
 * legal-documents Task 3: 公開中の版を短時間だけ覚えておく（関所で毎リクエスト DB を叩かないため）
 * 出典: docs/tasks/admin/legal-documents/03-reconsent.md
 *
 * 【初心者向け】公開中の版は滅多に変わらないので 60 秒だけメモリに持つ。公開した直後に最大 60 秒、
 * 再同意画面が出るのが遅れるだけで、実害はない。読めなければ空（＝再同意不要）として扱い、関所を止めない。
 */
export const PUBLISHED_VERSIONS_TTL_MS = 60 * 1000;

const cache: { value: PublishedVersions | null; fetchedAt: number } = { value: null, fetchedAt: 0 };

export function resetPublishedVersionsCache(): void {
  cache.value = null;
  cache.fetchedAt = 0;
}

export async function getPublishedVersionsCached(client: SupabaseClient, now: number = Date.now()): Promise<PublishedVersions> {
  if (cache.value && now - cache.fetchedAt < PUBLISHED_VERSIONS_TTL_MS) return cache.value;
  try {
    const { data, error } = await client.from("legal_documents").select("kind, version").eq("status", "published");
    if (error) throw error;
    const value: PublishedVersions = {};
    for (const row of (data ?? []) as { kind: LegalKind; version: string }[]) value[row.kind] = row.version;
    cache.value = value;
    cache.fetchedAt = now;
    return value;
  } catch (error) {
    console.error("[legal] 公開中の版を読めませんでした:", error instanceof Error ? error.message : error);
    return cache.value ?? {};
  }
}
