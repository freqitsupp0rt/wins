import { NextResponse } from "next/server";
import { getOmadaToken } from "@/lib/getToken";
import axios from "axios";

// Reusable function to fetch Omada clients with v2 API (POST request)
async function fetchOmadaClientsV2(siteId, page = 1, pageSize = 1000) {
  try {
    const omadaToken = await getOmadaToken();
    const omadacId = process.env.OMADA_OMADAC_ID;
    const baseUrl = process.env.OMADA_BASE_URL;
    
    if (!omadaToken) {
      console.error("Omada token not available");
      throw new Error("Omada authentication failed");
    }

    const payload = {
      page: parseInt(page),
      pageSize: parseInt(pageSize),
    };

    console.log(`Omada API Request for site ${siteId}:`, {
      payload: payload
    });

    const response = await axios.post(
      `${baseUrl}/openapi/v2/${omadacId}/sites/${siteId}/clients`,
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `AccessToken=${omadaToken}`,
        },
        timeout: 15000
      }
    );

    console.log(`Omada API Response for site ${siteId}:`, {
      errorCode: response.data?.errorCode,
      msg: response.data?.msg,
      dataLength: response.data?.result?.data?.length || 0
    });

    if (response.data?.errorCode !== 0) {
      throw new Error(`Omada API error: ${response.data?.msg}`);
    }

    const result = response.data?.result || {};
    const clients = result.data || [];
    
    console.log(`Omada v2 API: Successfully fetched ${clients.length} clients for site ${siteId}`);
    
    return clients;
  } catch (error) {
    console.error(`Omada v2 clients error for site ${siteId}:`, error.message);
    throw error;
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get('siteId');
    const page = searchParams.get('page') || "1";
    const pageSize = searchParams.get('pageSize') || "1000";
    
    console.log("Fetching Omada clients:", { siteId, page, pageSize });

    if (!siteId) {
      return NextResponse.json(
        { 
          vendor: "omada",
          error: "Site ID is required for Omada clients",
          details: "Please provide a siteId parameter"
        },
        { status: 400 }
      );
    }

    // Fetch Omada clients
    const rawOmadaClients = await fetchOmadaClientsV2(siteId, page, pageSize);
    console.log("Raw Omada Clients Count:", rawOmadaClients.length);
    
    // Transform Omada clients to match your existing format
    const transformedClients = rawOmadaClients.map(client => {
      return {
        vendor: "Omada",
        id: client.id || client.mac || Math.random().toString(36),
        name: client.name || client.hostName || "Unnamed Client",
        hostName: client.hostName || client.name,
        mac: client.mac || "Unknown MAC",
        ip: client.ip || "Unknown IP",
        connectType: client.connectType || "Unknown",
        deviceType: client.deviceType || "Unknown",
        ssid: client.ssid || "Unknown",
        signalStrength: client.signalStrength || client.rssi || 0,
        rxRate: client.rxRate || 0,
        txRate: client.txRate || 0,
        connectTime: client.connectTime || 0,
        onlineTime: client.onlineTime || client.uptime || 0,
        // Additional Omada fields
        rssi: client.rssi || 0,
        apName: client.apName || "",
        channel: client.channel || 0,
        wireless: client.wireless || false,
        guest: client.guest || false,
        active: client.active || false,
        uptime: client.uptime || 0,
        lastSeen: client.lastSeen,
        activity: client.activity || 0,
        authStatus: client.authStatus || 0
      };
    });

    console.log("Transformed Omada Clients Count:", transformedClients.length);

    return NextResponse.json({
      vendor: "omada",
      totalRecords: transformedClients.length,
      data: transformedClients,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total: transformedClients.length
      }
    });
  } catch (err) {
    console.error("Omada API error:", {
      message: err.message,
      stack: err.stack,
      response: err.response?.data
    });
    
    return NextResponse.json(
      { 
        vendor: "omada",
        error: "Failed to fetch Omada clients", 
        details: err.message 
      },
      { status: 500 }
    );
  }
}