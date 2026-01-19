import React, { useState, useEffect, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid } from 'recharts';
import { Calendar, RefreshCw, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { CSV_DATA } from '../data/initialData';

// --- CONFIG ---
const TARGET_CALENDAR_NAME = "ATracker";
const GOOGLE_CLIENT_ID = "YOUR_GOOGLE_CLIENT_ID_HERE"; // <--- PASTE YOUR CLIENT ID
const GOOGLE_API_KEY = "YOUR_GOOGLE_API_KEY_HERE";     // <--- PASTE YOUR API KEY
const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest"];
const SCOPES = "https://www.googleapis.com/auth/calendar.readonly";

const TABS = ['1D', '7D', '30D', '1Y', 'MAX'];

// Constants for the Legacy Data (Start Feb 1, 2024)
const LEGACY_START_DATE = new Date("2024-02-01");
const BASE_LOG_DATE = new Date("2026-01-17");
const LEGACY_HOURS = 1015;
const LEGACY_MINUTES = 46;
const LEGACY_TOTAL_SECONDS = (LEGACY_HOURS * 3600) + (LEGACY_MINUTES * 60);

const formatDuration = (seconds) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  if (h === 0) return `${m}m ${s}s`;
  return `${h}h ${m}m ${s}s`;
};

const formatDate = (dateStr) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export default function Portfolio({ isDark }) {
  const [activeTab, setActiveTab] = useState('7D');
  const [sessions, setSessions] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [gapiLoaded, setGapiLoaded] = useState(false);
  const [user, setUser] = useState(null);
  const isGoogleConfigured = GOOGLE_CLIENT_ID !== "YOUR_GOOGLE_CLIENT_ID_HERE" && GOOGLE_API_KEY !== "YOUR_GOOGLE_API_KEY_HERE";

  // 1. Initialize Data from CSV
  useEffect(() => {
    const initial = CSV_DATA.map(d => ({
      id: d.start,
      start: new Date(d.start),
      duration: d.duration, 
      source: 'csv'
    }));
    setSessions(initial);
  }, []);

  // 2. Google Auth Setup (Load script dynamically if not present)
  useEffect(() => {
    if (!isGoogleConfigured) return;
    const initClient = () => {
      window.gapi.client.init({
        apiKey: GOOGLE_API_KEY,
        clientId: GOOGLE_CLIENT_ID,
        discoveryDocs: DISCOVERY_DOCS,
        scope: SCOPES,
      }).then(() => {
        setGapiLoaded(true);
        const authInstance = window.gapi.auth2.getAuthInstance();
        setUser(authInstance.isSignedIn.get() ? authInstance.currentUser.get() : null);
        authInstance.isSignedIn.listen(isSignedIn => {
          setUser(isSignedIn ? authInstance.currentUser.get() : null);
        });
      });
    };

    if (!window.gapi) {
        const script = document.createElement('script');
        script.src = "https://apis.google.com/js/api.js";
        script.onload = () => window.gapi.load('client:auth2', initClient);
        document.body.appendChild(script);
    } else {
        window.gapi.load('client:auth2', initClient);
    }
  }, []);

  const handleSync = async () => {
    if (!isGoogleConfigured) {
      alert("Google Calendar sync isn't configured yet.");
      return;
    }
    if (!gapiLoaded) return;
    if (!user) {
      window.gapi.auth2.getAuthInstance().signIn();
      return;
    }

    setIsSyncing(true);
    try {
      const calList = await window.gapi.client.calendar.calendarList.list();
      const targetCal = calList.result.items.find(c => 
        c.summary.toLowerCase() === TARGET_CALENDAR_NAME.toLowerCase()
      );

      if (!targetCal) {
        alert(`Calendar "${TARGET_CALENDAR_NAME}" not found.`);
        setIsSyncing(false);
        return;
      }

      const now = new Date();
      const syncStart = now < BASE_LOG_DATE ? LEGACY_START_DATE : BASE_LOG_DATE;

      const events = await window.gapi.client.calendar.events.list({
        calendarId: targetCal.id,
        timeMin: syncStart.toISOString(),
        showDeleted: false,
        singleEvents: true,
        orderBy: 'startTime'
      });

      const newSessions = events.result.items.map(e => {
        if (!e.start.dateTime || !e.end.dateTime) return null;
        const start = new Date(e.start.dateTime);
        const end = new Date(e.end.dateTime);
        const duration = (end - start) / 1000;
        return {
          id: e.id,
          start: start,
          duration: duration,
          source: 'google'
        };
      }).filter(Boolean);

      setSessions(prev => {
        const existingIds = new Set(prev.map(p => p.start.getTime()));
        const uniqueNew = newSessions.filter(n => !existingIds.has(n.start.getTime()));
        return [...prev, ...uniqueNew].sort((a, b) => a.start - b.start);
      });

    } catch (error) {
      console.error("Sync Error", error);
      alert("Failed to sync. Check console.");
    } finally {
      setIsSyncing(false);
    }
  };

  // 3. Process Data for Chart
  const chartData = useMemo(() => {
    if (sessions.length === 0) return [];

    const sorted = [...sessions].sort((a, b) => a.start - b.start);
    const firstDataDate = sorted[0].start; // Dec 17, 2025
    
    // We calculate the average starting from the LEGACY DATE (Feb 1 2024)
    // but we only Plot the chart from the CSV Start date (Dec 17 2025)
    
    const dayMs = 1000 * 60 * 60 * 24;

    // Fill days from CSV start to Today
    const dayMap = new Map();
    let curr = new Date(firstDataDate);
    curr.setHours(0,0,0,0);
    const today = new Date();
    today.setHours(0,0,0,0);

    while (curr <= today) {
      dayMap.set(curr.toISOString().split('T')[0], 0);
      curr.setDate(curr.getDate() + 1);
    }

    // Populate play time from CSV/Google
    sorted.forEach(s => {
      const dStr = s.start.toISOString().split('T')[0];
      if (dayMap.has(dStr)) {
        dayMap.set(dStr, dayMap.get(dStr) + s.duration);
      }
    });

    let cumulativeSeconds = LEGACY_TOTAL_SECONDS;

    const dataPoints = [];

    for (const [dateStr, dailySeconds] of dayMap) {
      cumulativeSeconds += dailySeconds;
      const dayDate = new Date(dateStr);
      const daysElapsed = Math.floor((dayDate - LEGACY_START_DATE) / dayMs);
      if (daysElapsed <= 0) continue;
      const averageSoFar = cumulativeSeconds / daysElapsed;
      
      dataPoints.push({
        date: dateStr,
        average: averageSoFar,
        dailyPlay: dailySeconds,
        formattedDate: formatDate(dateStr)
      });
    }

    return dataPoints;
  }, [sessions]);

  // 4. Filter by Tab
  const filteredData = useMemo(() => {
    if (chartData.length === 0) return [];
    const now = new Date();
    let daysToSubtract = 0;
    if (activeTab === '1D') daysToSubtract = 1;
    if (activeTab === '7D') daysToSubtract = 7;
    if (activeTab === '30D') daysToSubtract = 30;
    if (activeTab === '1Y') daysToSubtract = 365;
    if (activeTab === 'MAX') return chartData;

    const cutoff = new Date();
    cutoff.setDate(now.getDate() - daysToSubtract);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    
    return chartData.filter(d => d.date >= cutoffStr);
  }, [chartData, activeTab]);

  const startPrice = filteredData.length > 0 ? filteredData[0].average : 0;
  const currentPrice = filteredData.length > 0 ? filteredData[filteredData.length - 1].average : 0;
  const isProfit = currentPrice >= startPrice;
  const color = isProfit ? '#22c55e' : '#ef4444'; 

  const [hoverData, setHoverData] = useState(null);
  const displayPrice = hoverData ? hoverData.average : currentPrice;
  const displayDate = hoverData ? hoverData.formattedDate : "Current";
  const changeDisplay = formatDuration(Math.abs(currentPrice - startPrice));

  const yDomain = useMemo(() => {
    if (!filteredData.length) return ['auto', 'auto'];
    const values = filteredData.map(point => point.average);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const spread = Math.max(60, (max - min) * 0.15);
    return [Math.max(0, min - spread), max + spread];
  }, [filteredData]);

  return (
    <div className={`flex flex-col h-full ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}>
      
      {/* HEADER INFO */}
      <div className="p-6 pt-8 flex justify-between items-start shrink-0">
        <div>
          <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">{displayDate}</div>
          <div className={`text-4xl font-bold tracking-tight flex items-baseline gap-2 transition-colors duration-300 ${isProfit ? 'text-green-500' : 'text-red-500'}`}>
             {formatDuration(displayPrice)}
             <span className="text-sm font-medium text-slate-500">avg/day</span>
          </div>
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
          <AreaChart data={filteredData} onMouseMove={(e) => { if(e.activePayload) setHoverData(e.activePayload[0].payload) }} onMouseLeave={() => setHoverData(null)}>
            <CartesianGrid
              strokeDasharray="2 6"
              stroke={isDark ? 'rgba(148,163,184,0.25)' : 'rgba(148,163,184,0.35)'}
              vertical
              horizontal={false}
            />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
              tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b' }}
              padding={{ left: 8, right: 8 }}
            />
            <YAxis domain={yDomain} hide />
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
                          <span className="text-xs text-slate-500">Played:</span>
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
        <div className={`flex p-1 rounded-2xl ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all duration-200 ${activeTab === tab ? (isDark ? 'bg-slate-700 text-white shadow' : 'bg-white text-indigo-600 shadow') : 'text-slate-500 hover:text-slate-400'}`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
