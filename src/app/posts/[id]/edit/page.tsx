import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUserOrRedirect } from "@/lib/auth/require-user-or-redirect";
import { buildComposeInitialState } from "@/lib/posts/compose-initial-state";
import { loadExistingPostForCompose } from "@/lib/posts/load-compose-data";
import { isVideoUploadDisabled } from "@/lib/video/process-video";
import { PostComposeScreen } from "@/components/posts/PostComposeScreen";

// #785: ブラウザのタブ名（「投稿を編集 | タビコエ」）
export const metadata = { title: "投稿を編集" };

/**
 * SC-03 投稿編集画面（編集モード）
 * 出典: docs/tasks/posts/post-edit/03-post-edit-ui.md
 *       docs/tasks/posts/post-edit-v3/01-edit-location.md
 *
 * 投稿者本人以外は編集画面へ入れない（3.3.3。共同アルバムのオーナーであっても同様）。
 * 他人の投稿・存在しない投稿はいずれも404として扱い、編集モードへの遷移自体をブロックする。
 * v3.0: 新規作成と同じ PostComposeScreen を使い、上 1/3 の地図で位置・スポットを選び直せる。
 */
export default async function EditPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await requireUserOrRedirect(supabase, `/posts/${id}/edit`);

  const existing = await loadExistingPostForCompose(createAdminClient(), id, user.id);
  if (!existing) notFound();
  // 下書きは /posts/new?draft= で開く（「続きを書く」）
  if (existing.status === "draft") notFound();

  return <PostComposeScreen videoUploadDisabled={isVideoUploadDisabled()} initial={buildComposeInitialState({})} existing={existing} />;
}
