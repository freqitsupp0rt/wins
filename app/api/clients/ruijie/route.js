import { NextResponse } from "next/server";
import { getRuijieToken } from "@/lib/getToken";
import axios from "axios";

// Reusable pagination function for Ruijie
async function fetchRuijieUsers(token) {
  try {
    const ruijieRes = await axios.post(
      `https://cloud-as.ruijienetworks.com/logbizagent/logbiz/api/sta/sta_users?access_token=${token}`,
      {
        staType: "currentUser",
        pageIndex: "1",
        pageSize: "1000"
      },
      {
        headers: {
          "Content-Type": "application/json"
        },
        timeout: 10000
      }
    );
    return ruijieRes.data.list ?? [];
  } catch (error) {
    console.error("Ruijie API Error:", {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    return [];
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const buildingName = searchParams.get('buildingName'); // For Ruijie, we filter by buildingName
    const page = searchParams.get('page') || "1";
    const pageSize = searchParams.get('pageSize') || "1000";
    
    console.log("Fetching Ruijie clients:", { buildingName, page, pageSize });

    // ---------------- Ruijie Users ----------------
    let ruijieUsers = [];
    try {
      const ruijieToken = await getRuijieToken();
      console.log("Ruijie Token:", ruijieToken ? "Received" : "Missing");
      
      if (!ruijieToken) {
        return NextResponse.json(
          { 
            vendor: "ruijie",
            error: "Ruijie authentication failed", 
            details: "No token available"
          },
          { status: 401 }
        );
      }
      
      ruijieUsers = await fetchRuijieUsers(ruijieToken);
      console.log("Raw Ruijie Users Count:", ruijieUsers.length);
      
      // Filter by buildingName if provided
      if (buildingName) {
        ruijieUsers = ruijieUsers.filter(user => user.buildingName === buildingName);
        console.log(`Filtered Ruijie Users for building ${buildingName}:`, ruijieUsers.length);
      }
      
      // Transform Ruijie users to match your format
      ruijieUsers = ruijieUsers.map(user => ({
        ...user,
        vendor: "Ruijie",
        id: user.id || user.mac || Math.random().toString(36),
        userName: user.userName || "",
        terminalMac: user.terminalMac || user.mac || "",
        mac: user.terminalMac || user.mac || "Unknown MAC",
        ip: user.onlineuserTerminalIp || user.userIp || "Unknown IP",
        userIp: user.onlineuserTerminalIp || user.userIp,
        onlineuserTerminalIp: user.onlineuserTerminalIp || user.userIp,
        connectTime: user.connectTime || 0,
        loginTime: user.loginTime || user.connectTime || 0,
        ssid: user.ssid || "Unknown",
        deviceType: user.deviceType || "Unknown",
        buildingName: user.buildingName || "",
        // Add name field for consistency
        name: user.userName || user.terminalMac || ""
      }));

    } catch (ruijieError) {
      console.error("Ruijie API Error:", ruijieError.message);
      return NextResponse.json(
        { 
          vendor: "ruijie",
          error: "Failed to fetch Ruijie users", 
          details: ruijieError.message 
        },
        { status: 500 }
      );
    }

    console.log("Transformed Ruijie Users Count:", ruijieUsers.length);

    return NextResponse.json({
      vendor: "ruijie",
      totalRecords: ruijieUsers.length,
      data: ruijieUsers,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total: ruijieUsers.length
      }
    });
  } catch (err) {
    console.error("Ruijie API error:", {
      message: err.message,
      stack: err.stack,
      response: err.response?.data
    });
    
    return NextResponse.json(
      { 
        vendor: "ruijie",
        error: "Failed to fetch Ruijie clients", 
        details: err.message 
      },
      { status: 500 }
    );
  }
}