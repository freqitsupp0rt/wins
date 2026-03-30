'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { motion } from 'framer-motion';
import logo from '@/resources/logo/dict_logo.png';
import { Loader2, Wand2, X } from "lucide-react";

// Import Chart.js correctly - use named imports for version 4+
import { Chart, registerables } from 'chart.js';

// Import the SiteList component
import SiteList from '@/components/SiteList';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { generateServiceReportPdf } from "@/lib/utils"; //keep this because i moved the function to utils for better organization
import { useAuth } from '@/hooks/useAuth';
import Swal from 'sweetalert2';

// Register dayjs plugins
dayjs.extend(isBetween);
dayjs.extend(customParseFormat);

// Register all Chart.js components
Chart.register(...registerables);

// get auth token
const token = localStorage.getItem('token');

// Helper functions defined BEFORE they're used
const formatLocalDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getFirstDayOfMonth = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
};

const getToday = () => new Date();

// Helper function to convert image to base64
const getBase64FromImageUrl = (url) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = url;
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    
    img.onerror = (error) => {
      reject(error);
    };
  });
};

// Function to convert bytes to appropriate units
const convertBytes = (bytes) => {
  if (bytes === undefined || bytes === null) return { value: 0, unit: "B" };
  if (bytes < 1024) return { value: bytes, unit: "B" };
  if (bytes < 1024 * 1024) return { value: parseFloat((bytes / 1024).toFixed(2)), unit: "KB" };
  if (bytes < 1024 * 1024 * 1024) return { value: parseFloat((bytes / (1024 * 1024)).toFixed(2)), unit: "MB" };
  // Always return GB for larger values with 2 decimal places
  return { value: parseFloat((bytes / (1024 * 1024 * 1024)).toFixed(2)), unit: "GB" };
};

// Function to calculate Service Availability based on users chart data
const calculateServiceAvailability = (usersData, trafficData, blackoutEvents) => {
  if (!usersData || usersData.length === 0) {
    // Return a default value or calculate from traffic data if users data is empty
    if (trafficData && trafficData.length > 0) {
      // Fallback to traffic data if users data is not available
      const totalDays = trafficData.length;
      let daysWithTraffic = 0;
      
      for (let i = 0; i < totalDays; i++) {
        const trafficDay = trafficData[i];
        // Check if day has blackout event
        const hasBlackout = blackoutEvents && blackoutEvents.some(event => {
          const eventStart = dayjs(event.start);
          const eventEnd = dayjs(event.end);
          const itemDate = dayjs(trafficDay.date);
          return itemDate.isBetween(eventStart, eventEnd, null, '[]');
        });
        
        if (hasBlackout) continue;
        
        // Changed: Check for GB instead of MB
        const hasTraffic = trafficDay && (trafficDay.rxGB > 0 || trafficDay.txGB > 0);
        if (hasTraffic) {
          daysWithTraffic++;
        }
      }
      
      const percentage = (daysWithTraffic / totalDays) * 100;
      const formattedPercentage = Math.min(100, Math.max(0, percentage)).toFixed(2);
      return `${formattedPercentage}%`;
    }
    return '98.5%'; // Default fallback
  }
  
  const totalDays = usersData.length;
  let daysWithActiveUsers = 0;
  
  // Check each day's users data
  for (let i = 0; i < totalDays; i++) {
    const userDay = usersData[i];
    
    // Check if day has blackout event
    const hasBlackout = blackoutEvents && blackoutEvents.some(event => {
      const eventStart = dayjs(event.start);
      const eventEnd = dayjs(event.end);
      const itemDate = dayjs(userDay.date);
      return itemDate.isBetween(eventStart, eventEnd, null, '[]');
    });
    
    // If blackout, skip this day (counts as 0 for availability)
    if (hasBlackout) {
      continue;
    }
    
    // Check if there are active users (activeTotal > 0)
    // You can adjust this threshold as needed
    const hasActiveUsers = userDay && userDay.activeTotal > 0;
    
    if (hasActiveUsers) {
      daysWithActiveUsers++;
    }
  }
  
  // Calculate percentage based on days with active users
  const percentage = (daysWithActiveUsers / totalDays) * 100;
  
  // if the Service Availability is 99.xx, make it 100
  if (percentage > 99 && percentage < 100) {
    return '100.00%';
  }

  // Format with 2 decimal places
  const formattedPercentage = Math.min(100, Math.max(0, percentage)).toFixed(2);
  
  return `${formattedPercentage}%`;
};

const extractSiteCodeAndName = (fullSiteName) => {
  const match = fullSiteName.match(/^(\S+)\s(.+)/); // Match the first word as site code and the rest as site name
  if (match) {
      return {
          siteCode: match[1],
          siteName: match[2]
      };
  }
  return { siteCode: '', siteName: fullSiteName }; // Fallback if no match
};

// Function to expand the abbreviation in site name
const expandSiteType = (siteName) => {
  if (!siteName) return siteName;
  
  const abbreviations = {
    'ES': 'Elementary School',
    'NHS': 'National High School',
    'CC': 'Covered Court',
    'MP': 'Municipal Plaza',
    'MH': 'Municipal Hall',
    'IS': 'Integrated School'
  };
  
  // Common separators that might be used
  const separators = ['_', '-', ' ', '.'];
  
  let expandedName = siteName;
  
  // Check each abbreviation
  for (const [abbr, fullName] of Object.entries(abbreviations)) {
    // Try to find the abbreviation in the string (case-insensitive)
    const index = siteName.toLowerCase().indexOf(abbr.toLowerCase());
    
    if (index !== -1) {
      // Check if it's at the end of the string or followed by a separator/end of string
      const afterAbbr = siteName.slice(index + abbr.length);
      const isAtEnd = afterAbbr === '' || separators.some(sep => afterAbbr.startsWith(sep));
      
      if (isAtEnd) {
        // Replace the abbreviation (preserving the original case)
        const beforeAbbr = siteName.slice(0, index);
        const afterAbbr = siteName.slice(index + abbr.length);
        expandedName = beforeAbbr + fullName + afterAbbr;
        break;
      }
    }
  }
  
  return expandedName;
};

const EditPointModal = ({ item, onSave, onClose }) => {
  const [formData, setFormData] = useState({ ...item });

  const handleChange = (field, value) => {
      let val = Number(value);
      if (val < 0) val = 0;
      setFormData(prev => ({ ...prev, [field]: val }));
  };

  const handleTrafficChange = (field, gbValue) => {
      let val = parseFloat(gbValue || 0);
      if (val < 0) val = 0;
      const bytes = Math.round(val * 1024 * 1024 * 1024);
      setFormData(prev => ({ ...prev, [field]: bytes }));
  };

  return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-[2px]">
          <div className="bg-gray-800 border border-white/10 rounded-lg shadow-xl p-6 w-full max-w-md">
              <h4 className="text-lg font-bold text-white mb-4">
                  Edit Data: {dayjs(item.date).format('MMM D, YYYY')}
              </h4>
              
              <div className="space-y-4">
                  {item.data_type === 'users' ? (
                      <>
                          <div>
                              <label className="block text-sm text-gray-400 mb-1">Total Users</label>
                              <input 
                                  type="number" 
                                  min="0"
                                  value={formData.total_users}
                                  onChange={(e) => handleChange('total_users', e.target.value)}
                                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                              />
                          </div>
                          <div>
                              <label className="block text-sm text-gray-400 mb-1">Active Users</label>
                              <input 
                                  type="number" 
                                  min="0"
                                  value={formData.active_users}
                                  onChange={(e) => handleChange('active_users', e.target.value)}
                                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                              />
                          </div>
                      </>
                  ) : (
                      <>
                          <div>
                              <label className="block text-sm text-gray-400 mb-1">Download (GB)</label>
                              <input 
                                  type="number" 
                                  min="0"
                                  step="0.01"
                                  value={(formData.download_bytes / (1024 * 1024 * 1024)).toFixed(2)}
                                  onChange={(e) => handleTrafficChange('download_bytes', e.target.value)}
                                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                              />
                          </div>
                          <div>
                              <label className="block text-sm text-gray-400 mb-1">Upload (GB)</label>
                              <input 
                                  type="number" 
                                  min="0"
                                  step="0.01"
                                  value={(formData.upload_bytes / (1024 * 1024 * 1024)).toFixed(2)}
                                  onChange={(e) => handleTrafficChange('upload_bytes', e.target.value)}
                                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                              />
                          </div>
                      </>
                  )}
              </div>

              <div className="flex justify-end gap-3 mt-6">
                  <button onClick={onClose} className="px-4 py-2 text-gray-300 hover:text-white hover:bg-white/10 rounded transition-colors">
                      Cancel
                  </button>
                  <button onClick={() => onSave(formData)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium">
                      Save Changes
                  </button>
              </div>
          </div>
      </div>
  );
};

