/**
 * GET /api/health-db — Supabase に到達できるかの簡易ヘルスチェック
 *
 * 【初心者向け】本番で「DB に繋がっているか」を人手で確かめるための API。
 * 環境変数が無ければ 500、Supabase が応答しなければ 503、正常なら {status:"ok"} を返す。
 * アプリの機能には使わない。デプロイ直後の確認やトラブル時の切り分け用。
 * `SUPABASE_SECRET_KEY` はサーバー側だけの秘密鍵なので、この値をレスポンスに含めないこと。
 */
import { NextResponse } from "next/server";

export async function GET() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SECRET_KEY;

    if (!supabaseUrl || !supabaseKey) {
        return NextResponse.json(
            { status: "error", message: "Supabase environment variables are not set" },
            { status: 500 }
        );
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
            return NextResponse.json(
                { status: "error", message: `Supabase responded with ${response.status}` },
                { status: 503 }
            );
        }

        return NextResponse.json({ status: "ok" });
    } catch (error) {
        return NextResponse.json(
            {
                status: "error",
                message: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 503 }
        );
    }
}
