'use server';

import { pool } from '@/lib/db';
import axios from 'axios';
import { getOmadaToken, getRuijieToken } from '@/lib/getToken';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { createHash } from 'crypto';

// Helper function to parse site name and code
function parseSiteInfo(siteName) {
  if (!siteName) return { siteName: '', siteCode: '' };
  
  const parts = siteName.trim().split(' ');
  
  if (parts.length >= 2) {
    const firstPart = parts[0];
    const isSiteCode = /^(WINS|SITE|LOC|PICS)-?[A-Z0-9-]+$/i.test(firstPart);
    
    if (isSiteCode) {
      return {
        siteCode: firstPart,
        siteName: parts.slice(1).join(' ')
      };
    }
  }
  
  return {
    siteCode: '',
    siteName: siteName
  };
}

// Helper to generate consistent site ID
function generateSiteId(site) {
  if (site.siteId) return site.siteId;
  if (site.id) return site.id.toString();
  if (site.groupId) return site.groupId.toString();
  
  // Generate hash from name and vendor
  const hash = createHash('md5')
    .update(`${site.name}-${site.vendor}`)
    .digest('hex')
    .substring(0, 24);
  
  return `gen_${hash}`;
}

export async function syncWinsSites() {
  const connection = await pool.getConnection(); // FIXED: Get connection directly from pool
  
  let syncLogId = null;
  const startedAt = new Date();
  
  try {
    // Get user info from headers
    const headersList = await headers();
    let user;
    try {
      user = JSON.parse(headersList.get('x-user') || '{"id": "system", "name": "System"}');
    } catch {
      user = { id: 'system', name: 'System' };
    }
    
    // Create sync log entry
    const [logResult] = await connection.execute(
      'INSERT INTO wins_sync_logs (action, entity_type, status, created_by, started_at) VALUES (?, ?, ?, ?, ?)',
      ['sync', 'sites', 'pending', user.name, startedAt]
    );
    
    syncLogId = logResult.insertId;
    
    // Fetch sites from APIs
    const sites = await fetchAllSites();
    
    // Process and store sites
    const results = await processAndStoreSites(connection, sites);
    
    // Update sync log
    const completedAt = new Date();
    await connection.execute(
      `UPDATE wins_sync_logs 
       SET status = ?, records_synced = ?, completed_at = ?
       WHERE id = ?`,
      ['success', results.totalProcessed, completedAt, syncLogId]
    );
    
    // Revalidate the sites page
    revalidatePath('/sites');
    revalidatePath('/api/sites'); // Also revalidate the API route
    
    return {
      success: true,
      message: `Synchronized ${results.totalProcessed} sites successfully`,
      details: results,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('Sync error:', error);
    
    // Update sync log with error
    if (syncLogId) {
      try {
        await connection.execute(
          `UPDATE wins_sync_logs 
           SET status = ?, errors = ?, completed_at = ?
           WHERE id = ?`,
          ['failed', error.message.substring(0, 1000), new Date(), syncLogId]
        );
      } catch (logError) {
        console.error('Failed to update sync log:', logError);
      }
    }
    
    return {
      success: false,
      message: 'Failed to synchronize sites',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  } finally {
    if (connection) connection.release();
  }
}

async function fetchAllSites() {
  const sites = [];
  
  try {
    // ---------------- Omada Sites ----------------
    console.log('🔍 Fetching Omada sites...');
    const omadaToken = await getOmadaToken();
    const omadaRes = await axios.get(
      `${process.env.OMADA_BASE_URL}/openapi/v1/${process.env.OMADA_OMADAC_ID}/sites`,
      { 
        params: {
          pageSize: 1000,
          page: 1
        },
        headers: { 
          'Authorization': `AccessToken=${omadaToken}`,
          'Content-Type': 'application/json'
        } 
      }
    );
    
    const omadaSites = omadaRes.data?.result?.data || [];
    sites.push(...omadaSites.map(s => ({ ...s, vendor: "Omada" })));
    console.log(`✅ Fetched ${omadaSites.length} Omada sites`);
    
  } catch (error) {
    console.error('Error fetching Omada sites:', error);
    // Don't throw - continue with Ruijie
    // throw new Error(`Omada API error: ${error.message}`);
  }
  
  try {
    // ---------------- Ruijie Sites ----------------
    console.log('🔍 Fetching Ruijie sites...');
    const ruijieToken = await getRuijieToken();
    const ruijieRes = await axios.get(
      `https://cloud-as.ruijienetworks.com/service/api/group/single/tree?access_token=${ruijieToken}`
    );
    
    let ruijieSites = [];
    const groups = ruijieRes.data?.groups;
    if (groups?.subGroups && groups.subGroups.length > 0) {
      const freqitsupp0rtGroup = groups.subGroups.find(g => 
        g.name?.toLowerCase().includes("freqitsupp0rt") || 
        g.name?.toLowerCase().includes("freqit")
      );
      
      if (freqitsupp0rtGroup?.subGroups) {
        ruijieSites = freqitsupp0rtGroup.subGroups.filter(
          site => !site.name?.toLowerCase().includes("provinet-palo leyte")
        );
      }
    }
    
    sites.push(...ruijieSites.map(s => ({ ...s, vendor: "Ruijie" })));
    console.log(`✅ Fetched ${ruijieSites.length} Ruijie sites`);
    
  } catch (error) {
    console.error('Error fetching Ruijie sites:', error);
    // Don't throw - continue with whatever we have
    // throw new Error(`Ruijie API error: ${error.message}`);
  }
  
  if (sites.length === 0) {
    throw new Error('No sites fetched from any API');
  }
  
  console.log(`📊 Total sites fetched: ${sites.length}`);
  return sites;
}

async function processAndStoreSites(connection, sites) {
  const results = {
    inserted: 0,
    updated: 0,
    skipped: 0,
    totalProcessed: 0
  };
  
  console.log('💾 Processing sites for database storage...');
  
  // Use batch processing for better performance
  const batchSize = 50;
  
  for (let i = 0; i < sites.length; i += batchSize) {
    const batch = sites.slice(i, i + batchSize);
    const batchPromises = [];
    
    for (const site of batch) {
      batchPromises.push(processSingleSite(connection, site));
    }
    
    try {
      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach(result => {
        if (result.status === 'fulfilled') {
          const { action, siteName } = result.value;
          if (action === 'inserted') results.inserted++;
          if (action === 'updated') results.updated++;
          results.totalProcessed++;
        } else {
          results.skipped++;
          console.error(`Skipped site: ${result.reason}`);
        }
      });
      
      console.log(`  Processed ${Math.min(i + batchSize, sites.length)}/${sites.length} sites...`);
      
    } catch (error) {
      console.error('Batch processing error:', error);
      results.skipped += batch.length;
    }
  }
  
  console.log(`📈 Processed: ${results.totalProcessed}, Inserted: ${results.inserted}, Updated: ${results.updated}, Skipped: ${results.skipped}`);
  return results;
}

async function processSingleSite(connection, site) {
  // Parse site information
  const parsedInfo = parseSiteInfo(site.name || '');
  
  // Generate or get site ID
  const siteId = generateSiteId(site);
  
  // Prepare site data
  const siteData = {
    siteId: siteId,
    name: site.name || 'Unnamed Site',
    displayName: parsedInfo.siteName || site.name || 'Unnamed Site',
    siteCode: parsedInfo.siteCode || site.siteCode || '',
    vendor: site.vendor || 'Unknown',
    latitude: site.latitude || site.lat || null,
    longitude: site.longitude || site.lon || null,
    address: site.address || '',
    region: site.region || '',
    groupId: site.groupId || site.id || null,
    lastSync: new Date()
  };
  
  // Check if site exists
  const [existing] = await connection.execute(
    'SELECT id FROM wins_sites WHERE site_id = ?',
    [siteData.siteId]
  );
  
  let action = 'skipped';
  
  if (existing.length > 0) {
    // Update existing site
    await connection.execute(
      `UPDATE wins_sites 
       SET name = ?, display_name = ?, site_code = ?, vendor = ?, 
           latitude = ?, longitude = ?, address = ?, region = ?, 
           group_id = ?, last_sync = ?, updated_at = ?
       WHERE site_id = ?`,
      [
        siteData.name,
        siteData.displayName,
        siteData.siteCode,
        siteData.vendor,
        siteData.latitude,
        siteData.longitude,
        siteData.address,
        siteData.region,
        siteData.groupId,
        siteData.lastSync,
        new Date(),
        siteData.siteId
      ]
    );
    action = 'updated';
  } else {
    // Insert new site
    await connection.execute(
      `INSERT INTO wins_sites 
       (site_id, name, display_name, site_code, vendor, 
        latitude, longitude, address, region, group_id, last_sync) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        siteData.siteId,
        siteData.name,
        siteData.displayName,
        siteData.siteCode,
        siteData.vendor,
        siteData.latitude,
        siteData.longitude,
        siteData.address,
        siteData.region,
        siteData.groupId,
        siteData.lastSync
      ]
    );
    action = 'inserted';
  }
  
  return { action, siteName: siteData.name };
}