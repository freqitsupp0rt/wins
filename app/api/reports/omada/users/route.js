import { NextResponse } from "next/server";
import { getOmadaToken } from "@/lib/getToken";

export async function POST(req) {
  try {
    const { siteId, start, end } = await req.json();

    if (!siteId || !start || !end) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const token = await getOmadaToken();
    const controllerId = process.env.OMADA_OMADAC_ID;

    const url = `https://aps1-api-omada-controller.tplinkcloud.com/openapi/v1/${controllerId}/sites/${siteId}/report/cards`;

    const body = {
      cards: [{ type: "clientConnectionTrend", topK: 20 }],
      start,
      end
    };

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `AccessToken=${token}`
      },
      body: JSON.stringify(body)
    });

    const data = await res.json();

    if (!res.ok || data.errorCode !== 0) {
      return NextResponse.json({ error: "Omada API error", details: data }, { status: 500 });
    }

    // Normalize the data and convert time to YYYYMMDD
    const trend = data?.result?.clientConnectionTrend?.clientConnectionTrend || [];
    const formatted = trend.map(item => ({
      time: new Date(item.time * 1000).toISOString().slice(0, 10).replace(/-/g, ""), // YYYYMMDD
      total: item.totalClients ?? 0,
      wired: item.wiredClients ?? 0,
      wireless: item.wirelessClients ?? 0,
    }));

    return NextResponse.json({ success: true, data: formatted });
  } catch (err) {
    console.error("Omada users API error:", err);
    return NextResponse.json({ error: "Internal server error", details: err.message }, { status: 500 });
  }
}
