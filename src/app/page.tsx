import { createClient } from "@/lib/supabase/server";
import LoginButton from "./login-button";
import InstagramHome from "./instagram-home";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <>
      </>
    );
  }

  const username =
    user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email ?? "タビコエユーザー";

  return <InstagramHome username={username} />;
}
