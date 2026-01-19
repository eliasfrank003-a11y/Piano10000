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
       const calRes = await fetch(calUrl, {
          headers: { Authorization: `Bearer ${token}` }
       });
       const calData = await calRes.json();
       allCalendars = allCalendars.concat(calData.items || []);
       calPageToken = calData.nextPageToken;
    } while (calPageToken);

    const targetName = "atracker";
    let calendar = allCalendars.find(c => c.summary && c.summary.trim().toLowerCase() === targetName);
    if (!calendar) {
        calendar = allCalendars.find(c => c.summary && c.summary.toLowerCase().includes(targetName));
    }
    if (!calendar) {
      throw new Error("Calendar not found. Make sure you have a calendar called 'ATracker'.");
    }

    let allEvents = [];
    let pageToken = null;
    do {
      let url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.id)}/events?singleEvents=true&orderBy=startTime&timeMin=${START_DATE.toISOString()}&maxResults=2500`;
      if (pageToken) url += `&pageToken=${pageToken}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      allEvents = allEvents.concat(data.items || []);
      pageToken = data.nextPageToken;
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
