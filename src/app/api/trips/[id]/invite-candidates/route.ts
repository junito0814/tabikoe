import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/auth/get-authenticated-user";
import { getAlbumRole } from "@/lib/albums/membership";
import { listInviteCandidates } from "@/lib/invitations/in-app";

/**
 * feedback-0919 Task6（v3.2）: GET /api/trips/[id]/invite-candidates
 * アルバム版の「一緒だった人」。オーナーだけ。
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const role = await getAlbumRole(admin, id, user.id);
  if (!role) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (role !== "owner") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  try {
    return NextResponse.json({ candidates: await listInviteCandidates(admin, user.id, "album", id) });
  } catch {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
}
