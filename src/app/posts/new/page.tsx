import { createClient } from "@/lib/supabase/server";
import { requireUserOrRedirect } from "@/lib/auth/require-user-or-redirect";
import PostForm from "./post-form";

/**
 * SC-03 投稿作成画面（新規作成モード）
 * 出典: docs/tasks/posts/post-creation/02-post-form-ui.md
 *
 * 投稿作成はログイン必須（要件定義書3.3.1）。
 */
export default async function NewPostPage() {
  const supabase = await createClient();
  await requireUserOrRedirect(supabase, "/posts/new");

  return <PostForm />;
}
