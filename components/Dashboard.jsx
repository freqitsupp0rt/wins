"use client";

import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import dynamic from "next/dynamic";
import {
  Search,
  RefreshCw,
  Server,
  Wifi,
  Activity,
  ChevronRight,
  Globe,
  HardDrive,
  Cpu,
  Filter,
  Clock,
  BarChart3,
  AlertCircle,
  Signal,
  Router,
  Network
} from "lucide-react";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

const Dashboard = () => {
  const [sites, setSites] = useState([]);
  const [devices, setDevices] = useState([]);
  const [trafficData, setTrafficData] = useState({});
  const [loading, setLoading] = useState({
    sites: true,
    devices: false,
    traffic: false
  });
  const [selectedSite, setSelectedSite] = useState(null);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [timeRange, setTimeRange] = useState("1h");
  const [activeTab, setActiveTab] = useState("all");
  const [error, setError] = useState(null);
  const token = localStorage.getItem('token');

  const fetchSites = useCallback(async () => {
    try {
      setLoading(prev => ({ ...prev, sites: true }));
      setError(null);
      const response = await axios.get("/api/sites", {
        headers: {
            "Authorization": `Bearer ${token}`,
        }
      });
      const formattedSites = (response.data.data || []).map(site => ({
        ...site,
        siteIdentifier: getSiteIdentifier(site)
      }));
      setSites(formattedSites);
    } catch (error) {
      console.error("Error fetching sites:", error);
      setError("Failed to fetch sites. Please try again.");
    } finally {
      setLoading(prev => ({ ...prev, sites: false }));
    }
  }, []);

  const getSiteIdentifier = (site) => {
    if (site.siteIdentifier) return site.siteIdentifier;
    if (site.vendor === "Omada" && site.id) return `omada-${site.siteId}`;
    if (site.vendor === "Ruijie" && site.groupId) return `ruijie-${site.groupId}`;
    if (site.siteId) return `${site.vendor?.toLowerCase()}-${site.siteId}`;
    return `${site.vendor?.toLowerCase()}-${site.name}-${Math.random().toString(36).substr(2, 9)}`;
  };

  const fetchDevices = useCallback(async (site, vendor) => {
    if (!site) return;
    try {
      setLoading(prev => ({ ...prev, devices: true }));
      setError(null);
      
      let response;
      let siteIdentifier;
      
      if (vendor === "Omada") {
        siteIdentifier = site.siteId || site.id;
        response = await axios.get(`/api/devices?siteId=${siteIdentifier}&vendor=${vendor}`, {
          headers: {
              "Authorization": `Bearer ${token}`,
          }
        });
      } else if (vendor === "Ruijie") {
        // Use groupId for Ruijie sites
        siteIdentifier = site.groupId;
        response = await axios.get(`/api/devices?siteId=${siteIdentifier}&vendor=${vendor}`, {
          headers: {
              "Authorization": `Bearer ${token}`,
          }
        });
      }
      
      const devicesData = response?.data?.data || [];
      setDevices(devicesData);
      
      // Reset selected device when fetching new devices
      setSelectedDevice(null);
      setTrafficData({});
      
      // Auto-select first device if available
      if (devicesData.length > 0) {
        setSelectedDevice(devicesData[0]);
      }
    } catch (error) {
      console.error("Error fetching devices:", error);
      setError(`Failed to fetch devices for ${vendor} site.`);
      setDevices([]);
      setSelectedDevice(null);
      setTrafficData({});
    } finally {
      setLoading(prev => ({ ...prev, devices: false }));
    }
  }, []);

  const fetchTrafficData = useCallback(async (device, vendor, timeRangeParam = null) => {
    if (!device) {
      setTrafficData({});
      return;
    }
    
    try {
      setLoading(prev => ({ ...prev, traffic: true }));
      setError(null);
      
      const currentTimeRange = timeRangeParam || timeRange;
      
      if (vendor === "Omada") {
        // Get siteId from the selectedSite state
        const siteId = selectedSite?.siteId || selectedSite?.id;
        
        if (!siteId) {
          throw new Error("No site selected for Omada device");
        }
        
        // Omada API call with siteId as query parameter
        const response = await axios.get(`/api/performance/omada/networktraffic`, {
          params: { 
            deviceId: device.macAddress || device.mac, 
            siteId: siteId,  // <-- ADD THIS
            timeRange: currentTimeRange 
          },
          headers: {
              "Authorization": `Bearer ${token}`,
          }
        });
        
        // Omada returns simple object with rxBytes, txBytes, etc.
        if (response.data.rxBytes !== undefined) {
          // Store as current traffic data
          setTrafficData({
            current: response.data,
            historical: []
          });
        } else if (response.data.error) {
          console.error("Omada API Error:", response.data.error);
          setError(`Traffic data error: ${response.data.error}`);
          setTrafficData({});
        }
      } else if (vendor === "Ruijie") {
        // Ruijie API call - always use today's data
        const now = Date.now();
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);
        
        const response = await axios.post(
          '/api/performance/ruijie/networktraffic',
          {
            sn: device.serialNumber,
            startDate: startOfToday.getTime().toString(),
            endDate: endOfToday.getTime().toString(),
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        
        if (response.data.code === 0) {
          // Transform Ruijie data
          const transformedData = response.data.list?.map(item => ({
            timestamp: Math.floor(item.timeStamp / 1000),
            uplinkRate: item.txRate * 1000000, // Convert Mbps to bps
            downlinkRate: item.rxRate * 1000000, // Convert Mbps to bps
            unit: "bps",
          })) || [];
          
          setTrafficData({
            current: null,
            historical: transformedData
          });
        } else {
          console.error("Ruijie API Error:", response.data.msg);
          setError(`Ruijie traffic data error: ${response.data.msg}`);
          setTrafficData({});
        }
      } else {
        console.error("Unknown vendor:", vendor);
        setTrafficData({});
      }
    } catch (error) {
      console.error("Error fetching traffic data:", error);
      const errorMsg = error.response?.data?.error || error.response?.data?.msg || error.message || "Failed to fetch traffic data";
      setError(errorMsg);
      setTrafficData({});
    } finally {
      setLoading(prev => ({ ...prev, traffic: false }));
    }
  }, [timeRange, selectedSite]);

  useEffect(() => { 
    fetchSites(); 
  }, [fetchSites]);

  useEffect(() => { 
    if (selectedSite) {
      fetchDevices(selectedSite, selectedSite.vendor);
    } else {
      setDevices([]);
      setSelectedDevice(null);
      setTrafficData({});
    }
  }, [selectedSite, fetchDevices]);

  useEffect(() => { 
    if (selectedDevice) {
      fetchTrafficData(selectedDevice, selectedDevice.vendor);
    } else {
      setTrafficData({});
    }
  }, [selectedDevice, timeRange, fetchTrafficData]);

  const handleSiteClick = (site) => {
    setSelectedSite(site);
    setSelectedDevice(null);
    setTrafficData({});
  };

  const handleDeviceClick = (device) => {
    setSelectedDevice(device);
  };

  const handleRefreshTraffic = () => {
    if (selectedDevice) {
      fetchTrafficData(selectedDevice, selectedDevice.vendor);
    }
  };

  const filteredSites = sites.filter(site => {
    const matchesSearch = site.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         site.description?.toLowerCase().includes(searchTerm.toLowerCase());
    if (activeTab === "all") return matchesSearch;
    if (activeTab === "Omada") return matchesSearch && site.vendor === "Omada";
    if (activeTab === "ruijie") return matchesSearch && site.vendor === "Ruijie";
    return matchesSearch;
  });

  const chartOptions = {
    chart: { 
      type: 'line', 
      height: 300, 
      zoom: { enabled: true }, 
      toolbar: { show: true }, 
      background: 'transparent', 
      foreColor: '#94a3b8' 
    },
    colors: ['#3B82F6', '#10B981'], 
    dataLabels: { enabled: false }, 
    stroke: { curve: 'smooth', width: 3 },
    grid: { borderColor: '#374151', row: { colors: ['transparent', 'transparent'], opacity: 0.5 } },
    xaxis: { 
      type: 'datetime', 
      labels: { 
        datetimeUTC: false, 
        format: 'HH:mm', 
        style: { colors: '#94a3b8' } 
      } 
    },
    yaxis: { 
      title: { text: 'Rate (bps)', style: { color: '#94a3b8' } }, 
      labels: { 
        formatter: (val) => {
          if (val >= 1000000) return `${(val/1000000).toFixed(1)} Mbps`;
          if (val >= 1000) return `${(val/1000).toFixed(1)} Kbps`;
          return `${val.toFixed(0)} bps`;
        }, 
        style: { colors: '#94a3b8' } 
      } 
    },
    tooltip: { 
      theme: 'dark', 
      x: { format: 'dd MMM yyyy HH:mm' }, 
      y: { 
        formatter: (val) => {
          if (val >= 1000000) return `${(val/1000000).toFixed(2)} Mbps`;
          if (val >= 1000) return `${(val/1000).toFixed(2)} Kbps`;
          return `${val.toFixed(2)} bps`;
        }
      } 
    },
    legend: { 
      position: 'top', 
      horizontalAlign: 'right', 
      labels: { colors: '#94a3b8' } 
    }
  };

  // Prepare chart series data
  let chartSeries = [];
  if (selectedDevice?.vendor === "Ruijie" && trafficData.historical) {
    // Ruijie: Use historical time series data
    chartSeries = [
      {
        name: 'Uplink',
        data: trafficData.historical.map(item => ({
          x: new Date(item.timestamp * 1000),
          y: item.uplinkRate || 0
        }))
      },
      {
        name: 'Downlink',
        data: trafficData.historical.map(item => ({
          x: new Date(item.timestamp * 1000),
          y: item.downlinkRate || 0
        }))
      }
    ];
  } else if (selectedDevice?.vendor === "Omada" && trafficData.current) {
    // Omada: Create simple chart with single data point (current traffic)
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 3600000);
    
    chartSeries = [
      {
        name: 'Current Traffic',
        data: [
          {
            x: oneHourAgo,
            y: trafficData.current.txBytes || 0
          },
          {
            x: now,
            y: trafficData.current.txBytes || 0
          }
        ]
      }
    ];
  }

  // Calculate traffic stats
  const getTrafficStats = () => {
    if (!selectedDevice) return { avgUplink: 0, avgDownlink: 0, dataPoints: 0 };
    
    if (selectedDevice.vendor === "Ruijie" && trafficData.historical) {
      const totalUplink = trafficData.historical.reduce((sum, item) => sum + (item.uplinkRate || 0), 0);
      const totalDownlink = trafficData.historical.reduce((sum, item) => sum + (item.downlinkRate || 0), 0);
      const dataPoints = trafficData.historical.length;
      
      return {
        avgUplink: dataPoints > 0 ? totalUplink / dataPoints : 0,
        avgDownlink: dataPoints > 0 ? totalDownlink / dataPoints : 0,
        dataPoints
      };
    } else if (selectedDevice.vendor === "Omada" && trafficData.current) {
      return {
        avgUplink: trafficData.current.txBytes || 0,
        avgDownlink: trafficData.current.rxBytes || 0,
        dataPoints: 1
      };
    }
    
    return { avgUplink: 0, avgDownlink: 0, dataPoints: 0 };
  };

  const { avgUplink, avgDownlink, dataPoints } = getTrafficStats();

  const Badge = ({ children, variant = "default", className = "" }) => {
    const variantClasses = {
      default: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
      secondary: "bg-gray-800 text-gray-300 border border-gray-700",
      success: "bg-green-500/10 text-green-400 border border-green-500/20",
      warning: "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20",
      danger: "bg-red-500/10 text-red-400 border border-red-500/20"
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variantClasses[variant]} ${className}`}>
        {children}
      </span>
    );
  };

  return (
    <div className="p-4 md:p-8 bg-gradient-to-br from-gray-900 via-gray-800 to-black min-h-screen text-white">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">Network Performance Dashboard</h1>
          <p className="text-sm md:text-base text-gray-300">Monitor real-time network traffic across all sites</p>
        </div>
        <div className="flex items-center gap-2">
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 text-red-400 rounded-lg border border-red-500/20">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}
          <button 
            onClick={fetchSites} 
            disabled={loading.sites} 
            className="inline-flex items-center px-3 md:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm md:text-base"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loading.sites ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Sites Panel */}
        <div className="lg:col-span-1">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-4 md:p-6 h-[calc(108vh-260px)] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
                  <Globe className="h-5 w-5 text-blue-400" />
                  Sites ({filteredSites.length})
                </h2>
                <p className="text-xs md:text-sm text-gray-300 mt-1">Select a site to view devices</p>
              </div>
              <div className="relative">
                <select 
                  value={activeTab} 
                  onChange={(e) => {
                    setActiveTab(e.target.value);
                    setSelectedSite(null);
                    setSelectedDevice(null);
                    setTrafficData({});
                  }} 
                  className="appearance-none bg-white/10 border border-white/20 text-white text-xs md:text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 pr-8"
                >
                  <option value="all">All Sites</option>
                  <option value="Omada">Omada</option>
                  <option value="ruijie">Ruijie</option>
                </select>
                <Filter className="absolute right-2 top-2.5 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
            
            <div className="relative mb-4">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search sites..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                className="w-full pl-10 pr-4 py-2.5 bg-white/10 border border-white/20 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm" 
              />
            </div>

            <div className="space-y-2 flex-1 overflow-y-auto pr-2">
              {loading.sites ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={`sites-skeleton-${i}`} className="animate-pulse p-4 rounded-lg bg-white/5">
                    <div className="h-16 bg-gray-700 rounded-lg"></div>
                  </div>
                ))
              ) : filteredSites.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <Globe className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No sites found</p>
                </div>
              ) : filteredSites.map((site) => (
                <div
                  key={`site-${site.siteIdentifier}`}
                  className={`p-4 rounded-lg border transition-all cursor-pointer hover:shadow-lg hover:border-blue-500/50 ${
                    selectedSite?.siteIdentifier === site.siteIdentifier
                      ? "border-blue-500 bg-blue-500/10"
                      : "border-white/20 bg-white/5"
                  }`}
                  onClick={() => handleSiteClick(site)}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-md ${site.vendor === "Omada" ? "bg-red-500/10" : "bg-blue-500/10"}`}>
                          {site.vendor === "Omada" ? <Router className="h-3.5 w-3.5 text-red-400" /> : <Network className="h-3.5 w-3.5 text-blue-400" />}
                        </div>
                        <h3 className="font-semibold text-white text-sm md:text-base">{site.name}</h3>
                        <Badge variant={site.vendor === "Omada" ? "default" : "success"} className="text-xs">
                          {site.vendor}
                        </Badge>
                      </div>
                    </div>
                    <ChevronRight className={`h-4 w-4 ${selectedSite?.siteIdentifier === site.siteIdentifier ? "text-blue-400" : "text-gray-400"}`} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-4 md:space-y-6">
          {/* Network Traffic Chart */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-4 md:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-blue-400" />
                  Network Traffic
                </h2>
                <p className="text-xs md:text-sm text-gray-300 mt-1">
                  {selectedDevice 
                    ? `Real-time traffic for ${selectedDevice.name} (${selectedDevice.vendor})` 
                    : selectedSite
                    ? "Select a device to view traffic data"
                    : "Select a site and device to view traffic data"
                  }
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <select 
                    value={timeRange} 
                    onChange={(e) => setTimeRange(e.target.value)} 
                    disabled={!selectedDevice || selectedDevice?.vendor === "Ruijie"}
                    className="appearance-none bg-white/10 border border-white/20 text-white text-xs md:text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 pr-8 disabled:opacity-50"
                  >
                    <option value="1h">Last 1 Hour</option>
                    <option value="6h">Last 6 Hours</option>
                    <option value="24h">Last 24 Hours</option>
                    <option value="7d">Last 7 Days</option>
                    <option value="today">Today</option>
                  </select>
                  <Clock className="absolute right-2 top-2.5 h-4 w-4 text-gray-400 pointer-events-none" />
                </div>
                {selectedDevice && (
                  <button 
                    onClick={handleRefreshTraffic} 
                    disabled={loading.traffic}
                    className="p-2.5 bg-white/10 rounded-lg hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <RefreshCw className={`h-4 w-4 text-gray-300 ${loading.traffic ? 'animate-spin' : ''}`} />
                  </button>
                )}
              </div>
            </div>
            
            <div className="h-[280px]">
              {loading.traffic ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <RefreshCw className="h-8 w-8 mx-auto mb-4 animate-spin text-blue-500" />
                    <p className="text-sm text-gray-300">
                      Loading {selectedDevice?.vendor} traffic data...
                    </p>
                  </div>
                </div>
              ) : !selectedDevice ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                  <Activity className="h-12 w-12 md:h-16 md:w-16 mb-4 opacity-50" />
                  <p className="text-sm md:text-lg">Select a device to view network traffic</p>
                  <p className="text-xs md:text-sm mt-2 text-gray-300">
                    {selectedSite ? "Choose a device from the devices list below" : "First select a site from the left panel"}
                  </p>
                </div>
              ) : (selectedDevice.vendor === "Ruijie" && !trafficData.historical?.length) || 
                  (selectedDevice.vendor === "Omada" && !trafficData.current) ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                  <BarChart3 className="h-12 w-12 md:h-16 md:w-16 mb-4 opacity-50" />
                  <p className="text-sm md:text-lg">No traffic data available</p>
                  <p className="text-xs md:text-sm mt-2 text-gray-300">
                    {selectedDevice.vendor === "Omada" 
                      ? "Omada shows current traffic only" 
                      : "Ruijie shows today's traffic data only"}
                  </p>
                </div>
              ) : (
                <Chart options={chartOptions} series={chartSeries} type="line" height="100%" />
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
            {/* Network Devices Panel */}
            <div className="lg:col-span-2">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-4 md:p-6 h-[430px]">
                <div className="mb-4">
                  <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
                    <Wifi className="h-5 w-5 text-blue-400" />
                    Network Devices
                    {selectedSite && <span className="text-sm text-gray-300 font-normal ml-2">in {selectedSite.name}</span>}
                  </h2>
                  <p className="text-xs md:text-sm text-gray-300 mt-1">
                    {selectedSite 
                      ? `Select a device to view its network traffic (${devices.length} devices)` 
                      : "Select a site to view its devices"}
                  </p>
                </div>
                
                <div className="h-[calc(100%-80px)]">
                  {!selectedSite ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400">
                      <Server className="h-12 w-12 md:h-16 md:w-16 mx-auto mb-4 opacity-50" />
                      <p className="text-sm md:text-lg">Select a site to view devices</p>
                      <p className="text-xs md:text-sm mt-2 text-gray-300">Choose a site from the left panel</p>
                    </div>
                  ) : loading.devices ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 h-full overflow-y-auto pr-2">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div key={`devices-skeleton-${i}`} className="animate-pulse p-4 rounded-lg bg-white/5">
                          <div className="h-32 bg-gray-700 rounded-lg"></div>
                        </div>
                      ))}
                    </div>
                  ) : devices.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400">
                      <Wifi className="h-12 w-12 md:h-16 md:w-16 mx-auto mb-4 opacity-50" />
                      <p className="text-sm md:text-lg">No devices found in this site</p>
                      <p className="text-xs md:text-sm mt-2 text-gray-300">Try selecting another site or refreshing</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 h-full overflow-y-auto pr-2">
                      {devices.map((device) => (
                        <div 
                          key={`device-${device.id || device.serialNumber || device.name}`} 
                          className={`p-4 rounded-lg border transition-all cursor-pointer hover:shadow-lg ${
                            selectedDevice?.id === device.id 
                              ? device.vendor === "Omada" 
                                ? "border-red-500 bg-red-500/10" 
                                : "border-blue-500 bg-blue-500/10"
                              : "border-white/20 bg-white/5"
                          }`} 
                          onClick={() => handleDeviceClick(device)}
                        >
                          <div className="space-y-3">
                            <div className="flex items-start justify-between">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <div className={`p-1.5 rounded-md ${device.vendor === "Omada" ? "bg-red-500/10" : "bg-blue-500/10"}`}>
                                    {device.vendor === "Omada" ? <Router className="h-4 w-4 text-red-400" /> : <Network className="h-4 w-4 text-blue-400" />}
                                  </div>
                                  <h3 className="font-semibold text-white text-sm md:text-base">{device.name}</h3>
                                </div>
                                <p className="text-xs text-gray-300">{device.model || "Unknown Model"}</p>
                              </div>
                              <div className="flex flex-col items-end gap-1.5">
                                <Badge variant={device.status === "Online" ? "success" : "secondary"} className="text-xs">
                                  {device.status || "Unknown"}
                                </Badge>
                                <Badge variant={device.vendor === "Omada" ? "default" : "success"} className="text-xs">
                                  {device.vendor}
                                </Badge>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-xs">
                              <div>
                                <p className="text-gray-300 font-medium">Serial</p>
                                <p className="text-gray-200 font-mono truncate">{device.serialNumber || "N/A"}</p>
                              </div>
                              <div>
                                <p className="text-gray-300 font-medium">Type</p>
                                <p className="text-gray-200">{device.type || "N/A"}</p>
                              </div>
                            </div>
                            <div className="text-xs">
                              <p className="text-gray-300 font-medium">MAC Address</p>
                              <p className="text-gray-200 font-mono truncate">{device.macAddress || device.mac || "N/A"}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Traffic Stats Panel */}
            <div className="lg:col-span-1">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-4 md:p-6 h-[430px] flex flex-col">
                <div className="mb-4">
                  <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-blue-400" />
                    Traffic Stats
                  </h2>
                  <p className="text-xs md:text-sm text-gray-300 mt-1">
                    {selectedDevice 
                      ? `Performance metrics for ${selectedDevice.name}` 
                      : "Select a device to view stats"}
                  </p>
                </div>
                
                <div className="grid grid-cols-1 gap-3 h-[calc(100%-80px)] overflow-y-auto pr-2">
                  {loading.traffic ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <div key={`stats-skeleton-${i}`} className="animate-pulse bg-gradient-to-br from-gray-900/50 to-gray-800/50 p-3 md:p-4 rounded-lg border border-white/20">
                        <div className="h-16 bg-gray-700/30 rounded-lg"></div>
                      </div>
                    ))
                  ) : !selectedDevice ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                      <Activity className="h-10 w-10 mx-auto mb-3 opacity-50" />
                      <p className="text-sm text-center">
                        Select a device to view traffic statistics
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="bg-gradient-to-br from-gray-900/50 to-gray-800/50 p-3 md:p-4 rounded-lg border border-white/20">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-blue-500/10 rounded-md">
                              <Signal className="h-3.5 w-3.5 md:h-4 md:w-4 text-blue-400" />
                            </div>
                            <p className="text-xs font-medium text-gray-300">Avg Uplink</p>
                          </div>
                          <p className="text-base md:text-lg font-bold text-white">
                            {avgUplink >= 1000000 
                              ? `${(avgUplink / 1000000).toFixed(1)} Mbps` 
                              : avgUplink >= 1000 
                              ? `${(avgUplink / 1000).toFixed(1)} Kbps` 
                              : `${avgUplink.toFixed(0)} bps`
                            }
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {selectedDevice.vendor === "Omada" ? "Current TX" : "Average over period"}
                          </p>
                        </div>
                      </div>

                      <div className="bg-gradient-to-br from-gray-900/50 to-gray-800/50 p-3 md:p-4 rounded-lg border border-white/20">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-green-500/10 rounded-md">
                              <Activity className="h-3.5 w-3.5 md:h-4 md:w-4 text-green-400" />
                            </div>
                            <p className="text-xs font-medium text-gray-300">Avg Downlink</p>
                          </div>
                          <p className="text-base md:text-lg font-bold text-white">
                            {avgDownlink >= 1000000 
                              ? `${(avgDownlink / 1000000).toFixed(1)} Mbps` 
                              : avgDownlink >= 1000 
                              ? `${(avgDownlink / 1000).toFixed(1)} Kbps` 
                              : `${avgDownlink.toFixed(0)} bps`
                            }
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {selectedDevice.vendor === "Omada" ? "Current RX" : "Average over period"}
                          </p>
                        </div>
                      </div>

                      <div className="bg-gradient-to-br from-gray-900/50 to-gray-800/50 p-3 md:p-4 rounded-lg border border-white/20">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-purple-500/10 rounded-md">
                              <HardDrive className="h-3.5 w-3.5 md:h-4 md:w-4 text-purple-400" />
                            </div>
                            <p className="text-xs font-medium text-gray-300">Data Points</p>
                          </div>
                          <p className="text-base md:text-lg font-bold text-white">{dataPoints}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            {selectedDevice.vendor === "Omada" ? "Current reading" : "Historical points"}
                          </p>
                        </div>
                      </div>

                      <div className="bg-gradient-to-br from-gray-900/50 to-gray-800/50 p-3 md:p-4 rounded-lg border border-white/20">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-orange-500/10 rounded-md">
                              <Cpu className="h-3.5 w-3.5 md:h-4 md:w-4 text-orange-400" />
                            </div>
                            <p className="text-xs font-medium text-gray-300">Device Type</p>
                          </div>
                          <p className="text-base md:text-lg font-bold text-white truncate">{selectedDevice.type || "N/A"}</p>
                          <p className="text-xs text-gray-400 mt-1">{selectedDevice.vendor}</p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;