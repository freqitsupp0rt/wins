// app/api/clients/route.js
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const vendor = searchParams.get('vendor');
    const siteId = searchParams.get('siteId');
    const buildingName = searchParams.get('buildingName');
    
    // Route to the appropriate endpoint
    if (vendor === 'omada') {
      if (!siteId) {
        return NextResponse.json({
          error: "Site ID required for Omada",
          message: "Please provide siteId parameter for Omada clients"
        }, { status: 400 });
      }
      // Redirect to Omada endpoint
      const omadaUrl = new URL('/api/clients/omada', request.url);
      searchParams.forEach((value, key) => {
        omadaUrl.searchParams.set(key, value);
      });
      return NextResponse.redirect(omadaUrl);
      
    } else if (vendor === 'ruijie') {
      // Redirect to Ruijie endpoint
      const ruijieUrl = new URL('/api/clients/ruijie', request.url);
      searchParams.forEach((value, key) => {
        ruijieUrl.searchParams.set(key, value);
      });
      return NextResponse.redirect(ruijieUrl);
      
    } else {
      // If no vendor specified, provide info about available endpoints
      return NextResponse.json({
        error: "Vendor parameter required",
        message: "Please specify vendor=omada or vendor=ruijie",
        available_endpoints: [
          {
            vendor: "omada",
            endpoint: "/api/clients?vendor=omada&siteId=...",
            description: "Get Omada clients for a specific site"
          },
          {
            vendor: "ruijie", 
            endpoint: "/api/clients?vendor=ruijie&buildingName=...",
            description: "Get Ruijie clients filtered by building name"
          }
        ]
      }, { status: 400 });
    }
  } catch (err) {
    console.error("API routing error:", err.message);
    return NextResponse.json(
      { error: "API routing failed", details: err.message },
      { status: 500 }
    );
  }
}