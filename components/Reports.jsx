'use client';

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend
} from "recharts";
import SiteList from "@/components/SiteList";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import isBetween from "dayjs/plugin/isBetween";
import relativeTime from "dayjs/plugin/relativeTime";
import Swal from "sweetalert2";
import { 
  Edit2, Save, Trash2, Plus, Minus,
  Sliders, Copy, Scissors, MousePointer, BoxSelect,
  ChevronDown, ChevronUp, Check, X,
  ArrowUp, ArrowDown, RefreshCw
} from "lucide-react";

dayjs.extend(customParseFormat);
dayjs.extend(isBetween);
dayjs.extend(relativeTime);

// Memoized Chart Components for better performance
const MemoizedUsersChart = React.memo(({ data, equalizerMode, equalizerModeType, onChartClick }) => {
  const CustomDot = (props) => {
    const { cx, cy, payload } = props;
    const hasBlackout = payload.hasBlackout;
    const isManual = payload.isManual;
    const isSelected = payload.selected;
    if (!cx || !cy) return null;
    
    let fillColor = "#4ade80";
    let strokeColor = "#4ade80";
    let radius = 3;
    
    if (hasBlackout) {
      fillColor = "#ef4444";
      strokeColor = "#ffffff";
      radius = 6;
    } else if (isSelected) {
      fillColor = "#a855f7";
      strokeColor = "#ffffff";
      radius = 6;
    } else if (isManual) {
      fillColor = "#f59e0b";
      strokeColor = "#ffffff";
      radius = 5;
    }
    
    return (
      <g>
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth={2}
          style={{ cursor: equalizerMode ? 'pointer' : 'default' }}
          onClick={(e) => {
            if (equalizerMode) {
              e.stopPropagation();
              onChartClick(payload, 'users', e);
            }
          }}
        />
      </g>
    );
  };

  const CustomTotalDot = (props) => {
    const { cx, cy, payload } = props;
    const hasBlackout = payload.hasBlackout;
    const isManual = payload.isManual;
    const isSelected = payload.selected;
    if (!cx || !cy) return null;
    
    let fillColor = "#22d3ee";
    let strokeColor = "#22d3ee";
    let radius = 3;
    
    if (hasBlackout) {
      fillColor = "#ef4444";
      strokeColor = "#ffffff";
      radius = 6;
    } else if (isSelected) {
      fillColor = "#a855f7";
      strokeColor = "#ffffff";
      radius = 6;
    } else if (isManual) {
      fillColor = "#f59e0b";
      strokeColor = "#ffffff";
      radius = 5;
    }
    
    return (
      <g>
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth={2}
          style={{ cursor: equalizerMode ? 'pointer' : 'default' }}
          onClick={(e) => {
            if (equalizerMode) {
              e.stopPropagation();
              onChartClick(payload, 'users', e);
            }
          }}
        />
      </g>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={250}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#4ade80" stopOpacity={0.8}/>
            <stop offset="95%" stopColor="#4ade80" stopOpacity={0}/>
          </linearGradient>
          <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.8}/>
            <stop offset="95%" stopColor="#22d3ee" stopOpacity={0}/>
          </linearGradient>
          <linearGradient id="colorBlackout" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
            <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1}/>
          </linearGradient>
          <linearGradient id="colorManual" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8}/>
            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
          </linearGradient>
          <linearGradient id="colorSelected" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#a855f7" stopOpacity={0.5}/>
            <stop offset="95%" stopColor="#a855f7" stopOpacity={0.1}/>
          </linearGradient>
        </defs>
        <XAxis 
          dataKey="time" 
          stroke="#cbd5e1" 
          tickFormatter={(value) => {
            if (value && value.length === 8) {
              try {
                return dayjs(value, "YYYYMMDD").format("MMM D");
              } catch (e) {
                return value;
              }
            }
            return value || "";
          }}
        />
        <YAxis stroke="#cbd5e1" />
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <Tooltip 
          contentStyle={{ backgroundColor: "#1e293b", borderRadius: "8px" }}
          labelFormatter={(label) => {
            if (label && label.length === 8) {
              try {
                return dayjs(label, "YYYYMMDD").format("MMMM D, YYYY");
              } catch (e) {
                return label;
              }
            }
            return label || "";
          }}
          formatter={(value, name, props) => {
            const source = props.payload?.source;
            const isManual = props.payload?.isManual;
            const hasBlackout = props.payload?.hasBlackout;
            const isSelected = props.payload?.selected;
            const blackoutReason = props.payload?.blackoutReason;
            const blackoutDetails = props.payload?.blackoutDetails;
            const notes = props.payload?.notes;
            let sourceText = '🔌 API';
            if (hasBlackout) sourceText = '⚡ Blackout';
            else if (isManual) sourceText = '📝 Manual';
            if (isSelected) sourceText += ' 🟣 Selected';
            const display = [`${value} users (${sourceText})`, name];
            if (hasBlackout) {
              display.push(`Reason: ${blackoutReason}`);
              if (blackoutDetails) {
                display.push(`Period: ${blackoutDetails.start} - ${blackoutDetails.end}`);
              }
            }
            if (notes && !hasBlackout) display.push(`Notes: ${notes}`);
            return display;
          }}
        />
        <Legend />
        <Area 
          type="monotone" 
          dataKey="selected" 
          name="Selected"
          stroke="transparent"
          fill="url(#colorSelected)"
          strokeWidth={0}
          isAnimationActive={false}
          hide={data.every(d => !d.selected)}
        />
        <Area 
          type="monotone" 
          dataKey="isManual" 
          name="Manual Adjustment"
          stroke="transparent"
          fill="url(#colorManual)"
          strokeWidth={0}
          isAnimationActive={false}
          hide={data.every(d => !d.isManual)}
        />
        <Area 
          type="step"
          dataKey="hasBlackout"
          name="Blackout"
          stroke="transparent"
          fill="url(#colorBlackout)"
          strokeWidth={0}
          isAnimationActive={false}
          hide={data.every(d => !d.hasBlackout)}
        />
        <Area 
          type="monotone" 
          dataKey="activeTotal" 
          name="Active Users" 
          stroke="#4ade80" 
          fill="url(#colorActive)" 
          strokeWidth={2}
          dot={<CustomDot />}
        />
        <Area 
          type="monotone" 
          dataKey="total" 
          name="Total Users" 
          stroke="#22d3ee" 
          fill="url(#colorTotal)" 
          strokeWidth={2}
          dot={<CustomTotalDot />}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
});

MemoizedUsersChart.displayName = 'MemoizedUsersChart';

const MemoizedTrafficChart = React.memo(({ data, equalizerMode, equalizerModeType, onChartClick }) => {
  const CustomRxDot = (props) => {
    const { cx, cy, payload } = props;
    const hasBlackout = payload.hasBlackout;
    const isManual = payload.isManual;
    const isSelected = payload.selected;
    if (!cx || !cy) return null;
    
    let fillColor = "#38bdf8";
    let strokeColor = "#38bdf8";
    let radius = 3;
    
    if (hasBlackout) {
      fillColor = "#ef4444";
      strokeColor = "#ffffff";
      radius = 6;
    } else if (isSelected) {
      fillColor = "#a855f7";
      strokeColor = "#ffffff";
      radius = 6;
    } else if (isManual) {
      fillColor = "#f59e0b";
      strokeColor = "#ffffff";
      radius = 5;
    }
    
    return (
      <g>
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth={2}
          style={{ cursor: equalizerMode ? 'pointer' : 'default' }}
          onClick={(e) => {
            if (equalizerMode) {
              e.stopPropagation();
              onChartClick(payload, 'traffic', e);
            }
          }}
        />
      </g>
    );
  };

  const CustomTxDot = (props) => {
    const { cx, cy, payload } = props;
    const hasBlackout = payload.hasBlackout;
    const isManual = payload.isManual;
    const isSelected = payload.selected;
    if (!cx || !cy) return null;
    
    let fillColor = "#f472b6";
    let strokeColor = "#f472b6";
    let radius = 3;
    
    if (hasBlackout) {
      fillColor = "#ef4444";
      strokeColor = "#ffffff";
      radius = 6;
    } else if (isSelected) {
      fillColor = "#a855f7";
      strokeColor = "#ffffff";
      radius = 6;
    } else if (isManual) {
      fillColor = "#f59e0b";
      strokeColor = "#ffffff";
      radius = 5;
    }
    
    return (
      <g>
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth={2}
          style={{ cursor: equalizerMode ? 'pointer' : 'default' }}
          onClick={(e) => {
            if (equalizerMode) {
              e.stopPropagation();
              onChartClick(payload, 'traffic', e);
            }
          }}
        />
      </g>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={250}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="colorRxTraffic" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.8}/>
            <stop offset="95%" stopColor="#38bdf8" stopOpacity={0}/>
          </linearGradient>
          <linearGradient id="colorTxTraffic" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f472b6" stopOpacity={0.8}/>
            <stop offset="95%" stopColor="#f472b6" stopOpacity={0}/>
          </linearGradient>
          <linearGradient id="colorBlackoutTraffic" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
            <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1}/>
          </linearGradient>
          <linearGradient id="colorManualTraffic" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8}/>
            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
          </linearGradient>
          <linearGradient id="colorSelectedTraffic" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#a855f7" stopOpacity={0.5}/>
            <stop offset="95%" stopColor="#a855f7" stopOpacity={0.1}/>
          </linearGradient>
        </defs>
        <XAxis 
          dataKey="timeString" 
          stroke="#cbd5e1" 
          tickFormatter={(value) => {
            if (value && value.length === 8) {
              try {
                return dayjs(value, "YYYYMMDD").format("MMM D");
              } catch (e) {
                return value;
              }
            }
            return value || "";
          }}
        />
        <YAxis stroke="#cbd5e1" />
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <Tooltip
          contentStyle={{ backgroundColor: "#1e293b", borderRadius: "8px" }}
          labelFormatter={(label) => {
            if (label && label.length === 8) {
              try {
                return dayjs(label, "YYYYMMDD").format("MMMM D, YYYY");
              } catch (e) {
                return label;
              }
            }
            return label || "";
          }}
          formatter={(value, name, props) => {
            const unit = props.payload?.unit || "B";
            const isManual = props.payload?.isManual;
            const hasBlackout = props.payload?.hasBlackout;
            const isSelected = props.payload?.selected;
            const blackoutReason = props.payload?.blackoutReason;
            const blackoutDetails = props.payload?.blackoutDetails;
            const notes = props.payload?.notes;
            let sourceText = '🔌 API';
            if (hasBlackout) sourceText = '⚡ Blackout';
            else if (isManual) sourceText = '📝 Manual';
            if (isSelected) sourceText += ' 🟣 Selected';
            const display = [`${Number(value || 0).toFixed(2)} ${unit} (${sourceText})`, name];
            if (hasBlackout) {
              display.push(`Reason: ${blackoutReason}`);
              if (blackoutDetails) {
                display.push(`Period: ${blackoutDetails.start} - ${blackoutDetails.end}`);
              }
            }
            if (notes && !hasBlackout) display.push(`Notes: ${notes}`);
            return display;
          }}
        />
        <Legend />
        <Area 
          type="monotone" 
          dataKey="selected" 
          name="Selected"
          stroke="transparent"
          fill="url(#colorSelectedTraffic)"
          strokeWidth={0}
          isAnimationActive={false}
          hide={data.every(d => !d.selected)}
        />
        <Area 
          type="monotone" 
          dataKey="isManual" 
          name="Manual Adjustment"
          stroke="transparent"
          fill="url(#colorManualTraffic)"
          strokeWidth={0}
          isAnimationActive={false}
          hide={data.every(d => !d.isManual)}
        />
        <Area 
          type="step"
          dataKey="hasBlackout"
          name="Blackout"
          stroke="transparent"
          fill="url(#colorBlackoutTraffic)"
          strokeWidth={0}
          isAnimationActive={false}
          hide={data.every(d => !d.hasBlackout)}
        />
        <Area 
          type="monotone" 
          dataKey="rxBytes" 
          name="Download" 
          stroke="#38bdf8" 
          fill="url(#colorRxTraffic)" 
          strokeWidth={2}
          dot={<CustomRxDot />}
        />
        <Area 
          type="monotone" 
          dataKey="txBytes" 
          name="Upload" 
          stroke="#f472b6" 
          fill="url(#colorTxTraffic)" 
          strokeWidth={2}
          dot={<CustomTxDot />}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
});

