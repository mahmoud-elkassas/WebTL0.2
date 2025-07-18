import { NextResponse } from "next/server";
import { fixCorruptedGlossaryJson } from "@/lib/glossary";
import { getSession } from "@/lib/auth";

export async function POST(request: Request) {
  // Check authentication
  const session = await getSession();
  if (!session?.session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { seriesId } = body;

    if (!seriesId) {
      return NextResponse.json(
        { error: "Series ID is required" },
        { status: 400 }
      );
    }

    const success = await fixCorruptedGlossaryJson(seriesId);

    if (success) {
      return NextResponse.json({
        success: true,
        message: "Glossary JSON fixed successfully",
      });
    } else {
      return NextResponse.json(
        { error: "Failed to fix glossary JSON" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error fixing glossary JSON:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
