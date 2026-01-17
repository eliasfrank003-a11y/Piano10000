import React, { useState, useMemo, useEffect } from 'react';
import { Info, Crown, Star, TrendingUp, TrendingDown, RefreshCw, Calendar, CheckCircle, AlertCircle } from 'lucide-react';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';

// --- CONSTANTS ---
const START_DATE = new Date("2024-02-01");
// The "Base" you provided: 1015 hours and 46 minutes as of Jan 17, 2026
const BASE_HOURS_LOGGED = 1015 + (46 / 60); 
const BASE_LOG_DATE = new Date("2026-01-17"); // The cutoff date for the base

const LEGACY_MILESTONES = [
  { hours: 900, date: new Date("2025-11-08"), avg: "1h 24m", type: 'legacy' },
  { hours: 800, date: new Date("2025-08-18"), avg: "1h 25m", type: 'legacy' },
  { hours: 700, date: new Date("2025-06-30"), avg: "1h 22m", type: 'legacy' },
  { hours: 600, date: new Date("2025-04-30"), avg: "1h 20m", type: 'legacy' },
  { hours: 500, date: new Date("2024-12-31"), avg: "1h 29m", type: 'legacy' },
  { hours: 400, date: new Date("2024-11-13"), avg: "1h 24m", type: 'legacy' },
];

// --- HELPERS ---
function formatDecimalToHMS(decimalHours) {
  const totalSeconds = Math.round(decimalHours * 3600);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}h ${m}m ${s}s`;
}

function calculateDaysAgo(date) {
  const now = new Date();
  const diffTime = Math.abs(now - date);
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

function formatYearsMonthsSincePlain(dateObj) {
  const now = new Date();
  let years = now.getFullYear() - dateObj.getFullYear();
  let months = now.getMonth() - dateObj.getMonth();
  if (now.getDate() < dateObj.getDate()) months -= 1;
  if (months < 0) { years -= 1; months += 12; }
  return { years, months, text: `${years} year ${months} month` };
}

// --- GOOGLE CALENDAR FETCH ---
async function fetchGoogleCalendarEvents(token) {
  try {
    // 1. Find the Calendar ID for "ATracker"
    const listResponse = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const listData = await listResponse.json();
    
    // Look for "ATracker" (case insensitive just in case)
    const calendar = listData.items?.find(c => c.summary.toLowerCase() === 'atracker');
    
    if (!calendar) {
      throw new Error("Calendar 'ATracker' not found.");
    }

    // 2. Fetch Events from Start Date (Feb 1 2024) until Now
    // We fetch EVERYTHING to build the daily history graph accurately
    let allEvents = [];
    let pageToken = null;
    
    do {
      let url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.id)}/events?singleEvents=true&orderBy=startTime&timeMin=${START_DATE.toISOString()}&maxResults=2500`;
      if (pageToken) url += `&pageToken=${pageToken}`;
      
      const eventsResponse = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const eventsData = await eventsResponse.json();
      if (eventsData.items) allEvents = allEvents.concat(eventsData.items);
      pageToken = eventsData.nextPageToken;
    } while (pageToken);

    return allEvents;
  } catch (error) {
    console.error("Google Sync Error:", error);
    throw error;
  }
}

