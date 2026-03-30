import { NextResponse } from 'next/server';
import axios from 'axios';
import { getOmadaToken } from "@/lib/getToken";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  
  const deviceId = searchParams.get('deviceId');
  const siteId = searchParams.get('siteId'); // <-- GET siteId from query params
  const timeRange = searchParams.get('timeRange') || '1h';
  
  if (!deviceId) {
    return NextResponse.json(
      { error: 'Device ID (AP MAC) is required' },
      { status: 400 }
    );
  }

  if (!siteId) {
    return NextResponse.json(
      { error: 'Site ID is required for Omada API' }, 
      { status: 400 }
    );
  }

  try {
    // Get Omada access token
    const accessToken = await getOmadaToken();
    const omadacId = process.env.OMADA_OMADAC_ID;
    const baseUrl = process.env.OMADA_BASE_URL;

    // 1. Get current traffic stats
    const trafficUrl = `${baseUrl}/openapi/v1/${omadacId}/sites/${siteId}/aps/${deviceId}/lan-traffic-info`;
    
    const trafficRes = await axios.get(trafficUrl, {
      headers: {
        'Authorization': `AccessToken=${accessToken}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    // 2. Get AP status for more context
    const apStatusUrl = `${baseUrl}/openapi/v1/${omadacId}/sites/${siteId}/aps/${deviceId}/status`;
    
    let apStatus = {};
    try {
      const statusRes = await axios.get(apStatusUrl, {
        headers: {
          'Authorization': `AccessToken=${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      apStatus = statusRes.data?.result || {};
    } catch (statusError) {
      console.warn('Could not fetch AP status:', statusError.message);
    }

    // Process traffic data
    const traffic = trafficRes.data?.result?.lanTraffic ?? {};
    
    // Convert bytes to MB
    const toMB = (bytes) => parseFloat(((bytes ?? 0) / 1048576).toFixed(2));
    
    // Return the data in a simpler format for the frontend
    const responseData = {
      rxBytes: toMB(traffic.rx),
      txBytes: toMB(traffic.tx),
      rxPkts: traffic.rxPkts ?? 0,
      txPkts: traffic.txPkts ?? 0,
      deviceId: deviceId,
      siteId: siteId,
      deviceName: apStatus.name || deviceId,
      timestamp: new Date().toISOString(),
      deviceInfo: {
        status: apStatus.status,
        clients: apStatus.clientCount || 0,
        channel: apStatus.channel,
        channelWidth: apStatus.channelWidth,
        txPower: apStatus.txPower,
        uptime: apStatus.uptime,
      }
    };

    return NextResponse.json(responseData);
    
  } catch (error) {
    console.error('Omada Performance API error:', error.response?.data || error.message);
    
    // Provide fallback mock data for development
    if (process.env.NODE_ENV === 'development') {
      console.log('Returning mock data for development');
      const toMB = (bytes) => parseFloat((bytes / 1048576).toFixed(2));
      const mockTraffic = {
        rx: 150000000, // 150 MB
        tx: 80000000,  // 80 MB
        rxPkts: 120000,
        txPkts: 90000,
      };
      
      return NextResponse.json({
        rxBytes: toMB(mockTraffic.rx),
        txBytes: toMB(mockTraffic.tx),
        rxPkts: mockTraffic.rxPkts,
        txPkts: mockTraffic.txPkts,
        deviceId: deviceId,
        siteId: siteId,
        deviceName: "Mock Device",
        timestamp: new Date().toISOString(),
        note: 'Mock data for development'
      });
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch Omada performance data',
        details: error.response?.data?.msg || error.message,
        suggestion: 'Ensure the AP is online and accessible'
      },
      { status: error.response?.status || 500 }
    );
  }
}