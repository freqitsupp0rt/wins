'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";
import L from 'leaflet';
import { 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  AlertCircle,
  Building,
  Server,
  Search,
  MapPin,
  ChevronDown,
  ChevronUp,
  Navigation
} from 'lucide-react';

// Dynamically load React Leaflet components
const MapContainer = dynamic(
  () => import("react-leaflet").then(mod => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then(mod => mod.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import("react-leaflet").then(mod => mod.Marker),
  { ssr: false }
);
const Popup = dynamic(
  () => import("react-leaflet").then(mod => mod.Popup),
  { ssr: false }
);

// Fix for default Leaflet marker icons in Next.js
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: '/leaflet/images/marker-icon-2x.png',
  iconUrl: '/leaflet/images/marker-icon.png',
  shadowUrl: '/leaflet/images/marker-shadow.png',
});

export default function SiteStatusPage() {
  const [siteStatuses, setSiteStatuses] = useState([]);
  const [sitesData, setSitesData] = useState([]); // Separate state for raw sites data
  const [devicesData, setDevicesData] = useState({});
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
  const [selectedSite, setSelectedSite] = useState(null);
  const [viewMode, setViewMode] = useState('all');

  // Fetch sites data (with coordinates) from /api/sites
  const fetchSitesData = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/sites`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch sites data');
      }

      const data = await response.json();
      
      if (data.success) {
        // Map database fields to expected structure with coordinates
        const normalized = (data.data || []).map(site => ({
          siteId: site.siteId || site.id?.toString(),
          name: site.name || "Unnamed Site",
          displayName: site.displayName || site.name || "Unnamed Site",
          siteCode: site.siteCode || '',
          vendor: site.vendor || "Unknown",
          latitude: parseFloat(site.latitude || site.lat || 11.0),
          longitude: parseFloat(site.longitude || site.lon || 125.0),
          address: site.address,
          region: site.region,
          groupId: site.groupId,
          lastSync: site.lastSync,
          syncStatus: site.syncStatus
        }));
        
        setSitesData(normalized);
      }
    } catch (error) {
      console.error('Error fetching sites data:', error);
    }
  }, []);

  // Fetch site statuses from /api/sites/status
  const fetchSiteStatuses = useCallback(async (forceRefresh = false) => {
    try {
      if (forceRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const token = localStorage.getItem('token');
      const response = await fetch(`/api/sites/status?status=all&vendor=all`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch site statuses');
      }

      const data = await response.json();
      
      if (data.success) {
        setSiteStatuses(data.data || []);
        setStatistics(data.statistics || {});
      }
    } catch (error) {
      console.error('Error fetching site statuses:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // Fetch both sites data (for coordinates) and statuses
    Promise.all([fetchSitesData(), fetchSiteStatuses()]);
  }, []);

  // Merge sites data with status data
  const mergedSites = useMemo(() => {
    return sitesData.map(site => {
      // Find matching status data
      const statusData = siteStatuses.find(status => 
        status.siteId === site.siteId || 
        status.id === site.siteId
      );
      
      return {
        ...site,
        ...statusData,
        // Use coordinates from sitesData (which has proper lat/long)
        latitude: site.latitude,
        longitude: site.longitude,
        // Fallback to status data if no device info in sitesData
        status: statusData?.status || 'error',
        deviceCount: statusData?.deviceCount || 0,
        onlineDevices: statusData?.onlineDevices || 0,
        offlineDevices: statusData?.offlineDevices || 0,
        lastChecked: statusData?.lastChecked || new Date().toISOString()
      };
    });
  }, [sitesData, siteStatuses]);

  // Create custom marker icons based on site status
  const createCustomIcon = (status) => {
    // Color coding based on status
    let color = '#6b7280'; // Gray for error/unknown
    
    switch (status) {
      case 'online':
        color = '#10b981'; // Green
        break;
      case 'offline':
        color = '#ef4444'; // Red
        break;
      case 'partial':
        color = '#f59e0b'; // Yellow
        break;
    }

    // Use the same icon URL as your original Sites.jsx
    return L.icon({
      iconUrl: "https://img.icons8.com/?size=100&id=PZTTDl8ML4vy&format=png&color=000000",
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32],
      className: `custom-marker-icon status-${status}`
    });
  };

  // Fetch devices for a specific site
  const fetchSiteDevices = async (siteId, vendor) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/devices?siteId=${siteId}&vendor=${vendor.toLowerCase()}`, {
        headers: {
          "Authorization": `Bearer ${token}`,
        }
      });
      if (!res.ok) throw new Error("Failed to fetch devices");
      const data = await res.json();
      
      if (data.success) {
        setDevicesData(prev => ({
          ...prev,
          [siteId]: data.data
        }));
      }
    } catch (err) {
      console.error(`Error fetching devices for site ${siteId}:`, err);
    }
  };

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getStatusBadge = (status) => {
    const variants = {
      online: { 
        icon: <Wifi className="w-4 h-4" />, 
        color: 'bg-green-900/30 text-green-400 border-green-700',
        label: 'Online'
      },
      offline: { 
        icon: <WifiOff className="w-4 h-4" />, 
        color: 'bg-red-900/30 text-red-400 border-red-700',
        label: 'Offline'
      },
      partial: { 
        icon: <AlertCircle className="w-4 h-4" />, 
        color: 'bg-yellow-900/30 text-yellow-400 border-yellow-700',
        label: 'Partial'
      },
      error: { 
        icon: <AlertCircle className="w-4 h-4" />, 
        color: 'bg-gray-800 text-gray-400 border-gray-700',
        label: 'Error'
      }
    };

    const variant = variants[status] || variants.error;
    
    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border ${variant.color}`}>
        {variant.icon}
        {variant.label}
      </span>
    );
  };

  const getVendorBadge = (vendor) => {
    const vendorColors = {
      omada: 'bg-red-900/30 text-red-400 border-red-700',
      ruijie: 'bg-blue-900/30 text-blue-400 border-blue-700'
    };
    
    return (
      <span className={`px-3 py-1.5 rounded-full text-xs font-medium border ${vendorColors[vendor.toLowerCase()] || 'bg-gray-800 text-gray-400 border-gray-700'}`}>
        {vendor}
      </span>
    );
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />;
  };

  // Filter and sort merged sites
  const filteredSites = useMemo(() => {
    let filtered = mergedSites;
    
    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(site =>
        site.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        site.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        site.vendor?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        site.siteCode?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Apply status filter
    if (viewMode !== 'all') {
      filtered = filtered.filter(site => site.status === viewMode);
    }
    
    // Apply sorting
    const { key, direction } = sortConfig;
    const multiplier = direction === 'asc' ? 1 : -1;
    
    return filtered.sort((a, b) => {
      if (key === 'name') {
        return multiplier * (a.displayName || a.name).localeCompare(b.displayName || b.name);
      }
      if (key === 'vendor') {
        return multiplier * a.vendor.localeCompare(b.vendor);
      }
      if (key === 'status') {
        const statusOrder = { online: 1, partial: 2, offline: 3, error: 4 };
        return multiplier * ((statusOrder[a.status] || 5) - (statusOrder[b.status] || 5));
      }
      if (key === 'devices') {
        return multiplier * (a.deviceCount - b.deviceCount);
      }
      return 0;
    });
  }, [mergedSites, searchTerm, viewMode, sortConfig]);

  // Calculate device statistics for a site
  const getDeviceStats = (siteId) => {
    const devices = devicesData[siteId] || [];
    const onlineCount = devices.filter(device => device.status === 'Online').length;
    const offlineCount = devices.filter(device => device.status === 'Offline').length;
    const totalCount = devices.length;

    return { onlineCount, offlineCount, totalCount };
  };

  // Handle marker click
  const handleMarkerClick = (siteId, vendor) => {
    setSelectedSite(siteId);
    // Fetch devices when marker is clicked if not already loaded
    if (!devicesData[siteId]) {
      fetchSiteDevices(siteId, vendor);
    }
  };

  // Get sites that have valid coordinates
  const sitesWithCoordinates = useMemo(() => {
    return mergedSites.filter(site => 
      site.latitude && site.longitude && 
      !isNaN(site.latitude) && !isNaN(site.longitude) &&
      Math.abs(site.latitude) > 0.1 && Math.abs(site.longitude) > 0.1 // Filter out near-zero coordinates
    );
  }, [mergedSites]);

  // Calculate map center based on sites
  const calculateMapCenter = useMemo(() => {
    if (sitesWithCoordinates.length === 0) return [11.0, 125.0];
    
    const latitudes = sitesWithCoordinates.map(s => s.latitude);
    const longitudes = sitesWithCoordinates.map(s => s.longitude);
    
    const avgLat = latitudes.reduce((a, b) => a + b, 0) / latitudes.length;
    const avgLng = longitudes.reduce((a, b) => a + b, 0) / longitudes.length;
    
    return [avgLat, avgLng];
  }, [sitesWithCoordinates]);

  // Debug: Log the sites data
  useEffect(() => {
    console.log('Merged sites:', mergedSites);
    console.log('Sites with coordinates:', sitesWithCoordinates);
  }, [mergedSites, sitesWithCoordinates]);

  if (loading) {
    return (
      <main className="p-4 sm:p-8 bg-gradient-to-br from-gray-900 via-gray-800 to-black min-h-screen text-white">
        <div className="container mx-auto">
          <div className="mb-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-white">Site Status Dashboard</h1>
                <p className="text-sm md:text-base text-gray-300 mt-1">Monitor all site device statuses in real-time</p>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-4 shadow-lg">
                <div className="animate-pulse">
                  <div className="h-4 bg-white/20 rounded w-1/2 mb-4"></div>
                  <div className="h-8 bg-white/20 rounded w-3/4"></div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-6 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-4 shadow-lg">
            <div className="animate-pulse">
              <div className="h-6 bg-white/20 rounded w-1/4 mb-4"></div>
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="h-12 bg-white/20 rounded"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="p-4 sm:p-8 bg-gradient-to-br from-gray-900 via-gray-800 to-black min-h-screen text-white">
      <div className="container mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">Site Status Dashboard</h1>
              <p className="text-sm md:text-base text-gray-300 mt-1">Monitor all site device statuses in real-time with interactive map</p>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="Search sites..." 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                  className="w-full md:w-64 pl-4 pr-10 py-2.5 bg-white/10 border border-white/20 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
                <Search className="absolute right-3 top-2.5 w-5 h-5 text-gray-400" />
              </div>
              
              <button 
                onClick={() => Promise.all([fetchSitesData(), fetchSiteStatuses(true)])}
                disabled={refreshing}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        {statistics && (
          <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-4 shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-300">Total Sites</h3>
                <Building className="w-5 h-5 text-gray-400" />
              </div>
              <div className="text-2xl font-bold text-white">{mergedSites.length}</div>
              <div className="text-xs text-gray-400 mt-1">
                {sitesWithCoordinates.length} with locations
              </div>
            </div>
            
            <div 
              className={`bg-white/10 backdrop-blur-sm rounded-xl border ${viewMode === 'online' ? 'border-green-500/50' : 'border-white/20'} p-4 shadow-lg cursor-pointer hover:bg-white/15 transition-colors`}
              onClick={() => setViewMode(viewMode === 'online' ? 'all' : 'online')}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-300">Online Sites</h3>
                <Wifi className="w-5 h-5 text-green-400" />
              </div>
              <div className="text-2xl font-bold text-green-400">
                {mergedSites.filter(s => s.status === 'online').length}
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {((mergedSites.filter(s => s.status === 'online').length / mergedSites.length) * 100 || 0).toFixed(1)}% of total
              </p>
            </div>
            
            <div 
              className={`bg-white/10 backdrop-blur-sm rounded-xl border ${viewMode === 'offline' ? 'border-red-500/50' : 'border-white/20'} p-4 shadow-lg cursor-pointer hover:bg-white/15 transition-colors`}
              onClick={() => setViewMode(viewMode === 'offline' ? 'all' : 'offline')}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-300">Offline Sites</h3>
                <WifiOff className="w-5 h-5 text-red-400" />
              </div>
              <div className="text-2xl font-bold text-red-400">
                {mergedSites.filter(s => s.status === 'offline').length}
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {mergedSites.filter(s => s.status === 'error').length > 0 && `${mergedSites.filter(s => s.status === 'error').length} with errors`}
              </p>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-4 shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-300">Total Devices</h3>
                <Server className="w-5 h-5 text-blue-400" />
              </div>
              <div className="text-2xl font-bold text-white">
                {mergedSites.reduce((sum, site) => sum + (site.deviceCount || 0), 0)}
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {mergedSites.reduce((sum, site) => sum + (site.onlineDevices || 0), 0)} online • 
                {mergedSites.reduce((sum, site) => sum + (site.offlineDevices || 0), 0)} offline
              </p>
            </div>
          </div>
        )}

        {/* Map Legend */}
        <div className="mb-4 flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-green-500"></div>
            <span className="text-sm text-gray-300">Online Sites</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-red-500"></div>
            <span className="text-sm text-gray-300">Offline Sites</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-yellow-500"></div>
            <span className="text-sm text-gray-300">Partial Online</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-300">Click pins for details</span>
          </div>
        </div>

        {/* Main Content - Split Layout */}
        <div className="flex flex-col lg:flex-row gap-4 md:gap-6">
          {/* Left Column: Site Status List (col-7) */}
          <div className="lg:w-7/12">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 shadow-lg overflow-hidden h-full">
              <div className="p-4 border-b border-white/20">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-lg font-semibold text-white">Site Status Details</h2>
                    <p className="text-sm text-gray-400 mt-1">
                      Showing {filteredSites.length} of {mergedSites.length} sites
                      {viewMode !== 'all' && ` (${viewMode} only)`}
                    </p>
                  </div>
                  <div className="text-sm text-gray-400">
                    {sitesWithCoordinates.length} sites have location data
                  </div>
                </div>
              </div>
              
              <div className="overflow-y-auto" style={{ maxHeight: '500px' }}>
                <table className="w-full">
                  <thead className="sticky top-0 bg-gray-800/80 backdrop-blur-sm z-10">
                    <tr className="border-b border-white/20">
                      <th 
                        className="text-left p-4 text-sm font-medium text-gray-300 cursor-pointer hover:bg-white/5"
                        onClick={() => handleSort('name')}
                      >
                        <div className="flex items-center gap-1">
                          Site Name
                          {getSortIcon('name')}
                        </div>
                      </th>
                      <th 
                        className="text-left p-4 text-sm font-medium text-gray-300 cursor-pointer hover:bg-white/5"
                        onClick={() => handleSort('vendor')}
                      >
                        <div className="flex items-center gap-1">
                          Vendor
                          {getSortIcon('vendor')}
                        </div>
                      </th>
                      <th 
                        className="text-left p-4 text-sm font-medium text-gray-300 cursor-pointer hover:bg-white/5"
                        onClick={() => handleSort('status')}
                      >
                        <div className="flex items-center gap-1">
                          Status
                          {getSortIcon('status')}
                        </div>
                      </th>
                      <th 
                        className="text-left p-4 text-sm font-medium text-gray-300 cursor-pointer hover:bg-white/5"
                        onClick={() => handleSort('devices')}
                      >
                        <div className="flex items-center gap-1">
                          Devices
                          {getSortIcon('devices')}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSites.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-gray-400">
                          <div className="flex flex-col items-center">
                            <AlertCircle className="w-12 h-12 mb-4 text-gray-600" />
                            <p className="text-lg">No sites found</p>
                            <p className="text-sm mt-2">Try adjusting your search or filters</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredSites.map((site) => (
                        <tr 
                          key={site.siteId} 
                          className={`border-b border-white/10 hover:bg-white/5 transition-colors cursor-pointer ${selectedSite === site.siteId ? 'bg-white/10' : ''}`}
                          onClick={() => setSelectedSite(site.siteId)}
                        >
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              {site.latitude && site.longitude ? (
                                <MapPin className="w-4 h-4 text-blue-400" />
                              ) : (
                                <MapPin className="w-4 h-4 text-gray-500" />
                              )}
                              <div>
                                <div className="font-medium text-white">{site.displayName || site.name}</div>
                                {site.siteCode && (
                                  <div className="text-xs text-gray-400 mt-1">{site.siteCode}</div>
                                )}
                                {site.address && (
                                  <div className="text-xs text-gray-500 mt-1 truncate max-w-[200px]">
                                    {site.address}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            {getVendorBadge(site.vendor)}
                          </td>
                          <td className="p-4">
                            {getStatusBadge(site.status)}
                          </td>
                          <td className="p-4">
                            <div className="flex flex-col">
                              <div className="text-white font-medium">{site.deviceCount || 0}</div>
                              <div className="text-xs text-gray-400 mt-1">
                                <span className="text-green-400">{site.onlineDevices || 0} online</span>
                                <span className="mx-1">•</span>
                                <span className="text-red-400">{site.offlineDevices || 0} offline</span>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Column: Map (col-5) */}
          <div className="lg:w-5/12">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-4 shadow-lg h-full">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Navigation className="w-5 h-5 text-blue-400" />
                  Site Locations Map
                </h2>
                <span className="text-sm text-gray-400">
                  {sitesWithCoordinates.length} sites on map
                </span>
              </div>
              
              <div className="h-[500px] rounded-lg overflow-hidden border border-white/20">
                {sitesWithCoordinates.length > 0 ? (
                  <MapContainer
                    center={calculateMapCenter}
                    zoom={sitesWithCoordinates.length > 1 ? 8 : 12}
                    className="h-full w-full"
                    style={{ zIndex: 1 }}
                  >
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      subdomains={['a','b','c']}
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    />
                    
                    {sitesWithCoordinates.map(site => {
                      const icon = createCustomIcon(site.status);
                      
                      return (
                        <Marker
                          key={site.siteId}
                          position={[site.latitude, site.longitude]}
                          icon={icon}
                          eventHandlers={{
                            click: () => handleMarkerClick(site.siteId, site.vendor)
                          }}
                        >
                          <Popup className="leaflet-popup-custom">
                            <div className="min-w-[250px] bg-gray-900 text-white rounded-lg p-4">
                              <div className="flex justify-between items-start mb-3">
                                <strong className="text-lg">{site.displayName || site.name}</strong>
                                {getStatusBadge(site.status)}
                              </div>
                              
                              <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                  <span className="text-gray-400">Vendor:</span>
                                  <span className={`px-2 py-1 rounded text-xs ${
                                    site.vendor?.toLowerCase() === 'ruijie' 
                                      ? 'bg-blue-500 text-white' 
                                      : site.vendor?.toLowerCase() === 'omada'
                                      ? 'bg-red-500 text-white'
                                      : 'bg-gray-500 text-white'
                                  }`}>
                                    {site.vendor}
                                  </span>
                                </div>
                                
                                <div className="border-t border-gray-700 pt-3">
                                  <h4 className="text-sm font-medium mb-2">Device Status:</h4>
                                  <div className="grid grid-cols-3 gap-2">
                                    <div className="text-center">
                                      <div className="text-lg font-bold">{site.deviceCount || 0}</div>
                                      <div className="text-xs text-gray-400">Total</div>
                                    </div>
                                    <div className="text-center">
                                      <div className="text-lg font-bold text-green-400">{site.onlineDevices || 0}</div>
                                      <div className="text-xs text-gray-400">Online</div>
                                    </div>
                                    <div className="text-center">
                                      <div className="text-lg font-bold text-red-400">{site.offlineDevices || 0}</div>
                                      <div className="text-xs text-gray-400">Offline</div>
                                    </div>
                                  </div>
                                </div>
                                
                                {site.address && (
                                  <div className="border-t border-gray-700 pt-3">
                                    <div className="flex items-start gap-2">
                                      <MapPin className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                                      <div>
                                        <p className="text-sm text-gray-300">Location:</p>
                                        <p className="text-xs text-gray-400 truncate">{site.address}</p>
                                      </div>
                                    </div>
                                  </div>
                                )}
                                
                                <div className="border-t border-gray-700 pt-3 text-xs text-gray-400">
                                  <p>Coordinates: {site.latitude.toFixed(4)}, {site.longitude.toFixed(4)}</p>
                                  <p className="mt-1">Last Checked: {site.lastChecked ? new Date(site.lastChecked).toLocaleString() : 'Never'}</p>
                                </div>
                              </div>
                            </div>
                          </Popup>
                        </Marker>
                      );
                    })}
                  </MapContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-400">
                    <div className="text-center">
                      <div className="text-5xl mb-4">🗺️</div>
                      <p className="text-lg">No Location Data Available</p>
                      <p className="text-sm mt-2">
                        {mergedSites.length > 0 
                          ? `${mergedSites.length} sites found but no location data`
                          : "No sites found to display on map"}
                      </p>
                      <div className="mt-4 text-xs text-gray-500">
                        <p>Check database for latitude/longitude coordinates in wins_sites table</p>
                        <p className="mt-1">Default fallback coordinates: 11.0, 125.0</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="mt-4 text-sm text-gray-400">
                <p>• Click on any pin to see site details and device information</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Custom CSS for map styling */}
      <style jsx global>{`
        /* Fix Leaflet popup z-index */
        .leaflet-container {
          z-index: 1 !important;
          font-family: inherit !important;
        }
        
        .leaflet-popup {
          z-index: 1000 !important;
        }
        
        .leaflet-popup-content-wrapper {
          background: transparent !important;
          border-radius: 12px !important;
          border: none !important;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5) !important;
          backdrop-filter: blur(10px) !important;
        }
        
        .leaflet-popup-content {
          margin: 0 !important;
          padding: 0 !important;
          line-height: 1.5 !important;
        }
        
        .leaflet-popup-tip {
          background: rgba(31, 41, 55, 0.95) !important;
          box-shadow: none !important;
        }
        
        .leaflet-control-attribution {
          background: rgba(0, 0, 0, 0.7) !important;
          color: #94a3b8 !important;
          font-size: 10px !important;
          padding: 2px 5px !important;
        }
        
        .leaflet-control-attribution a {
          color: #3b82f6 !important;
        }
        
        /* Custom marker styling - make them black like your original */
        .custom-marker-icon {
          filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5));
        }
        
        /* Add colored border to markers based on status */
        .custom-marker-icon.status-online {
          filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5)) sepia(1) saturate(5) hue-rotate(90deg);
        }
        
        .custom-marker-icon.status-offline {
          filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5)) sepia(1) saturate(5) hue-rotate(340deg);
        }
        
        .custom-marker-icon.status-partial {
          filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5)) sepia(1) saturate(5) hue-rotate(40deg);
        }
        
        .custom-marker-icon:hover {
          transform: scale(1.1);
          transition: transform 0.2s ease;
        }
        
        /* Map controls */
        .leaflet-control-zoom {
          border: 1px solid rgba(255, 255, 255, 0.2) !important;
          background: rgba(31, 41, 55, 0.8) !important;
          backdrop-filter: blur(10px) !important;
        }
        
        .leaflet-control-zoom a {
          background: rgba(255, 255, 255, 0.1) !important;
          color: #fff !important;
          border-bottom: 1px solid rgba(255, 255, 255, 0.2) !important;
        }
        
        .leaflet-control-zoom a:hover {
          background: rgba(255, 255, 255, 0.2) !important;
        }
        
        /* Ensure map tiles render correctly */
        .leaflet-tile {
          filter: brightness(0.9) contrast(1.1) !important;
        }
      `}</style>
    </main>
  );
}