'use client';

import { useEffect, useState, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from "@tanstack/react-table";
import SiteList from "@/components/SiteList";

export default function SiteClients() {
  const [sites, setSites] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedSite, setSelectedSite] = useState(null);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [siteSearchTerm, setSiteSearchTerm] = useState("");
  const [clientSearchTerm, setClientSearchTerm] = useState("");
  const token = localStorage.getItem('token');

  useEffect(() => {
    async function fetchSites() {
      try {
        const res = await fetch("/api/sites", {
          headers: {
            "Authorization": `Bearer ${token}`,
          }
        });
        if (!res.ok) throw new Error("Failed to fetch sites");
        const data = await res.json();
        const normalized = (data.data || []).map(site => ({
          siteId: site.id || site.siteId || site.groupId || Math.random().toString(36),
          name: site.name || "Unnamed Site",
          vendor: site.vendor || "Unknown",
          groupId: site.groupId || site.siteId || site.id,
          latitude: site.latitude || site.lat || 14.5995,
          longitude: site.longitude || site.lon || 120.9842,
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

  // Fetch clients when a site is selected
  useEffect(() => {
    if (!selectedSite) {
      setClients([]);
      setSelectedVendor(null);
      return;
    }

    async function fetchClientsForSite() {
      setClientsLoading(true);
      try {
        const site = sites.find(s => s.siteId === selectedSite);
        if (!site) return;

        const vendor = site.vendor?.toLowerCase();
        setSelectedVendor(vendor);

        // Determine URL
        let url = '';
        let params = new URLSearchParams();

        if (vendor === 'omada') {
          url = `/api/clients/omada?siteId=${encodeURIComponent(site.groupId)}`;
        } else if (vendor === 'ruijie') {
          url = `/api/clients/ruijie?buildingName=${encodeURIComponent(site.name)}`;
        } else {
          url = `/api/clients?vendor=${vendor}`;
          if (site.groupId) {
            params.append('siteId', site.groupId);
          }
        }

        // Add headers properly as second argument
        const res = await fetch(url, {
          headers: {
            "Authorization": `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.error || `Failed to fetch ${vendor} clients`);
        }

        const data = await res.json();
        setClients(data.data || []);

      } catch (err) {
        console.error("Error fetching clients:", err);
        setError(`Failed to load clients: ${err.message}`);
        setClients([]);
        setSelectedVendor(null);
      } finally {
        setClientsLoading(false);
      }
    }

    fetchClientsForSite();
  }, [selectedSite, sites]);

  // Filter clients based on search term
  const filteredClients = useMemo(() => {
    if (!clientSearchTerm) return clients;
    return clients.filter(client =>
      (client.name && client.name.toLowerCase().includes(clientSearchTerm.toLowerCase())) ||
      (client.userName && client.userName.toLowerCase().includes(clientSearchTerm.toLowerCase())) ||
      (client.hostName && client.hostName.toLowerCase().includes(clientSearchTerm.toLowerCase())) ||
      (client.mac && client.mac.toLowerCase().includes(clientSearchTerm.toLowerCase())) ||
      (client.terminalMac && client.terminalMac.toLowerCase().includes(clientSearchTerm.toLowerCase())) ||
      (client.ip && client.ip.toLowerCase().includes(clientSearchTerm.toLowerCase())) ||
      (client.userIp && client.userIp.toLowerCase().includes(clientSearchTerm.toLowerCase())) ||
      (client.onlineuserTerminalIp && client.onlineuserTerminalIp.toLowerCase().includes(clientSearchTerm.toLowerCase())) ||
      (client.ssid && client.ssid.toLowerCase().includes(clientSearchTerm.toLowerCase())) ||
      (client.deviceType && client.deviceType.toLowerCase().includes(clientSearchTerm.toLowerCase())) ||
      (client.connectType && client.connectType.toLowerCase().includes(clientSearchTerm.toLowerCase())) ||
      (client.apName && client.apName.toLowerCase().includes(clientSearchTerm.toLowerCase()))
    );
  }, [clients, clientSearchTerm]);

  const clientColumns = useMemo(() => {
    const baseColumns = [
      { 
        accessorKey: "name", 
        header: "Client Name",
        cell: ({ row }) => {
          const client = row.original;
          const vendor = client.vendor?.toLowerCase();
          
          if (vendor === 'omada') {
            return client.name || client.hostName || formatMacAddress(client.mac) || 'N/A';
          } else if (vendor === 'ruijie') {
            const userName = client.userName;
            if (userName && userName !== "~anonymous" && userName.trim() !== "") {
              return userName;
            }
            return formatMacAddress(client.terminalMac ?? client.mac) || 'N/A';
          }
          return formatMacAddress(client.mac) || 'N/A';
        }
      },
      { 
        accessorKey: "mac", 
        header: "MAC Address",
        cell: ({ row }) => {
          const client = row.original;
          const mac = client.terminalMac ?? client.mac;
          return formatMacAddress(mac);
        }
      },
      { 
        accessorKey: "ip", 
        header: "IP Address",
        cell: ({ row }) => {
          const client = row.original;
          if (client.vendor?.toLowerCase() === 'omada') {
            return client.ip || 'N/A';
          } else {
            return client.onlineuserTerminalIp ?? client.userIp ?? client.ip ?? 'N/A';
          }
        }
      },
      { 
        accessorKey: "ssid", 
        header: "SSID",
        cell: ({ row }) => {
          const client = row.original;
          return client.ssid || 'N/A';
        }
      },
    ];

    // Add vendor-specific columns
    if (selectedVendor === 'omada') {
      return [
        ...baseColumns,
        { 
          accessorKey: "apName", 
          header: "AP Name",
          cell: ({ row }) => {
            return row.original.apName || 'N/A';
          }
        },
        { 
          accessorKey: "vendor", 
          header: "Vendor",
          cell: ({ row }) => {
            return row.original.vendor || 'Unknown';
          }
        },
      ];
    } else if (selectedVendor === 'ruijie') {
      return [
        ...baseColumns,
        { 
          accessorKey: "deviceAliasName", 
          header: "AP Name",
          cell: ({ row }) => {
            return row.original.deviceAliasName || 'Unknown';
          }
        },
        { 
          accessorKey: "vendor", 
          header: "Vendor",
          cell: ({ row }) => {
            return row.original.vendor || 'Unknown';
          }
        },
      ];
    }

    return baseColumns;
  }, [selectedVendor]);

  // Helper function to format MAC address
  const formatMacAddress = (mac) => {
    if (!mac) return 'N/A';
    
    // Remove dots and convert to uppercase
    const cleanMac = mac.replace(/[\.:-]/g, '').toUpperCase();
    
    // Format as XX:XX:XX:XX:XX:XX
    if (cleanMac.length === 12) {
      return cleanMac.match(/.{1,2}/g)?.join(':') || cleanMac;
    }
    
    // If already in another format, return as is
    return mac;
  };

  const clientTable = useReactTable({ 
    data: filteredClients, 
    columns: clientColumns, 
    getCoreRowModel: getCoreRowModel() 
  });

  // Get selected site info
  const selectedSiteInfo = selectedSite 
    ? sites.find(site => site.siteId === selectedSite) 
    : null;

  // Handle site selection from SiteList
  const handleSiteSelect = (siteId) => {
    setSelectedSite(siteId);
    setClientSearchTerm('');
  };

  // Handle site search term change
  const handleSiteSearchChange = (term) => {
    setSiteSearchTerm(term);
  };

  // Get vendor color class
  const getVendorColor = (vendor) => {
    const vendorLower = vendor?.toLowerCase();
    switch (vendorLower) {
      case 'omada':
        return 'bg-green-600 text-white';
      case 'ruijie':
        return 'bg-blue-600 text-white';
      case 'huawei':
        return 'bg-red-600 text-white';
      default:
        return 'bg-gray-600 text-white';
    }
  };

  // Handle deselect site
  const handleDeselectSite = () => {
    setSelectedSite(null);
    setSelectedVendor(null);
    setClientSearchTerm('');
    setClients([]);
  };

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

        {/* Right Column - Site Clients List */}
        <div className="w-full md:w-2/3 bg-white/10 p-4 rounded-xl shadow-lg mt-2 flex flex-col">
          {/* Clients Header */}
          <div className="flex flex-col mb-4">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-xl font-semibold">Site Clients</h2>
            </div>
          </div>

          <div className="flex-1 min-h-[400px]">
            <div className="h-full">
              <div className="mb-4">
                {selectedSite ? (
                  <div>
                    <div className="flex items-center mb-2">
                      <h3 className="text-lg font-medium">
                        {selectedVendor?.toUpperCase()} Clients for: {selectedSiteInfo?.name} 
                      </h3>
                      <span className={`ml-2 text-sm px-2 py-1 rounded ${getVendorColor(selectedSiteInfo?.vendor)}`}>
                        {selectedSiteInfo?.vendor}
                      </span>
                      <button
                        onClick={handleDeselectSite}
                        className="ml-2 px-2 py-1 bg-gray-600 rounded text-sm hover:bg-gray-500 transition"
                        title="Click to deselect site"
                      >
                        X
                      </button>
                    </div>
                    <p className="text-sm text-gray-400">
                      {clientsLoading ? (
                        <span className="animate-pulse">Loading {selectedVendor} clients...</span>
                      ) : (
                        <>
                          {clients.length} {selectedVendor} client(s) found {clientSearchTerm && `(${filteredClients.length} filtered)`}
                        </>
                      )}
                    </p>
                  </div>
                ) : (
                  <p className="text-gray-400">Please select a site to view its clients.</p>
                )}
              </div>
              
              {clientsLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="flex flex-col items-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-2"></div>
                    <p className="text-gray-400">Loading {selectedVendor} clients...</p>
                  </div>
                </div>
              ) : filteredClients.length === 0 ? (
                <div className="flex items-center justify-center h-32">
                  <p className="text-gray-400">
                    {selectedSite 
                      ? clientSearchTerm 
                        ? `No ${selectedVendor} clients found matching your search` 
                        : `No ${selectedVendor} clients found for this site` 
                      : 'No site selected'
                    }
                  </p>
                </div>
              ) : (
                <div className="overflow-y-auto max-h-[600px]">
                  <table className="min-w-full border-collapse">
                    <thead>
                      {clientTable.getHeaderGroups().map(headerGroup => (
                        <tr key={headerGroup.id} className="bg-white/20">
                          {headerGroup.headers.map(header => (
                            <th key={header.id} className="px-3 py-2 text-left text-gray-200">
                              {flexRender(header.column.columnDef.header, header.getContext())}
                            </th>
                          ))}
                        </tr>
                      ))}
                    </thead>
                    <tbody>
                      {clientTable.getRowModel().rows.map((row, index) => {
                        const rowBg = index % 2 === 0 ? "bg-white/10" : "bg-white/5";
                        const client = row.original;
                        
                        return (
                          <tr
                            key={`${selectedSite}-${client.mac || client.terminalMac || client.id || 'client'}-${index}`}
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
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}