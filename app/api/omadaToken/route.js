import { NextResponse } from "next/server";
import { getOmadaToken } from "@/lib/getToken";

export async function GET() {
  try {
    const token = await getOmadaToken();
    return NextResponse.json({ token }, { status: 200 });
  } catch (err) {
    console.error("Omada token error:", err);
    return NextResponse.json(
      { error: "Failed to fetch token" },
      { status: 500 }
    );
  }
}