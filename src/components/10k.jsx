import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Plus, Info, Edit2, Trash, Crown, Star, Calendar, RefreshCw, AlertCircle } from 'lucide-react';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';

// --- CONSTANTS ---
const START_DATE = new Date("2024-02-01");
const BASE_HOURS_LOGGED = 1015 + (46 / 60); 
const BASE_LOG_DATE = new Date("2026-01-17");

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
  const s = Math.round(totalSeconds % 60);
  
  if (h === 0) {
      if (m === 0) return `${s}s`;
      return `${m}m ${s}s`;
  }
  return `${h}h ${m}m ${s}s`;
}

function calculateDaysAgo(date) {
  const now = new Date();
  const diffTime = Math.abs(now - date);
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

function formatAvgTime(str) {
  if (!str) return "";
  if (str.includes('h') && str.includes('m')) return str;
  let match = str.match(/^(\d+):(\d+):(\d+)$/);
  if (match) return `${parseInt(match[1])}h ${parseInt(match[2])}m ${parseInt(match[3])}s`;
  match = str.match(/^(\d+):(\d+)$/);
  if (match) return `${parseInt(match[1])}h ${parseInt(match[2])}m`;
  
  if (/^\d{5,6}$/.test(str)) {
     const s = parseInt(str.slice(-2), 10);
     const m = parseInt(str.slice(-4, -2), 10);
     const h = parseInt(str.slice(0, -4), 10);
     return `${h}h ${m}m ${s}s`;
  }
  if (/^\d{3,4}$/.test(str)) {
     const m = parseInt(str.slice(-2), 10);
     const h = parseInt(str.slice(0, -2), 10);
     return `${h}h ${m}m`;
  }
  return str;
}

function formatYearsMonthsSincePlain(dateObj) {
  const now = new Date();
  let years = now.getFullYear() - dateObj.getFullYear();
  let months = now.getMonth() - dateObj.getMonth();
  if (now.getDate() < dateObj.getDate()) months -= 1;
  if (months < 0) { years -= 1; months += 12; }
  if (years < 0) years = 0;
  if (months < 0) months = 0;
  return { years, months, text: `${years} year ${months} month` };
}

// --- GOOGLE SYNC HELPERS ---
async function fetchGoogleCalendarEvents(token) {
  try {
    let allCalendars = [];
    let calPageToken = null;
    do {
       let calUrl = 'https://www.googleapis.com/calendar/v3/users/me/calendarList';
       if (calPageToken) calUrl += `?pageToken=${calPageToken}`;
       
       const response = await fetch(calUrl, { headers: { Authorization: `Bearer ${token}` } });
       if (!response.ok) {
           const errData = await response.json();
           throw new Error(`Google API Error: ${errData.error?.message || response.statusText}`);
       }

       const data = await response.json();
       if (data.items) allCalendars = allCalendars.concat(data.items);
       calPageToken = data.nextPageToken;
    } while (calPageToken);

    const targetName = 'atracker';
    let calendar = allCalendars.find(c => c.summary && c.summary.trim().toLowerCase() === targetName);
    if (!calendar) {
        calendar = allCalendars.find(c => c.summary && c.summary.toLowerCase().includes(targetName));
    }

    if (!calendar) {
        const foundNames = allCalendars.map(c => c.summary).join(", ");
        throw new Error(`Calendar 'ATracker' not found. I found: ${foundNames || "(None)"}.`);
    }

    let allEvents = [];
    let eventPageToken = null;
    do {
      let url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.id)}/events?singleEvents=true&orderBy=startTime&timeMin=${START_DATE.toISOString()}&maxResults=2500`;
      if (eventPageToken) url += `&pageToken=${eventPageToken}`;
      const eventsResponse = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      
      if (!eventsResponse.ok) {
           const errData = await eventsResponse.json();
           throw new Error(`Events Fetch Error: ${errData.error?.message || eventsResponse.statusText}`);
      }

      const eventsData = await eventsResponse.json();
      if (eventsData.items) allEvents = allEvents.concat(eventsData.items);
      eventPageToken = eventsData.nextPageToken;
    } while (eventPageToken);
    
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
  const syncAttemptRef = useRef(0);

  const syncFromToken = async (token, attemptId) => {
    const events = await fetchGoogleCalendarEvents(token);
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
  };

  useEffect(() => {
    const attemptId = syncAttemptRef.current + 1;
    syncAttemptRef.current = attemptId;
    const handleRedirect = async () => {
      try {
        const result = await firebase.auth().getRedirectResult();
        if (!result?.credential?.accessToken) return;
        setIsSyncing(true);
        setSyncError(null);
        await syncFromToken(result.credential.accessToken, attemptId);
      } catch (err) {
        const msg = (err.message || "Redirect sign-in failed. Please try again.")
          .replace("Firebase: ", "")
          .replace(/\(.*\)/, "");
        setSyncError(msg);
      } finally {
        if (syncAttemptRef.current === attemptId) {
          setIsSyncing(false);
        }
      }
    };
    handleRedirect();
  }, []);
  
  // --- STATS LOGIC ---
  const stats = useMemo(() => {
    const newEvents = externalHistory.filter(s => new Date(s.id) > BASE_LOG_DATE);
    const newHours = newEvents.reduce((acc, s) => acc + s.duration, 0);
    const totalPlayed = BASE_HOURS_LOGGED + newHours;

    const now = new Date();
    const timeDiff = now - START_DATE;
    const daysPassed = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    
    if (daysPassed <= 0 || totalPlayed === 0) return null;

    const avgHoursPerDay = totalPlayed / daysPassed;
    const percentage = Math.min(100, (totalPlayed / 10000) * 100).toFixed(2);
    
    const remainingHours = 10000 - totalPlayed;
    const daysRemaining = remainingHours / avgHoursPerDay;
    const finishDate = new Date();
    finishDate.setDate(now.getDate() + daysRemaining);

    const nextMilestone = (Math.floor(totalPlayed / 100) + 1) * 100;
    const daysToMilestone = Math.ceil((nextMilestone - totalPlayed) / avgHoursPerDay);
    const nextMilestoneDate = new Date();
    nextMilestoneDate.setDate(now.getDate() + daysToMilestone);

    const next1k = (Math.floor(totalPlayed / 1000) + 1) * 1000;
    const daysTo1k = Math.ceil((next1k - totalPlayed) / avgHoursPerDay);
    const next1kDate = new Date();
    next1kDate.setDate(now.getDate() + daysTo1k);
    
    const years = Math.floor(daysRemaining / 365);
    const months = Math.floor((daysRemaining % 365) / 30);
    const totalDays = daysPassed + daysRemaining;
    const totalJourneyYears = Math.floor(totalDays / 365);
    const totalJourneyMonths = Math.floor((totalDays % 365) / 30);

    return {
      totalPlayed,
      daysPassed,
      avgDisplay: formatDecimalToHMS(avgHoursPerDay),
      avgNumeric: avgHoursPerDay,
      percentage,
      finishDate: finishDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      remainingFormatted: `${years}y ${months}m`,
      totalJourneyFormatted: `${totalJourneyYears}y ${totalJourneyMonths}m`,
      nextMilestone,
      daysToMilestone,
      nextMilestoneDateStr: nextMilestoneDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      next1k,
      daysTo1k,
      next1kDateStr: next1kDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    };
  }, [externalHistory]);

  const handleGoogleSync = async () => {
    if (isSyncing) return;
    const attemptId = syncAttemptRef.current + 1;
    syncAttemptRef.current = attemptId;
    setIsSyncing(true);
    setSyncError(null);
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/calendar.readonly');
    // Removed prompt:'consent' to make re-sync smoother (optional: put it back if user gets stuck)
    try {
      const timeoutMs = 20000;
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Sync timed out. Please try again.")), timeoutMs);
      });
      const result = await Promise.race([
        firebase.auth().signInWithPopup(provider),
        timeoutPromise
      ]);
      if (syncAttemptRef.current !== attemptId) return;
      await syncFromToken(result.credential.accessToken, attemptId);
      // alert(`Success! Synced ${processedSessions.length} sessions.`); // Optional toast
      
    } catch (err) {
      let msg = err.message || "Sync failed. Please try again.";
      if (msg.includes("popup-blocked")) {
        try {
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
      setSyncError(msg);
    } finally {
      if (syncAttemptRef.current === attemptId) {
        setIsSyncing(false);
      }
    }
  };

  const [expandedId, setExpandedId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState('CHOOSE');
  const [modalType, setModalType] = useState(null);
  const [editingMilestone, setEditingMilestone] = useState(null);
  const [isForecastOpen, setIsForecastOpen] = useState(false);
  const [formState, setFormState] = useState({ date: '', hours: '', avg: '', title: '', description: '' });

  const journeyAge = useMemo(() => formatYearsMonthsSincePlain(START_DATE), []);
  const nextIntervalHours = useMemo(() => {
    const hoursSet = new Set([...LEGACY_MILESTONES.map(m => Number(m.hours)), ...intervalMilestones.map(m => Number(m.hours))]);
    let h = 1000;
    while (hoursSet.has(h)) h += 100;
    return h;
  }, [intervalMilestones]);

  const allMilestones = useMemo(() => {
    const legacy = LEGACY_MILESTONES.map(m => ({ ...m, id: `legacy-${m.hours}`, title: `${m.hours} Hours`, description: legacyMeta[`legacy-${m.hours}`] || "" }));
    const interval = intervalMilestones.map(m => ({ ...m, id: `interval-${m.id}`, type: 'interval', title: `${m.hours} Hours`, date: new Date(m.date), description: m.description || "", avg: formatAvgTime(m.avg) }));
    const custom = customMilestones.map(m => ({ ...m, id: `custom-${m.id}`, type: 'custom', date: new Date(m.date), title: m.title, description: m.description || "" }));
    return [...legacy, ...interval, ...custom].sort((a, b) => Number(b.hours) - Number(a.hours));
  }, [customMilestones, intervalMilestones, legacyMeta]);

  // Modal handlers
  const toggleExpand = (id) => setExpandedId(expandedId === id ? null : id);
  const openAdd = () => { setIsModalOpen(true); setModalStep('CHOOSE'); setModalType(null); setEditingMilestone(null); };
  const openEdit = (milestone) => { setEditingMilestone(milestone); setIsModalOpen(true); setModalStep('FORM'); setModalType('EDIT_DESC'); setFormState({ date: milestone.date ? new Date(milestone.date).toISOString().split('T')[0] : '', hours: milestone.hours ? String(milestone.hours) : '', avg: milestone.avg || '', title: milestone.title || '', description: milestone.description || '' }); };
  const saveNewMilestone = () => { 
      if (modalType === 'INTERVAL') {
          const h = Number(formState.hours);
          setIntervalMilestones(prev => ([...prev, { id: Date.now(), date: formState.date, hours: h, avg: formState.avg, description: formState.description || "" }]));
          if (onIntervalAdded) onIntervalAdded(String(h));
      } else if (modalType === 'CUSTOM') {
          addCustomMilestone({ id: Date.now(), date: formState.date, hours: Number(formState.hours), title: formState.title, description: formState.description || "", dateCreated: Date.now() });
      }
      setIsModalOpen(false); 
  };
  const saveEditDescription = () => {
      const desc = formState.description || "";
      if (editingMilestone.type === 'legacy') setLegacyMeta(prev => ({ ...prev, [editingMilestone.id]: desc }));
      else if (editingMilestone.type === 'interval') { const rawId = String(editingMilestone.id).replace('interval-', ''); setIntervalMilestones(prev => prev.map(m => String(m.id) === rawId ? { ...m, description: desc } : m)); }
      else if (editingMilestone.type === 'custom') { const rawId = String(editingMilestone.id).replace('custom-', ''); editCustomMilestone(Number(rawId), { description: desc }); }
      setIsModalOpen(false); setEditingMilestone(null);
  };
  const deleteEditingMilestone = () => {
      if (editingMilestone.type === 'custom') { const rawId = String(editingMilestone.id).replace('custom-', ''); deleteCustomMilestone(Number(rawId)); }
      else if (editingMilestone.type === 'interval') { const rawId = String(editingMilestone.id).replace('interval-', ''); setIntervalMilestones(prev => prev.filter(m => String(m.id) !== rawId)); }
      else if (editingMilestone.type === 'legacy') setLegacyMeta(prev => { const n={...prev}; delete n[editingMilestone.id]; return n; });
      setIsModalOpen(false); setEditingMilestone(null);
  };
  
  // FORECAST LOGIC
  const getForecastData = () => {
    if (!stats) return null;
    const calculateEffort = (secondsToAdd) => {
      const totalSeconds = secondsToAdd * stats.daysPassed;
      if (totalSeconds < 60) return `${Math.round(totalSeconds)}s`;
      const mins = Math.floor(totalSeconds / 60);
      const hrs = Math.floor(mins/60);
      
      // Smart format: Hide hours if 0
      if (hrs === 0) {
          if (mins === 0) return `${Math.round(totalSeconds % 60)}s`;
          return `${mins}m ${Math.round(totalSeconds % 60)}s`;
      }
      return `${hrs}h ${mins%60}m`;
    };
    const diffSeconds = ((stats.totalPlayed / stats.daysPassed) - (stats.totalPlayed / (stats.daysPassed + 1))) * 3600;
    return { effort: [1, 3, 5, 10, 20].map(s => ({ seconds: s, cost: calculateEffort(s) })), drop: diffSeconds.toFixed(2) };
  };
  const forecastData = useMemo(() => isForecastOpen ? getForecastData() : null, [isForecastOpen, stats]);
  const inputClass = "w-full p-3 border border-slate-200 dark:border-slate-600 rounded-xl text-sm outline-none dark:bg-slate-700 dark:text-white";

  return (
    <div className="flex-1 flex flex-col p-6 overflow-y-auto w-full animate-in fade-in zoom-in duration-300 scroller-fix pb-24">
      
      {/* --- INPUT CARD --- */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm mb-6 border border-slate-100 dark:border-slate-700 z-20 relative">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">Current Progress</h2>
          <div className="flex gap-2">
              {/* CLEAN SYNC BUTTON (No Background) */}
              <button
                onClick={handleGoogleSync}
                disabled={isSyncing}
                aria-busy={isSyncing}
                className="text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors p-1 disabled:opacity-60 disabled:cursor-not-allowed"
                title="Sync ATracker"
              >
                {isSyncing ? <RefreshCw size={18} className="animate-spin"/> : <Calendar size={18}/>}
              </button>
              {/* CLEAN PLUS BUTTON (Matched Style) */}
              <button onClick={openAdd} className="text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors p-1">
                <Plus size={18} />
              </button>
          </div>
        </div>
        <div className="flex gap-4 items-center">
          <div className="flex-1">
            <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Hours</label>
            <input type="number" readOnly value={stats ? Math.floor(stats.totalPlayed) : 0} className="w-full text-3xl font-bold bg-transparent border-b-2 border-slate-200 dark:border-slate-600 outline-none text-slate-900 dark:text-white p-1" />
          </div>
          <div className="flex-1">
            <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Minutes</label>
            <input type="number" readOnly value={stats ? Math.round((stats.totalPlayed % 1) * 60) : 0} className="w-full text-3xl font-bold bg-transparent border-b-2 border-slate-200 dark:border-slate-600 outline-none text-slate-900 dark:text-white p-1" />
          </div>
        </div>
        {syncError && <div className="mt-2 text-[10px] text-red-500 font-bold flex items-center gap-1 leading-tight"><AlertCircle size={10} className="shrink-0"/> {syncError}</div>}
      </div>

      {/* --- STATS & TIMELINE --- */}
      {stats ? (
        <>
          <div className="mb-4">
            <div className="flex justify-between text-xs font-bold text-slate-500 dark:text-slate-400 mb-2"><span>MASTERY</span><span>{stats.percentage}%</span></div>
            <div className="h-6 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden shadow-inner relative">
              <div className="h-full bg-green-500 transition-all duration-1000 ease-out relative" style={{ width: `${stats.percentage}%` }}><div className="absolute inset-0 bg-white/20"></div></div>
            </div>
            <div className="flex justify-between mt-2 text-xs text-slate-400 font-mono items-center">
                <div className="flex items-center gap-2">
                    <span>Avg: {stats.avgDisplay}/day</span>
                    <button onClick={() => setIsForecastOpen(true)} className="text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 p-1"><Info size={16}/></button>
                </div>
                <span>Day {stats.daysPassed}</span>
            </div>
          </div>

          <div className="relative mt-6 pb-12">
            <div className="absolute left-8 top-8 bottom-8 w-0.5 bg-slate-200 dark:bg-slate-700 -translate-x-1/2 z-0"></div>
            {/* Estimated Finish Card */}
            <div className="relative z-10 mb-8 pl-16">
              <div className="absolute left-8 top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-slate-300 dark:bg-slate-600 ring-4 ring-slate-50 dark:ring-slate-900"></div>
              <div className="border border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-3 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                <div><div className="text-xs font-bold uppercase tracking-wider text-slate-400">Estimated Finish</div><div className="text-lg font-bold text-slate-700 dark:text-slate-300">{stats.finishDate}</div></div>
                <div className="text-right flex flex-col items-end justify-center gap-0.5"><div className="text-xs font-bold text-slate-500 dark:text-slate-400">REMAINING {stats.remainingFormatted}</div><div className="text-xs font-bold text-slate-500 dark:text-slate-400">TOTAL {stats.totalJourneyFormatted}</div></div>
              </div>
            </div>
            {/* Next 1k Card */}
            <div className="relative z-10 mb-8 pl-16">
              <div className="absolute left-8 top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-purple-400 ring-4 ring-purple-400/20 shadow-lg shadow-purple-400/50"></div>
              <div className="bg-gradient-to-r from-purple-50 to-white dark:from-slate-800 dark:to-slate-800 border border-purple-200 dark:border-purple-900/30 rounded-xl p-4 shadow-sm">
                <div className="flex justify-between items-center"><div><div className="text-purple-600 dark:text-purple-400 text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1"><Crown size={12}/> Next 1k</div><div className="text-xl font-bold text-slate-900 dark:text-white">{stats.next1k} Hours</div></div><div className="text-right"><div className="text-2xl font-bold text-purple-500">{stats.daysTo1k}</div><div className="text-[10px] text-slate-400 uppercase font-bold">{stats.next1kDateStr}</div></div></div>
              </div>
            </div>
            {/* Next Milestone Card */}
            <div className="relative z-10 mb-8 pl-16">
              <div className="absolute left-8 top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-yellow-400 ring-4 ring-yellow-400/20 shadow-lg shadow-yellow-400/50"></div>
              <div className="bg-gradient-to-r from-yellow-50 to-white dark:from-slate-800 dark:to-slate-800 border border-yellow-200 dark:border-yellow-900/30 rounded-xl p-4 shadow-sm">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-yellow-600 dark:text-yellow-400 text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1"><Star size={12}/> Next Goal</div>
                    <div className="text-xl font-bold text-slate-900 dark:text-white">{stats.nextMilestone} Hours</div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-yellow-500">{stats.daysToMilestone}</div>
                    <div className="text-[10px] text-slate-400 uppercase font-bold">{stats.nextMilestoneDateStr}</div>
                  </div>
                </div>
              </div>
            </div>
            {/* Milestones Loop */}
            {allMilestones.map((milestone, idx) => {
              const isExpanded = expandedId === milestone.id;
              return (
                <div key={milestone.id || idx} onClick={() => toggleExpand(milestone.id)} className="relative z-10 mb-8 pl-16 cursor-pointer">
                  <div className="absolute left-8 top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600"></div>
                  <div className="flex-1"><div className="flex justify-between items-baseline"><span className={`font-bold text-slate-700 dark:text-slate-300 ${milestone.type === 'custom' ? 'text-sm' : 'text-lg'}`}>{milestone.title}</span>{milestone.type === 'custom' ? <span className="text-xs text-slate-400">{milestone.hours} h</span> : <span className="text-xs text-slate-400">{milestone.avg}/day</span>}</div><div className="text-xs text-slate-400 mt-0.5">{milestone.date ? `${calculateDaysAgo(milestone.date)} days ago` : ''}</div>
                    {isExpanded && (<div className="mt-3 text-sm text-slate-600 dark:text-slate-300 border-t border-slate-200 dark:border-slate-700 pt-2 flex justify-between items-start animate-in fade-in"><div className="flex-1 mr-2 whitespace-pre-wrap">{milestone.description || <span className="text-slate-400 italic">No description...</span>}</div><button onClick={(e) => { e.stopPropagation(); openEdit(milestone); }} className="text-slate-400 hover:text-indigo-500 p-1"><Edit2 size={16}/></button></div>)}
                  </div>
                </div>
              );
            })}
            {/* Journey Started */}
            <div className="relative z-10 pl-16"><div className="absolute left-8 top-1/2 -translate-x-1/2 w-4 h-full bg-slate-50 dark:bg-slate-900 z-0"></div><div className="absolute left-8 top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-slate-900 dark:bg-white border-2 border-slate-50 dark:border-slate-900 z-10"></div><div className="flex justify-between items-center"><div><div className="text-sm font-bold text-slate-900 dark:text-white">Journey Started</div><div className="text-xs text-slate-400">Feb 1, 2024</div></div><div className="text-xs text-slate-400">{journeyAge.text}</div></div></div>
          </div>
        </>
      ) : ( <div className="text-center text-slate-400 mt-10 p-6 bg-slate-100 dark:bg-slate-800/50 rounded-2xl">Enter your total hours above to generate your timeline.</div> )}
      
      {/* --- FORECAST MODAL --- */}
      {isForecastOpen && forecastData && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50" style={{ height: 'var(--app-height)' }}>
           <div className="min-h-full flex items-center justify-center p-4">
             <div onClick={(e) => e.stopPropagation()} className="bg-white dark:bg-slate-800 p-6 rounded-2xl w-full max-w-sm shadow-2xl animate-in zoom-in duration-200 relative">
               <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2"><Info size={16}/> Stats Forecast</h3>
               <div className="space-y-4">
                 <div><div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">To Increase Average</div><div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl overflow-hidden">{forecastData.effort.map((item, i) => (<div key={item.seconds} className={`flex justify-between items-center p-3 ${i !== 0 ? 'border-t border-slate-100 dark:border-slate-700' : ''}`}><span className="text-sm font-medium text-slate-600 dark:text-slate-300">+{item.seconds} sec</span><span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">Play +{item.cost}</span></div>))}</div></div>
                 <div><div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">If You Skip Today</div><div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-xl p-3 flex justify-between items-center"><span className="text-sm font-medium text-red-600 dark:text-red-400">Average Drops By</span><span className="text-sm font-bold text-red-600 dark:text-red-400">{forecastData.drop} sec</span></div></div>
                 <button onClick={() => setIsForecastOpen(false)} className="w-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 py-3 rounded-xl text-sm font-bold">Close</button>
               </div>
             </div>
           </div>
        </div>
      )}
      
      {/* --- ADD/EDIT MODAL --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50" style={{ height: 'var(--app-height)' }}>
           <div className="min-h-full flex items-center justify-center p-4">
             <div onClick={(e) => e.stopPropagation()} className="bg-white dark:bg-slate-800 p-6 rounded-2xl w-full max-w-sm shadow-2xl animate-in zoom-in duration-200 relative">
               {modalStep === 'CHOOSE' && (
                 <>
                   <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">Add Milestone</h3>
                   <div className="space-y-2"><button onClick={() => { setModalType('INTERVAL'); setModalStep('FORM'); setFormState({ date: new Date().toISOString().split('T')[0], hours: String(nextIntervalHours), avg: '', title: '', description: '' }); }} className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-left"><div className="text-sm font-bold text-slate-900 dark:text-white">100h Milestone</div></button><button onClick={() => { setModalType('CUSTOM'); setModalStep('FORM'); setFormState({ date: new Date().toISOString().split('T')[0], hours: '', avg: '', title: '', description: '' }); }} className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-left"><div className="text-sm font-bold text-slate-900 dark:text-white">Custom Milestone</div></button></div>
                   <button onClick={() => setIsModalOpen(false)} className="w-full mt-4 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 py-3 rounded-xl text-sm font-bold">Cancel</button>
                 </>
               )}
               {modalStep === 'FORM' && (
                 <>
                   <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">{modalType === 'INTERVAL' ? '100h Milestone' : (modalType === 'EDIT_DESC' ? 'Edit' : 'Custom Milestone')}</h3>
                   <div className="space-y-3">
                     {modalType !== 'EDIT_DESC' && <div><label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">Date</label><input type="date" value={formState.date} onChange={e => setFormState({ ...formState, date: e.target.value })} className={inputClass} /></div>}
                     {modalType === 'INTERVAL' && <div><label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">Hours</label><input type="number" value={formState.hours} onChange={e => setFormState({ ...formState, hours: e.target.value })} className={inputClass} /></div>}
                     {modalType === 'INTERVAL' && <div><label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">Avg</label><input type="text" value={formState.avg} onChange={e => setFormState({ ...formState, avg: e.target.value })} className={inputClass} /></div>}
                     {modalType === 'CUSTOM' && <div><label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">Name</label><input type="text" value={formState.title} onChange={e => setFormState({ ...formState, title: e.target.value })} className={inputClass} /></div>}
                     <div><label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">Description</label><textarea value={formState.description} onChange={e => setFormState({ ...formState, description: e.target.value })} className={`${inputClass} h-24`} /></div>
                     <div className="flex gap-2 pt-1">
                       <button onClick={modalType === 'EDIT_DESC' ? saveEditDescription : saveNewMilestone} className="flex-1 bg-indigo-600 text-white py-3 rounded-xl text-sm font-bold">Save</button>
                       {modalType === 'EDIT_DESC' && <button onClick={deleteEditingMilestone} className="px-3 bg-slate-100 dark:bg-slate-700 text-slate-500 rounded-xl"><Trash size={16}/></button>}
                       <button onClick={() => setIsModalOpen(false)} className="flex-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 py-3 rounded-xl text-sm font-bold">Cancel</button>
                     </div>
                   </div>
                 </>
               )}
             </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Tracker;
