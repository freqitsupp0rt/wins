import { NextResponse } from "next/server";
import { getRuijieToken } from "@/lib/getToken";

export async function POST(req) {
  try {
    const ruijieToken = await getRuijieToken();
    const { startDate, endDate, buildingId, type } = await req.json();

    if (!startDate || !endDate || !buildingId || !type) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const url = `https://cloud-as.ruijienetworks.com/logbizagent/logbiz/api/flow/show?access_token=${ruijieToken}`;

    const body = { startDate, endDate, buildingId, type };

    const ruijieRes = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json;charset=UTF-8",
      },
      body: JSON.stringify(body),
    });

    const data = await ruijieRes.json();

    if (!ruijieRes.ok || data.code !== 0) {
      return NextResponse.json(
        { error: "Ruijie API error", details: data },
        { status: 500 }
      );
    }

    const formattedList = data.list.map((item) => {
      let timeString = item.timeString || item.timeStamp || null;

      // Only override if timeStamp exists and is valid
      if (item.timeStamp) {
        const date = new Date(item.timeStamp);
        if (!isNaN(date)) {
          const yyyy = date.getFullYear();
          const mm = String(date.getMonth() + 1).padStart(2, "0");
          const dd = String(date.getDate()).padStart(2, "0");
          timeString = `${yyyy}${mm}${dd}`;
        }
      }

      return {
        ...item,
        timeString, // keep raw value if timestamp invalid
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        ...data,
        list: formattedList,
      },
    });
  } catch (err) {
    console.error("Ruijie traffic API error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: err.message },
      { status: 500 }
    );
  }
}