MemoizedTrafficChart.displayName = 'MemoizedTrafficChart';

// Floating Editor Component
const FloatingBatchEditor = ({ dateKey, data, onChange, onClose, convertBytes }) => {
  const [localData, setLocalData] = useState(data);
  
  const handleChange = (field, value) => {
    const newData = { ...localData, [field]: typeof value === 'string' ? parseInt(value) || 0 : value };
    setLocalData(newData);
    onChange(dateKey, newData);
  };

  const adjustValue = (field, amount) => {
    const currentValue = localData[field] || 0;
    handleChange(field, Math.max(0, currentValue + amount));
  };

  return (
    <div className="fixed z-50 bg-gray-900 border-2 border-purple-500 rounded-xl shadow-2xl p-4 min-w-[320px] transform -translate-x-1/2 -translate-y-full backdrop-blur-sm">
      <div className="flex justify-between items-center mb-3">
        <div>
          <h5 className="font-bold text-white text-lg">{dayjs(dateKey, "YYYYMMDD").format("MMM D, YYYY")}</h5>
          <div className="text-xs text-gray-300 flex items-center gap-2 mt-1">
            <span className="px-2 py-1 bg-purple-600 rounded-full">Batch Editing</span>
          </div>
        </div>
        <button 
          onClick={onClose} 
          className="text-gray-400 hover:text-white p-1 hover:bg-gray-800 rounded"
        >
          <X size={18} />
        </button>
      </div>
      
      <div className="space-y-4">
        <div>
          <label className="block text-xs text-gray-300 mb-1 font-medium">Data Type</label>
          <select
            value={localData.data_type}
            onChange={(e) => handleChange('data_type', e.target.value)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="users">Users Data</option>
            <option value="traffic">Traffic Data</option>
            <option value="all">Both Users & Traffic</option>
          </select>
        </div>
        
        {(localData.data_type === 'users' || localData.data_type === 'all') && (
          <>
            <div className="space-y-3">
              <div className="bg-gray-800/50 p-3 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-300">Total Users</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => adjustValue('total_users', -10)}
                      className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg flex items-center justify-center"
                      title="Decrease by 10"
                    >
                      <ArrowDown size={14} />
                    </button>
                    <button
                      onClick={() => adjustValue('total_users', -1)}
                      className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded"
                      title="Decrease by 1"
                    >
                      <Minus size={12} />
                    </button>
                    <input
                      type="number"
                      value={localData.total_users}
                      onChange={(e) => handleChange('total_users', e.target.value)}
                      className="w-24 px-3 py-2 bg-gray-900 border border-gray-700 rounded text-center text-base font-semibold"
                    />
                    <button
                      onClick={() => adjustValue('total_users', 1)}
                      className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded"
                      title="Increase by 1"
                    >
                      <Plus size={12} />
                    </button>
                    <button
                      onClick={() => adjustValue('total_users', 10)}
                      className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg flex items-center justify-center"
                      title="Increase by 10"
                    >
                      <ArrowUp size={14} />
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-800/50 p-3 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-300">Active Users</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => adjustValue('active_users', -10)}
                      className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg flex items-center justify-center"
                      title="Decrease by 10"
                    >
                      <ArrowDown size={14} />
                    </button>
                    <button
                      onClick={() => adjustValue('active_users', -1)}
                      className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded"
                      title="Decrease by 1"
                    >
                      <Minus size={12} />
                    </button>
                    <input
                      type="number"
                      value={localData.active_users}
                      onChange={(e) => handleChange('active_users', e.target.value)}
                      className="w-24 px-3 py-2 bg-gray-900 border border-gray-700 rounded text-center text-base font-semibold"
                    />
                    <button
                      onClick={() => adjustValue('active_users', 1)}
                      className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded"
                      title="Increase by 1"
                    >
                      <Plus size={12} />
                    </button>
                    <button
                      onClick={() => adjustValue('active_users', 10)}
                      className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg flex items-center justify-center"
                      title="Increase by 10"
                    >
                      <ArrowUp size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
        
        {(localData.data_type === 'traffic' || localData.data_type === 'all') && (
          <>
            <div className="space-y-3">
              <div className="bg-gray-800/50 p-3 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-300">
                    Download ({convertBytes(localData.download_bytes).value.toFixed(1)} {convertBytes(localData.download_bytes).unit})
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => adjustValue('download_bytes', -1073741824)}
                      className="p-2 bg-gray-700 hover:bg-gray-600 rounded text-xs"
                      title="-1 GB"
                    >
                      -1G
                    </button>
                    <button
                      onClick={() => adjustValue('download_bytes', -107374182)}
                      className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs"
                      title="-100 MB"
                    >
                      -100M
                    </button>
                    <input
                      type="number"
                      value={localData.download_bytes}
                      onChange={(e) => handleChange('download_bytes', e.target.value)}
                      className="w-32 px-3 py-2 bg-gray-900 border border-gray-700 rounded text-center text-base font-semibold"
                    />
                    <button
                      onClick={() => adjustValue('download_bytes', 107374182)}
                      className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs"
                      title="+100 MB"
                    >
                      +100M
                    </button>
                    <button
                      onClick={() => adjustValue('download_bytes', 1073741824)}
                      className="p-2 bg-gray-700 hover:bg-gray-600 rounded text-xs"
                      title="+1 GB"
                    >
                      +1G
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-800/50 p-3 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-300">
                    Upload ({convertBytes(localData.upload_bytes).value.toFixed(1)} {convertBytes(localData.upload_bytes).unit})
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => adjustValue('upload_bytes', -536870912)}
                      className="p-2 bg-gray-700 hover:bg-gray-600 rounded text-xs"
                      title="-500 MB"
                    >
                      -500M
                    </button>
                    <button
                      onClick={() => adjustValue('upload_bytes', -53687091)}
                      className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs"
                      title="-50 MB"
                    >
                      -50M
                    </button>
                    <input
                      type="number"
                      value={localData.upload_bytes}
                      onChange={(e) => handleChange('upload_bytes', e.target.value)}
                      className="w-32 px-3 py-2 bg-gray-900 border border-gray-700 rounded text-center text-base font-semibold"
                    />
                    <button
                      onClick={() => adjustValue('upload_bytes', 53687091)}
                      className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs"
                      title="+50 MB"
                    >
                      +50M
                    </button>
                    <button
                      onClick={() => adjustValue('upload_bytes', 536870912)}
                      className="p-2 bg-gray-700 hover:bg-gray-600 rounded text-xs"
                      title="+500 MB"
                    >
                      +500M
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
        
        <div>
          <label className="block text-xs font-medium text-gray-300 mb-1">Notes</label>
          <textarea
            value={localData.notes}
            onChange={(e) => handleChange('notes', e.target.value)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            rows="2"
            placeholder="Add notes for this date..."
          />
        </div>
      </div>
    </div>
  );
};

FloatingBatchEditor.displayName = 'FloatingBatchEditor';

export default function Reports() {
  const [sites, setSites] = useState([]);
  const [selectedSite, setSelectedSite] = useState(null);
  const [siteSearchTerm, setSiteSearchTerm] = useState("");
  const [usersData, setUsersData] = useState([]);
  const [trafficData, setTrafficData] = useState([]);
  const [loadingSites, setLoadingSites] = useState(true);
  const [loadingCharts, setLoadingCharts] = useState(false);
  const [blackoutEvents, setBlackoutEvents] = useState([]);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [equalizerMode, setEqualizerMode] = useState(false);
  const [selectedDataPoint, setSelectedDataPoint] = useState(null);
  const [selectedDates, setSelectedDates] = useState([]);
  const [equalizerModeType, setEqualizerModeType] = useState("single");
  const [equalizerData, setEqualizerData] = useState({
    date: "",
    data_type: "users",
    total_users: 0,
    active_users: 0,
    download_bytes: 0,
    upload_bytes: 0,
    notes: ""
  });
  const [batchEqualizerData, setBatchEqualizerData] = useState({});
  const [equalizerHistory, setEqualizerHistory] = useState([]);
  const [equalizerPresets] = useState([
    { name: "Weekend Peak", total_users: 150, active_users: 120 },
    { name: "Off Day", total_users: 50, active_users: 30 },
    { name: "Normal Day", total_users: 100, active_users: 80 },
    { name: "High Traffic", download_bytes: 1073741824, upload_bytes: 536870912 }
  ]);
  const [editMode, setEditMode] = useState(false);
  const [currentEditId, setCurrentEditId] = useState(null);
  const [expandedBatchDate, setExpandedBatchDate] = useState(null);
  const [floatingEditorPosition, setFloatingEditorPosition] = useState(null);
  const [optimisticUpdates, setOptimisticUpdates] = useState({});
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  // Optimize data updates with useMemo
  const memoizedUsersData = useMemo(() => usersData, [usersData]);
  const memoizedTrafficData = useMemo(() => trafficData, [trafficData]);

  useEffect(() => {
    async function fetchSites() {
      try {
        const res = await fetch("/api/sites", {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.message || "Failed to fetch sites");
        }
        const data = await res.json();
        const normalized = (data.data || []).map(site => ({
          siteId: site.id || site.siteId || site.groupId || Math.random().toString(36),
          name: site.name || "Unnamed Site",
          vendor: site.vendor || "Unknown",
          groupId: site.groupId || site.siteId || site.id,
        }));
        setSites(normalized);
      } catch (err) {
        console.error("Failed to load sites", err);
      } finally {
        setLoadingSites(false);
      }
    }
    if (token) {
      fetchSites();
    }
  }, [token]);

  useEffect(() => {
    if (equalizerModeType === "batch" && selectedDates.length > 0) {
      const initialBatchData = {};
      selectedDates.forEach(dateKey => {
        const userData = usersData.find(d => (d.time || d.timeString) === dateKey);
        const trafficDataPoint = trafficData.find(d => (d.time || d.timeString) === dateKey);
        
        initialBatchData[dateKey] = {
          date: dayjs(dateKey, "YYYYMMDD").format("YYYY-MM-DD"),
          data_type: "users",
          total_users: userData?.total || 0,
          active_users: userData?.activeTotal || 0,
          download_bytes: trafficDataPoint?.originalRxBytes || 0,
          upload_bytes: trafficDataPoint?.originalTxBytes || 0,
          notes: ""
        };
      });
      setBatchEqualizerData(initialBatchData);
    } else {
      setBatchEqualizerData({});
    }
  }, [selectedDates, equalizerModeType, usersData, trafficData]);

  const convertBytes = useCallback((bytes) => {
    if (bytes === undefined || bytes === null) return { value: 0, unit: "B" };
    if (bytes < 1024) return { value: bytes, unit: "B" };
    if (bytes < 1024 * 1024) return { value: +(bytes / 1024).toFixed(2), unit: "KB" };
    if (bytes < 1024 * 1024 * 1024) return { value: +(bytes / (1024 * 1024)).toFixed(2), unit: "MB" };
    return { value: +(bytes / (1024 * 1024 * 1024)).toFixed(2), unit: "GB" };
  }, []);

  const generateDates = useCallback(() => {
    const now = dayjs();
    if (customStart && customEnd) {
      const start = dayjs(customStart).startOf("day");
      const end = dayjs(customEnd).endOf("day");
      return { start, end };
    }
    return { start: now.subtract(7, "day").startOf("day"), end: now.endOf("day") };
  }, [customStart, customEnd]);

  const fetchBlackoutEvents = useCallback(async (site, start, end) => {
    try {
      const url = `/api/reports/events?siteId=${encodeURIComponent(site.groupId)}&startDate=${start.valueOf()}&endDate=${end.valueOf()}`;
      const res = await fetch(url, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) return [];
      const data = await res.json();
      return data.data || [];
    } catch (err) {
      console.error("Failed to fetch blackout events", err);
      return [];
    }
  }, [token]);

  const fetchManualData = useCallback(async (siteName, start, end) => {
    try {
      const res = await fetch("/api/manual-data/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json", "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          siteId: siteName,
          startDate: start.valueOf(),
          endDate: end.valueOf()
        })
      });
      if (!res.ok) return [];
      const data = await res.json();
      return data.data || [];
    } catch (err) {
      console.error("Failed to fetch manual data", err);
      return [];
    }
  }, [token]);

  const fetchManualDataForDate = useCallback(async (siteName, date) => {
    try {
      const res = await fetch(`/api/manual-data/by-date?siteId=${encodeURIComponent(siteName)}&date=${date}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.data || null;
    } catch (err) {
      console.error("Failed to fetch manual data for date", err);
      return null;
    }
  }, [token]);

  const mergeDataWithManual = useCallback((apiData, manualData, dataType) => {
    const mergedData = [...apiData];
    const manualMap = new Map();
    manualData.forEach(item => {
      if (item.data_type === dataType || item.data_type === 'all') {
        const dateKey = dayjs(item.date).format("YYYYMMDD");
        manualMap.set(dateKey, {
          ...item,
          isManual: true,
          manualId: item.id
        });
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
            isManual: true,
            manualId: manualItem.manualId
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
            isManual: true,
            manualId: manualItem.manualId
          };
        }
      }
      return { ...apiItem, source: 'api', isManual: false, manualId: null };
    });
    return result;
  }, [convertBytes]);

  const applyBlackoutEvents = useCallback((data, events) => {
    if (!events.length) return data;
    return data.map(item => {
      const itemDateStr = item.time || item.timeString;
      if (!itemDateStr || itemDateStr.length !== 8) return item;
      const itemDate = dayjs(itemDateStr, "YYYYMMDD");
      if (!itemDate.isValid()) return item;
      const matchingEvents = events.filter(event => {
        const eventStart = dayjs(event.start);
        const eventEnd = dayjs(event.end);
        return itemDate.isBetween(eventStart, eventEnd, 'day', '[]');
      });
      if (matchingEvents.length > 0) {
        const matchingEvent = matchingEvents[0];
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
  }, []);

  // Fast update function for real-time chart updates
  const updateChartDataOptimistically = useCallback((dateKey, data) => {
    setOptimisticUpdates(prev => ({
      ...prev,
      [dateKey]: data
    }));
    
    // Update users data
    setUsersData(prev => prev.map(item => {
      if ((item.time || item.timeString) === dateKey) {
        return {
          ...item,
          total: data.total_users || item.total,
          activeTotal: data.active_users || item.activeTotal,
          isManual: true,
          source: 'manual'
        };
      }
      return item;
    }));
    
    // Update traffic data
    setTrafficData(prev => prev.map(item => {
      if ((item.time || item.timeString) === dateKey) {
        const rxConverted = convertBytes(data.download_bytes || 0);
        const txConverted = convertBytes(data.upload_bytes || 0);
        return {
          ...item,
          rxBytes: rxConverted.value,
          txBytes: txConverted.value,
          originalRxBytes: data.download_bytes || 0,
          originalTxBytes: data.upload_bytes || 0,
          unit: rxConverted.unit,
          isManual: true,
          source: 'manual'
        };
      }
      return item;
    }));
  }, [convertBytes]);

  const loadReports = useCallback(async () => {
    if (!selectedSite || !token) return;
    setLoadingCharts(true);
    const site = sites.find(s => s.siteId === selectedSite);
    if (!site) {
      setLoadingCharts(false);
      return;
    }
    const { start, end } = generateDates();
    try {
      let rawUsersData = [];
      let rawTrafficData = [];
      const blackoutEvents = await fetchBlackoutEvents(site, start, end);
      setBlackoutEvents(blackoutEvents);
      const manualData = await fetchManualData(site.name, start, end);
      
      if (site.vendor === "Omada") {
        const startUnix = Math.floor(start.valueOf() / 1000);
        const endUnix = Math.floor(end.valueOf() / 1000);
        const usersRes = await fetch("/api/reports/omada/users", {
          method: "POST",
          body: JSON.stringify({ 
            start: startUnix, 
            end: endUnix, 
            siteId: site.groupId 
          }),
          headers: { 
            "Content-Type": "application/json", "Authorization": `Bearer ${token}`
          },
        });
        if (usersRes.ok) {
          const usersJson = await usersRes.json();
          rawUsersData = usersJson?.data || [];
        }
        const trafficRes = await fetch("/api/reports/omada/traffic", {
          method: "POST",
          body: JSON.stringify({ 
            start: startUnix, 
            end: endUnix, 
            siteId: site.groupId 
          }),
          headers: { 
            "Content-Type": "application/json", "Authorization": `Bearer ${token}`
          },
        });
        if (trafficRes.ok) {
          const trafficJson = await trafficRes.json();
          rawTrafficData = trafficJson?.data || [];
        }
      } else if (site.vendor === "Ruijie") {
        const usersRes = await fetch("/api/reports/ruijie/users", {
          method: "POST",
          body: JSON.stringify({ 
            startDate: start.valueOf(), 
            endDate: end.valueOf(), 
            groupId: site.groupId, 
            type: "day" 
          }),
          headers: { 
            "Content-Type": "application/json", "Authorization": `Bearer ${token}`
          },
        });
        if (usersRes.ok) {
          const usersJson = await usersRes.json();
          rawUsersData = (usersJson?.list || []).map(item => ({
            time: item.time ?? item.timeString ?? "",
            total: item.total ?? 0,
            activeTotal: item.activeTotal ?? (item.wireless + item.wired ?? 0),
          }));
        }
        const trafficRes = await fetch("/api/reports/ruijie/traffic", {
          method: "POST",
          body: JSON.stringify({ 
            startDate: start.valueOf(), 
            endDate: end.valueOf(), 
            buildingId: site.groupId, 
            type: "week"
          }),
          headers: { 
            "Content-Type": "application/json", "Authorization": `Bearer ${token}`
          },
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
      
      const formattedUsersData = rawUsersData.map(item => ({
        time: item.time || "",
        timeString: item.time || "",
        total: item.total ?? 0,
        activeTotal: item.activeTotal ?? (item.wireless + item.wired ?? 0),
      }));
      
      const formattedTrafficData = rawTrafficData.map(item => {
        if (item.originalRxBytes !== undefined) return item;
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
      
      const mergedUsersData = mergeDataWithManual(formattedUsersData, manualData, 'users');
      const mergedTrafficData = mergeDataWithManual(formattedTrafficData, manualData, 'traffic');
      
      const fillMissingDates = (data, start, end) => {
        const filledData = [];
        const dataMap = new Map();
        data.forEach(item => {
          const dateKey = item.time || item.timeString || "";
          if (dateKey) dataMap.set(dateKey, { ...item });
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
              hasBlackout: false,
              manualId: null,
              selected: false
            });
          }
          currentDate = currentDate.add(1, 'day');
        }
        return filledData;
      };
      
      const completeUsersData = fillMissingDates(mergedUsersData, start, end);
      const completeTrafficData = fillMissingDates(mergedTrafficData, start, end);
      const usersDataWithBlackouts = applyBlackoutEvents(completeUsersData, blackoutEvents);
      const trafficDataWithBlackouts = applyBlackoutEvents(completeTrafficData, blackoutEvents);
      
      // Apply optimistic updates if any
      let finalUsersData = usersDataWithBlackouts;
      let finalTrafficData = trafficDataWithBlackouts;
      
      Object.keys(optimisticUpdates).forEach(dateKey => {
        const data = optimisticUpdates[dateKey];
        finalUsersData = finalUsersData.map(item => {
          if ((item.time || item.timeString) === dateKey) {
            return {
              ...item,
              total: data.total_users || item.total,
              activeTotal: data.active_users || item.activeTotal,
              isManual: true,
              source: 'manual'
            };
          }
          return item;
        });
        
        finalTrafficData = finalTrafficData.map(item => {
          if ((item.time || item.timeString) === dateKey) {
            const rxConverted = convertBytes(data.download_bytes || 0);
            const txConverted = convertBytes(data.upload_bytes || 0);
            return {
              ...item,
              rxBytes: rxConverted.value,
              txBytes: txConverted.value,
              originalRxBytes: data.download_bytes || 0,
              originalTxBytes: data.upload_bytes || 0,
              unit: rxConverted.unit,
              isManual: true,
              source: 'manual'
            };
          }
          return item;
        });
      });
      
      const usersWithSelection = finalUsersData.map(item => ({
        ...item,
        selected: selectedDates.includes(item.time || item.timeString)
      }));
      
      const trafficWithSelection = finalTrafficData.map(item => ({
        ...item,
        selected: selectedDates.includes(item.time || item.timeString)
      }));
      
      setUsersData(usersWithSelection);
      setTrafficData(trafficWithSelection);
    } catch (err) {
      console.error("Failed to fetch reports", err);
      setUsersData([]);
      setTrafficData([]);
      setBlackoutEvents([]);
    } finally {
      setLoadingCharts(false);
    }
  }, [selectedSite, customStart, customEnd, sites, generateDates, convertBytes, selectedDates, optimisticUpdates, token, fetchBlackoutEvents, fetchManualData, mergeDataWithManual, applyBlackoutEvents]);

  useEffect(() => {
    if (selectedSite && token) {
      loadReports();
    }
  }, [selectedSite, customStart, customEnd, loadReports, token]);

  const handleChartClick = useCallback(async (dataPoint, chartType, event) => {
    if (!equalizerMode || !selectedSite) return;
    
    const site = sites.find(s => s.siteId === selectedSite);
    if (!site) return;

    const dateKey = dataPoint.time || dataPoint.timeString;
    if (!dateKey) return;

    if (equalizerModeType === "batch") {
      const isSelected = selectedDates.includes(dateKey);
      let newSelectedDates;
      
      if (isSelected) {
        newSelectedDates = selectedDates.filter(d => d !== dateKey);
        setBatchEqualizerData(prev => {
          const newData = { ...prev };
          delete newData[dateKey];
          return newData;
        });
      } else {
        newSelectedDates = [...selectedDates, dateKey];
      }
      
      setSelectedDates(newSelectedDates);
      
      setUsersData(prev => prev.map(item => {
        const itemDate = item.time || item.timeString;
        return itemDate === dateKey ? { ...item, selected: !isSelected } : item;
      }));
      
      setTrafficData(prev => prev.map(item => {
        const itemDate = item.time || item.timeString;
        return itemDate === dateKey ? { ...item, selected: !isSelected } : item;
      }));
      
      // Set floating editor position
      if (event && !isSelected) {
        const rect = event.target.getBoundingClientRect();
        setFloatingEditorPosition({
          dateKey,
          x: rect.left + rect.width / 2,
          y: rect.top
        });
      } else {
        setFloatingEditorPosition(null);
      }
      
      return;
    }

    try {
      const existingManualData = await fetchManualDataForDate(site.name, dateKey);
      if (existingManualData) {
        setEditMode(true);
        setCurrentEditId(existingManualData.id);
        setEqualizerData({
          date: dayjs(existingManualData.date).format("YYYY-MM-DD"),
          data_type: existingManualData.data_type || "users",
          total_users: existingManualData.total_users || 0,
          active_users: existingManualData.active_users || 0,
          download_bytes: existingManualData.download_bytes || 0,
          upload_bytes: existingManualData.upload_bytes || 0,
          notes: existingManualData.notes || ""
        });
      } else {
        setEditMode(false);
        setCurrentEditId(null);
        const isUsersChart = 'total' in dataPoint;
        setEqualizerData({
          date: dayjs(dateKey, "YYYYMMDD").format("YYYY-MM-DD"),
          data_type: isUsersChart ? "users" : "traffic",
          total_users: dataPoint.total || 0,
          active_users: dataPoint.activeTotal || 0,
          download_bytes: dataPoint.originalRxBytes || 0,
          upload_bytes: dataPoint.originalTxBytes || 0,
          notes: ""
        });
      }
      setSelectedDataPoint({
        date: dateKey,
        displayDate: dayjs(dateKey, "YYYYMMDD").format("MMM D, YYYY"),
        originalData: dataPoint,
        chartType: 'total' in dataPoint ? 'users' : 'traffic'
      });
    } catch (err) {
      console.error("Failed to fetch data for equalizer", err);
      Swal.fire({
        title: 'Error',
        text: 'Failed to load data for this date',
        icon: 'error',
        confirmButtonText: 'OK'
      });
    }
  }, [equalizerMode, equalizerModeType, selectedSite, sites, selectedDates, fetchManualDataForDate]);

  const handleBatchValueChange = useCallback((dateKey, field, value) => {
    setBatchEqualizerData(prev => ({
      ...prev,
      [dateKey]: {
        ...prev[dateKey],
        [field]: typeof value === 'string' ? parseInt(value) || 0 : value
      }
    }));
    
    // Update chart data optimistically
    const updatedData = {
      ...batchEqualizerData[dateKey],
      [field]: typeof value === 'string' ? parseInt(value) || 0 : value
    };
    updateChartDataOptimistically(dateKey, updatedData);
  }, [batchEqualizerData, updateChartDataOptimistically]);

  const applyBatchPreset = useCallback((preset) => {
    const updatedBatchData = { ...batchEqualizerData };
    selectedDates.forEach(dateKey => {
      if (updatedBatchData[dateKey]) {
        updatedBatchData[dateKey] = {
          ...updatedBatchData[dateKey],
          ...preset
        };
        updateChartDataOptimistically(dateKey, updatedBatchData[dateKey]);
      }
    });
    setBatchEqualizerData(updatedBatchData);
  }, [batchEqualizerData, selectedDates, updateChartDataOptimistically]);

  const adjustBatchValues = useCallback((field, amount) => {
    const updatedBatchData = { ...batchEqualizerData };
    selectedDates.forEach(dateKey => {
      if (updatedBatchData[dateKey]) {
        const currentValue = updatedBatchData[dateKey][field] || 0;
        updatedBatchData[dateKey][field] = Math.max(0, currentValue + amount);
        updateChartDataOptimistically(dateKey, updatedBatchData[dateKey]);
      }
    });
    setBatchEqualizerData(updatedBatchData);
  }, [batchEqualizerData, selectedDates, updateChartDataOptimistically]);

  const handleBatchSave = useCallback(async () => {
    if (!selectedSite || selectedDates.length === 0) return;
    
    const site = sites.find(s => s.siteId === selectedSite);
    if (!site) return;

    try {
      const batchData = selectedDates.map(dateKey => {
        const data = batchEqualizerData[dateKey];
        if (!data) return null;
        
        return {
          site_id: site.name,
          date: data.date,
          data_type: data.data_type,
          total_users: data.total_users || 0,
          active_users: data.active_users || 0,
          download_bytes: data.download_bytes || 0,
          upload_bytes: data.upload_bytes || 0,
          notes: data.notes || `Batch edit for ${dateKey}`
        };
      }).filter(Boolean);

      const res = await fetch("/api/manual-data/batch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ data: batchData })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        await Swal.fire({
          title: 'Success!',
          text: `Applied adjustments to ${selectedDates.length} dates`,
          icon: 'success',
          timer: 1500,
          timerProgressBar: true,
          showConfirmButton: false
        });
        
        // Clear selections and refresh
        setSelectedDates([]);
        setBatchEqualizerData({});
        setFloatingEditorPosition(null);
        setOptimisticUpdates({});
        
        // Fast refresh
        await loadReports();
        
        setEqualizerHistory(prev => [
          ...prev,
          {
            timestamp: new Date().toISOString(),
            action: 'batch_saved',
            dates: selectedDates,
            count: selectedDates.length,
            data: batchData
          }
        ]);
      } else {
        throw new Error(data.error || 'Failed to save batch data');
      }
    } catch (err) {
      console.error("Error saving batch equalizer data", err);
      Swal.fire({
        title: 'Error',
        text: err.message,
        icon: 'error',
        confirmButtonText: 'OK'
      });
    }
  }, [selectedSite, selectedDates, sites, batchEqualizerData, token, loadReports]);

  const handleEqualizerSave = useCallback(async () => {
    if (!selectedSite) return;
    
    const site = sites.find(s => s.siteId === selectedSite);
    if (!site) return;

    if (equalizerModeType === "batch" && selectedDates.length > 0) {
      await handleBatchSave();
      return;
    }

    if (selectedDataPoint) {
      try {
        const method = editMode ? "PUT" : "POST";
        const url = "/api/manual-data";
        const payload = editMode ? {
          id: currentEditId,
          site_id: site.name,
          date: equalizerData.date,
          data_type: equalizerData.data_type,
          total_users: equalizerData.total_users,
          active_users: equalizerData.active_users,
          download_bytes: equalizerData.download_bytes,
          upload_bytes: equalizerData.upload_bytes,
          notes: equalizerData.notes
        } : {
          site_id: site.name,
          date: equalizerData.date,
          data_type: equalizerData.data_type,
          total_users: equalizerData.total_users,
          active_users: equalizerData.active_users,
          download_bytes: equalizerData.download_bytes,
          upload_bytes: equalizerData.upload_bytes,
          notes: equalizerData.notes
        };
        
        // Optimistic update first
        updateChartDataOptimistically(selectedDataPoint.date, equalizerData);
        
        const res = await fetch(url, {
          method,
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok && data.success) {
          await Swal.fire({
            title: 'Success!',
            text: editMode ? 'Data updated successfully' : 'Data added successfully',
            icon: 'success',
            timer: 1000,
            timerProgressBar: true,
            showConfirmButton: false
          });
          
          // Fast refresh
          await loadReports();
          setSelectedDataPoint(null);
          setEditMode(false);
          setCurrentEditId(null);
          setOptimisticUpdates({});
          setEqualizerHistory(prev => [
            ...prev,
            {
              timestamp: new Date().toISOString(),
              action: 'saved',
              date: equalizerData.date,
              data: { ...equalizerData }
            }
          ]);
        } else {
          throw new Error(data.error || 'Failed to save data');
        }
      } catch (err) {
        console.error("Error saving equalizer data", err);
        Swal.fire({
          title: 'Error',
          text: err.message,
          icon: 'error',
          confirmButtonText: 'OK'
        });
      }
    }
  }, [selectedSite, equalizerModeType, selectedDates, selectedDataPoint, editMode, currentEditId, equalizerData, sites, token, updateChartDataOptimistically, handleBatchSave, loadReports]);

  const handleEqualizerDelete = useCallback(async () => {
    if (equalizerModeType === "batch" && selectedDates.length > 0) {
      const result = await Swal.fire({
        title: `Delete ${selectedDates.length} Manual Data Entries?`,
        text: "This will remove manual adjustments for all selected dates",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: `Delete ${selectedDates.length} entries`,
        cancelButtonText: 'Cancel'
      });
      if (!result.isConfirmed) return;

      try {
        const site = sites.find(s => s.siteId === selectedSite);
        if (!site) return;

        const manualDataPromises = selectedDates.map(date => 
          fetchManualDataForDate(site.name, date)
        );
        const manualDataResults = await Promise.all(manualDataPromises);
        const idsToDelete = manualDataResults
          .filter(data => data && data.id)
          .map(data => data.id);

        if (idsToDelete.length > 0) {
          const res = await fetch("/api/manual-data/batch", {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ ids: idsToDelete })
          });
          const data = await res.json();
          if (res.ok && data.success) {
            await Swal.fire({
              title: 'Deleted!',
              text: `Deleted ${idsToDelete.length} manual data entries`,
              icon: 'success',
              timer: 1500,
              timerProgressBar: true,
              showConfirmButton: false
            });
            
            // Clear and refresh
            setSelectedDates([]);
            setBatchEqualizerData({});
            setFloatingEditorPosition(null);
            setOptimisticUpdates({});
            await loadReports();
            
            setEqualizerHistory(prev => [
              ...prev,
              {
                timestamp: new Date().toISOString(),
                action: 'batch_deleted',
                dates: selectedDates,
                count: idsToDelete.length
              }
            ]);
          } else {
            throw new Error(data.error || 'Failed to delete batch data');
          }
        } else {
          Swal.fire({
            title: 'No Data',
            text: 'No manual data found for selected dates',
            icon: 'info',
            timer: 1500,
            timerProgressBar: true,
            showConfirmButton: false
          });
        }
      } catch (err) {
        console.error("Error deleting batch equalizer data", err);
        Swal.fire({
          title: 'Error',
          text: err.message,
          icon: 'error',
          confirmButtonText: 'OK'
        });
      }
    } else if (currentEditId) {
      const result = await Swal.fire({
        title: 'Delete Manual Data?',
        text: "This will remove the manual adjustment for this date",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Delete',
        cancelButtonText: 'Cancel'
      });
      if (!result.isConfirmed) return;
      try {
        const res = await fetch(`/api/manual-data?id=${currentEditId}`, {
          method: "DELETE",
          headers: { "Authorization": `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok && data.success) {
          await Swal.fire({
            title: 'Deleted!',
            text: 'Manual data has been deleted.',
            icon: 'success',
            timer: 1500,
            timerProgressBar: true,
            showConfirmButton: false
          });
          
          // Clear and refresh
          setSelectedDataPoint(null);
          setEditMode(false);
          setCurrentEditId(null);
          setOptimisticUpdates({});
          await loadReports();
          
          setEqualizerHistory(prev => [
            ...prev,
            {
              timestamp: new Date().toISOString(),
              action: 'deleted',
              date: equalizerData.date,
              data: { ...equalizerData }
            }
          ]);
        } else {
          throw new Error(data.error || 'Failed to delete data');
        }
      } catch (err) {
        console.error("Error deleting equalizer data", err);
        Swal.fire({
          title: 'Error',
          text: err.message,
          icon: 'error',
          confirmButtonText: 'OK'
        });
      }
    }
  }, [equalizerModeType, selectedDates, selectedSite, sites, fetchManualDataForDate, token, currentEditId, equalizerData, loadReports]);

  const applyPreset = useCallback((preset) => {
    if (equalizerModeType === "batch") {
      applyBatchPreset(preset);
    } else {
      setEqualizerData(prev => ({ ...prev, ...preset }));
      if (selectedDataPoint) {
        updateChartDataOptimistically(selectedDataPoint.date, { ...equalizerData, ...preset });
      }
    }
  }, [equalizerModeType, applyBatchPreset, selectedDataPoint, equalizerData, updateChartDataOptimistically]);

  const adjustValue = useCallback((field, amount) => {
    if (equalizerModeType === "batch") {
      adjustBatchValues(field, amount);
    } else {
      setEqualizerData(prev => ({
        ...prev,
        [field]: Math.max(0, (prev[field] || 0) + amount)
      }));
      if (selectedDataPoint) {
        updateChartDataOptimistically(selectedDataPoint.date, {
          ...equalizerData,
          [field]: Math.max(0, (equalizerData[field] || 0) + amount)
        });
      }
    }
  }, [equalizerModeType, adjustBatchValues, selectedDataPoint, equalizerData, updateChartDataOptimistically]);

  const handleBatchSelectAll = useCallback(() => {
    const allDates = [...usersData, ...trafficData]
      .map(item => item.time || item.timeString)
      .filter((date, index, self) => date && self.indexOf(date) === index);
    
    setSelectedDates(allDates);
    
    setUsersData(prev => prev.map(item => ({ ...item, selected: true })));
    setTrafficData(prev => prev.map(item => ({ ...item, selected: true })));
  }, [usersData, trafficData]);

  const handleBatchClearSelection = useCallback(() => {
    setSelectedDates([]);
    setBatchEqualizerData({});
    setFloatingEditorPosition(null);
    setUsersData(prev => prev.map(item => ({ ...item, selected: false })));
    setTrafficData(prev => prev.map(item => ({ ...item, selected: false })));
  }, []);

  const calculateBatchSummary = useCallback(() => {
    if (selectedDates.length === 0) {
      return { totalUsers: 0, avgUsers: 0, totalDownload: { value: 0, unit: "B" }, totalUpload: { value: 0, unit: "B" } };
    }
    
    let totalUsers = 0;
    let totalDownload = 0;
    let totalUpload = 0;
    
    selectedDates.forEach(dateKey => {
      const data = batchEqualizerData[dateKey];
      if (data) {
        totalUsers += (data.total_users || 0);
        totalDownload += (data.download_bytes || 0);
        totalUpload += (data.upload_bytes || 0);
      }
    });
    
    return {
      totalUsers,
      avgUsers: Math.round(totalUsers / selectedDates.length),
      totalDownload: convertBytes(totalDownload),
      totalUpload: convertBytes(totalUpload)
    };
  }, [selectedDates, batchEqualizerData, convertBytes]);

  const calculateSummary = useCallback(() => {
    if (!usersData.length || !trafficData.length) {
      return {
        totalUsers: 0,
        activeUsers: 0,
        totalDownload: { value: 0, unit: "B" },
        totalUpload: { value: 0, unit: "B" }
      };
    }
    const totalUsers = usersData.reduce((acc, item) => acc + (item.total || 0), 0);
    const activeUsers = usersData.reduce((acc, item) => acc + (item.activeTotal || 0), 0);
    const totalDownloadBytes = trafficData.reduce((acc, item) => {
      if (item.hasBlackout) return acc;
      if (item.originalRxBytes !== undefined) return acc + (item.originalRxBytes || 0);
      let multiplier = 1;
      switch (item.unit) {
        case "KB": multiplier = 1024; break;
        case "MB": multiplier = 1024 * 1024; break;
        case "GB": multiplier = 1024 * 1024 * 1024; break;
      }
      return acc + ((item.rxBytes || 0) * multiplier);
    }, 0);
    const totalUploadBytes = trafficData.reduce((acc, item) => {
      if (item.hasBlackout) return acc;
      if (item.originalTxBytes !== undefined) return acc + (item.originalTxBytes || 0);
      let multiplier = 1;
      switch (item.unit) {
        case "KB": multiplier = 1024; break;
        case "MB": multiplier = 1024 * 1024; break;
        case "GB": multiplier = 1024 * 1024 * 1024; break;
      }
      return acc + ((item.txBytes || 0) * multiplier);
    }, 0);
    return {
      totalUsers,
      activeUsers,
      totalDownload: convertBytes(totalDownloadBytes),
      totalUpload: convertBytes(totalUploadBytes)
    };
  }, [usersData, trafficData, convertBytes]);

  const selectedSiteInfo = sites.find(s => s.siteId === selectedSite);
  const summary = calculateSummary();
  const batchSummary = calculateBatchSummary();

  // Close floating editor when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (floatingEditorPosition && !e.target.closest('.floating-editor') && !e.target.closest('circle')) {
        setFloatingEditorPosition(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [floatingEditorPosition]);

  return (
    <main className="p-4 sm:p-8 bg-gradient-to-br from-gray-900 via-gray-800 to-black min-h-screen text-white">
      <div className="container mx-auto flex flex-col md:flex-row md:gap-6">
        <div className="w-full md:w-1/3 mb-4 md:mb-0">
          <SiteList
            sites={sites}
            loading={loadingSites}
            selectedSite={selectedSite}
            searchTerm={siteSearchTerm}
            onSiteSelect={setSelectedSite}
            onSearchChange={setSiteSearchTerm}
          />
        </div>
        <div className="w-full md:w-2/3 bg-white/10 p-4 rounded-xl shadow-lg flex flex-col gap-6">
          <div className="backdrop-blur-xl bg-white/5 border border-white/10 p-5 rounded-2xl flex flex-col md:flex-row md:items-end gap-5 shadow-xl">
            <div className="flex flex-col w-full">
              <label className="text-gray-300 mb-1 font-medium tracking-wide">Start Date</label>
              <div className="relative">
                <input
                  type="date"
                  value={customStart}
                  onChange={e => setCustomStart(e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400/60 transition-all"
                />
                <span className="absolute right-3 top-3 text-gray-300">📅</span>
              </div>
            </div>
            <div className="flex flex-col w-full">
              <label className="text-gray-300 mb-1 font-medium tracking-wide">End Date</label>
              <div className="relative">
                <input
                  type="date"
                  value={customEnd}
                  onChange={e => setCustomEnd(e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400/60 transition-all"
                />
                <span className="absolute right-3 top-3 text-gray-300">📅</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setCustomStart(""); setCustomEnd(""); }}
                className="px-6 py-3 bg-red-500/80 hover:bg-red-600 rounded-xl font-semibold text-white shadow-lg transition-all backdrop-blur-lg border border-red-500/30"
              >
                Clear
              </button>
              <button
                onClick={() => {
                  setEqualizerMode(!equalizerMode);
                  setSelectedDates([]);
                  setSelectedDataPoint(null);
                  setFloatingEditorPosition(null);
                  setEqualizerModeType("single");
                }}
                className={`px-6 py-3 rounded-xl font-semibold shadow-lg transition-all backdrop-blur-lg border flex items-center gap-2 ${
                  equalizerMode 
                    ? 'bg-purple-600 hover:bg-purple-700 border-purple-500/30' 
                    : 'bg-gray-700 hover:bg-gray-600 border-gray-600/30'
                }`}
              >
                <Sliders size={20} />
                {equalizerMode ? 'Exit WINS Equalizer' : 'WINS Equalizer'}
              </button>
            </div>
          </div>
          
          {equalizerMode && (
            <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-700/50 rounded-xl p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Sliders className="text-purple-400" size={24} />
                  <h3 className="text-lg font-bold">WINS Equalizer</h3>
                  <span className="px-2 py-1 bg-purple-700/50 rounded text-sm">
                    {equalizerModeType === "single" ? "Click to adjust single point" : `${selectedDates.length} dates selected`}
                  </span>
                </div>
                <div className="text-sm text-gray-300">
                  {equalizerHistory.length} adjustments made
                </div>
              </div>
              
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => {
                    setEqualizerModeType("single");
                    setSelectedDates([]);
                    setSelectedDataPoint(null);
                    setFloatingEditorPosition(null);
                  }}
                  className={`px-3 py-2 rounded-lg flex items-center gap-2 ${
                    equalizerModeType === "single" 
                      ? 'bg-purple-600' 
                      : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                >
                  <MousePointer size={16} />
                  Single Point
                </button>
                <button
                  onClick={() => {
                    setEqualizerModeType("batch");
                    setSelectedDataPoint(null);
                  }}
                  className={`px-3 py-2 rounded-lg flex items-center gap-2 ${
                    equalizerModeType === "batch" 
                      ? 'bg-blue-600' 
                      : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                >
                  <BoxSelect size={16} />
                  Batch Edit
                </button>
                {equalizerModeType === "batch" && (
                  <>
                    <button
                      onClick={handleBatchSelectAll}
                      className="px-3 py-2 bg-green-600 hover:bg-green-700 rounded-lg flex items-center gap-2"
                    >
                      <Copy size={16} />
                      Select All
                    </button>
                    <button
                      onClick={handleBatchClearSelection}
                      className="px-3 py-2 bg-red-600 hover:bg-red-700 rounded-lg flex items-center gap-2"
                    >
                      <Scissors size={16} />
                      Clear ({selectedDates.length})
                    </button>
                  </>
                )}
              </div>
              
              {equalizerModeType === "batch" && selectedDates.length > 0 ? (
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h4 className="font-bold text-lg">
                        Batch Editing: {selectedDates.length} dates selected
                      </h4>
                      <p className="text-sm text-gray-300">
                        Apply values to multiple dates at once
                      </p>
                      {selectedDates.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {selectedDates.slice(0, 5).map((dateKey, index) => (
                            <span 
                              key={index}
                              className="px-2 py-1 bg-purple-700/30 rounded text-xs flex items-center gap-1"
                            >
                              {dayjs(dateKey, "YYYYMMDD").format("MMM D")}
                              <button
                                onClick={() => {
                                  setSelectedDates(prev => prev.filter(d => d !== dateKey));
                                  setUsersData(prev => prev.map(item => 
                                    (item.time || item.timeString) === dateKey 
                                      ? { ...item, selected: false } 
                                      : item
                                  ));
                                  setTrafficData(prev => prev.map(item => 
                                    (item.time || item.timeString) === dateKey 
                                      ? { ...item, selected: false } 
                                      : item
                                  ));
                                  if (floatingEditorPosition?.dateKey === dateKey) {
                                    setFloatingEditorPosition(null);
                                  }
                                }}
                                className="hover:text-red-400"
                              >
                                <X size={12} />
                              </button>
                            </span>
                          ))}
                          {selectedDates.length > 5 && (
                            <span className="px-2 py-1 bg-purple-700/30 rounded text-xs">
                              +{selectedDates.length - 5} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleBatchClearSelection}
                        className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => {
                          const result = Swal.fire({
                            title: `Delete ${selectedDates.length} entries?`,
                            text: "This will remove manual data for all selected dates",
                            icon: 'warning',
                            showCancelButton: true,
                            confirmButtonColor: '#d33',
                            cancelButtonColor: '#3085d6',
                            confirmButtonText: 'Delete All'
                          });
                          if (result.isConfirmed) {
                            handleEqualizerDelete();
                          }
                        }}
                        className="px-3 py-2 bg-red-600 hover:bg-red-700 rounded-lg flex items-center gap-2"
                      >
                        <Trash2 size={16} />
                        Delete All
                      </button>
                      <button
                        onClick={handleBatchSave}
                        className="px-3 py-2 bg-green-600 hover:bg-green-700 rounded-lg flex items-center gap-2"
                      >
                        <Save size={16} />
                        Save All
                      </button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 p-4 bg-gray-900/30 rounded-lg">
                    <div className="text-center">
                      <div className="text-sm text-gray-300">Total Users</div>
                      <div className="text-xl font-bold">{batchSummary.totalUsers.toLocaleString()}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm text-gray-300">Avg. Users</div>
                      <div className="text-xl font-bold">{batchSummary.avgUsers.toLocaleString()}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm text-gray-300">Total Download</div>
                      <div className="text-xl font-bold">
                        {batchSummary.totalDownload.value.toFixed(1)} {batchSummary.totalDownload.unit}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm text-gray-300">Total Upload</div>
                      <div className="text-xl font-bold">
                        {batchSummary.totalUpload.value.toFixed(1)} {batchSummary.totalUpload.unit}
                      </div>
                    </div>
                  </div>
                  
                  <div className="mb-6">
                    <div className="flex justify-between items-center mb-3">
                      <label className="block text-sm font-medium">Quick Presets (Apply to All)</label>
                      <div className="flex flex-wrap gap-2">
                        {equalizerPresets.map((preset, index) => (
                          <button
                            key={index}
                            onClick={() => applyBatchPreset(preset)}
                            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
                          >
                            {preset.name}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="bg-gray-900/50 rounded p-3">
                        <label className="block text-sm font-medium mb-2">Adjust All Users</label>
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => adjustBatchValues('total_users', -10)}
                            className="p-2 bg-gray-700 hover:bg-gray-600 rounded"
                          >
                            <ArrowDown size={16} />
                          </button>
                          <span className="px-3">-10 / +10</span>
                          <button
                            onClick={() => adjustBatchValues('total_users', 10)}
                            className="p-2 bg-gray-700 hover:bg-gray-600 rounded"
                          >
                            <ArrowUp size={16} />
                          </button>
                        </div>
                      </div>
                      
                      <div className="bg-gray-900/50 rounded p-3">
                        <label className="block text-sm font-medium mb-2">Adjust All Active</label>
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => adjustBatchValues('active_users', -10)}
                            className="p-2 bg-gray-700 hover:bg-gray-600 rounded"
                          >
                            <ArrowDown size={16} />
                          </button>
                          <span className="px-3">-10 / +10</span>
                          <button
                            onClick={() => adjustBatchValues('active_users', 10)}
                            className="p-2 bg-gray-700 hover:bg-gray-600 rounded"
                          >
                            <ArrowUp size={16} />
                          </button>
                        </div>
                      </div>
                      
                      <div className="bg-gray-900/50 rounded p-3">
                        <label className="block text-sm font-medium mb-2">Adjust All Download</label>
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => adjustBatchValues('download_bytes', -107374182)}
                            className="p-2 bg-gray-700 hover:bg-gray-600 rounded text-xs"
                          >
                            -100MB
                          </button>
                          <button
                            onClick={() => adjustBatchValues('download_bytes', 107374182)}
                            className="p-2 bg-gray-700 hover:bg-gray-600 rounded text-xs"
                          >
                            +100MB
                          </button>
                        </div>
                      </div>
                      
                      <div className="bg-gray-900/50 rounded p-3">
                        <label className="block text-sm font-medium mb-2">Adjust All Upload</label>
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => adjustBatchValues('upload_bytes', -53687091)}
                            className="p-2 bg-gray-700 hover:bg-gray-600 rounded text-xs"
                          >
                            -50MB
                          </button>
                          <button
                            onClick={() => adjustBatchValues('upload_bytes', 53687091)}
                            className="p-2 bg-gray-700 hover:bg-gray-600 rounded text-xs"
                          >
                            +50MB
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <h5 className="font-medium">Edit Individual Dates</h5>
                      <button
                        onClick={() => setExpandedBatchDate(expandedBatchDate ? null : selectedDates[0])}
                        className="text-sm text-gray-400 hover:text-white"
                      >
                        {expandedBatchDate ? 'Collapse All' : 'Expand All'}
                      </button>
                    </div>
                    
                    {selectedDates.map((dateKey, index) => {
                      const data = batchEqualizerData[dateKey];
                      if (!data) return null;
                      
                      const isExpanded = expandedBatchDate === dateKey;
                      
                      return (
                        <div key={dateKey} className="border border-gray-700 rounded-lg overflow-hidden">
                          <button
                            onClick={() => setExpandedBatchDate(isExpanded ? null : dateKey)}
                            className="w-full p-3 bg-gray-900/50 hover:bg-gray-800/50 flex justify-between items-center"
                          >
                            <div className="flex items-center gap-3">
                              <span className="font-medium">
                                {dayjs(dateKey, "YYYYMMDD").format("MMM D, YYYY")}
                              </span>
                              <span className="text-xs px-2 py-1 bg-blue-900/30 rounded">
                                {data.data_type === 'all' ? 'Users & Traffic' : data.data_type}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-300">
                                {data.total_users} users • {convertBytes(data.download_bytes).value.toFixed(1)} {convertBytes(data.download_bytes).unit} ↓
                              </span>
                              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </div>
                          </button>
                          
                          {isExpanded && (
                            <div className="p-4 bg-gray-900/30">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-sm font-medium mb-2">Data Type</label>
                                  <select
                                    value={data.data_type}
                                    onChange={(e) => handleBatchValueChange(dateKey, 'data_type', e.target.value)}
                                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded"
                                  >
                                    <option value="users">Users Data</option>
                                    <option value="traffic">Traffic Data</option>
                                    <option value="all">Both Users & Traffic</option>
                                  </select>
                                </div>
                                
                                {(data.data_type === 'users' || data.data_type === 'all') && (
                                  <>
                                    <div className="bg-gray-900/50 rounded p-3">
                                      <label className="block text-sm font-medium mb-2">Total Users</label>
                                      <div className="flex items-center gap-3">
                                        <button
                                          onClick={() => handleBatchValueChange(dateKey, 'total_users', data.total_users - 10)}
                                          className="p-2 bg-gray-700 hover:bg-gray-600 rounded"
                                        >
                                          <Minus size={16} />
                                        </button>
                                        <input
                                          type="number"
                                          value={data.total_users}
                                          onChange={(e) => handleBatchValueChange(dateKey, 'total_users', e.target.value)}
                                          className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-center"
                                        />
                                        <button
                                          onClick={() => handleBatchValueChange(dateKey, 'total_users', data.total_users + 10)}
                                          className="p-2 bg-gray-700 hover:bg-gray-600 rounded"
                                        >
                                          <Plus size={16} />
                                        </button>
                                      </div>
                                    </div>
                                    
                                    <div className="bg-gray-900/50 rounded p-3">
                                      <label className="block text-sm font-medium mb-2">Active Users</label>
                                      <div className="flex items-center gap-3">
                                        <button
                                          onClick={() => handleBatchValueChange(dateKey, 'active_users', data.active_users - 10)}
                                          className="p-2 bg-gray-700 hover:bg-gray-600 rounded"
                                        >
                                          <Minus size={16} />
                                        </button>
                                        <input
                                          type="number"
                                          value={data.active_users}
                                          onChange={(e) => handleBatchValueChange(dateKey, 'active_users', e.target.value)}
                                          className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-center"
                                        />
                                        <button
                                          onClick={() => handleBatchValueChange(dateKey, 'active_users', data.active_users + 10)}
                                          className="p-2 bg-gray-700 hover:bg-gray-600 rounded"
                                        >
                                          <Plus size={16} />
                                        </button>
                                      </div>
                                    </div>
                                  </>
                                )}
                                
                                {(data.data_type === 'traffic' || data.data_type === 'all') && (
                                  <>
                                    <div className="bg-gray-900/50 rounded p-3">
                                      <label className="block text-sm font-medium mb-2">
                                        Download ({convertBytes(data.download_bytes).value.toFixed(1)} {convertBytes(data.download_bytes).unit})
                                      </label>
                                      <div className="flex items-center gap-3">
                                        <button
                                          onClick={() => handleBatchValueChange(dateKey, 'download_bytes', data.download_bytes - 107374182)}
                                          className="p-2 bg-gray-700 hover:bg-gray-600 rounded text-xs"
                                        >
                                          -100MB
                                        </button>
                                        <input
                                          type="number"
                                          value={data.download_bytes}
                                          onChange={(e) => handleBatchValueChange(dateKey, 'download_bytes', e.target.value)}
                                          className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-center"
                                        />
                                        <button
                                          onClick={() => handleBatchValueChange(dateKey, 'download_bytes', data.download_bytes + 107374182)}
                                          className="p-2 bg-gray-700 hover:bg-gray-600 rounded text-xs"
                                        >
                                          +100MB
                                        </button>
                                      </div>
                                    </div>
                                    
                                    <div className="bg-gray-900/50 rounded p-3">
                                      <label className="block text-sm font-medium mb-2">
                                        Upload ({convertBytes(data.upload_bytes).value.toFixed(1)} {convertBytes(data.upload_bytes).unit})
                                      </label>
                                      <div className="flex items-center gap-3">
                                        <button
                                          onClick={() => handleBatchValueChange(dateKey, 'upload_bytes', data.upload_bytes - 53687091)}
                                          className="p-2 bg-gray-700 hover:bg-gray-600 rounded text-xs"
                                        >
                                          -50MB
                                        </button>
                                        <input
                                          type="number"
                                          value={data.upload_bytes}
                                          onChange={(e) => handleBatchValueChange(dateKey, 'upload_bytes', e.target.value)}
                                          className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-center"
                                        />
                                        <button
                                          onClick={() => handleBatchValueChange(dateKey, 'upload_bytes', data.upload_bytes + 53687091)}
                                          className="p-2 bg-gray-700 hover:bg-gray-600 rounded text-xs"
                                        >
                                          +50MB
                                        </button>
                                      </div>
                                    </div>
                                  </>
                                )}
                                
                                <div className="md:col-span-2">
                                  <label className="block text-sm font-medium mb-2">Notes</label>
                                  <textarea
                                    value={data.notes}
                                    onChange={(e) => handleBatchValueChange(dateKey, 'notes', e.target.value)}
                                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded"
                                    rows="2"
                                    placeholder="Add notes for this date..."
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : equalizerModeType === "batch" ? (
                <div className="text-center py-8 text-gray-300">
                  <BoxSelect className="mx-auto mb-3" size={48} />
                  <p className="text-lg mb-2">Select dates for batch editing</p>
                  <p className="text-sm">Click on data points in the charts to select multiple dates</p>
                  <p className="text-xs mt-2 text-gray-400">Selected dates will be highlighted in purple</p>
                </div>
              ) : (equalizerModeType === "single" && selectedDataPoint) ? (
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h4 className="font-bold text-lg">
                        Adjusting: {selectedDataPoint.displayDate}
                      </h4>
                      <p className="text-sm text-gray-300">
                        {editMode ? 'Editing existing manual data' : 'Creating new manual adjustment'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setSelectedDataPoint(null);
                          setSelectedDates([]);
                        }}
                        className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
                      >
                        Cancel
                      </button>
                      {editMode && (
                        <button
                          onClick={handleEqualizerDelete}
                          className="px-3 py-2 bg-red-600 hover:bg-red-700 rounded-lg flex items-center gap-2"
                        >
                          <Trash2 size={16} />
                          Delete
                        </button>
                      )}
                      <button
                        onClick={handleEqualizerSave}
                        className="px-3 py-2 bg-green-600 hover:bg-green-700 rounded-lg flex items-center gap-2"
                      >
                        <Save size={16} />
                        Save
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Data Type</label>
                      <select
                        value={equalizerData.data_type}
                        onChange={(e) => setEqualizerData({...equalizerData, data_type: e.target.value})}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded"
                      >
                        <option value="users">Users Data</option>
                        <option value="traffic">Traffic Data</option>
                        <option value="all">Both Users & Traffic</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Quick Presets</label>
                      <div className="flex flex-wrap gap-2">
                        {equalizerPresets.map((preset, index) => (
                          <button
                            key={index}
                            onClick={() => applyPreset(preset)}
                            className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm"
                          >
                            {preset.name}
                          </button>
                        ))}
                      </div>
                    </div>
                    {(equalizerData.data_type === 'users' || equalizerData.data_type === 'all') && (
                      <>
                        <div className="bg-gray-900/50 rounded p-3">
                          <label className="block text-sm font-medium mb-2">Total Users</label>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => adjustValue('total_users', -10)}
                              className="p-2 bg-gray-700 hover:bg-gray-600 rounded"
                            >
                              <Minus size={16} />
                            </button>
                            <input
                              type="number"
                              value={equalizerData.total_users}
                              onChange={(e) => setEqualizerData({...equalizerData, total_users: parseInt(e.target.value) || 0})}
                              className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-center"
                            />
                            <button
                              onClick={() => adjustValue('total_users', 10)}
                              className="p-2 bg-gray-700 hover:bg-gray-600 rounded"
                            >
                              <Plus size={16} />
                            </button>
                          </div>
                        </div>
                        <div className="bg-gray-900/50 rounded p-3">
                          <label className="block text-sm font-medium mb-2">Active Users</label>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => adjustValue('active_users', -10)}
                              className="p-2 bg-gray-700 hover:bg-gray-600 rounded"
                            >
                              <Minus size={16} />
                            </button>
                            <input
                              type="number"
                              value={equalizerData.active_users}
                              onChange={(e) => setEqualizerData({...equalizerData, active_users: parseInt(e.target.value) || 0})}
                              className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-center"
                            />
                            <button
                              onClick={() => adjustValue('active_users', 10)}
                              className="p-2 bg-gray-700 hover:bg-gray-600 rounded"
                            >
                              <Plus size={16} />
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                    {(equalizerData.data_type === 'traffic' || equalizerData.data_type === 'all') && (
                      <>
                        <div className="bg-gray-900/50 rounded p-3">
                          <label className="block text-sm font-medium mb-2">
                            Download ({convertBytes(equalizerData.download_bytes).value.toFixed(1)} {convertBytes(equalizerData.download_bytes).unit})
                          </label>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => adjustValue('download_bytes', -107374182)}
                              className="p-2 bg-gray-700 hover:bg-gray-600 rounded text-xs"
                            >
                              -100MB
                            </button>
                            <input
                              type="number"
                              value={equalizerData.download_bytes}
                              onChange={(e) => setEqualizerData({...equalizerData, download_bytes: parseInt(e.target.value) || 0})}
                              className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-center"
                            />
                            <button
                              onClick={() => adjustValue('download_bytes', 107374182)}
                              className="p-2 bg-gray-700 hover:bg-gray-600 rounded text-xs"
                            >
                              +100MB
                            </button>
                          </div>
                        </div>
                        <div className="bg-gray-900/50 rounded p-3">
                          <label className="block text-sm font-medium mb-2">
                            Upload ({convertBytes(equalizerData.upload_bytes).value.toFixed(1)} {convertBytes(equalizerData.upload_bytes).unit})
                          </label>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => adjustValue('upload_bytes', -53687091)}
                              className="p-2 bg-gray-700 hover:bg-gray-600 rounded text-xs"
                            >
                              -50MB
                            </button>
                            <input
                              type="number"
                              value={equalizerData.upload_bytes}
                              onChange={(e) => setEqualizerData({...equalizerData, upload_bytes: parseInt(e.target.value) || 0})}
                              className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-center"
                            />
                            <button
                              onClick={() => adjustValue('upload_bytes', 53687091)}
                              className="p-2 bg-gray-700 hover:bg-gray-600 rounded text-xs"
                            >
                              +50MB
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium mb-2">Notes</label>
                      <textarea
                        value={equalizerData.notes}
                        onChange={(e) => setEqualizerData({...equalizerData, notes: e.target.value})}
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded"
                        rows="2"
                        placeholder="Add notes about this adjustment..."
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-300">
                  <Sliders className="mx-auto mb-3" size={48} />
                  <p className="text-lg mb-2">Click on any data point in the charts below to adjust its values</p>
                  <p className="text-sm">Manual adjustments will override API data</p>
                </div>
              )}
            </div>
          )}
          
          {/* Floating Editor for Batch Mode */}
          {floatingEditorPosition && batchEqualizerData[floatingEditorPosition.dateKey] && (
            <div className="floating-editor">
              <FloatingBatchEditor
                dateKey={floatingEditorPosition.dateKey}
                data={batchEqualizerData[floatingEditorPosition.dateKey]}
                onChange={handleBatchValueChange}
                onClose={() => setFloatingEditorPosition(null)}
                convertBytes={convertBytes}
              />
            </div>
          )}
          
          {loadingCharts ? (
            <div className="flex justify-center items-center h-64">
              <RefreshCw className="animate-spin mr-3" />
              Loading charts...
            </div>
          ) : !selectedSite ? (
            <div className="flex justify-center items-center h-64">Select a site to view reports</div>
          ) : (
            <>
              <div className="bg-gray-800 p-4 rounded-xl">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-semibold mb-1">{selectedSiteInfo?.name}</h3>
                    <p className="text-sm text-gray-300">
                      Data Hierarchy: 
                      <span className="ml-2">
                        <span className="text-red-400">Blackout Events</span> → 
                        <span className="text-green-400 mx-2">Manual Data</span> → 
                        <span className="text-blue-400">API Data</span>
                      </span>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={loadReports}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium flex items-center gap-2"
                    >
                      <RefreshCw size={16} />
                      Refresh Data
                    </button>
                  </div>
                </div>
                {blackoutEvents.length > 0 && (
                  <div className="mt-3 p-3 bg-red-900/30 border border-red-700/50 rounded-lg">
                    <p className="text-sm font-medium text-red-300">
                      ⚠️ Active Blackout Events: {blackoutEvents.length}
                    </p>
                    <div className="mt-2 space-y-1">
                      {blackoutEvents.slice(0, 3).map((event, index) => (
                        <p key={index} className="text-xs text-red-200">
                          • {event.event}: {dayjs(event.start).format("MMM D")} - {dayjs(event.end).format("MMM D")}
                        </p>
                      ))}
                      {blackoutEvents.length > 3 && (
                        <p className="text-xs text-red-300">+ {blackoutEvents.length - 3} more events</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="bg-gray-800 p-4 rounded-xl relative">
                <h3 className="text-lg font-semibold mb-2">Users Active</h3>
                <MemoizedUsersChart
                  data={memoizedUsersData}
                  equalizerMode={equalizerMode}
                  equalizerModeType={equalizerModeType}
                  onChartClick={handleChartClick}
                />
                {equalizerMode && (
                  <div className="mt-2 text-sm text-center text-purple-300">
                    {equalizerModeType === "single" 
                      ? "💡 Click on any colored dot to adjust values"
                      : "🟣 Click to select/deselect multiple dates for batch editing"
                    }
                  </div>
                )}
              </div>
              
              <div className="bg-gray-800 p-4 rounded-xl">
                <h3 className="text-lg font-semibold mb-2">Network Traffic</h3>
                <MemoizedTrafficChart
                  data={memoizedTrafficData}
                  equalizerMode={equalizerMode}
                  equalizerModeType={equalizerModeType}
                  onChartClick={handleChartClick}
                />
                {equalizerMode && (
                  <div className="mt-2 text-sm text-center text-purple-300">
                    {equalizerModeType === "single" 
                      ? "💡 Click on any colored dot to adjust values"
                      : "🟣 Click to select/deselect multiple dates for batch editing"
                    }
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                <div className="bg-gray-700 p-4 rounded-xl shadow flex flex-col items-center">
                  <h4 className="text-sm text-gray-300 mb-1">Total Users</h4>
                  <span className="text-2xl font-bold">{summary.totalUsers.toLocaleString()}</span>
                </div>
                <div className="bg-gray-700 p-4 rounded-xl shadow flex flex-col items-center">
                  <h4 className="text-sm text-gray-300 mb-1">Active Users</h4>
                  <span className="text-2xl font-bold">{summary.activeUsers.toLocaleString()}</span>
                </div>
                <div className="bg-gray-700 p-4 rounded-xl shadow flex flex-col items-center">
                  <h4 className="text-sm text-gray-300 mb-1">Total Download</h4>
                  <span className="text-2xl font-bold">
                    {summary.totalDownload.value.toFixed(1)} {summary.totalDownload.unit}
                  </span>
                </div>
                <div className="bg-gray-700 p-4 rounded-xl shadow flex flex-col items-center">
                  <h4 className="text-sm text-gray-300 mb-1">Total Upload</h4>
                  <span className="text-2xl font-bold">
                    {summary.totalUpload.value.toFixed(1)} {summary.totalUpload.unit}
                  </span>
                </div>
              </div>
              
              {equalizerMode && equalizerHistory.length > 0 && (
                <div className="mt-4 bg-gray-800/50 rounded-xl p-4">
                  <h4 className="font-bold mb-2">Recent WINS Adjustments</h4>
                  <div className="space-y-2">
                    {equalizerHistory.slice().reverse().slice(0, 5).map((item, index) => (
                      <div key={index} className="flex justify-between items-center text-sm p-2 bg-gray-900/30 rounded">
                        <div>
                          <span className={`px-2 py-1 rounded text-xs ${
                            item.action === 'saved' || item.action === 'batch_saved' ? 'bg-green-900/50' : 
                            item.action === 'deleted' || item.action === 'batch_deleted' ? 'bg-red-900/50' : 
                            'bg-blue-900/50'
                          }`}>
                            {item.action.includes('batch') ? 'Batch ' + item.action.split('_')[1] : item.action}
                          </span>
                          <span className="ml-2">
                            {item.action.includes('batch') 
                              ? `${item.count} dates`
                              : dayjs(item.date, "YYYYMMDD").format("MMM D")
                            }
                          </span>
                        </div>
                        <div className="text-gray-400 text-xs">
                          {dayjs(item.timestamp).fromNow()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}