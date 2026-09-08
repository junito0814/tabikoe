import type { SupabaseClient, User } from "@supabase/supabase-js";

/**
 * 初回ログイン時にpublic.usersへレコードを作成する（F-AC-01 Task5）。
 * 既にレコードが存在する場合は何もしない
 * （表示名・アイコンはプロフィール編集で変更され得るため、ログインのたびに上書きしない）。
 */
export async function ensureUserRecord(admin: SupabaseClient, user: User): Promise<void> {
    const googleIdentity = user.identities?.find(
        (identity) => identity.provider === "google"
    );
    const idpSubject =
        googleIdentity?.id ??
        (user.user_metadata?.sub as string | undefined) ??
        user.id;
    const displayName =
        (user.user_metadata?.full_name as string | undefined) ??
        (user.user_metadata?.name as string | undefined) ??
        null;
    const avatarUrl =
        (user.user_metadata?.avatar_url as string | undefined) ??
        (user.user_metadata?.picture as string | undefined) ??
        null;

    const { error } = await admin.from("users").upsert(
        {
            id: user.id,
            idp_provider: "google",
            idp_subject: idpSubject,
            email: user.email ?? "",
            display_name: displayName,
            avatar_url: avatarUrl,
        },
        { onConflict: "id", ignoreDuplicates: true }
    );

    if (error) {
        throw error;
    }
}
