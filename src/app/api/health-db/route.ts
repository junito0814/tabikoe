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
