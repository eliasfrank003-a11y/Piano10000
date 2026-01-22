import React, { useState, useMemo, useRef } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid } from 'recharts';
import { Calendar, RefreshCw, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import { CSV_DATA } from '../data/initialData';
import { fetchGoogleCalendarEvents } from '../utils/googleCalendar';
import { calculateTenKStats } from '../utils/tenKStats';

// --- CONFIG ---
const TABS = ['7D', '4W', '16W'];

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

const DAY_MS = 1000 * 60 * 60 * 24;

const formatDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateKey = (dateKey) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
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

  const csvSessions = useMemo(() => CSV_DATA.map(d => ({
    id: d.start,
    start: new Date(d.start),
    duration: d.duration,
    source: 'csv'
  })), []);

  const syncedSessions = useMemo(() => externalHistory
    .filter(s => new Date(s.id) > BASE_LOG_DATE)
    .map(s => ({
      id: s.id,
      start: new Date(s.id),
      duration: s.duration * 3600,
      source: 'google'
    })), [externalHistory]);

  const sessions = useMemo(() => [...csvSessions, ...syncedSessions].sort((a, b) => a.start - b.start), [csvSessions, syncedSessions]);
  const tenKStats = useMemo(() => calculateTenKStats(externalHistory), [externalHistory]);

  const handleSync = async () => {
    if (isSyncing) return;
    const attemptId = syncAttemptRef.current + 1;
    syncAttemptRef.current = attemptId;
    setIsSyncing(true);
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/calendar.readonly');
      const timeoutMs = 20000;
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Sync timed out. Please try again.")), timeoutMs);
      });
      const result = await Promise.race([
        firebase.auth().signInWithPopup(provider),
        timeoutPromise
      ]);
      if (syncAttemptRef.current !== attemptId) return;
      const events = await fetchGoogleCalendarEvents(result.credential.accessToken, LEGACY_START_DATE);
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
      let msg = error.message || "Sync failed. Please try again.";
      if (msg.includes("popup-blocked")) {
        try {
          const provider = new firebase.auth.GoogleAuthProvider();
          provider.addScope('https://www.googleapis.com/auth/calendar.readonly');
          await firebase.auth().signInWithRedirect(provider);
          return;
        } catch (redirectError) {
          msg = redirectError.message || "Popup blocked. Redirect failed. Please try again.";
        }
      } else if (msg.includes("popup-closed-by-user")) {
        msg = "Popup closed before completing sign-in.";
      } else if (msg.includes("auth/cancelled-popup-request")) {
        msg = "Sign-in already in progress. Please try again.";
      }
      msg = msg.replace("Firebase: ", "").replace(/\(.*\)/, "");
      if (msg.includes("Legacy People API")) {
        msg = "Please enable the Google Calendar API in your Google Cloud Console.";
      }
      alert(msg);
    } finally {
      if (syncAttemptRef.current === attemptId) {
        setIsSyncing(false);
      }
    }
  };

  // 3. Process Data for Chart
  const chartData = useMemo(() => {
    if (sessions.length === 0) return [];

    const sorted = [...sessions].sort((a, b) => a.start - b.start);
    const firstDataDate = sorted[0].start;

    const csvTotalSeconds = csvSessions.reduce((sum, session) => sum + session.duration, 0);
    const baselineSeconds = Math.max(0, LEGACY_TOTAL_SECONDS - csvTotalSeconds);

    // Fill days from CSV start to Today (includes today even if 0)
    const dayMap = new Map();
    let curr = new Date(firstDataDate);
    curr.setHours(0, 0, 0, 0);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Ensure loop goes UP TO and INCLUDING today
    while (curr <= today) {
      dayMap.set(formatDateKey(curr), 0);
      curr.setDate(curr.getDate() + 1);
    }

    // Populate play time from CSV/Google
    sorted.forEach(s => {
      const dStr = formatDateKey(s.start);
      if (dayMap.has(dStr)) {
        dayMap.set(dStr, dayMap.get(dStr) + s.duration);
      }
    });

    let cumulativeSeconds = baselineSeconds;
    const dataPoints = [];

    for (const [dateStr, dailySeconds] of dayMap) {
      cumulativeSeconds += dailySeconds;
      const dayDate = parseDateKey(dateStr);
      const daysElapsed = Math.floor((dayDate - LEGACY_START_DATE) / DAY_MS);
      if (daysElapsed <= 0) continue;
      const averageSoFar = Math.round(cumulativeSeconds / daysElapsed);

      dataPoints.push({
        date: dateStr,
        dateObj: dayDate,
        average: averageSoFar,
        dailyPlay: dailySeconds,
        formattedDate: formatDate(dateStr)
      });
    }

    return dataPoints;
  }, [sessions, csvSessions]);

  // 4. Filter by Tab
  const filteredData = useMemo(() => {
    if (chartData.length === 0) return [];
    
    // Define the absolute end of the current day to ensure "Today" is included in <= comparisons
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    if (activeTab === '7D') {
      const start = new Date(startOfToday);
      start.setDate(startOfToday.getDate() - 6);
      return chartData.filter(d => d.dateObj >= start && d.dateObj <= endOfToday);
    }

    if (activeTab === '4W') {
      const start = new Date(startOfToday);
      start.setDate(startOfToday.getDate() - 27);
      
      const rangeData = chartData.filter(d => d.dateObj >= start && d.dateObj <= endOfToday);
      
      return Array.from({ length: 4 }, (_, index) => {
        const bucketStart = new Date(start);
        bucketStart.setDate(start.getDate() + (index * 7));
        const bucketEnd = new Date(bucketStart);
        bucketEnd.setDate(bucketStart.getDate() + 6);
        // Ensure bucketEnd captures the full day if it is today
        bucketEnd.setHours(23, 59, 59, 999);

        const bucketPoints = rangeData.filter(d => d.dateObj >= bucketStart && d.dateObj <= bucketEnd);
        const average = bucketPoints.length ? bucketPoints[bucketPoints.length - 1].average : 0;
        const dailyPlay = bucketPoints.reduce((sum, point) => sum + point.dailyPlay, 0);
        const weekNumber = getWeekNumber(bucketStart);
        
        return {
          date: formatDateKey(bucketStart),
          dateObj: bucketStart,
          label: `Week ${weekNumber}`,
          average,
          dailyPlay,
          formattedDate: `Week ${weekNumber}`
        };
      });
    }

    if (activeTab === '16W') {
      const start = new Date(startOfToday);
      start.setDate(startOfToday.getDate() - 111);
      
      const rangeData = chartData.filter(d => d.dateObj >= start && d.dateObj <= endOfToday);
      
      return Array.from({ length: 16 }, (_, index) => {
        const bucketStart = new Date(start);
        bucketStart.setDate(start.getDate() + (index * 7));
        const bucketEnd = new Date(bucketStart);
        bucketEnd.setDate(bucketStart.getDate() + 6);
        // Ensure bucketEnd captures the full day if it is today
        bucketEnd.setHours(23, 59, 59, 999);

        const bucketPoints = rangeData.filter(d => d.dateObj >= bucketStart && d.dateObj <= bucketEnd);
        const average = bucketPoints.length ? bucketPoints[bucketPoints.length - 1].average : 0;
        const dailyPlay = bucketPoints.reduce((sum, point) => sum + point.dailyPlay, 0);
        const weekNumber = getWeekNumber(bucketStart);
        
        return {
          date: formatDateKey(bucketStart),
          dateObj: bucketStart,
          label: `Week ${weekNumber}`,
          average,
          dailyPlay,
          formattedDate: `Week ${weekNumber}`
        };
      });
    }
    
    return chartData;
  }, [chartData, activeTab]);

  const startPrice = filteredData.length > 0 ? filteredData[0].average : 0;
  const currentPrice = filteredData.length > 0 ? filteredData[filteredData.length - 1].average : 0;
  const currentAverageSeconds = tenKStats ? tenKStats.avgSeconds : currentPrice;
  const totalProgressSeconds = tenKStats ? tenKStats.totalPlayedSeconds : null;
  const isProfit = currentPrice >= startPrice;
  const color = isProfit ? '#22c55e' : '#ef4444'; 

  const [hoverData, setHoverData] = useState(null);
  const displayPrice = hoverData ? hoverData.average : currentAverageSeconds;
  const displayDate = hoverData ? hoverData.formattedDate : "Current";
  const changeDisplay = activeTab === '7D'
    ? formatSecondsOnly(Math.abs(currentPrice - startPrice))
    : formatMinutesSeconds(Math.abs(currentPrice - startPrice));

  const xAxisKey = activeTab === '7D' ? 'date' : 'label';

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
          <AreaChart data={filteredData} onMouseMove={(e) => { if(e.activePayload) setHoverData(e.activePayload[0].payload) }} onMouseLeave={() => setHoverData(null)}>
            <CartesianGrid
              strokeDasharray="2 6"
              stroke={isDark ? 'rgba(148,163,184,0.25)' : 'rgba(148,163,184,0.35)'}
              horizontal={false}
              vertical={false}
            />
            {filteredData.map((point) => (
              <ReferenceLine
                key={`grid-${point[xAxisKey]}`}
                x={point[xAxisKey]}
                strokeDasharray="2 6"
                stroke={isDark ? 'rgba(148,163,184,0.25)' : 'rgba(148,163,184,0.35)'}
              />
            ))}
            <XAxis
              dataKey={xAxisKey}
              tickFormatter={activeTab === '7D' ? formatDate : (value) => value}
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
              {tab === '7D' ? '7 Days' : tab === '4W' ? '4 Weeks' : '16 Weeks'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
