'use client';

import { useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";

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

export default function Sites() {
  const [sites, setSites] = useState([]);
  const [devicesData, setDevicesData] = useState({}); // Store devices by siteId
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSite, setSelectedSite] = useState(null);
  const [L, setLeaflet] = useState(null);
  const [searchTerm, setSearchTerm] = useState(""); // Search state
  const token = localStorage.getItem('token'); //get auth token

  useEffect(() => {
    // dynamically import leaflet only on client
    import("leaflet").then(mod => setLeaflet(mod));

    async function fetchSites() {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch("/api/sites", {
          headers: {
            "Authorization": `Bearer ${token}`,
          }
        });
        if (!res.ok) throw new Error("Failed to fetch sites");
        const data = await res.json();
        
        // Map database fields to your component's expected structure
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
        
        setSites(normalized);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchSites();
  }, []);

  // Fetch devices for a specific site
  const fetchSiteDevices = async (siteId, vendor) => {
    try {
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

  // Calculate device statistics for a site
  const getDeviceStats = (siteId) => {
    const devices = devicesData[siteId] || [];
    const onlineCount = devices.filter(device => device.status === 'Online').length;
    const offlineCount = devices.filter(device => device.status === 'Offline').length;
    const totalCount = devices.length;

    return { onlineCount, offlineCount, totalCount };
  };

  const getMarkerIcon = () => {
    if (!L) return null;
    return L.icon({
      iconUrl: "https://img.icons8.com/?size=100&id=PZTTDl8ML4vy&format=png&color=000000",
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32],
    });
  };

  // Only render map when Leaflet is loaded
  const isMapReady = L && sites.length > 0;

  // Filter sites for the map based on search term
  const filteredSites = useMemo(() => {
    if (!searchTerm) return sites;
    return sites.filter(site =>
      site.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      site.vendor.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [sites, searchTerm]);

  // Custom marker event handler for z-index fix
  const handleMarkerClick = (siteId, vendor) => {
    setSelectedSite(siteId);
    // Fetch devices when marker is clicked if not already loaded
    if (!devicesData[siteId]) {
      fetchSiteDevices(siteId, vendor);
    }
  };

  return (
    <main className="p-4 sm:p-8 bg-gradient-to-br from-gray-900 via-gray-800 to-black min-h-screen text-white">
      <div className="container mx-auto">
        {/* Header with Title and Search */}
        <div className="mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">Site Locations Map</h1>
              <p className="text-sm md:text-base text-gray-300 mt-1">View all network sites on an interactive map</p>
            </div>
            
            <div className="relative max-w-md w-full">
              <input 
                type="text" 
                placeholder="Search sites by name or vendor..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                className="w-full pl-4 pr-10 py-2.5 bg-white/10 border border-white/20 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
              <div className="absolute right-3 top-2.5 text-gray-400">
                {loading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-400 border-t-transparent"></div>
                ) : (
                  <span className="text-xs">{filteredSites.length} sites</span>
                )}
              </div>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mt-4 p-3 bg-red-500/10 text-red-400 rounded-lg border border-red-500/20">
              <p className="text-sm">{error}</p>
            </div>
          )}
        </div>

        {/* Main Content Area with Sidebar Layout */}
        <div className="flex flex-col lg:flex-row gap-4 md:gap-6">
          {/* Left Column: Map (col-8) */}
          <div className="lg:w-12/12">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-3 md:p-4 shadow-lg h-full">
              <div className="h-[60vh] min-h-[400px] lg:h-[70vh] relative z-0 rounded-lg overflow-hidden">
                {loading ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
                      <p className="text-gray-300">Loading map and sites...</p>
                    </div>
                  </div>
                ) : isMapReady ? (
                  <MapContainer
                    center={[11.0, 125.0]}
                    zoom={8}
                    className="h-full w-full rounded-lg"
                    style={{ zIndex: 1 }}
                  >
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      subdomains={['a','b','c']}
                      attribution="&copy; OpenStreetMap contributors"
                    />
                    {filteredSites.map(site => {
                      const icon = getMarkerIcon();
                      const stats = getDeviceStats(site.siteId);
                      
                      return site.latitude && site.longitude && icon ? (
                        <Marker
                          key={site.siteId}
                          position={[site.latitude, site.longitude]}
                          icon={icon}
                          eventHandlers={{
                            click: () => handleMarkerClick(site.siteId, site.vendor)
                          }}
                        >
                          <Popup className="leaflet-popup-custom">
                            <div className="min-w-[200px] bg-gray-900 text-white rounded-lg p-3">
                              <strong className="text-lg">{site.name}</strong>
                              <div className="mt-2">
                                <div className="flex justify-between items-center mb-1">
                                  <span>Vendor:</span>
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
                                
                                <div className="border-t border-gray-700 my-2"></div>
                                
                                <div className="text-sm">
                                  <div className="flex justify-between items-center mb-1">
                                    <span>Total Devices:</span>
                                    <span className="font-semibold">{stats.totalCount}</span>
                                  </div>
                                  <div className="flex justify-between items-center mb-1">
                                    <span className="text-green-500">Online:</span>
                                    <span className="font-semibold text-green-500">{stats.onlineCount}</span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-red-500">Offline:</span>
                                    <span className="font-semibold text-red-500">{stats.offlineCount}</span>
                                  </div>
                                </div>
                                
                                {stats.totalCount === 0 && (
                                  <div className="text-xs text-gray-400 mt-2 text-center">
                                    Click to load devices
                                  </div>
                                )}
                                
                                <div className="mt-3 pt-3 border-t border-gray-700 text-xs text-gray-400">
                                  <p>Last Sync: {site.lastSync ? new Date(site.lastSync).toLocaleDateString() : 'Never'}</p>
                                  <p className="truncate max-w-[180px]">{site.address}</p>
                                </div>
                              </div>
                            </div>
                          </Popup>
                        </Marker>
                      ) : null;
                    })}
                  </MapContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-400">
                    <div className="text-center">
                      <div className="text-5xl mb-4">🗺️</div>
                      <p className="text-lg">Map not available</p>
                      <p className="text-sm mt-2">Failed to load map components</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Custom CSS for fixing Leaflet z-index issues */}
      <style jsx global>{`
        /* Fix Leaflet popup z-index */
        .leaflet-container {
          z-index: 1 !important;
        }
        
        .leaflet-popup {
          z-index: 1000 !important;
        }
        
        .leaflet-popup-content-wrapper {
          background: transparent !important;
          border-radius: 8px !important;
          border: none !important;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5) !important;
        }
        
        .leaflet-popup-content {
          margin: 0 !important;
          padding: 0 !important;
        }
        
        .leaflet-popup-tip {
          background: rgba(31, 41, 55, 0.95) !important;
          box-shadow: none !important;
        }
        
        .leaflet-control-attribution {
          background: rgba(0, 0, 0, 0.7) !important;
          color: #94a3b8 !important;
          font-size: 11px !important;
        }
        
        .leaflet-control-attribution a {
          color: #3b82f6 !important;
        }
        
        /* Fix for modals and overlays */
        .leaflet-pane {
          z-index: 1 !important;
        }
        
        .leaflet-top,
        .leaflet-bottom {
          z-index: 2 !important;
        }
        
        /* Ensure map tiles don't overlap other content */
        .leaflet-tile-container {
          z-index: 0 !important;
        }
        
        .leaflet-marker-icon {
          z-index: 10 !important;
        }
        
        .leaflet-marker-shadow {
          z-index: 9 !important;
        }
      `}</style>
    </main>
  );
}