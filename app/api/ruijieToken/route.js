import { NextResponse } from "next/server";
import { getRuijieToken } from "@/lib/getToken";

export async function GET() {
  try {
    const token = await getRuijieToken();
    return NextResponse.json({ token }, { status: 200 });
  } catch (err) {
    console.error("Ruijie token error:", err);
    return NextResponse.json(
      { error: "Failed to fetch token" },
      { status: 500 }
    );
  }
}