import { NextResponse } from 'next/server';
import axios from 'axios';
import { getOmadaToken, getRuijieToken } from "@/lib/getToken";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const siteId = searchParams.get('siteId');
  const vendor = searchParams.get('vendor');

  console.log('API Route Hit - App Router:', { siteId, vendor });

  if (!siteId) {
    return NextResponse.json({ error: 'Site ID is required' }, { status: 400 });
  }

  if (!vendor) {
    return NextResponse.json({ error: 'Vendor is required' }, { status: 400 });
  }

  try {
    let devices = [];

    if (vendor.toLowerCase() === 'omada') {
      devices = await fetchOmadaDevices(siteId);
    } else if (vendor.toLowerCase() === 'ruijie') {
      devices = await fetchRuijieDevices(siteId);
    } else {
      return NextResponse.json({ 
        error: 'Unsupported vendor. Use "omada" or "ruijie"' 
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      data: devices,
      total: devices.length,
      vendor: vendor.toLowerCase()
    });

  } catch (error) {
    console.error(`Devices API error for ${vendor} site ${siteId}:`, error.message);
    return NextResponse.json({ 
      error: "Failed to fetch devices",
      details: error.message
    }, { status: 500 });
  }
}

async function fetchOmadaDevices(siteId) {
  const token = await getOmadaToken();
  const omadacId = process.env.OMADA_OMADAC_ID;
  const baseURL = process.env.OMADA_BASE_URL;

  const response = await axios.get(`${baseURL}/openapi/v1/${omadacId}/sites/${siteId}/devices`, {
    params: {
      pageSize: 1000,
      page: 1
    },
    headers: { 
      'Authorization': `AccessToken=${token}`,
      'Content-Type': 'application/json'
    }
  });

  const omadaDevices = response.data?.result?.data || [];
  
  return omadaDevices.map(device => ({
    id: device.sn || device.mac,
    name: device.name,
    type: device.type ? device.type.toUpperCase() : 'UNKNOWN',
    model: device.modelName || device.model,
    serialNumber: device.sn,
    macAddress: device.mac,
    ipAddress: device.ip || '-',
    status: getOmadaStatus(device.status),
    siteId: siteId,
    vendor: 'Omada',
    softwareVersion: device.firmwareVersion,
    lastOnline: device.lastSeen ? new Date(device.lastSeen).toISOString() : null,
    uptime: device.uptime || 0,
    groupName: device.siteName || 'Omada Site'
  }));
}

async function fetchRuijieDevices(groupId) {
  const token = await getRuijieToken();
  const page = 1;
  const perPage = 100;
  
  const productTypes = ["EAP", "EHR"];
  const results = [];

  for (const type of productTypes) {
    const apiUrl = `https://cloud-as.ruijienetworks.com/service/api/maint/devices?page=${page}&per_page=${perPage}&group_id=${groupId}&product_type=${type}&access_token=${token}`;
    const response = await axios.get(apiUrl);

    const data = response.data;
    if (data.code !== 0 || !data.deviceList) {
      console.warn(`No devices found for ${type}:`, data.msg || "Invalid device data");
      continue;
    }

    results.push(
      ...data.deviceList.map(device => ({
        id: device.serialNumber,
        name: device.name || device.aliasName,
        type: device.productType,
        model: device.productClass,
        serialNumber: device.serialNumber,
        macAddress: formatMacAddress(device.mac),
        ipAddress: device.localIp,
        status: device.onlineStatus === 'ON' ? 'Online' : 'Offline',
        siteId: device.groupId,
        vendor: 'Ruijie',
        groupName: device.groupName,
      }))
    );
  }

  return results;
}

function formatMacAddress(mac) {
    if (!mac) return 'N/A';
    const cleanMac = mac.replace(/\./g, '').toUpperCase();
    const formattedMac = cleanMac.match(/.{1,2}/g)?.join('-');
    return formattedMac || mac;
}

function getOmadaStatus(statusCode) {
  const statusMap = {
    1: 'Online',
    0: 'Offline',
    2: 'Unknown',
    3: 'Upgrading',
    4: 'Provisioning',
    5: 'Rebooting'
  };
  
  return statusMap[statusCode] || 'Unknown';
}