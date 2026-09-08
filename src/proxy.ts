import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { assertSupabaseEnv } from "@/lib/supabase/env";

/**
 * F-AC-02 Task1（セッション検証）+ F-AD-01 Task1（管理画面is_admin判定）。
 * /admin配下のみを対象とする。存在自体を一般ユーザーに露出させないため、
 * 未ログイン・is_admin=falseのいずれも404を返す（リダイレクトしない）。
 */
export async function proxy(request: NextRequest) {
  assertSupabaseEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new NextResponse(null, { status: 404 });
  }

  const { data: profile } = await supabase
    .from("users")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    return new NextResponse(null, { status: 404 });
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};
