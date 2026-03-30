import NodeCache from 'node-cache';

// Create cache instance (5 minute TTL)
const siteStatusCache = new NodeCache({ 
  stdTTL: 300, // 5 minutes
  checkperiod: 60 // Check for expired keys every 60 seconds
});

export async function getCachedSiteStatus(forceRefresh = false) {
  const cacheKey = 'site_statuses';
  
  if (!forceRefresh) {
    const cachedData = siteStatusCache.get(cacheKey);
    if (cachedData) {
      console.log('Returning cached site status data');
      return cachedData;
    }
  }
  
  // Fetch fresh data
  const controllerUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
  const response = await fetch(`${controllerUrl}/api/sites/status?status=all&vendor=all`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch site statuses');
  }
  
  const data = await response.json();
  
  // Store in cache
  siteStatusCache.set(cacheKey, data);
  
  return data;
}

export function clearSiteStatusCache() {
  const cacheKey = 'site_statuses';
  siteStatusCache.del(cacheKey);
}