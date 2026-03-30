'use client';

import { useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from "@tanstack/react-table";
import { Search } from "lucide-react";
import { motion } from 'framer-motion';

// Helper function to parse site name and code from full name
const parseSiteInfo = (siteName) => {
  if (!siteName) return { siteName: '', siteCode: '' };
  
  // Pattern: "PICS-P2-L3 Atty. Roque A. Marcos_MS-Lapaz"
  // Site Code: "PICS-P2-L3"
  // Site Name: "Atty. Roque A. Marcos_MS-Lapaz"
  
  const parts = siteName.trim().split(' ');
  
  if (parts.length >= 2) {
    // Check if first part looks like a site code (contains PICS or similar pattern)
    const firstPart = parts[0];
    const isSiteCode = /^(WINS|SITE|LOC)-?[A-Z0-9-]+$/i.test(firstPart);
    
    if (isSiteCode) {
      return {
        siteCode: firstPart,
        siteName: parts.slice(1).join(' ')
      };
    }
  }
  
  // If no clear pattern, use the whole string as site name
  return {
    siteCode: '',
    siteName: siteName
  };
};

export default function SiteList({ 
  sites = [], 
  loading = false, 
  error = null, 
  selectedSite = null,
  searchTerm = "",
  onSiteSelect = () => {},
  onSearchChange = () => {}
}) {
  
  // Filter sites based on search term
  const filteredSites = useMemo(() => {
    if (!searchTerm) return sites;

    return sites.filter(site => {
      const lower = searchTerm.toLowerCase();

      // Use raw "name" field too
      const rawName = site.name?.toLowerCase() || "";

      return (
        rawName.includes(lower) ||
        site.displayName?.toLowerCase().includes(lower) ||
        site.siteCode?.toLowerCase().includes(lower) ||
        site.vendor?.toLowerCase().includes(lower)
      );
    });
  }, [sites, searchTerm]);


  // Normalize sites data for display
  const normalizedSites = useMemo(() => {
    return (filteredSites || []).map(site => {
      // Parse site name and code from the full name if not already done
      const parsedInfo = parseSiteInfo(site.name || '');
      
      return {
        siteId: site.siteId || site.id || site.groupId || Math.random().toString(36),
        displayName: site.displayName || parsedInfo.siteName || site.name || "Unnamed Site",
        siteCode: site.siteCode || parsedInfo.siteCode || '',
        vendor: site.vendor || "Unknown",
        latitude: site.latitude || site.lat || 11.0,
        longitude: site.longitude || site.lon || 125.0,
        rawData: site // Keep original data for reference
      };
    });
  }, [filteredSites]);

  // Update columns to show both name and code
  const columns = useMemo(() => [
    { 
      accessorKey: "displayName", 
      header: "Site Name",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.original.displayName}</span>
          {row.original.siteCode && (
            <span className="text-xs text-gray-300 mt-1">Code: {row.original.siteCode}</span>
          )}
        </div>
      )
    }
  ], []);

  const table = useReactTable({ 
    data: normalizedSites, 
    columns, 
    getCoreRowModel: getCoreRowModel() 
  });

  // Handle row click
  const handleRowClick = (siteId) => {
    onSiteSelect(siteId);
  };

  return (
    <div className="w-full h-full bg-white/10 p-4 rounded-xl shadow-lg flex flex-col">
      {/* Header with title and search bar */}
      <div className="flex flex-col mb-4">
        <h2 className="text-xl font-semibold mb-3">Site List</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search sites, codes, or vendors..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
        </div>
        {/* Search results count */}
        {searchTerm && (
          <div className="text-sm text-gray-400 mt-2">
            Found {filteredSites.length} site{filteredSites.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mb-2"></div>
            <p className="text-gray-400">Loading sites...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="flex-1 flex items-center justify-center">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center p-4 bg-red-500/20 rounded-lg border border-red-500/30"
          >
            <p className="text-red-400 font-medium mb-2">Error Loading Sites</p>
            <p className="text-red-300 text-sm">{error}</p>
          </motion.div>
        </div>
      )}

      {/* Site List Table - Scrollable Container */}
      {!loading && !error && (
        <div className="overflow-y-auto max-h-[800px] flex-1">
          <table className="min-w-full border-collapse">
            <thead>
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id} className="bg-white/20">
                  {headerGroup.headers.map(header => (
                    <th key={header.id} className="px-3 py-2 text-left text-gray-200 sticky top-0 bg-white/20 z-10">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row, index) => {
                const isSelected = selectedSite === row.original.siteId;
                const rowBg = index % 2 === 0 ? "bg-white/10" : "bg-white/5";
                
                return (
                  <tr
                    key={row.original.siteId}
                    onClick={() => handleRowClick(row.original.siteId)}
                    className={`cursor-pointer transition ${rowBg} ${isSelected ? "bg-green-500 text-black font-semibold" : ""} hover:bg-white/20`}
                  >
                    <td className="px-3 py-2">
                      <div className="flex justify-between items-center">
                        <div className="flex flex-col">
                          <span>{row.original.displayName}</span>
                          {row.original.siteCode && (
                            <span className="text-xs text-gray-300 mt-1">Code: {row.original.siteCode}</span>
                          )}
                        </div>
                        <span className={`text-xs px-2 py-1 rounded ${
                          row.original.vendor?.toLowerCase() === 'ruijie' 
                            ? 'bg-blue-500' 
                            : row.original.vendor?.toLowerCase() === 'huawei'
                            ? 'bg-red-500'
                            : 'bg-gray-500'
                        }`}>
                          {row.original.vendor}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          
          {/* Empty State */}
          {normalizedSites.length === 0 && !loading && (
            <div className="text-center text-gray-400 py-8">
              No sites found matching your search
            </div>
          )}
        </div>
      )}

      {/* Footer Stats */}
      {!loading && !error && normalizedSites.length > 0 && (
        <div className="mt-4 pt-4 border-t border-white/20 text-xs text-gray-400">
          <div className="flex justify-between">
            <span>Total Sites: {sites.length}</span>
            <span>Showing: {normalizedSites.length}</span>
            <span>Selected: {selectedSite ? '1' : 'None'}</span>
          </div>
        </div>
      )}
    </div>
  );
}