const Tracker = ({
  tenKData,
  setTenKData,
  customMilestones = [],
  addCustomMilestone,
  editCustomMilestone,
  deleteCustomMilestone,
  intervalMilestones = [],
  setIntervalMilestones,
  legacyMeta = {},
  setLegacyMeta,
  onIntervalAdded,
  externalHistory = [],
  setExternalHistory
}) => {
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState(null);
  const [graphRange, setGraphRange] = useState(7); // 7 or 30
  
  // --- AUTH & SYNC HANDLER ---
  const handleGoogleSync = async () => {
    setIsSyncing(true);
    setSyncError(null);
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/calendar.events.readonly');
      
      const result = await firebase.auth().signInWithPopup(provider);
      const token = result.credential.accessToken;
      
      const events = await fetchGoogleCalendarEvents(token);
      
      // Process Events
      const processedSessions = events.map(e => {
        if (!e.start?.dateTime || !e.end?.dateTime) return null;
        const start = new Date(e.start.dateTime);
        const end = new Date(e.end.dateTime);
        const durationHours = (end - start) / (1000 * 60 * 60);
        return {
          id: start.getTime(),
          date: start,
          duration: durationHours
        };
      }).filter(Boolean);

      setExternalHistory(processedSessions);
      alert(`Successfully synced ${processedSessions.length} sessions from ATracker!`);
      
    } catch (err) {
      setSyncError(err.message);
      alert("Sync failed: " + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  // --- STATS ENGINE ---
  const stats = useMemo(() => {
    // 1. Calculate Total Hours
    // Strategy: BASE_HOURS (manual pre-2026) + Events AFTER Base Date
    // OR: If we have full history in calendar, use calendar? 
    // The user said: "current base hour is 1015... anything added after this should update"
    
    // Filter events that are NEWER than the manual base log date
    const newEvents = externalHistory.filter(s => new Date(s.id) > BASE_LOG_DATE);
    const newHours = newEvents.reduce((acc, s) => acc + s.duration, 0);
    
    const totalPlayed = BASE_HOURS_LOGGED + newHours;

    const now = new Date();
    const timeDiff = now - START_DATE;
    const daysPassed = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    
    if (daysPassed <= 0) return null;

    const avgHoursPerDay = totalPlayed / daysPassed;
    const percentage = Math.min(100, (totalPlayed / 10000) * 100).toFixed(2);
    
    // ... (Standard logic for projections)
    const remainingHours = 10000 - totalPlayed;
    const daysRemaining = remainingHours / avgHoursPerDay;
    const finishDate = new Date();
    finishDate.setDate(now.getDate() + daysRemaining);

    return {
      totalPlayed,
      daysPassed,
      avgNumeric: avgHoursPerDay,
      avgDisplay: formatDecimalToHMS(avgHoursPerDay),
      percentage,
      finishDate: finishDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      remainingHours,
      daysRemaining
    };
  }, [externalHistory]);

  // --- DELTA GRAPH ENGINE ---
  const deltaGraphData = useMemo(() => {
    if (externalHistory.length === 0) return null;

    // We need to replay history day by day to get the moving average
    // We'll simulate from (Today - Range) to Today
    
    const daysToRender = graphRange;
    const dataPoints = [];
    const now = new Date();
    
    // Create a map of Daily Play time from history
    const dailyPlayMap = {};
    externalHistory.forEach(s => {
        const key = new Date(s.id).toDateString();
        dailyPlayMap[key] = (dailyPlayMap[key] || 0) + s.duration;
    });

    // We need the "Total Hours" and "Total Days" state at the START of our window
    // to calculate the first delta accurately.
    // Approximate backwards:
    
    let currentTotal = stats ? stats.totalPlayed : 0;
    let currentDays = stats ? stats.daysPassed : 1;

    // Loop BACKWARDS from today
    for (let i = 0; i < daysToRender; i++) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        const dayKey = d.toDateString();
        
        const playedToday = dailyPlayMap[dayKey] || 0;
        
        // Avg TODAY
        const avgToday = currentTotal / currentDays;
        
        // State YESTERDAY
        const prevTotal = currentTotal - playedToday;
        const prevDays = currentDays - 1;
        const avgYesterday = prevDays > 0 ? prevTotal / prevDays : avgToday;
        
        // Delta: How much did the average CHANGE today? (in seconds)
        const deltaSeconds = (avgToday - avgYesterday) * 3600;
        
        dataPoints.unshift({
            day: d.toLocaleDateString('en-US', { weekday: 'narrow' }),
            fullDate: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            delta: deltaSeconds,
            played: playedToday
        });

        // Step back
        currentTotal = prevTotal;
        currentDays = prevDays;
    }
    
    return dataPoints;
  }, [externalHistory, stats, graphRange]);


  // --- COMPONENT RENDER ---
  return (
    <div className="flex-1 flex flex-col p-6 overflow-y-auto w-full animate-in fade-in zoom-in duration-300 scroller-fix pb-24">
      
      {/* --- AUTOMATION HEADER --- */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm mb-6 border border-slate-100 dark:border-slate-700 relative overflow-hidden">
        <div className="flex justify-between items-start mb-4 relative z-10">
           <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-1">Total Progress</h2>
              <div className="text-3xl font-bold text-slate-900 dark:text-white flex items-baseline gap-2">
                 {stats ? Math.floor(stats.totalPlayed) : 0} 
                 <span className="text-sm font-normal text-slate-500">Hours</span>
                 {stats && <span className="text-sm font-normal text-slate-400"> {Math.round((stats.totalPlayed % 1)*60)}m</span>}
              </div>
           </div>
           
           <button 
             onClick={handleGoogleSync}
             disabled={isSyncing}
             className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all ${isSyncing ? 'bg-slate-100 text-slate-400' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200 dark:shadow-none'}`}
           >
             {isSyncing ? <RefreshCw className="animate-spin" size={16}/> : <Calendar size={16}/>}
             {isSyncing ? 'Syncing...' : 'Sync ATracker'}
           </button>
        </div>

        {syncError && (
          <div className="flex items-center gap-2 text-red-500 text-xs font-bold bg-red-50 dark:bg-red-900/20 p-3 rounded-lg mb-2">
             <AlertCircle size={14}/> {syncError}
          </div>
        )}

        <div className="text-xs text-slate-400 flex gap-4">
           <span className="flex items-center gap-1"><CheckCircle size={12}/> Auto-calc enabled</span>
           <span>Base: {Math.floor(BASE_HOURS_LOGGED)}h (Jan 17)</span>
        </div>
      </div>
      
      {/* --- STOCK STYLE DELTA GRAPH --- */}
      {deltaGraphData && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm mb-6 border border-slate-100 dark:border-slate-700">
             <div className="flex justify-between items-center mb-6">
                 <div className="text-sm font-bold uppercase tracking-wider text-slate-400">Average Momentum</div>
                 <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
                    <button onClick={() => setGraphRange(7)} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${graphRange === 7 ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white' : 'text-slate-400'}`}>7D</button>
                    <button onClick={() => setGraphRange(30)} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${graphRange === 30 ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white' : 'text-slate-400'}`}>30D</button>
                 </div>
             </div>

             {/* THE GRAPH VISUALIZATION */}
             <div className="h-40 w-full flex items-end gap-1 relative">
                {/* Zero Line */}
                <div className="absolute top-1/2 left-0 right-0 h-px bg-slate-200 dark:bg-slate-700 border-t border-dashed border-slate-300 dark:border-slate-600 z-0"></div>
                
                {deltaGraphData.map((d, i) => {
                    const val = d.delta;
                    const isPos = val >= 0;
                    // Logarithmic-ish scaling for visual clarity so small deltas still show
                    const absVal = Math.abs(val);
                    const height = Math.min(absVal * 3, 75); // Cap height at 75px (half container)
                    
                    return (
                        <div key={i} className="flex-1 flex flex-col justify-center items-center h-full relative group">
                            {/* Tooltip */}
                            <div className="absolute -top-8 bg-slate-900 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity z-20 whitespace-nowrap pointer-events-none">
                                {d.fullDate}: {val > 0 ? '+' : ''}{val.toFixed(1)}s
                            </div>

                            {/* Bar */}
                            <div className="w-full flex flex-col justify-center items-center h-full">
                                <div 
                                    className={`w-1.5 sm:w-2 rounded-full transition-all duration-500 ${isPos ? 'bg-green-500' : 'bg-red-500'} ${absVal === 0 ? 'opacity-20 bg-slate-400 h-1' : ''}`}
                                    style={{ 
                                        height: `${Math.max(4, height)}px`, // Min height 4px
                                        transform: isPos ? `translateY(-${height/2}px)` : `translateY(${height/2}px)`
                                    }}
                                ></div>
                            </div>
                            
                            {/* X Axis Label (Only show some to avoid clutter) */}
                            {(graphRange === 7 || i % 5 === 0) && (
                                <div className="absolute bottom-0 text-[9px] font-bold text-slate-300 dark:text-slate-600 uppercase">
                                    {d.day}
                                </div>
                            )}
                        </div>
                    )
                })}
             </div>
          </div>
      )}

      {/* --- LEGACY STATS (Milestones etc) --- */}
      {stats && (
          <div className="mt-4">
            <div className="flex justify-between text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">
              <span>MASTERY</span>
              <span>{stats.percentage}%</span>
            </div>
            <div className="h-6 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden shadow-inner relative">
              <div className="h-full bg-green-500 transition-all duration-1000 ease-out relative" style={{ width: `${stats.percentage}%` }}>
                <div className="absolute inset-0 bg-white/20"></div>
              </div>
            </div>
            
             <div className="relative mt-12 pl-4">
                <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-slate-200 dark:bg-slate-700"></div>
                {/* Render estimated finish */}
                <div className="mb-8 pl-8 relative">
                   <div className="absolute left-[-5px] top-2 w-3 h-3 rounded-full bg-slate-400 ring-4 ring-white dark:ring-slate-900"></div>
                   <div className="text-xs font-bold text-slate-400">ESTIMATED FINISH</div>
                   <div className="text-lg font-bold text-slate-800 dark:text-white">{stats.finishDate}</div>
                </div>
             </div>
          </div>
      )}
    </div>
  );
};

export default Tracker;
