import { NextResponse } from 'next/server';
import { pool } from "@/lib/db";
import axios from 'axios';
import { getOmadaToken, getRuijieToken } from "@/lib/getToken"; // Import your existing token functions

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get('status');
  const vendorFilter = searchParams.get('vendor');

  // Remove localStorage code - it doesn't work on server side

  try {
    // Step 1: Fetch active sites from database
    const [sites] = await pool.execute(
      `SELECT 
        id, site_id as siteId, name, display_name as displayName, 
        site_code as siteCode, vendor, group_id as groupId,
        DATE_FORMAT(last_sync, '%Y-%m-%d %H:%i:%s') as lastSync
       FROM wins_sites 
       WHERE sync_status = 'active'
       ORDER BY vendor, name`
    );

    if (sites.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        total: 0,
        message: "No active sites found"
      });
    }

    // Step 2: Process sites in batches
    const batchSize = 5;
    const siteStatuses = [];
    
    for (let i = 0; i < sites.length; i += batchSize) {
      const batch = sites.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (site, index) => {
        if (index > 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        try {
          // Use your existing token functions instead of localStorage
          const devices = await fetchSiteDevices(site.siteId, site.vendor);
          const onlineCount = devices.filter(d => d.status === 'Online').length;
          const totalCount = devices.length;
          const siteStatus = totalCount === 0 ? 'offline' : 
                           onlineCount === 0 ? 'offline' : 
                           onlineCount === totalCount ? 'online' : 'partial';
          
          return {
            ...site,
            status: siteStatus,
            deviceCount: totalCount,
            onlineDevices: onlineCount,
            offlineDevices: totalCount - onlineCount,
            lastChecked: new Date().toISOString()
          };
        } catch (error) {
          console.error(`Error fetching devices for site ${site.siteId}:`, error.message);
          return {
            ...site,
            status: 'error',
            deviceCount: 0,
            onlineDevices: 0,
            offlineDevices: 0,
            error: error.message,
            lastChecked: new Date().toISOString()
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      siteStatuses.push(...batchResults);
      
      if (i + batchSize < sites.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Step 3: Apply filters
    let filteredResults = siteStatuses;
    
    if (statusFilter && statusFilter !== 'all') {
      filteredResults = filteredResults.filter(site => 
        statusFilter === 'online' ? site.status === 'online' :
        statusFilter === 'offline' ? (site.status === 'offline' || site.status === 'error') :
        true
      );
    }
    
    if (vendorFilter && vendorFilter !== 'all') {
      filteredResults = filteredResults.filter(site => 
        site.vendor.toLowerCase() === vendorFilter.toLowerCase()
      );
    }

    // Step 4: Aggregate statistics
    const stats = {
      totalSites: filteredResults.length,
      onlineSites: filteredResults.filter(s => s.status === 'online').length,
      offlineSites: filteredResults.filter(s => s.status === 'offline').length,
      partialSites: filteredResults.filter(s => s.status === 'partial').length,
      errorSites: filteredResults.filter(s => s.status === 'error').length,
      totalDevices: filteredResults.reduce((sum, site) => sum + site.deviceCount, 0),
      onlineDevices: filteredResults.reduce((sum, site) => sum + site.onlineDevices, 0),
    };

    return NextResponse.json({
      success: true,
      data: filteredResults,
      statistics: stats,
      filters: {
        status: statusFilter || 'all',
        vendor: vendorFilter || 'all'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Bulk site status error:', error);
    return NextResponse.json({
      success: false,
      error: "Failed to fetch site statuses",
      details: error.message
    }, { status: 500 });
  }
}

async function fetchSiteDevices(siteId, vendor) {
  try {
    // Use your existing token functions from lib/getToken.js
    if (vendor.toLowerCase() === 'omada') {
      return await fetchOmadaDevices(siteId);
    } else if (vendor.toLowerCase() === 'ruijie') {
      return await fetchRuijieDevices(siteId);
    } else {
      throw new Error(`Unsupported vendor: ${vendor}`);
    }
  } catch (error) {
    console.error(`Error fetching ${vendor} devices for site ${siteId}:`, error);
    throw error;
  }
}

async function fetchOmadaDevices(siteId) {
  const token = await getOmadaToken(); // This should handle token caching
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

async function fetchRuijieDevices(siteId) {
  const token = await getRuijieToken(); // This should handle token caching
  const page = 1;
  const perPage = 100;
  
  const productTypes = ["EAP", "EHR"];
  const results = [];

  for (const type of productTypes) {
    const apiUrl = `https://cloud-as.ruijienetworks.com/service/api/maint/devices?page=${page}&per_page=${perPage}&group_id=${siteId}&product_type=${type}&access_token=${token}`;
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

function formatMacAddress(mac) {
  if (!mac) return 'N/A';
  const cleanMac = mac.replace(/\./g, '').toUpperCase();
  const formattedMac = cleanMac.match(/.{1,2}/g)?.join('-');
  return formattedMac || mac;
}