import { createBrowserClient } from "@supabase/ssr";
import { assertSupabaseEnv } from "./env";

export function createClient() {
    assertSupabaseEnv();
    return createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
    );
}