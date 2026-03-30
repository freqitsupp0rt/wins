'use client';

import { useEffect, useState, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from "@tanstack/react-table";
import SiteList from "@/components/SiteList"; // Import SiteList component

export default function SiteDevices() {
  const [sites, setSites] = useState([]);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedSite, setSelectedSite] = useState(null);
  const [siteSearchTerm, setSiteSearchTerm] = useState("");
  const token = localStorage.getItem('token');

  useEffect(() => {
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
          siteId: site.siteId,
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

  // Fetch devices when a site is selected
  useEffect(() => {
    if (!selectedSite) {
      setDevices([]);
      return;
    }

    async function fetchDevicesForSite() {
      setDevicesLoading(true);
      try {
        const site = sites.find(s => s.siteId === selectedSite);
        if (!site) return;

        const res = await fetch(`/api/devices?siteId=${selectedSite}&vendor=${site.vendor.toLowerCase()}`,
          {
            headers: {
                "Authorization": `Bearer ${token}`,
            }
          }
        );
        if (!res.ok) throw new Error("Failed to fetch devices");
        
        const data = await res.json();
        setDevices(data.data || []);
      } catch (err) {
        console.error("Error fetching devices:", err);
        setError(`Failed to load devices: ${err.message}`);
        setDevices([]);
      } finally {
        setDevicesLoading(false);
      }
    }

    fetchDevicesForSite();
  }, [selectedSite, sites]);

  const deviceColumns = useMemo(() => [
    { 
      accessorKey: "name", 
      header: "Device Name",
      cell: ({ row }) => row.original.name || "N/A"
    },
    { 
      accessorKey: "type", 
      header: "Type",
      cell: ({ row }) => row.original.type || "N/A"
    },
    { 
      accessorKey: "model", 
      header: "Model",
      cell: ({ row }) => row.original.model || "N/A"
    },
    { 
      accessorKey: "status", 
      header: "Status",
      cell: ({ row }) => {
        const status = row.original.status;
        const statusClass = status === 'Online' 
          ? 'text-green-400 font-bold' 
          : status === 'Offline' 
            ? 'text-red-400 font-bold' 
            : 'text-yellow-400 font-bold';
        
        return <span className={statusClass}>{status || "Unknown"}</span>;
      }
    },
    { 
      accessorKey: "ipAddress", 
      header: "IP Address",
      cell: ({ row }) => row.original.ipAddress || "N/A"
    },
    { 
      accessorKey: "macAddress", 
      header: "MAC Address",
      cell: ({ row }) => row.original.macAddress || "N/A"
    },
  ], []);

  const deviceTable = useReactTable({ 
    data: devices, 
    columns: deviceColumns, 
    getCoreRowModel: getCoreRowModel() 
  });

  // Get selected site info
  const selectedSiteInfo = selectedSite 
    ? sites.find(site => site.siteId === selectedSite) 
    : null;

  // Handle site selection from SiteList
  const handleSiteSelect = (siteId) => {
    setSelectedSite(siteId);
  };

  // Handle site search term change
  const handleSiteSearchChange = (term) => {
    setSiteSearchTerm(term);
  };

  // Calculate device statistics
  const deviceStats = useMemo(() => {
    const onlineCount = devices.filter(d => d.status === 'Online').length;
    const offlineCount = devices.filter(d => d.status === 'Offline').length;
    const totalCount = devices.length;
    
    return { onlineCount, offlineCount, totalCount };
  }, [devices]);

  return (
    <main className="p-4 sm:p-8 bg-gradient-to-br from-gray-900 via-gray-800 to-black min-h-screen text-white">
      <div className="container mx-auto flex flex-col md:flex-row md:gap-6">
        {/* Left Column - SiteList Component */}
        <div className="w-full md:w-1/3 mb-4 md:mb-0 mt-2">
          <SiteList 
            sites={sites}
            loading={loading}
            error={error}
            selectedSite={selectedSite}
            searchTerm={siteSearchTerm}
            onSiteSelect={handleSiteSelect}
            onSearchChange={handleSiteSearchChange}
          />
        </div>

        {/* Right Column - Site Devices List */}
        <div className="w-full md:w-2/3 bg-white/10 p-4 rounded-xl shadow-lg mt-2 flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Site Devices</h2>
          </div>

          <div className="flex-1 min-h-[400px]">
            <div className="h-full">
              <div className="mb-4">
                {selectedSite ? (
                  <div>
                    <h3 className="text-lg font-medium mb-2">
                      Devices for: {selectedSiteInfo?.name} 
                      <span className={`ml-2 text-sm px-2 py-1 rounded ${
                        selectedSiteInfo?.vendor?.toLowerCase() === 'ruijie' 
                          ? 'bg-blue-500 text-white' 
                          : selectedSiteInfo?.vendor?.toLowerCase() === 'huawei'
                          ? 'bg-red-500 text-white'
                          : 'bg-gray-500 text-white'
                      }`}>
                        {selectedSiteInfo?.vendor}
                      </span>
                      <button
                        onClick={() => setSelectedSite(null)}
                        className="ml-2 px-2 py-1 bg-gray-600 rounded text-sm hover:bg-gray-500 transition"
                        title="Click to deselect site"
                      >
                        X
                      </button>
                    </h3>
                    
                    {/* Device Statistics */}
                    <div className="flex gap-4 mb-3 text-sm">
                      <div className="flex items-center">
                        <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
                        <span className="text-green-400">Online: {deviceStats.onlineCount}</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-3 h-3 rounded-full bg-red-500 mr-2"></div>
                        <span className="text-red-400">Offline: {deviceStats.offlineCount}</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
                        <span className="text-blue-400">Total: {deviceStats.totalCount}</span>
                      </div>
                    </div>
                    
                    <p className="text-sm text-gray-400">
                      Showing {devices.length} device(s)
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-400 mb-2">Please select a site to view its devices</p>
                    <p className="text-sm text-gray-500">
                      Click on any site in the left panel to load its devices
                    </p>
                  </div>
                )}
              </div>
              
              {devicesLoading ? (
                <div className="flex flex-col items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mb-2"></div>
                  <p className="text-gray-400">Loading devices...</p>
                </div>
              ) : devices.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32">
                  <p className="text-gray-400 mb-2">
                    {selectedSite ? 'No devices found for this site' : 'No site selected'}
                  </p>
                  {selectedSite && (
                    <p className="text-sm text-gray-500">
                      This site may not have any registered devices
                    </p>
                  )}
                </div>
              ) : (
                <div className="overflow-y-auto max-h-[600px]">
                  <table className="min-w-full border-collapse">
                    <thead>
                      {deviceTable.getHeaderGroups().map(headerGroup => (
                        <tr key={headerGroup.id} className="bg-white/20 sticky top-0">
                          {headerGroup.headers.map(header => (
                            <th key={header.id} className="px-3 py-2 text-left text-gray-200">
                              {flexRender(header.column.columnDef.header, header.getContext())}
                            </th>
                          ))}
                        </tr>
                      ))}
                    </thead>
                    <tbody>
                      {deviceTable.getRowModel().rows.map((row, index) => {
                        const rowBg = index % 2 === 0 ? "bg-white/10" : "bg-white/5";
                        
                        return (
                          <tr
                            key={row.original.id || `device-${index}`}
                            className={`${rowBg} hover:bg-white/20 transition`}
                          >
                            {row.getVisibleCells().map(cell => (
                              <td 
                                key={cell.id} 
                                className="px-3 py-2"
                              >
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  
                  {/* Footer Stats */}
                  <div className="mt-4 pt-4 border-t border-white/20 text-xs text-gray-400">
                    <div className="flex justify-between">
                      <span>Showing {devices.length} devices</span>
                      <span className="text-green-400">Online: {deviceStats.onlineCount}</span>
                      <span className="text-red-400">Offline: {deviceStats.offlineCount}</span>
                      <span>Availability: {deviceStats.totalCount > 0 
                        ? `${((deviceStats.onlineCount / deviceStats.totalCount) * 100).toFixed(1)}%` 
                        : '0%'}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}