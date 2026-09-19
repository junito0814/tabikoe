import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * mentoring-7 Task2（v3.1）: 「日常」アルバム
 * 出典: docs/tasks/shared-ui/mentoring-7/02-daily-album.md
 *       要件定義書 v3.1 3.3.4・3.6.2・5.3
 *
 * 【初心者向け】アルバム欄を空にして投稿・下書き保存したときの入れ物。1 人 1 つで、最初に必要になったときに作る
 * （trips.is_daily = true。DB の部分ユニーク索引で 1 人 1 行に限られる）。
 * 名前変更・削除・招待・しおりは付けられないので、各 Route Handler は `isDailyTrip()` で先に弾く。
 * v3.0 の仮タイトル「今日の投稿（M/D）」はこれに置き換わった（provisional-title.ts は削除）。
 */
export const DAILY_ALBUM_TITLE = "日常";

/** その利用者の「日常」の trip_id を返す。無ければ作る（同時実行で重複したら既存行を引き直す） */
export async function getOrCreateDailyTripId(supabase: SupabaseClient, userId: string): Promise<string> {
  const { data: existing, error: selectError } = await supabase.from("trips").select("id").eq("user_id", userId).eq("is_daily", true).maybeSingle();
  if (selectError) throw selectError;
  if (existing) return existing.id;

  // 「日常」という名前の旅行を自分で作っていた人は、それを「日常」に昇格させる（同名の旅行を 2 つ作れないため）
  const { data: named } = await supabase.from("trips").select("id").eq("user_id", userId).eq("title", DAILY_ALBUM_TITLE).maybeSingle();
  if (named) {
    const { error: promoteError } = await supabase.from("trips").update({ is_daily: true }).eq("id", named.id);
    if (promoteError) throw promoteError;
    return named.id;
  }

  const { data: created, error: insertError } = await supabase
    .from("trips")
    .insert({ user_id: userId, title: DAILY_ALBUM_TITLE, is_daily: true })
    .select("id")
    .single();
  if (insertError) {
    // 同時に 2 回作ろうとした場合は部分ユニーク索引に弾かれるので、既存行を引き直す
    const { data: raced } = await supabase.from("trips").select("id").eq("user_id", userId).eq("is_daily", true).maybeSingle();
    if (raced) return raced.id;
    throw insertError;
  }
  return created.id;
}

/** 「日常」かどうか（名前変更・削除・招待・しおり作成を拒否する判定に使う） */
export async function isDailyTrip(supabase: SupabaseClient, tripId: string): Promise<boolean> {
  const { data, error } = await supabase.from("trips").select("is_daily").eq("id", tripId).maybeSingle();
  if (error) throw error;
  return data?.is_daily === true;
}
