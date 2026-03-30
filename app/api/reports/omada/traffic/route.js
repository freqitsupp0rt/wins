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
      cards: [{ type: "network", topK: 20 }],
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

    const trafficSummary = data?.result?.network?.trafficSummary?.trafficSummary || [];

    // Map to standard format for your Reports.jsx
    const formattedTraffic = trafficSummary.map(item => ({
      timeString: new Date(item.time * 1000).toISOString().slice(0, 10).replace(/-/g, ""),
      rxBytes: item.rxData || 0,
      txBytes: item.txData || 0
    }));

    return NextResponse.json({ success: true, data: formattedTraffic });
  } catch (err) {
    console.error("Omada traffic API error:", err);
    return NextResponse.json({ error: "Internal server error", details: err.message }, { status: 500 });
  }
}
