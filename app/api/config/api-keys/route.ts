import { NextResponse } from "next/server";
import supabase from "@/lib/supabase";

// GET - Fetch active API keys for client-side use
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const keyType = searchParams.get("type"); // 'gemini' or 'google'

    const { data, error } = await supabase
      .from("api_keys")
      .select("keys_json")
      .limit(1)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("Error fetching API keys:", error);
      return NextResponse.json(
        { error: "Failed to fetch API keys" },
        { status: 500 }
      );
    }

    // If no data, return empty arrays
    if (!data) {
      return NextResponse.json({
        keys: [],
        count: 0,
      });
    }

    const config = data.keys_json;
    let keys: string[] = [];

    if (keyType === "gemini") {
      keys = config.gemini_keys || [];
    } else if (keyType === "google") {
      keys = config.google_keys || [];
    } else {
      // Return all keys
      keys = [...(config.gemini_keys || []), ...(config.google_keys || [])];
    }

    return NextResponse.json({
      keys: keys.filter((key) => key && key.trim().length > 0),
      count: keys.length,
      gemini_count: config.gemini_keys?.length || 0,
      google_count: config.google_keys?.length || 0,
    });
  } catch (error) {
    console.error("Error in GET /api/config/api-keys:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
