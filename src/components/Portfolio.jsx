import React, { useState, useMemo, useRef } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid } from 'recharts';
import { Calendar, RefreshCw, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import { fetchGoogleCalendarEvents } from '../utils/googleCalendar';
import { calculateTenKStats } from '../utils/tenKStats';

// --- NEW DATA SOURCE ---
import { FULL_HISTORY } from '../data/full_history_data';

// --- CONFIG ---
const TABS = ['7D', '4W', '16W', '1Y', 'MAX'];
const DAY_MS = 1000 * 60 * 60 * 24;

// Determine the cut-off date for historic data to cleanly merge with sync
const HISTORY_END_DATE = new Date(FULL_HISTORY[FULL_HISTORY.length - 1].date);

// --- HELPERS ---
const formatDuration = (seconds) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  if (h === 0) return `${m}m ${s}s`;
  return `${h}h ${m}m ${s}s`;
};

const formatAxisDuration = (seconds) => {
  const totalSeconds = Math.round(seconds);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
};

const formatDate = (dateStr) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const formatSecondsOnly = (seconds) => `${Math.round(seconds)}s`;

const formatMinutesSeconds = (seconds) => {
  const totalSeconds = Math.round(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
};

const getWeekNumber = (date) => {
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNumber = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  return Math.ceil((((utcDate - yearStart) / DAY_MS) + 1) / 7);
};

export default function Portfolio({ isDark, externalHistory = [], setExternalHistory = () => {} }) {
  const [activeTab, setActiveTab] = useState('7D');
  const [isSyncing, setIsSyncing] = useState(false);
  const syncAttemptRef = useRef(0);

  // --- 1. MERGE DATA SOURCES ---
  const unifiedSessions = useMemo(() => {
    const dayMap = new Map();

    // A. Static History (Convert Hours -> Seconds)
    FULL_HISTORY.forEach(d => {
      const dateKey = d.date; // "YYYY-MM-DD"
      // Store in map: duplicate dates in static file? Just in case, sum them.
      dayMap.set(dateKey, (dayMap.get(dateKey) || 0) + (d.duration * 3600));
    });

    // B. Live Calendar Data (Filter for NEW events only)
    externalHistory.forEach(s => {
      const d = new Date(s.id);
      // Only include if it's strictly AFTER the static history ends
      if (d > HISTORY_END_DATE) {
        const dateKey = d.toISOString().split('T')[0];
        // Calculate duration in seconds (assuming externalHistory duration is hours)
        const durationSeconds = s.duration * 3600; 
        dayMap.set(dateKey, (dayMap.get(dateKey) || 0) + durationSeconds);
      }
    });

    // Convert back to sorted array
    return Array.from(dayMap.entries())
      .map(([date, dailySeconds]) => ({
        date,
        dateObj: new Date(date),
        dailyPlay: dailySeconds,
      }))
      .sort((a, b) => a.dateObj - b.dateObj);
  }, [externalHistory]);

  const tenKStats = useMemo(() => calculateTenKStats(externalHistory), [externalHistory]);

  // --- 2. AGGREGATE BASED ON TAB ---
  const chartData = useMemo(() => {
    if (unifiedSessions.length === 0) return [];

    const now = new Date();
    // Helper to bucket data
    const bucketData = (data, getBucketKey, getBucketLabel) => {
        const buckets = new Map();
        data.forEach(day => {
            const key = getBucketKey(day.dateObj);
            if (!buckets.has(key)) {
                buckets.set(key, { 
                    totalPlay: 0, 
                    count: 0, 
                    label: getBucketLabel(day.dateObj), 
                    // Store the first dateObj found for this bucket for sorting/filtering
                    dateObj: day.dateObj 
                });
            }
            const b = buckets.get(key);
            b.totalPlay += day.dailyPlay;
            b.count += 1;
        });
        
        return Array.from(buckets.values())
            .map(b => ({
                date: b.label, 
                // X-Axis sorting often needs a real date object or comparable string
                sortKey: b.dateObj,
                average: b.totalPlay / b.count, 
                dailyPlay: b.totalPlay, 
                formattedDate: b.label
            }))
            .sort((a, b) => a.sortKey - b.sortKey);
    };

    if (activeTab === '7D') {
       const cutoff = new Date(now); 
       cutoff.setDate(now.getDate() - 7);
       // Ensure we include today
       cutoff.setHours(0,0,0,0);
       
       return unifiedSessions
        .filter(d => d.dateObj >= cutoff)
        .map(d => ({ 
            ...d, 
            average: d.dailyPlay, 
            formattedDate: formatDate(d.date) 
        }));
    }

    if (activeTab === '4W' || activeTab === '16W') {
       const weeksBack = activeTab === '4W' ? 4 : 16;
       const cutoff = new Date(now); 
       cutoff.setDate(now.getDate() - (weeksBack * 7));
       
       const relevantData = unifiedSessions.filter(d => d.dateObj >= cutoff);
       
       return bucketData(
           relevantData, 
           (d) => `${d.getFullYear()}-W${getWeekNumber(d)}`, 
           (d) => `W${getWeekNumber(d)}`
       );
    }

    if (activeTab === '1Y') {
        const cutoff = new Date(now); 
        cutoff.setFullYear(now.getFullYear() - 1);
        
        const relevantData = unifiedSessions.filter(d => d.dateObj >= cutoff);
        
        return bucketData(
            relevantData,
            (d) => `${d.getFullYear()}-${d.getMonth()}`,
            (d) => d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
        );
    }

    if (activeTab === 'MAX') {
        return bucketData(
            unifiedSessions,
            (d) => {
                // Trimesters: 0-3 (T1), 4-7 (T2), 8-11 (T3)
                const block = Math.floor(d.getMonth() / 4); 
                return `${d.getFullYear()}-B${block}`;
            },
            (d) => {
                const block = Math.floor(d.getMonth() / 4);
                const startMonth = new Date(0, block * 4).toLocaleDateString('en-US', { month: 'short' });
                const endMonth = new Date(0, block * 4 + 3).toLocaleDateString('en-US', { month: 'short' });
                return `${startMonth}-${endMonth} '${d.getFullYear().toString().slice(2)}`;
            }
        );
    }

    return [];
  }, [unifiedSessions, activeTab]);

  // Sync Handler (Unchanged logic, just cleaner)
  const handleSync = async () => {
    if (isSyncing) return;
    const attemptId = syncAttemptRef.current + 1;
    syncAttemptRef.current = attemptId;
    setIsSyncing(true);
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.addScope('[https://www.googleapis.com/auth/calendar.readonly](https://www.googleapis.com/auth/calendar.readonly)');
      const timeoutMs = 20000;
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Sync timed out. Please try again.")), timeoutMs);
      });
      const result = await Promise.race([
        firebase.auth().signInWithPopup(provider),
        timeoutPromise
      ]);
      if (syncAttemptRef.current !== attemptId) return;
      
      // We fetch from the very beginning to be safe, but our merge logic 
      // will gracefully ignore the duplicates.
      const events = await fetchGoogleCalendarEvents(result.credential.accessToken, new Date("2024-02-01"));
      
      const processedSessions = events.map(e => {
        if (!e.start?.dateTime || !e.end?.dateTime) return null;
        const start = new Date(e.start.dateTime);
        const end = new Date(e.end.dateTime);
        const durationHours = (end - start) / (1000 * 60 * 60);
        return { id: start.getTime(), date: start, duration: durationHours };
      }).filter(Boolean);

      if (syncAttemptRef.current === attemptId) {
        setExternalHistory(processedSessions);
      }
    } catch (error) {
      alert(error.message || "Sync failed.");
    } finally {
      if (syncAttemptRef.current === attemptId) {
        setIsSyncing(false);
      }
    }
  };

  const startPrice = chartData.length > 0 ? chartData[0].average : 0;
  const currentPrice = chartData.length > 0 ? chartData[chartData.length - 1].average : 0;
  
  // Use tenKStats for current day average if available, else fallback to chart
  const currentAverageSeconds = (activeTab === '7D' && tenKStats) ? tenKStats.avgSeconds : currentPrice;
  const totalProgressSeconds = tenKStats ? tenKStats.totalPlayedSeconds : null;
  const isProfit = currentPrice >= startPrice;
  const color = isProfit ? '#22c55e' : '#ef4444'; 

  const [hoverData, setHoverData] = useState(null);
  const displayPrice = hoverData ? hoverData.average : currentAverageSeconds;
  const displayDate = hoverData ? hoverData.formattedDate : (activeTab === '7D' ? "Current Day" : "Current Period");
  
  const changeDisplay = activeTab === '7D'
    ? formatSecondsOnly(Math.abs(currentPrice - startPrice))
    : formatMinutesSeconds(Math.abs(currentPrice - startPrice));

  const xAxisKey = activeTab === '7D' ? 'formattedDate' : 'formattedDate';

  const yDomain = useMemo(() => {
    if (!chartData.length) return ['auto', 'auto'];
    const values = chartData.map(point => point.average);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const spread = Math.max(60, (max - min) * 0.15);
    return [Math.max(0, min - spread), max + spread];
  }, [chartData]);

  return (
    <div className={`flex flex-col h-full ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}>
      
      {/* HEADER INFO */}
      <div className="p-6 pt-8 flex justify-between items-start shrink-0">
        <div>
          <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">{displayDate}</div>
          <div className={`text-4xl font-bold tracking-tight flex items-baseline gap-2 transition-colors duration-300 ${isProfit ? 'text-green-500' : 'text-red-500'}`}>
             {formatDuration(displayPrice)}
             <span className="text-sm font-medium text-slate-500">avg</span>
          </div>
          {totalProgressSeconds !== null && (
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Total Progress: {formatDuration(totalProgressSeconds)}
            </div>
          )}
          {!hoverData && (
            <div className={`mt-2 inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-white/10 ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
               {isProfit ? <ArrowUpRight size={12}/> : <ArrowDownRight size={12}/>}
               {changeDisplay} {activeTab}
            </div>
          )}
        </div>

        <button 
          onClick={handleSync} 
          disabled={isSyncing}
          className={`p-3 rounded-full transition-all active:scale-95 ${isDark ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-white text-slate-600 shadow'}`}
        >
          {isSyncing ? <RefreshCw className="animate-spin" size={20}/> : <Calendar size={20}/>}
        </button>
      </div>

      {/* CHART */}
      <div className="flex-1 w-full relative min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} onMouseMove={(e) => { if(e.activePayload) setHoverData(e.activePayload[0].payload) }} onMouseLeave={() => setHoverData(null)}>
            <CartesianGrid
              strokeDasharray="2 6"
              stroke={isDark ? 'rgba(148,163,184,0.25)' : 'rgba(148,163,184,0.35)'}
              horizontal={false}
              vertical={false}
            />
            {chartData.map((point) => (
              <ReferenceLine
                key={`grid-${point.date}`}
                x={point.date}
                strokeDasharray="2 6"
                stroke={isDark ? 'rgba(148,163,184,0.25)' : 'rgba(148,163,184,0.35)'}
              />
            ))}
            <XAxis
              dataKey={xAxisKey}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
              tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b' }}
              padding={{ left: 8, right: 8 }}
            />
            <YAxis
              domain={yDomain}
              tickFormatter={formatAxisDuration}
              axisLine={false}
              tickLine={false}
              width={56}
              tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b' }}
            />
            <defs>
              <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={color} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <Tooltip 
               content={({ active, payload }) => {
                 if (active && payload && payload.length) {
                   return (
                     <div className={`border p-3 rounded-xl shadow-2xl ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                       <p className="text-slate-400 text-xs font-bold mb-1">{payload[0].payload.formattedDate}</p>
                       <p className={`${isDark ? 'text-white' : 'text-slate-900'} font-mono font-bold`}>{formatDuration(payload[0].value)} avg</p>
                       <div className="mt-2 pt-2 border-t border-slate-700/50 flex justify-between gap-4">
                          <span className="text-xs text-slate-500">Total Played:</span>
                          <span className={`text-xs font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{formatDuration(payload[0].payload.dailyPlay)}</span>
                       </div>
                     </div>
                   );
                 }
                 return null;
               }}
            />
            <ReferenceLine y={startPrice} stroke="gray" strokeDasharray="3 3" strokeOpacity={0.3} />
            <Area 
              type="monotone" 
              dataKey="average" 
              stroke={color} 
              strokeWidth={3}
              fill="url(#colorGradient)" 
              animationDuration={1500}
              isAnimationActive={true}
              baseLine={startPrice}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* TABS */}
      <div className="p-6 pb-8 safe-area-pb shrink-0">
        <div className={`flex p-1 rounded-2xl ${isDark ? 'bg-slate-800' : 'bg-slate-200'} overflow-x-auto`}>
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 min-w-[60px] py-3 text-sm font-bold rounded-xl transition-all duration-200 ${activeTab === tab ? (isDark ? 'bg-slate-700 text-white shadow' : 'bg-white text-indigo-600 shadow') : 'text-slate-500 hover:text-slate-400'}`}
            >
              {tab === 'MAX' ? 'Max' : tab}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
