import { NextResponse } from "next/server";
import supabase from "@/lib/supabase";

export async function GET() {
  try {
    // Get API keys configuration from database
    const { data, error } = await supabase
      .from("api_keys")
      .select("keys_json")
      .limit(1)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("Error getting API key count:", error);
      return NextResponse.json(
        { error: "Failed to get API key count", count: 1 },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json({
        count: 0,
        gemini_count: 0,
        google_count: 0,
        message: "No API keys configured",
      });
    }

    const config = data.keys_json;
    const geminiKeys = config.gemini_keys || [];
    const googleKeys = config.google_keys || [];

    // Filter out empty keys
    const activeGeminiKeys = geminiKeys.filter(
      (key: string) => key && key.trim().length > 0
    );
    const activeGoogleKeys = googleKeys.filter(
      (key: string) => key && key.trim().length > 0
    );

    return NextResponse.json({
      count: activeGeminiKeys.length, // For backward compatibility
      gemini_count: activeGeminiKeys.length,
      google_count: activeGoogleKeys.length,
      message: `${activeGeminiKeys.length} Gemini keys and ${activeGoogleKeys.length} Google keys available for parallel processing`,
    });
  } catch (error) {
    console.error("Error getting API key count:", error);
    return NextResponse.json(
      { error: "Failed to get API key count", count: 1 },
      { status: 500 }
    );
  }
}