const PreviewModal = ({ isOpen, onClose, onConfirm, originalData, previewData, isSaving, gaps, siteForm }) => {
  const usersCanvasRef = useRef(null);
  const trafficCanvasRef = useRef(null);
  const chartInstancesRef = useRef([]);
  const [localData, setLocalData] = useState([]);
  const [activeTab, setActiveTab] = useState('charts');
  const [editingIndex, setEditingIndex] = useState(null);
  const [randomizeTrend, setRandomizeTrend] = useState('weekday/weekend');
  
  // Interactive Chart Refs & State
  const interactiveCanvasRef = useRef(null);
  const interactiveChartRef = useRef(null);
  const [interactiveMetric, setInteractiveMetric] = useState('users');
  const dragState = useRef({ isDragging: false, datasetIndex: null, dataIndex: null, previewIndex: null });

  useEffect(() => {
    if (isOpen && previewData) {
      setLocalData(JSON.parse(JSON.stringify(previewData)));
    }
  }, [isOpen, previewData]);

  useEffect(() => {
    if (isOpen && originalData && localData.length > 0 && activeTab === 'charts') {
      // Destroy old charts
      chartInstancesRef.current.forEach(c => c.destroy());
      chartInstancesRef.current = [];

      // Merge data for preview
      // Create a map of preview data for fast lookup
      const previewMap = new Map();
      localData.forEach((item, index) => {
        // Normalize date key to YYYYMMDD
        const dateKey = dayjs(item.date).format("YYYYMMDD");
        previewMap.set(`${dateKey}-${item.data_type}`, { ...item, _index: index });
      });

      const mergedUsers = originalData.usersData.map(d => {
        const dateKey = d.time || d.timeString;
        const p = previewMap.get(`${dateKey}-users`);
        return p ? { ...d, total: p.total_users, activeTotal: p.active_users, _previewIndex: p._index } : d;
      });

      const mergedTraffic = originalData.trafficData.map(d => {
        const dateKey = d.time || d.timeString;
        const p = previewMap.get(`${dateKey}-traffic`);
        if (p) {
           const rxGB = parseFloat((p.download_bytes / (1024 * 1024 * 1024)).toFixed(2));
           const txGB = parseFloat((p.upload_bytes / (1024 * 1024 * 1024)).toFixed(2));
           return { ...d, rxGB, txGB, _previewIndex: p._index };
        }
        return d;
      });

      const labels = mergedUsers.map(d => d.displayDate || '');

      // Render Users Chart
      if (usersCanvasRef.current) {
        const ctx = usersCanvasRef.current.getContext('2d');
        chartInstancesRef.current.push(new Chart(ctx, {
          type: 'line',
          data: {
            labels,
            datasets: [
              { label: 'Total Users', data: mergedUsers.map(d => d.total), borderColor: 'rgba(54, 162, 235, 1)', backgroundColor: 'rgba(54, 162, 235, 0.2)', fill: true, tension: 0.3 },
              { label: 'Active Users', data: mergedUsers.map(d => d.activeTotal), borderColor: 'rgba(255, 99, 132, 1)', backgroundColor: 'rgba(255, 99, 132, 0.2)', fill: true, tension: 0.3 }
            ]
          },
          options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { 
              title: { display: true, text: 'Users Activity (Preview)' },
              tooltip: {
                callbacks: {
                  afterLabel: function(context) {
                    const dataIndex = context.dataIndex;
                    const point = mergedUsers[dataIndex];
                    return point._previewIndex !== undefined ? ' (Click to Edit)' : '';
                  }
                }
              }
            },
            onClick: (e, elements) => {
              if (elements && elements.length > 0) {
                const dataIndex = elements[0].index;
                const point = mergedUsers[dataIndex];
                if (point && point._previewIndex !== undefined) {
                  setEditingIndex(point._previewIndex);
                }
              }
            },
            onHover: (e, elements) => {
              if (e.native && e.native.target) {
                e.native.target.style.cursor = elements.length > 0 ? 'pointer' : 'default';
              }
            }
          }
        }));
      }

      // Render Traffic Chart
      if (trafficCanvasRef.current) {
        const ctx = trafficCanvasRef.current.getContext('2d');
        chartInstancesRef.current.push(new Chart(ctx, {
          type: 'line',
          data: {
            labels,
            datasets: [
              { label: 'Tx (GB)', data: mergedTraffic.map(d => d.txGB), borderColor: 'rgba(153, 102, 255, 1)', backgroundColor: 'rgba(153, 102, 255, 0.2)', fill: true, tension: 0.3 },
              { label: 'Rx (GB)', data: mergedTraffic.map(d => d.rxGB), borderColor: 'rgba(75, 192, 192, 1)', backgroundColor: 'rgba(75, 192, 192, 0.2)', fill: true, tension: 0.3 }
            ]
          },
          options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { 
              title: { display: true, text: 'Network Traffic (Preview)' },
              tooltip: {
                callbacks: {
                  afterLabel: function(context) {
                    const dataIndex = context.dataIndex;
                    const point = mergedTraffic[dataIndex];
                    return point._previewIndex !== undefined ? ' (Click to Edit)' : '';
                  }
                }
              }
            },
            onClick: (e, elements) => {
              if (elements && elements.length > 0) {
                const dataIndex = elements[0].index;
                const point = mergedTraffic[dataIndex];
                if (point && point._previewIndex !== undefined) {
                  setEditingIndex(point._previewIndex);
                }
              }
            },
            onHover: (e, elements) => {
              if (e.native && e.native.target) {
                e.native.target.style.cursor = elements.length > 0 ? 'pointer' : 'default';
              }
            }
          }
        }));
      }
    }
  }, [isOpen, originalData, localData, activeTab]);

  // Effect for Interactive Chart
  useEffect(() => {
    if (isOpen && originalData && localData.length > 0 && activeTab === 'interactive') {
        if (interactiveChartRef.current) {
            interactiveChartRef.current.destroy();
        }

        const previewMap = new Map();
        localData.forEach((item, index) => {
            const dateKey = dayjs(item.date).format("YYYYMMDD");
            previewMap.set(`${dateKey}-${item.data_type}`, { ...item, _index: index });
        });

        let chartData;

        if (interactiveMetric === 'users') {
            const mergedUsers = originalData.usersData.map(d => {
                const dateKey = d.time || d.timeString;
                const p = previewMap.get(`${dateKey}-users`);
                return p ? { ...d, total: p.total_users, activeTotal: p.active_users, _previewIndex: p._index } : d;
            });

            chartData = {
                labels: mergedUsers.map(d => d.displayDate || ''),
                datasets: [
                    { 
                        label: 'Total Users', 
                        data: mergedUsers.map(d => d.total), 
                        borderColor: 'rgba(54, 162, 235, 1)', 
                        backgroundColor: 'rgba(54, 162, 235, 0.2)', 
                        pointBackgroundColor: mergedUsers.map(d => d._previewIndex !== undefined ? 'rgba(54, 162, 235, 1)' : 'rgba(200, 200, 200, 0.5)'),
                        pointRadius: mergedUsers.map(d => d._previewIndex !== undefined ? 6 : 3),
                        pointHoverRadius: mergedUsers.map(d => d._previewIndex !== undefined ? 8 : 4),
                        fill: true, 
                        tension: 0.3
                    },
                    { 
                        label: 'Active Users', 
                        data: mergedUsers.map(d => d.activeTotal), 
                        borderColor: 'rgba(255, 99, 132, 1)', 
                        backgroundColor: 'rgba(255, 99, 132, 0.2)',
                        pointBackgroundColor: mergedUsers.map(d => d._previewIndex !== undefined ? 'rgba(255, 99, 132, 1)' : 'rgba(200, 200, 200, 0.5)'),
                        pointRadius: mergedUsers.map(d => d._previewIndex !== undefined ? 6 : 3),
                        pointHoverRadius: mergedUsers.map(d => d._previewIndex !== undefined ? 8 : 4),
                        fill: true, 
                        tension: 0.3 
                    }
                ]
            };
        } else {
            const mergedTraffic = originalData.trafficData.map(d => {
                const dateKey = d.time || d.timeString;
                const p = previewMap.get(`${dateKey}-traffic`);
                if (p) {
                   const rxGB = parseFloat((p.download_bytes / (1024 * 1024 * 1024)).toFixed(2));
                   const txGB = parseFloat((p.upload_bytes / (1024 * 1024 * 1024)).toFixed(2));
                   return { ...d, rxGB, txGB, _previewIndex: p._index };
                }
                return d;
            });

            chartData = {
                labels: mergedTraffic.map(d => d.displayDate || ''),
                datasets: [
                    { 
                        label: 'Tx (GB)', 
                        data: mergedTraffic.map(d => d.txGB), 
                        borderColor: 'rgba(153, 102, 255, 1)', 
                        backgroundColor: 'rgba(153, 102, 255, 0.2)', 
                        pointBackgroundColor: mergedTraffic.map(d => d._previewIndex !== undefined ? 'rgba(153, 102, 255, 1)' : 'rgba(200, 200, 200, 0.5)'),
                        pointRadius: mergedTraffic.map(d => d._previewIndex !== undefined ? 6 : 3),
                        pointHoverRadius: mergedTraffic.map(d => d._previewIndex !== undefined ? 8 : 4),
                        fill: true, 
                        tension: 0.3 
                    },
                    { 
                        label: 'Rx (GB)', 
                        data: mergedTraffic.map(d => d.rxGB), 
                        borderColor: 'rgba(75, 192, 192, 1)', 
                        backgroundColor: 'rgba(75, 192, 192, 0.2)', 
                        pointBackgroundColor: mergedTraffic.map(d => d._previewIndex !== undefined ? 'rgba(75, 192, 192, 1)' : 'rgba(200, 200, 200, 0.5)'),
                        pointRadius: mergedTraffic.map(d => d._previewIndex !== undefined ? 6 : 3),
                        pointHoverRadius: mergedTraffic.map(d => d._previewIndex !== undefined ? 8 : 4),
                        fill: true, 
                        tension: 0.3 
                    }
                ]
            };
        }

        if (interactiveCanvasRef.current) {
            const ctx = interactiveCanvasRef.current.getContext('2d');
            interactiveChartRef.current = new Chart(ctx, {
                type: 'line',
                data: chartData,
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'nearest', axis: 'x', intersect: true },
                    plugins: {
                        title: { display: true, text: `Interactive ${interactiveMetric === 'users' ? 'Users' : 'Traffic'} Editing` },
                        tooltip: { enabled: true }
                    },
                    scales: { y: { beginAtZero: true } },
                    onHover: (e, elements) => {
                        const canvas = e.native.target;
                        if (elements.length > 0) {
                            const { datasetIndex, index } = elements[0];
                            const isEditable = interactiveChartRef.current.data.datasets[datasetIndex].pointRadius[index] === 6;
                            canvas.style.cursor = isEditable ? 'grab' : 'default';
                        } else {
                            canvas.style.cursor = 'default';
                        }
                    }
                }
            });

            const canvas = interactiveCanvasRef.current;
            
            const onMouseDown = (e) => {
                const chart = interactiveChartRef.current;
                if (!chart) return;
                const points = chart.getElementsAtEventForMode(e, 'nearest', { intersect: true }, true);
                if (points.length > 0) {
                    const { index, datasetIndex } = points[0];
                    const dateKey = chart.data.labels[index]; // Note: using displayDate might be ambiguous if not unique, but index is safe
                    
                    // Find preview index
                    let previewIndex = -1;
                    if (interactiveMetric === 'users') {
                         const d = originalData.usersData[index];
                         const p = previewMap.get(`${d.time || d.timeString}-users`);
                         if (p) previewIndex = p._index;
                    } else {
                         const d = originalData.trafficData[index];
                         const p = previewMap.get(`${d.time || d.timeString}-traffic`);
                         if (p) previewIndex = p._index;
                    }

                    if (previewIndex !== -1) {
                        dragState.current = { isDragging: true, datasetIndex, dataIndex: index, previewIndex };
                        canvas.style.cursor = 'grabbing';
                        chart.options.plugins.tooltip.enabled = false;
                    }
                }
            };

            const onMouseMove = (e) => {
                if (!dragState.current.isDragging) return;
                const chart = interactiveChartRef.current;
                const { datasetIndex, dataIndex } = dragState.current;
                const yValue = chart.scales.y.getValueForPixel(e.offsetY);
                chart.data.datasets[datasetIndex].data[dataIndex] = Math.max(0, yValue);
                chart.update('none');
            };

            const onMouseUp = () => {
                if (!dragState.current.isDragging) return;
                const { datasetIndex, dataIndex, previewIndex } = dragState.current;
                const finalValue = interactiveChartRef.current.data.datasets[datasetIndex].data[dataIndex];
                const newData = [...localData];
                const item = { ...newData[previewIndex] };
                
                if (interactiveMetric === 'users') {
                    if (datasetIndex === 0) item.total_users = Math.round(finalValue);
                    if (datasetIndex === 1) item.active_users = Math.round(finalValue);
                } else {
                    const bytes = Math.round(finalValue * 1024 * 1024 * 1024);
                    if (datasetIndex === 0) item.upload_bytes = bytes;
                    if (datasetIndex === 1) item.download_bytes = bytes;
                }
                newData[previewIndex] = item;
                setLocalData(newData);
                dragState.current.isDragging = false;
                canvas.style.cursor = 'default';
                if (interactiveChartRef.current) interactiveChartRef.current.options.plugins.tooltip.enabled = true;
            };

            canvas.addEventListener('mousedown', onMouseDown);
            canvas.addEventListener('mousemove', onMouseMove);
            canvas.addEventListener('mouseup', onMouseUp);
            canvas.addEventListener('mouseleave', onMouseUp);

            return () => {
                if (canvas) {
                    canvas.removeEventListener('mousedown', onMouseDown);
                    canvas.removeEventListener('mousemove', onMouseMove);
                    canvas.removeEventListener('mouseup', onMouseUp);
                    canvas.removeEventListener('mouseleave', onMouseUp);
                }
            };
        }
    }
  }, [isOpen, originalData, localData, activeTab, interactiveMetric]);

  const handleValueChange = (index, field, value) => {
    let val = Number(value);
    if (val < 0) val = 0;
    const newData = [...localData];
    newData[index] = { ...newData[index], [field]: val };
    setLocalData(newData);
  };

  const handleTrafficChange = (index, field, gbValue) => {
    let val = parseFloat(gbValue || 0);
    if (val < 0) val = 0;
    const bytes = Math.round(val * 1024 * 1024 * 1024);
    const newData = [...localData];
    newData[index] = { ...newData[index], [field]: bytes };
    setLocalData(newData);
  };

  const handleReset = () => {
    if (previewData) {
      setLocalData(JSON.parse(JSON.stringify(previewData)));
    }
  };

  const handleModalSave = (updatedItem) => {
    if (editingIndex !== null) {
      const newData = [...localData];
      newData[editingIndex] = updatedItem;
      setLocalData(newData);
      setEditingIndex(null);
    }
  };

  const handleExportTemplate = useCallback(() => {
    if (gaps.length === 0) {
        Swal.fire('No Gaps', 'No missing data points to create a template for.', 'info');
        return;
    }

    const headers = ['date', 'data_type', 'total_users', 'active_users', 'download_bytes', 'upload_bytes'];
    const rows = gaps.flatMap(date => [
        [dayjs(date, 'YYYYMMDD').format('YYYY-MM-DD'), 'users', '', '', '', ''],
        [dayjs(date, 'YYYYMMDD').format('YYYY-MM-DD'), 'traffic', '', '', '', '']
    ]);

    let csvContent = "data:text/csv;charset=utf-8," 
        + headers.join(",") + "\n" 
        + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `wins_population_template_${siteForm.siteCode}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [gaps, siteForm.siteCode]);

  const handleCsvUpload = (event) => {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
          const text = e.target.result;
          try {
              const lines = text.split('\n').filter(line => line.trim() !== '');
              const headers = lines[0].split(',').map(h => h.trim());
              const requiredHeaders = ['date', 'data_type', 'total_users', 'active_users', 'download_bytes', 'upload_bytes'];
              
              if (!requiredHeaders.every(h => headers.includes(h))) {
                  throw new Error('CSV is missing required headers: ' + requiredHeaders.join(', '));
              }

              const uploadedData = lines.slice(1).map(line => {
                  const values = line.split(',');
                  const row = headers.reduce((obj, header, index) => {
                      obj[header] = values[index]?.trim();
                      return obj;
                  }, {});
                  return row;
              });

              const updatedData = [...localData];
              const uploadedMap = new Map();
              uploadedData.forEach(up => {
                  const dateKey = dayjs(up.date, 'YYYY-MM-DD').format('YYYYMMDD');
                  uploadedMap.set(`${dateKey}-${up.data_type}`, up);
              });

              let changesMade = false;
              updatedData.forEach((item, index) => {
                  const dateKey = dayjs(item.date).format('YYYYMMDD');
                  const uploadedItem = uploadedMap.get(`${dateKey}-${item.data_type}`);
                  if (uploadedItem) {
                      changesMade = true;
                      if (item.data_type === 'users') {
                          updatedData[index].total_users = parseInt(uploadedItem.total_users) || item.total_users;
                          updatedData[index].active_users = parseInt(uploadedItem.active_users) || item.active_users;
                      } else if (item.data_type === 'traffic') {
                          updatedData[index].download_bytes = parseInt(uploadedItem.download_bytes) || item.download_bytes;
                          updatedData[index].upload_bytes = parseInt(uploadedItem.upload_bytes) || item.upload_bytes;
                      }
                  }
              });

              if (changesMade) {
                  setLocalData(updatedData);
                  Swal.fire('Success', 'CSV data loaded into preview.', 'success');
              } else {
                  Swal.fire('No Matching Data', 'No matching dates found in the uploaded CSV for the current gaps.', 'info');
              }

          } catch (error) {
              Swal.fire('Error', 'Failed to parse CSV: ' + error.message, 'error');
          }
      };
      reader.readAsText(file);
      event.target.value = '';
  };

  const handleRandomize = (trendType) => {
    const { usersData: rawUsers, trafficData: rawTraffic } = originalData;
    const getUserStat = (key) => {
        const values = rawUsers.filter(d => d[key] > 0 && !d.hasBlackout).map(d => d[key]);
        if (values.length < 2) return { avg: key === 'total' ? 150 : 120, std: key === 'total' ? 30 : 25 };
        const sum = values.reduce((a, b) => a + b, 0);
        const avg = sum / values.length;
        const std = Math.sqrt(values.map(x => Math.pow(x - avg, 2)).reduce((a, b) => a + b, 0) / values.length);
        return { avg, std };
    };
    const getTrafficStat = (key) => {
        const values = rawTraffic.filter(d => d[key] > 0 && !d.hasBlackout).map(d => d[key]);
        if (values.length < 2) return { avg: key === 'originalRxBytes' ? 5e9 : 1e9, std: key === 'originalRxBytes' ? 2e9 : 0.5e9 };
        const sum = values.reduce((a, b) => a + b, 0);
        const avg = sum / values.length;
        const std = Math.sqrt(values.map(x => Math.pow(x - avg, 2)).reduce((a, b) => a + b, 0) / values.length);
        return { avg, std };
    };
    const totalUsersStat = getUserStat('total');
    const activeUsersStat = getUserStat('activeTotal');
    const downloadStat = getTrafficStat('originalRxBytes');
    const uploadStat = getTrafficStat('originalTxBytes');

    let randomizedData;

    if (trendType === 'linear-growth') {
        const uniqueDates = [...new Set(localData.map(item => dayjs(item.date).format('YYYYMMDD')))].sort();
        const numDays = uniqueDates.length;
        const dateIndexMap = new Map(uniqueDates.map((date, index) => [date, index]));

        const getLinearValue = (dayIndex, stat, startMultiplier, endMultiplier) => {
            const startValue = stat.avg * startMultiplier;
            const endValue = stat.avg * endMultiplier;
            const progress = numDays > 1 ? dayIndex / (numDays - 1) : 1;
            const baseValue = startValue + (endValue - startValue) * progress;
            const noise = (Math.random() - 0.5) * stat.std * 0.5; // Smaller noise
            return Math.max(0, baseValue + noise);
        };

        randomizedData = localData.map(item => {
            const newItem = { ...item };
            const dateKey = dayjs(item.date).format('YYYYMMDD');
            const dayIndex = dateIndexMap.get(dateKey) || 0;

            if (item.data_type === 'users') {
                newItem.total_users = Math.round(getLinearValue(dayIndex, totalUsersStat, 0.8, 1.2));
                newItem.active_users = Math.round(getLinearValue(dayIndex, activeUsersStat, 0.8, 1.2));
                newItem.active_users = Math.min(newItem.total_users, newItem.active_users);
            } else if (item.data_type === 'traffic') {
                newItem.download_bytes = Math.round(getLinearValue(dayIndex, downloadStat, 0.7, 1.3));
                newItem.upload_bytes = Math.round(getLinearValue(dayIndex, uploadStat, 0.7, 1.3));
            }
            return newItem;
        });
    } else { // Default to 'weekday/weekend'
        randomizedData = localData.map(item => {
            const date = dayjs(item.date);
            const dayOfWeek = date.day();
            const weekendMultiplier = (dayOfWeek === 0 || dayOfWeek === 6) ? 1.2 : 1.0;
            const dailyMultiplier = 0.9 + Math.random() * 0.2;
            const newItem = { ...item };
            if (item.data_type === 'users') {
                let randomTotal = Math.max(0, totalUsersStat.avg + (Math.random() - 0.5) * 2 * totalUsersStat.std);
                randomTotal *= weekendMultiplier * dailyMultiplier;
                newItem.total_users = Math.round(randomTotal);
                let randomActive = Math.max(0, activeUsersStat.avg + (Math.random() - 0.5) * 2 * activeUsersStat.std);
                randomActive *= weekendMultiplier * dailyMultiplier;
                newItem.active_users = Math.min(newItem.total_users, Math.round(randomActive));
            } else if (item.data_type === 'traffic') {
                let randomDownload = Math.max(0, downloadStat.avg + (Math.random() - 0.5) * 2 * downloadStat.std);
                randomDownload *= weekendMultiplier * dailyMultiplier;
                newItem.download_bytes = Math.round(randomDownload);
                let randomUpload = Math.max(0, uploadStat.avg + (Math.random() - 0.5) * 2 * uploadStat.std);
                randomUpload *= weekendMultiplier * dailyMultiplier;
                newItem.upload_bytes = Math.round(randomUpload);
            }
            return newItem;
        });
    }
    setLocalData(randomizedData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-white/10 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col">
        <div className="p-4 border-b border-white/10 flex justify-between items-center sticky top-0 bg-gray-900 z-10">
          <h3 className="text-xl font-bold text-white">Preview Data Population</h3>
          <div className="flex items-center gap-3">
             <div className="flex items-center gap-2">
                <select
                    value={randomizeTrend}
                    onChange={(e) => setRandomizeTrend(e.target.value)}
                    className="px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-xs text-white focus:ring-1 focus:ring-purple-500 outline-none"
                >
                    <option value="weekday/weekend">Weekday/Weekend</option>
                    <option value="linear-growth">Linear Growth</option>
                </select>
                <button
                    onClick={() => handleRandomize(randomizeTrend)}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded font-medium transition-colors"
                >
                    Randomize
                </button>
             </div>
             <div className="flex bg-gray-800 rounded-lg p-1">
                <button 
                    onClick={() => setActiveTab('charts')}
                    className={`px-3 py-1 rounded-md text-sm transition-colors ${activeTab === 'charts' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                    Charts
                </button>
                <button 
                    onClick={() => setActiveTab('table')}
                    className={`px-3 py-1 rounded-md text-sm transition-colors ${activeTab === 'table' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                    Edit Data
                </button>
                <button 
                    onClick={() => setActiveTab('interactive')}
                    className={`px-3 py-1 rounded-md text-sm transition-colors ${activeTab === 'interactive' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                    Interactive
                </button>
                <button 
                    onClick={() => setActiveTab('csv')}
                    className={`px-3 py-1 rounded-md text-sm transition-colors ${activeTab === 'csv' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                    CSV
                </button>
             </div>
             <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={24} /></button>
          </div>
        </div>
        
        <div className="p-6 space-y-6 flex-1 overflow-y-auto">
          {activeTab === 'charts' ? (
            <>
              <div className="h-64 w-full bg-white/5 rounded-lg p-2">
                <canvas ref={usersCanvasRef}></canvas>
              </div>
              <div className="h-64 w-full bg-white/5 rounded-lg p-2">
                <canvas ref={trafficCanvasRef}></canvas>
              </div>
            </>
          ) : activeTab === 'table' ? (
            <div className="overflow-x-auto">
                <div className="flex justify-end mb-2">
                    <button 
                        onClick={handleReset}
                        className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
                    >
                        Reset to Original
                    </button>
                </div>
                <table className="w-full text-sm text-left text-gray-300">
                    <thead className="text-xs text-gray-400 uppercase bg-gray-800">
                        <tr>
                            <th className="px-4 py-3">Date</th>
                            <th className="px-4 py-3">Type</th>
                            <th className="px-4 py-3">Metrics</th>
                        </tr>
                    </thead>
                    <tbody>
                        {localData.map((item, index) => {
                            const isModified = previewData && (
                                previewData[index].total_users !== item.total_users ||
                                previewData[index].active_users !== item.active_users ||
                                previewData[index].download_bytes !== item.download_bytes ||
                                previewData[index].upload_bytes !== item.upload_bytes
                            );
                            return (
                            <tr key={index} className={`border-b border-gray-800 hover:bg-gray-800/50 ${isModified ? 'bg-yellow-500/10' : ''}`}>
                                <td className="px-4 py-3 font-medium">
                                    {dayjs(item.date).format('MMM D, YYYY (dddd)')}
                                </td>
                                <td className="px-4 py-3">
                                    <span className={`px-2 py-1 rounded text-xs ${item.data_type === 'users' ? 'bg-blue-900/50 text-blue-300' : 'bg-purple-900/50 text-purple-300'}`}>
                                        {item.data_type}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    {item.data_type === 'users' ? (
                                        <div className="flex gap-4">
                                            <div className="flex flex-col">
                                                <label className="text-xs text-gray-500 mb-1">Total Users</label>
                                                <input 
                                                    type="number" 
                                                    min="0"
                                                    value={item.total_users}
                                                    onChange={(e) => handleValueChange(index, 'total_users', e.target.value)}
                                                    className="bg-gray-700 border border-gray-600 rounded px-2 py-1 w-24 text-white focus:ring-1 focus:ring-blue-500 outline-none"
                                                />
                                            </div>
                                            <div className="flex flex-col">
                                                <label className="text-xs text-gray-500 mb-1">Active Users</label>
                                                <input 
                                                    type="number" 
                                                    min="0"
                                                    value={item.active_users}
                                                    onChange={(e) => handleValueChange(index, 'active_users', e.target.value)}
                                                    className="bg-gray-700 border border-gray-600 rounded px-2 py-1 w-24 text-white focus:ring-1 focus:ring-blue-500 outline-none"
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex gap-4">
                                            <div className="flex flex-col">
                                                <label className="text-xs text-gray-500 mb-1">Download (GB)</label>
                                                <input 
                                                    type="number" 
                                                    min="0"
                                                    step="0.01"
                                                    value={(item.download_bytes / (1024 * 1024 * 1024)).toFixed(2)}
                                                    onChange={(e) => handleTrafficChange(index, 'download_bytes', e.target.value)}
                                                    className="bg-gray-700 border border-gray-600 rounded px-2 py-1 w-24 text-white focus:ring-1 focus:ring-blue-500 outline-none"
                                                />
                                            </div>
                                            <div className="flex flex-col">
                                                <label className="text-xs text-gray-500 mb-1">Upload (GB)</label>
                                                <input 
                                                    type="number" 
                                                    min="0"
                                                    step="0.01"
                                                    value={(item.upload_bytes / (1024 * 1024 * 1024)).toFixed(2)}
                                                    onChange={(e) => handleTrafficChange(index, 'upload_bytes', e.target.value)}
                                                    className="bg-gray-700 border border-gray-600 rounded px-2 py-1 w-24 text-white focus:ring-1 focus:ring-blue-500 outline-none"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        )})}
                    </tbody>
                </table>
            </div>
          ) : activeTab === 'interactive' ? (
            <div className="flex flex-col h-full">
                <div className="flex justify-center mb-4">
                    <div className="bg-gray-800 p-1 rounded-lg flex gap-1">
                        <button
                            onClick={() => setInteractiveMetric('users')}
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${interactiveMetric === 'users' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                        >
                            Users
                        </button>
                        <button
                            onClick={() => setInteractiveMetric('traffic')}
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${interactiveMetric === 'traffic' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
                        >
                            Traffic
                        </button>
                    </div>
                </div>
                <div className="flex-1 bg-white/5 rounded-lg p-4 relative min-h-[400px]">
                    <canvas ref={interactiveCanvasRef}></canvas>
                    <div className="absolute top-4 right-4 bg-black/50 px-3 py-1 rounded text-xs text-gray-300 pointer-events-none">
                        Drag points to edit
                    </div>
                </div>
            </div>
          ) : (
            <div className="space-y-6 text-center">
                <div>
                    <h4 className="text-lg font-semibold">CSV Import/Export</h4>
                    <p className="text-sm text-gray-400">Export a template for missing dates, or upload a completed CSV to populate data.</p>
                    <div className="flex justify-center gap-4 pt-4">
                        <button
                            onClick={handleExportTemplate}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium"
                        >
                            Export Template
                        </button>
                        <label className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-medium cursor-pointer">
                            Upload CSV
                            <input type="file" accept=".csv" onChange={handleCsvUpload} className="hidden" />
                        </label>
                    </div>
                </div>
            </div>
          )}
        </div>
        <div className="p-4 border-t border-white/10 flex justify-end gap-3 sticky bottom-0 bg-gray-900 z-10">
          <button onClick={onClose} className="px-4 py-2 rounded text-gray-300 hover:bg-white/10 transition-colors" disabled={isSaving}>Cancel</button>
          <button onClick={() => onConfirm(localData)} disabled={isSaving} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-medium flex items-center gap-2">
            {isSaving ? <Loader2 className="animate-spin w-4 h-4" /> : <Wand2 className="w-4 h-4" />}
            {isSaving ? 'Saving...' : 'Confirm & Populate'}
          </button>
        </div>
        
        {editingIndex !== null && localData[editingIndex] && (
          <EditPointModal 
              item={localData[editingIndex]} 
              onSave={handleModalSave} 
              onClose={() => setEditingIndex(null)} 
          />
        )}
      </div>
    </div>
  );
};

export default function Sites() {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSite, setSelectedSite] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  
  // PDF Generation States
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [form, setForm] = useState({
    siteCode: '',
    siteId: '',
    siteName: '',
    expandedName: '',
    projectName: 'SUPPLY, DELIVERY, INSTALLATION, AND MAINTENANCE OF MANAGED INTERNET SERVICES FOR THE PROJECT WI-FI IN NORTHERN SAMAR (WINS)',
    supplierName: 'FREQ IT SOLUTIONS',
    startDate: formatLocalDate(getFirstDayOfMonth()),
    endDate: formatLocalDate(getToday()),
    serviceAvailability: '100%',
  });
  const [chartsLoaded, setChartsLoaded] = useState(false);
  const [usingSampleData, setUsingSampleData] = useState(false);
  const [logoDataUrl, setLogoDataUrl] = useState(null);
  const [populating, setPopulating] = useState(false);
  const [reportData, setReportData] = useState({
    usersData: [],
    trafficData: [],
    blackoutEvents: [],
    manualData: []
  });
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState(null);

  // Calculate gaps for the Populate button
  const gaps = useMemo(() => {
    if (!reportData.usersData || reportData.usersData.length === 0) return [];
    return reportData.usersData
      .filter(d => d.total === 0)
      .map(d => d.time || d.timeString || dayjs(d.date).format('YYYYMMDD'));
  }, [reportData.usersData]);

  // Chart Refs
  const usersChartRef = useRef(null); // Combined chart for Total & Active Users
  const trafficChartRef = useRef(null); // Combined chart for Download & Upload Traffic
  const chartInstances = useRef([]);
  const { user } = useAuth();

  // Load and convert logo to data URL
  useEffect(() => {
    const loadLogo = async () => {
      try {
        const dataUrl = await getBase64FromImageUrl(logo.src);
        setLogoDataUrl(dataUrl);
      } catch (error) {
        console.warn('Error loading logo:', error);
      }
    };

    loadLogo();
  }, []);

  // Fetch sites data
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
          latitude: site.latitude || site.lat || 11.0,
          longitude: site.longitude || site.lon || 125.0,
          groupId: site.groupId || site.siteId || site.id,
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

  // Update form when site is selected
  useEffect(() => {
    if (selectedSite) {
      const selected = sites.find(site => site.siteId === selectedSite);
      if (selected) {
        const { siteCode, siteName } = extractSiteCodeAndName(selected.name);
        const expandedSiteName = expandSiteType(siteName);
        
        setForm(prev => ({
          ...prev,
          siteName: siteName,
          expandedName: expandedSiteName,
          siteId: selected.siteId,
          siteCode: siteCode,
          groupId: selected.groupId,
          vendor: selected.vendor,
        }));
      }
    }
  }, [selectedSite, sites]);

  // Handle site selection
  const handleSiteSelect = (siteId) => {
    setSelectedSite(siteId);
    // Clear previous report data and preview when a new site is selected
    setReportData({
      usersData: [],
      trafficData: [],
      blackoutEvents: [],
      manualData: []
    });
    setPdfUrl(null);
    setChartsLoaded(false);
  };

  // Handle search term change
  const handleSearchChange = (term) => {
    setSearchTerm(term);
  };

  // Handle form changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // Function to fetch blackout events - from Reports.jsx
  const fetchBlackoutEvents = async (site, start, end) => {
    try {
      const url = `/api/reports/events?siteId=${encodeURIComponent(site.groupId)}&startDate=${start.valueOf()}&endDate=${end.valueOf()}`;
      
      const res = await fetch(url, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      
      if (!res.ok) {
        return [];
      }
      
      const data = await res.json();
      return data.data || [];
    } catch (err) {
      console.error("Failed to fetch blackout events", err);
      return [];
    }
  };

  // Function to fetch manual data - from Reports.jsx
  const fetchManualData = async (siteName, start, end, retryCount = 0) => {
    try {
      const res = await fetch("/api/manual-data/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          siteId: siteName,
          startDate: start.valueOf(),
          endDate: end.valueOf()
        })
      });

      if (!res.ok) {
        // Retry on server errors (like ECONNRESET/500)
        if (res.status >= 500 && retryCount < 3) {
          console.warn(`Retrying fetchManualData (${retryCount + 1})...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          return fetchManualData(siteName, start, end, retryCount + 1);
        }
        return [];
      }
      
      const data = await res.json();
      return data.data || [];
    } catch (err) {
      console.error("Failed to fetch manual data", err);
      // Retry on network errors
      if (retryCount < 3) {
        console.warn(`Retrying fetchManualData after error (${retryCount + 1})...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return fetchManualData(siteName, start, end, retryCount + 1);
      }
      return [];
    }
  };

  // Function to merge data with manual entries - from Reports.jsx
  const mergeDataWithManual = (apiData, manualData, dataType) => {
    const mergedData = [...apiData];
    const manualMap = new Map();

    manualData.forEach(item => {
      if (item.data_type === dataType) {
        const dateKey = dayjs(item.date).format("YYYYMMDD");
        manualMap.set(dateKey, item);
      }
    });
    
    const result = mergedData.map(apiItem => {
      const dateKey = apiItem.time || apiItem.timeString;
      const manualItem = manualMap.get(dateKey);
      
      if (manualItem) {
        if (dataType === 'users') {
          return {
            ...apiItem,
            total: manualItem.total_users || apiItem.total,
            activeTotal: manualItem.active_users || apiItem.activeTotal,
            source: 'manual',
            notes: manualItem.notes,
            isManual: true
          };
        } else {
          const rxConverted = convertBytes(manualItem.download_bytes || 0);
          const txConverted = convertBytes(manualItem.upload_bytes || 0);
          
          return {
            ...apiItem,
            rxBytes: rxConverted.value,
            txBytes: txConverted.value,
            originalRxBytes: manualItem.download_bytes || 0,
            originalTxBytes: manualItem.upload_bytes || 0,
            unit: rxConverted.unit,
            source: 'manual',
            notes: manualItem.notes,
            isManual: true
          };
        }
      }
      return { ...apiItem, source: 'api', isManual: false };
    });
    
    return result;
  };

  // Function to apply blackout events to data - from Reports.jsx
  const applyBlackoutEvents = (data, events) => {
    if (!events.length) return data;

    return data.map(item => {
      const itemDateStr = item.time || item.timeString;
      if (!itemDateStr || itemDateStr.length !== 8) {
        return item;
      }
      
      const itemDate = dayjs(itemDateStr, "YYYYMMDD");
      if (!itemDate.isValid()) {
        return item;
      }

      const matchingEvents = events.filter(event => {
        const eventStart = dayjs(event.start);
        const eventEnd = dayjs(event.end);
        return itemDate.isBetween(eventStart, eventEnd, 'day', '[]');
      });

      if (matchingEvents.length > 0) {
        const matchingEvent = matchingEvents[0];
        
        // Zero out the values and mark as blackout
        if ('total' in item) {
          return {
            ...item,
            total: 0,
            activeTotal: 0,
            hasBlackout: true,
            blackoutReason: matchingEvent?.event || "Blackout Event",
            blackoutDetails: {
              event: matchingEvent.event,
              start: dayjs(matchingEvent.start).format('MMM D'),
              end: dayjs(matchingEvent.end).format('MMM D')
            }
          };
        } else {
          return {
            ...item,
            rxBytes: 0,
            txBytes: 0,
            originalRxBytes: 0,
            originalTxBytes: 0,
            unit: "B",
            hasBlackout: true,
            blackoutReason: matchingEvent?.event || "Blackout Event",
            blackoutDetails: {
              event: matchingEvent.event,
              start: dayjs(matchingEvent.start).format('MMM D'),
              end: dayjs(matchingEvent.end).format('MMM D')
            }
          };
        }
      }
      return item;
    });
  };

  // Function to fill missing dates in data - from Reports.jsx
  const fillMissingDates = (data, start, end) => {
    const filledData = [];
    const dataMap = new Map();
    
    data.forEach(item => {
      const dateKey = item.time || item.timeString || "";
      if (dateKey) {
        dataMap.set(dateKey, { ...item });
      }
    });

    let currentDate = start.clone();
    while (currentDate.isBefore(end) || currentDate.isSame(end, 'day')) {
      const dateKey = currentDate.format("YYYYMMDD");
      const existingData = dataMap.get(dateKey);
      
      if (existingData) {
        filledData.push(existingData);
      } else {
        filledData.push({
          time: dateKey,
          timeString: dateKey,
          total: 0,
          activeTotal: 0,
          rxBytes: 0,
          txBytes: 0,
          unit: "B",
          source: 'none',
          isManual: false,
          hasBlackout: false
        });
      }
      
      currentDate = currentDate.add(1, 'day');
    }

    return filledData;
  };

  // Update the fetchReportData function with blackout and manual data integration
  const fetchReportData = async () => {
    setChartsLoaded(false);
    setDataLoading(true);
    // Immediately clear previous data to prevent showing stale information during load
    setReportData({
      usersData: [],
      trafficData: [],
      blackoutEvents: [],
      manualData: []
    });
    setPdfUrl(null);

    try {
      const site = sites.find(s => s.siteId === form.siteId);
      if (!site) {
        throw new Error("No site selected");
      }

      // Parse dates
      const parseLocalDate = (dateString) => {
        const [year, month, day] = dateString.split('-').map(Number);
        // Create date at start of day in local time
        const date = new Date(year, month - 1, day, 0, 0, 0, 0);
        return date;
      };

      // Get dates from form
      const localStartDate = parseLocalDate(form.startDate);
      const localEndDate = parseLocalDate(form.endDate);

      // Convert to dayjs for easier manipulation
      const start = dayjs(localStartDate);
      const end = dayjs(localEndDate).endOf('day');

      // Fetch blackout events and manual data first
      const blackoutEvents = await fetchBlackoutEvents(site, start, end);
      const manualData = await fetchManualData(site.name, start, end);

      let rawUsersData = [];
      let rawTrafficData = [];

      try {
        if (site.vendor === "Omada") {
          // For Omada API - convert to Unix timestamps (seconds)
          const startUnix = Math.floor(start.valueOf() / 1000);
          const endUnix = Math.floor(end.valueOf() / 1000);

          // Fetch Omada Users
          const usersRes = await fetch("/api/reports/omada/users", {
            method: "POST",
            body: JSON.stringify({ 
              start: startUnix, 
              end: endUnix, 
              siteId: site.groupId 
            }),
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          });
          
          if (usersRes.ok) {
            const usersJson = await usersRes.json();
            rawUsersData = usersJson?.data || [];
          }

          // Fetch Omada Traffic
          const trafficRes = await fetch("/api/reports/omada/traffic", {
            method: "POST",
            body: JSON.stringify({ 
              start: startUnix, 
              end: endUnix, 
              siteId: site.groupId 
            }),
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          });
          
          if (trafficRes.ok) {
            const trafficJson = await trafficRes.json();
            rawTrafficData = trafficJson?.data || [];
          }

        } else if (site.vendor === "Ruijie") {
          // Fetch Ruijie Users
          const usersRes = await fetch("/api/reports/ruijie/users", {
            method: "POST",
            body: JSON.stringify({ 
              startDate: start.valueOf(), 
              endDate: end.valueOf(), 
              groupId: site.groupId, 
              type: "day" 
            }),
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          });
          
          if (usersRes.ok) {
            const usersJson = await usersRes.json();
            rawUsersData = (usersJson?.list || []).map(item => ({
              time: item.time ?? item.timeString ?? "",
              total: item.total ?? 0,
              activeTotal: item.activeTotal ?? 0,
            }));
          }

          // Fetch Ruijie Traffic
          const trafficRes = await fetch("/api/reports/ruijie/traffic", {
            method: "POST",
            body: JSON.stringify({ 
              startDate: start.valueOf(), 
              endDate: end.valueOf(), 
              buildingId: site.groupId, 
              type: "week"
            }),
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          });
          
          if (trafficRes.ok) {
            const trafficJson = await trafficRes.json();

            rawTrafficData = (trafficJson?.data?.list || trafficJson?.list || []).map(item => {
              const rxBytes = item.rxBytes ?? 0;
              const txBytes = item.txBytes ?? 0;
              const rxConverted = convertBytes(rxBytes);
              const txConverted = convertBytes(txBytes);
              return {
                time: item.time ?? item.timeString ?? "",
                timeString: item.time ?? item.timeString ?? "",
                rxBytes: rxConverted.value,
                txBytes: txConverted.value,
                originalRxBytes: rxBytes,
                originalTxBytes: txBytes,
                unit: rxConverted.unit,
              };
            });
          }
        }

        // Format the data for processing
        const formattedUsersData = rawUsersData.map(item => ({
          time: item.time || "",
          timeString: item.time || "",
          total: item.total ?? 0,
          activeTotal: item.activeTotal ?? (item.wireless + item.wired ?? 0),
        }));

        const formattedTrafficData = rawTrafficData.map(item => {
          if (item.originalRxBytes !== undefined) {
            return item;
          }
          const rxBytes = item.rxBytes ?? 0;
          const txBytes = item.txBytes ?? 0;
          const rxConverted = convertBytes(rxBytes);
          const txConverted = convertBytes(txBytes);
          return {
            time: item.time || item.timeString || "",
            timeString: item.timeString || item.time || "",
            rxBytes: rxConverted.value,
            txBytes: txConverted.value,
            originalRxBytes: rxBytes,
            originalTxBytes: txBytes,
            unit: rxConverted.unit,
          };
        });

        // 1. Merge with initial manual data
        let mergedUsersData = mergeDataWithManual(formattedUsersData, manualData, 'users');
        let mergedTrafficData = mergeDataWithManual(formattedTrafficData, manualData, 'traffic');

        // 2. Fill missing dates (creates entries with source: 'none')
        let completeUsersData = fillMissingDates(mergedUsersData, start, end);
        let completeTrafficData = fillMissingDates(mergedTrafficData, start, end);

        // Apply blackout events (highest priority - overrides manual and API data)
        const usersDataWithBlackouts = applyBlackoutEvents(completeUsersData, blackoutEvents);
        const trafficDataWithBlackouts = applyBlackoutEvents(completeTrafficData, blackoutEvents);

        // Add display dates for charts
        const finalUsersData = usersDataWithBlackouts.map(item => ({
          ...item,
          date: dayjs(item.time || item.timeString, "YYYYMMDD").toDate(),
          dateString: dayjs(item.time || item.timeString, "YYYYMMDD").format("YYYY-MM-DD"),
          displayDate: dayjs(item.time || item.timeString, "YYYYMMDD").format("MMM D")
        }));

        const finalTrafficData = trafficDataWithBlackouts.map(item => {
          // Convert originalRxBytes and originalTxBytes from bytes to GB with 2 decimal places
          const rxGB = parseFloat((item.originalRxBytes / (1024 * 1024 * 1024)).toFixed(2));
          const txGB = parseFloat((item.originalTxBytes / (1024 * 1024 * 1024)).toFixed(2));
          
          return {
            ...item,
            date: dayjs(item.time || item.timeString, "YYYYMMDD").toDate(),
            dateString: dayjs(item.time || item.timeString, "YYYYMMDD").format("YYYY-MM-DD"),
            displayDate: dayjs(item.time || item.timeString, "YYYYMMDD").format("MMM D"),
            rxGB: rxGB,
            txGB: txGB
          };
        });

        // Store the fetched data
        setReportData({ 
          usersData: finalUsersData, 
          trafficData: finalTrafficData,
          blackoutEvents,
          manualData 
        });
        
        // Calculate Service Availability (excluding blackout days)
        const calculatedAvailability = calculateServiceAvailability(
          finalUsersData, 
          finalTrafficData, 
          blackoutEvents
        );
        
        // Update form with calculated availability
        setForm(prev => ({
          ...prev,
          serviceAvailability: calculatedAvailability
        }));
        
        // Create combined charts
        createCombinedCharts(finalUsersData, finalTrafficData);
        setUsingSampleData(false);

      } catch (apiError) {
        console.error("Error fetching API data:", apiError);
        // Use empty data
        const emptyData = [];
        setReportData({ 
          usersData: emptyData, 
          trafficData: emptyData,
          blackoutEvents: [],
          manualData: []
        });
        
        // Create empty charts
        createCombinedCharts(emptyData, emptyData);
        setUsingSampleData(true);
      }

      setPdfLoading(false);
      setChartsLoaded(true);
      return true;
    } catch (err) {
      console.error('Error in fetchReportData:', err);
      setChartsLoaded(false); // Ensure loading states are reset on error
      return false;
    } finally {
      setDataLoading(false);
    }
  };

  // Helper function to create combined charts
  const createCombinedCharts = (usersData, trafficData) => {
    // Destroy existing charts
    chartInstances.current.forEach((chart) => chart.destroy());
    chartInstances.current = [];

    // Ensure we have data
    if (!usersData || usersData.length === 0 || !trafficData || trafficData.length === 0) {
      console.warn('No data available for charts');
      return;
    }

    // Use displayDate field from our processed data
    const userLabels = usersData.map(item => item.displayDate || '');
    const totalUsersData = usersData.map(item => item.total || 0);
    const activeUsersData = usersData.map(item => item.activeTotal || 0);
    
    const trafficLabels = trafficData.map(item => item.displayDate || '');
    const downloadData = trafficData.map(item => item.rxGB || 0);
    const uploadData = trafficData.map(item => item.txGB || 0);

    // Create Users Chart (Combined Total & Active Users) - FIXED
    if (usersChartRef.current) {
      const ctx = usersChartRef.current.getContext('2d');
      const chart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: userLabels, // Use userLabels, not trafficLabels
          datasets: [
            {
              label: 'Total Users',
              data: totalUsersData,
              fill: true,
              backgroundColor: 'rgba(54, 162, 235, 0.2)',
              borderColor: 'rgba(54, 162, 235, 1)',
              borderWidth: 2,
              tension: 0.3,
            },
            {
              label: 'Active Users',
              data: activeUsersData,
              fill: true,
              backgroundColor: 'rgba(255, 99, 132, 0.2)',
              borderColor: 'rgba(255, 99, 132, 1)',
              borderWidth: 2,
              tension: 0.3,
            }
          ],
        },
        options: {
          responsive: false,
          plugins: { 
            legend: { 
              display: true,
              labels: {
                color: '#000',
                font: {
                  size: 12
                }
              },
              position: 'top'
            },
            title: {
              display: true,
              text: 'Users Activity',
              color: '#000',
              font: {
                size: 16,
                weight: 'bold'
              }
            }
          },
          scales: {
            x: { 
              ticks: { 
                autoSkip: false,
                color: '#000',
                maxRotation: 45,
                font: {
                  size: 10
                }
              },
              title: {
                display: true,
                text: 'Date',
                color: '#000',
                font: {
                  size: 12,
                  weight: 'bold'
                }
              }
            },
            y: { 
              beginAtZero: true,
              ticks: {
                color: '#000',
                font: {
                  size: 10
                }
              },
              title: {
                display: true,
                text: 'Number of Users',
                color: '#000',
                font: {
                  size: 12,
                  weight: 'bold'
                }
              }
            },
          },
        },
      });
      chartInstances.current.push(chart);
    }

    // Create Traffic Chart (Combined Download & Upload) - FIXED
    if (trafficChartRef.current) {
      const ctx = trafficChartRef.current.getContext('2d');
      const chart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: trafficLabels, // Use trafficLabels
          datasets: [
            {
              label: 'Tx (GB)', // Changed from MB to GB
              data: uploadData,
              fill: true,
              backgroundColor: 'rgba(153, 102, 255, 0.2)',
              borderColor: 'rgba(153, 102, 255, 1)',
              borderWidth: 2,
              tension: 0.3,
            },
            {
              label: 'Rx (GB)', // Changed from MB to GB
              data: downloadData,
              fill: true,
              backgroundColor: 'rgba(75, 192, 192, 0.2)',
              borderColor: 'rgba(75, 192, 192, 1)',
              borderWidth: 2,
              tension: 0.3,
            }
          ],
        },
        options: {
          responsive: false,
          plugins: { 
            legend: { 
              display: true,
              labels: {
                color: '#000',
                font: {
                  size: 12
                }
              },
              position: 'top'
            },
            title: {
              display: true,
              text: 'Network Traffic',
              color: '#000',
              font: {
                size: 16,
                weight: 'bold'
              }
            }
          },
          scales: {
            x: { 
              ticks: { 
                autoSkip: false,
                color: '#000',
                maxRotation: 45,
                font: {
                  size: 10
                }
              },
              title: {
                display: true,
                text: 'Date',
                color: '#000',
                font: {
                  size: 12,
                  weight: 'bold'
                }
              }
            },
            y: { 
              beginAtZero: true,
              ticks: {
                color: '#000',
                font: {
                  size: 10
                },
                callback: function(value) {
                  return value + ' GB';
                }
              },
              title: {
                display: true,
                text: 'Data Usage (GB)',
                color: '#000',
                font: {
                  size: 12,
                  weight: 'bold'
                }
              }
            },
          },
        },
      });
      chartInstances.current.push(chart);
    }
  };

  // Generate PDF function - Now 2 pages: Page 1 = Service Report, Page 2 = Both Charts
  const generatePdf = async () => {
    if (!form.siteId) {
      alert("Please select a site first");
      return;
    }

    setPdfLoading(true);

    try {
      // Get chart images
      let usersChartImg = null;
      let trafficChartImg = null;
      
      if (usersChartRef.current && trafficChartRef.current) {
        usersChartImg = usersChartRef.current.toDataURL('image/png', 1.0);
        trafficChartImg = trafficChartRef.current.toDataURL('image/png', 1.0);
      }

      const pdfBlob = await generateServiceReportPdf(form, logoDataUrl, usersChartImg, trafficChartImg);
      const url = URL.createObjectURL(pdfBlob);
      setPdfUrl(url);

    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF: ' + error.message);
    } finally {
      setPdfLoading(false);
    }
  };

  const handlePopulatePreview = async (site, dates) => {
    try {
      setPopulating(true);
      const res = await fetch("/api/manual-data/populate", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ siteId: site.name, vendor: site.vendor, dates: dates, preview: true })
      });
      const data = await res.json();
      if (data.success) {
        setPreviewData(data.data);
        setShowPreview(true);
      } else {
        throw new Error(data.error || "Failed to generate preview");
      }
    } catch (err) {
      console.error("Preview error:", err);
      Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to generate preview data' });
    } finally {
      setPopulating(false);
    }
  };

  const handleConfirmPopulation = async (dataToSave) => {
    const data = dataToSave || previewData;
    if (!data) return;
    try {
      setPopulating(true);
      const res = await fetch("/api/manual-data/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ data: data })
      });
      if (res.ok) {
        setShowPreview(false);
        setPreviewData(null);
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Data populated successfully', showConfirmButton: false, timer: 3000, background: '#1f2937', color: '#fff' });
        fetchReportData();
      } else { throw new Error("Failed to save data"); }
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to save populated data' });
    } finally { setPopulating(false); }
  };

  return (
    <main className="p-4 sm:p-8 bg-gradient-to-br from-gray-900 via-gray-800 to-black min-h-screen text-white">
      <div className="container mx-auto flex flex-col md:flex-row md:gap-6">
        {/* Left Column - Site List Component */}
        <div className="w-full md:w-1/3 mb-4 md:mb-0 mt-2">
          <SiteList 
            sites={sites}
            loading={loading}
            error={error}
            selectedSite={selectedSite}
            searchTerm={searchTerm}
            onSiteSelect={handleSiteSelect}
            onSearchChange={handleSearchChange}
          />
        </div>

        {/* Right Column - PDF Generation */}
        <div className="w-full md:w-2/3 bg-white/10 p-4 rounded-xl shadow-lg mt-2 flex flex-col">
          <h2 className="text-xl font-semibold mb-2">Generate Service Report</h2>
          
          {selectedSite ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="flex-1 min-h-[400px]"
            >
              {/* Form Container on Top */}
              <section className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/20 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  <div>
                    <label htmlFor="siteName" className="block mb-1 font-medium text-sm">Site Name:</label>
                    <input
                      type="text"
                      id="siteName"
                      name="siteName"
                      value={form.expandedName}
                      onChange={handleChange}
                      className="w-full rounded border border-white/30 bg-transparent p-2 text-sm placeholder:text-white/60 focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="Site name"
                      readOnly
                    />
                  </div>

                  <div>
                    <label htmlFor="siteCode" className="block mb-1 font-medium text-sm">Site Code:</label>
                    <input
                      type="text"
                      id="siteCode"
                      name="siteCode"
                      value={form.siteCode}
                      onChange={handleChange}
                      className="w-full rounded border border-white/30 bg-transparent p-2 text-sm placeholder:text-white/60 focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="Site code"
                      readOnly
                    />
                  </div>

                  <div>
                    <label htmlFor="startDate" className="block mb-1 font-medium text-sm">Start Date:</label>
                    <input
                      type="date"
                      id="startDate"
                      name="startDate"
                      value={form.startDate}
                      onChange={handleChange}
                      className="w-full rounded border border-white/30 bg-transparent p-2 text-sm placeholder:text-white/60 focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="endDate" className="block mb-1 font-medium text-sm">End Date:</label>
                    <input
                      type="date"
                      id="endDate"
                      name="endDate"
                      value={form.endDate}
                      onChange={handleChange}
                      className="w-full rounded border border-white/30 bg-transparent p-2 text-sm placeholder:text-white/60 focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>

                  <div className="md:col-span-4 flex items-end gap-2 flex-wrap">
                    <button
                      onClick={fetchReportData}
                      disabled={dataLoading || pdfLoading || populating}
                      className={`flex-1 px-4 py-2 rounded text-white font-medium text-sm ${
                        dataLoading || pdfLoading || populating
                          ? 'bg-gray-400 cursor-not-allowed'
                          : 'bg-blue-600 hover:bg-blue-700'
                      }`}
                    >
                      {dataLoading || populating ? (
                        <span className="flex items-center justify-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          {populating ? 'Populating...' : 'Loading Data...'}
                        </span>
                      ) : 'Load Report Data'}
                    </button>

                    {user?.role === 'developer' && gaps.length > 0 && (
                      <button
                        onClick={async () => {
                          if (!selectedSite) return;
                          
                          const site = sites.find(s => s.siteId === selectedSite);
                          await handlePopulatePreview(site, gaps);
                        }}
                        disabled={dataLoading || populating}
                        className="px-4 py-2 rounded text-white font-medium text-sm bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
                        title={`Populate ${gaps.length} missing dates`}
                      >
                        <Wand2 className="w-4 h-4" />
                      </button>
                    )}

                    <button
                      onClick={generatePdf}
                      disabled={!chartsLoaded || pdfLoading || dataLoading || populating}
                      className={`flex-1 px-4 py-2 rounded text-white font-medium text-sm ${
                        !chartsLoaded || pdfLoading || dataLoading || populating
                          ? 'bg-gray-400 cursor-not-allowed'
                          : 'bg-green-600 hover:bg-green-700'
                      }`}
                    >
                      {pdfLoading ? 'Generating PDF...' : 'Generate PDF'}
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block mb-1 font-medium text-sm">Service Availability:</label>
                    <div className="w-full rounded border border-white/30 bg-transparent p-2 text-sm text-white">
                      <span className={`font-bold ${
                        form.serviceAvailability === '100%' ? 'text-green-400' :
                        form.serviceAvailability >= '99%' ? 'text-green-300' :
                        form.serviceAvailability >= '98%' ? 'text-yellow-400' :
                        'text-orange-400'
                      }`}>
                        {form.serviceAvailability}
                      </span>
                      <span className="text-gray-400 ml-2 text-xs">
                        (Calculated from data completeness)
                      </span>
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <div className="border-t border-white/20 pt-4 mt-4">
                      <div className="flex flex-col md:flex-row md:items-center justify-center text-sm text-gray-300 gap-2 md:gap-4">
                        <div className="flex items-center">
                          <span className="font-medium">Report Period:</span>
                          <span className="ml-2 px-3 py-1 bg-white/10 rounded">
                            {form.startDate} to {form.endDate}
                          </span>
                        </div>
                        <div className="flex items-center">
                          <span className="font-medium">Vendor:</span>
                          <span className="ml-2 px-3 py-1 bg-white/10 rounded">
                            {sites.find(s => s.siteId === selectedSite)?.vendor || 'Unknown'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {usingSampleData && (
                  <div className="mt-3 text-center">
                    <span className="text-xs px-2 py-1 bg-yellow-500/20 text-yellow-300 rounded">
                      Using sample data for testing
                    </span>
                  </div>
                )}

              </section>

              {/* PDF Preview Below */}
              <section className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/20 flex-1">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">PDF Preview</h3>
                  {pdfUrl && !pdfLoading && !dataLoading && (
                    <a
                      href={pdfUrl}
                      download={`${form.expandedName}.pdf`}
                      className="text-sm px-3 py-1 bg-green-600 hover:bg-green-700 rounded"
                    >
                      Download PDF
                    </a>
                  )}
                </div>
                
                {dataLoading ? (
                  <div className="h-[600px] flex flex-col items-center justify-center border border-white/20 rounded bg-white/5">
                    <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
                    <p className="text-lg text-white/70">Loading Report Data...</p>
                  </div>
                ) : pdfLoading ? (
                  <div className="h-[600px] flex flex-col items-center justify-center border border-white/20 rounded bg-white/5">
                    <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
                    <p className="text-lg text-white/70">Generating PDF...</p>
                  </div>
                ) : pdfUrl ? (
                  <div className="h-[600px] overflow-hidden rounded border border-white/20 bg-white">
                    <iframe
                      src={pdfUrl}
                      title="PDF Preview"
                      className="w-full h-full"
                      frameBorder="0"
                    />
                  </div>
                ) : (
                  <div className="h-[600px] flex flex-col items-center justify-center italic text-white/70 border border-dashed border-white/20 rounded bg-white/5">
                    <div className="text-center">
                      <p className="text-lg mb-2">No PDF generated yet</p>
                      <p className="text-sm mb-4">Select a site and click "Generate PDF" to create and preview the report</p>
                    </div>
                  </div>
                )}
              </section>
            </motion.div>
          ) : (
            <div className="flex-1 flex items-center justify-center min-h-[400px]">
              <div className="text-center text-gray-400">
                <p className="text-lg mb-2">Select a site from the list to generate a service report</p>
                <p className="text-sm">Click on any site in the left panel to get started</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Hidden canvases for combined charts */}
      <div className="hidden">
        <canvas ref={usersChartRef} width={800} height={400} />
        <canvas ref={trafficChartRef} width={800} height={400} />
      </div>

      <PreviewModal 
        isOpen={showPreview} 
        onClose={() => setShowPreview(false)} 
        onConfirm={handleConfirmPopulation}
        originalData={reportData}
        previewData={previewData}
        isSaving={populating}
        gaps={gaps}
        siteForm={form}
      />
    </main>
  );
}