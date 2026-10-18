import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";

/**
 * GET /api/admin/health-db — Supabase に到達できるかの簡易ヘルスチェック（運営だけ）
 *
 * #998（2026-10-18）: `/api/health-db` から**この場所へ移した**。
 *
 * 【初心者向け】これは「DB に繋がっているか」を人手で確かめるための API で、
 * アプリの機能では使いません（デプロイ直後の確認やトラブル時の切り分け用）。
 *
 * 移した理由は 2 つです。
 *   1. **運営向けのものが、外から誰でも動かせる状態だった。** 叩かれるたびに Supabase へ
 *      問い合わせが飛ぶので、見られて困る情報は出なくても、動かせること自体をやめる
 *   2. `/api/admin` 配下に置くと、**関所（proxy.ts）が自動で守ってくれる**
 *      （`is_admin` ＋ 二段階確認。足りなければ API なので 401 を返す。要件 3.10.1）
 *
 * 応答には**失敗の中身を入れません**（状態だけ）。中身はサーバーのログに出します。
 * 外から見える文章に理由が載ると、構成を言い当てる手がかりになるためです。
 * `SUPABASE_SECRET_KEY` はサーバー側だけの秘密鍵なので、この値は決して応答に含めないこと。
 */
export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("[health-db] Supabase の環境変数が設定されていません");
    return NextResponse.json({ status: "error" }, { status: 500 });
  }

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      console.error(`[health-db] Supabase が ${response.status} を返しました`);
      return NextResponse.json({ status: "error" }, { status: 503 });
    }

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    // #895: Next.js の内部的な合図（redirect / notFound など）は握りつぶさずに投げ直す
    unstable_rethrow(error);
    console.error("[health-db] Supabase に到達できません:", error instanceof Error ? error.message : error);
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
}
