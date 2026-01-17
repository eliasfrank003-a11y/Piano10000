import React, { useState, useEffect, useRef, useMemo } from 'react';
import Tracker from './components/10k'; 
import Repertoire from './components/Repertoire';
import Repetitions from './components/Repetitions';
import Practice from './components/Practice';
import History from './components/History';
import Leaderboard from './components/Leaderboard';
import Settings from './components/Settings';
import { Play, List, Crown, Clock, Music, Timer, RotateCw, ChevronDown } from 'lucide-react';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

// --- FIREBASE CONFIG ---
const userFirebaseConfig = {
  apiKey: "AIzaSyBtbs3d0ifYfTE2H0ly7-rix0wVhbdf25I",
  authDomain: "piano10000-35804.firebaseapp.com",
  projectId: "piano10000-35804",
  storageBucket: "piano10000-35804.firebasestorage.app",
  messagingSenderId: "1005611018408",
  appId: "1:1005611018408:web:c067db2e119cc9f3a5fa9d",
  measurementId: "G-63W95VNLK6"
};

function App() {
  // --- iOS Viewport Fix ---
  useEffect(() => {
    const setAppHeight = () => {
      const h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      document.documentElement.style.setProperty('--app-height', `${h}px`);
    };
    setAppHeight();
    window.addEventListener('resize', setAppHeight);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', setAppHeight);
    return () => {
      window.removeEventListener('resize', setAppHeight);
      if (window.visualViewport) window.visualViewport.removeEventListener('resize', setAppHeight);
    }
  }, []);

  const [appMode, setAppMode] = useState('REPERTOIRE');
  const [view, setView] = useState('PRACTICE');

  const [isDark, setIsDark] = useState(() => {
    const stored = localStorage.getItem('pianoTheme');
    return stored ? stored === 'dark' : true;
  });

  const [syncId, setSyncId] = useState(() => localStorage.getItem('pianoSyncId') || "");
  const [syncStatus, setSyncStatus] = useState("disconnected");
  const [isFirebaseEnabled, setIsFirebaseEnabled] = useState(false);
  const dbRef = useRef(null);
  const isCloudReady = useRef(false);

  // --- DATA STATE ---
  const INITIAL_REPERTOIRE = [];
  const [pieces, setPieces] = useState(() => {
    const saved = localStorage.getItem('pianoRepertoire_v9');
    let data = saved ? JSON.parse(saved) : INITIAL_REPERTOIRE;
    // Data normalization from original code
    data = data.map(p => {
        if (p.type === 'divider') return p;
        let status = p.status;
        if (!status) status = p.isRed ? 'red' : 'normal';
        if (status === 'red' && !p.isRed) p.isRed = true;
        if (p.isRed && status === 'normal') status = 'red';
        return { ...p, status, isRed: status === 'red' };
    });
    return data;
  });

  const [tenKData, setTenKData] = useState(() => {
    const saved = localStorage.getItem('piano10k_v1');
    return saved ? JSON.parse(saved) : { hours: "", minutes: "" };
  });

  const [customMilestones, setCustomMilestones] = useState(() => JSON.parse(localStorage.getItem('pianoCustomMilestones_v1') || "[]"));
  const [intervalMilestones, setIntervalMilestones] = useState(() => JSON.parse(localStorage.getItem('pianoIntervalMilestones_v1') || "[]"));
  const [legacyMeta, setLegacyMeta] = useState(() => JSON.parse(localStorage.getItem('pianoLegacyMeta_v1') || "{}"));
  const [repState, setRepState] = useState({ count: 5, target: 5 });
  const [history, setHistory] = useState(() => JSON.parse(localStorage.getItem('pianoHistory_v1') || "[]"));
  const [dailyStats, setDailyStats] = useState(() => {
    const saved = JSON.parse(localStorage.getItem('pianoDailyStats_v1') || '{}');
    const today = new Date().toDateString();
    if (saved.date !== today) return { date: today, count: 0 };
    return saved;
  });

  const [currentPiece, setCurrentPiece] = useState(null);
  
  // Modal states for App-level additions
  const [isAdding, setIsAdding] = useState(false);
  const [newPieceTitle, setNewPieceTitle] = useState("");
  const [newPieceDate, setNewPieceDate] = useState("");
  const [isAddingDivider, setIsAddingDivider] = useState(false);
  const [dividerText, setDividerText] = useState("");
  const [dividerAfterId, setDividerAfterId] = useState("");

  const [isRedListMode, setIsRedListMode] = useState(false);
  const [sessionFilter, setSessionFilter] = useState(false);

  // Sorting
  const sortedPieces = useMemo(() => {
      return [...pieces].filter(p => p.type !== 'divider').sort((a, b) => (b.playCount || 0) - (a.playCount || 0));
  }, [pieces]);

  // --- FIREBASE INIT ---
  useEffect(() => {
    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(userFirebaseConfig);
        setIsFirebaseEnabled(true);
        dbRef.current = firebase.firestore();
      } else {
        setIsFirebaseEnabled(true);
        dbRef.current = firebase.firestore();
      }
    } catch (e) { console.error("Firebase Init Failed", e); }
  }, []);

  // --- SYNC LOGIC ---
  useEffect(() => {
    if (isFirebaseEnabled && syncId && dbRef.current) {
      setSyncStatus("syncing");
      isCloudReady.current = false;
      dbRef.current.collection('piano_users').doc(syncId).get().then(doc => {
        if (doc.exists) {
          const data = doc.data();
          if (data.pianoRepertoire_v9) setPieces(data.pianoRepertoire_v9);
          if (data.piano10k_v1) setTenKData(data.piano10k_v1);
          if (data.pianoHistory_v1) setHistory(data.pianoHistory_v1);
          if (data.pianoDailyStats_v1) setDailyStats(data.pianoDailyStats_v1);
          if (data.pianoCustomMilestones_v1) setCustomMilestones(data.pianoCustomMilestones_v1);
          if (data.pianoLegacyMeta_v1) setLegacyMeta(data.pianoLegacyMeta_v1);
          if (data.pianoIntervalMilestones_v1) setIntervalMilestones(data.pianoIntervalMilestones_v1);
          setSyncStatus("synced");
        } else { setSyncStatus("synced"); }
      }).catch((err) => { console.error(err); setSyncStatus("error"); }).finally(() => { isCloudReady.current = true; });
    } else if (!syncId) { setSyncStatus("disconnected"); }
  }, [syncId, isFirebaseEnabled]);

  const saveData = async (key, data) => {
    localStorage.setItem(key, JSON.stringify(data));
    if (isFirebaseEnabled && syncId && dbRef.current && isCloudReady.current) {
      setSyncStatus("syncing");
      try {
        await dbRef.current.collection('piano_users').doc(syncId).set({ [key]: data, lastUpdated: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
        setSyncStatus("synced");
      } catch (e) { setSyncStatus("error"); }
    }
  };

  // --- PERSISTENCE ---
  useEffect(() => { saveData('pianoRepertoire_v9', pieces); }, [pieces]);
  useEffect(() => { saveData('piano10k_v1', tenKData); }, [tenKData]);
  useEffect(() => { saveData('pianoHistory_v1', history); }, [history]);
  useEffect(() => { saveData('pianoDailyStats_v1', dailyStats); }, [dailyStats]);
  useEffect(() => { saveData('pianoCustomMilestones_v1', customMilestones); }, [customMilestones]);
  useEffect(() => { saveData('pianoLegacyMeta_v1', legacyMeta); }, [legacyMeta]);
  useEffect(() => { saveData('pianoIntervalMilestones_v1', intervalMilestones); }, [intervalMilestones]);
  useEffect(() => { if (syncId) localStorage.setItem('pianoSyncId', syncId); }, [syncId]);

  // --- THEME ---
  useEffect(() => {
    if (isDark) { document.documentElement.classList.add('dark'); localStorage.setItem('pianoTheme', 'dark'); } 
    else { document.documentElement.classList.remove('dark'); localStorage.setItem('pianoTheme', 'light'); }
  }, [isDark]);

  // --- ACTIONS ---
  const recordPlay = (piece) => {
    if (piece.type === 'divider') return;
    const now = Date.now();
    setPieces(prev => prev.map(p => p.id === piece.id ? { ...p, lastPlayed: now, playCount: (p.playCount || 0) + 1 } : p));
    setHistory(prev => [{ historyId: Date.now(), pieceId: piece.id, title: piece.title, timestamp: now }, ...prev]);
    const todayStr = new Date().toDateString();
    setDailyStats(prev => {
        if (prev.date !== todayStr) return { date: todayStr, count: 1 };
        return { ...prev, count: prev.count + 1 };
    });
  };

  const pickPiece = (filterRed) => {
    let isRed = sessionFilter;
    if (typeof filterRed === 'boolean') { isRed = filterRed; setSessionFilter(filterRed); }
    const validPool = pieces.filter(p => p.type !== 'divider');
    const pool = isRed ? validPool.filter(p => p.status === 'red') : validPool.filter(p => p.status !== 'green');

    if (pool.length === 0) return alert(isRed ? "Red List is empty!" : "No eligible pieces available!");

    const now = Date.now();
    const candidates = pool.map(p => {
        const timeSinceLastPlayed = p.lastPlayed === 0 ? 100000000000 : now - p.lastPlayed;
        const randomFactor = 0.5 + Math.random();
        return { ...p, score: timeSinceLastPlayed * randomFactor };
    });
    candidates.sort((a, b) => b.score - a.score);
    const winner = candidates[0];
    setCurrentPiece(winner);
    recordPlay(winner);
  };

  const replayPieceFromHistory = (pieceId) => { const piece = pieces.find(p => p.id === pieceId); if (piece) recordPlay(piece); };
  
  const deleteHistoryEntry = (historyId, pieceId) => {
    const entry = history.find(h => h.historyId === historyId);
    if (entry) {
       const isToday = new Date(entry.timestamp).toDateString() === new Date().toDateString();
       if (isToday) setDailyStats(prev => ({ ...prev, count: Math.max(0, prev.count - 1) }));
    }
    setHistory(history.filter(h => h.historyId !== historyId));
    setPieces(prev => prev.map(p => p.id === pieceId ? { ...p, playCount: Math.max(0, (p.playCount || 0) - 1) } : p));
  };

  const handleLogout = () => {
    if (confirm("Are you sure? This will disconnect cloud sync and clear all local data.")) {
        setSyncId(""); localStorage.removeItem('pianoSyncId'); setSyncStatus("disconnected");
        setPieces(INITIAL_REPERTOIRE); setHistory([]); setTenKData({ hours: "", minutes: "" });
    }
  };

  // --- ADD LOGIC ---
  const handleStartAdd = () => {
    const existingCount = pieces.filter(p => p.type !== 'divider').length;
    setNewPieceTitle(`${existingCount + 1}. `);
    setNewPieceDate(new Date().toISOString().split('T')[0]);
    setIsAdding(true);
  };

  const addNewPiece = () => {
    if (!newPieceTitle.trim()) return;
    const newPiece = { id: Date.now(), type: 'piece', title: newPieceTitle, startDate: newPieceDate, lastPlayed: 0, playCount: 0, status: 'normal', isRed: false };
    setPieces([newPiece, ...pieces]);
    setNewPieceTitle(""); setIsAdding(false);
  };

  const addDivider = (text, afterPieceId) => {
    let newId = Date.now();
    if (afterPieceId) {
       const sorted = [...pieces].sort((a,b) => a.id - b.id);
       const index = sorted.findIndex(p => p.id === Number(afterPieceId));
       if (index !== -1 && index < sorted.length - 1) newId = (sorted[index].id + sorted[index+1].id) / 2;
    }
    setPieces(prev => [{ id: newId, type: 'divider', text: text || "" }, ...prev]);
    setIsAddingDivider(false); setDividerText("");
  };

  const cycleMode = () => {
    if (appMode === 'REPERTOIRE') setAppMode('10K');
    else if (appMode === '10K') setAppMode('REPS');
    else setAppMode('REPERTOIRE');
  };

  return (
    <div className={`flex flex-col h-screen ${isDark ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-900'} font-sans overflow-hidden`} style={{ height: 'var(--app-height)' }}>
      {/* HEADER */}
      <div className={`p-4 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} border-b shadow-sm flex justify-between items-center shrink-0 z-10`}>
         <button onClick={cycleMode} className="flex flex-col items-start justify-center h-10">
            <h1 className="text-lg font-bold flex items-center gap-2 active:opacity-50 transition-opacity">
                {appMode === 'REPERTOIRE' && <><Music /> Repertoire <ChevronDown /></>}
                {appMode === '10K' && <><Timer /> 10.000 Hours <ChevronDown /></>}
                {appMode === 'REPS' && <><RotateCw /> Repetitions <ChevronDown /></>}
            </h1>
         </button>
         {appMode === 'REPERTOIRE' && (
             <div className={`flex gap-2 p-1 rounded-full items-center ${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}>
                {/* BIGGER BUTTONS: p-3 and size={20} */}
                <button onClick={() => setView('PRACTICE')} className={`p-3 rounded-full transition-colors ${view === 'PRACTICE' ? (isDark ? 'bg-slate-600 text-white shadow' : 'bg-white shadow text-indigo-600') : 'text-slate-400'}`}><Play size={20} /></button>
                <button onClick={() => setView('LIST')} className={`p-3 rounded-full transition-colors ${view === 'LIST' ? (isDark ? 'bg-slate-600 text-white shadow' : 'bg-white shadow text-indigo-600') : 'text-slate-400'}`}><List size={20} /></button>
                <button onClick={() => setView('LEADERBOARD')} className={`p-3 rounded-full transition-colors ${view === 'LEADERBOARD' ? (isDark ? 'bg-slate-600 text-white shadow' : 'bg-white shadow text-indigo-600') : 'text-slate-400'}`}><Crown size={20} /></button>
                <button onClick={() => setView('HISTORY')} className={`p-3 rounded-full transition-colors ${view === 'HISTORY' ? (isDark ? 'bg-slate-600 text-white shadow' : 'bg-white shadow text-indigo-600') : 'text-slate-400'}`}><Clock size={20} /></button>
                <button onClick={() => setView('SETTINGS')} className={`px-3 py-1 ml-1 rounded-full text-xs font-bold transition-colors ${view === 'SETTINGS' ? (isDark ? 'bg-slate-600 text-white shadow' : 'bg-white shadow text-indigo-600') : (isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-400')}`}>v54</button>
             </div>
         )}
      </div>

      {appMode === 'REPERTOIRE' && (
        <div className={`py-1.5 px-4 flex justify-center items-center gap-4 text-xs font-mono shrink-0 z-0 border-b ${isDark ? 'bg-slate-900/50 border-slate-700 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>
            <span>Today: <strong className={isDark ? 'text-slate-200' : 'text-slate-700'}>{dailyStats.count}</strong></span>
            <span className={isDark ? 'text-slate-600' : 'text-slate-300'}>|</span>
            <span>Total: <strong className={isDark ? 'text-slate-200' : 'text-slate-700'}>{pieces.filter(p=>p.type!=='divider').reduce((sum, p) => sum + (p.playCount || 0), 0)}</strong></span>
        </div>
      )}

      {/* CONTENT */}
      <div className="flex-1 overflow-hidden flex flex-col relative">
        {appMode === '10K' && <Tracker tenKData={tenKData} setTenKData={setTenKData} customMilestones={customMilestones} addCustomMilestone={(m) => setCustomMilestones([...customMilestones, m])} intervalMilestones={intervalMilestones} setIntervalMilestones={setIntervalMilestones} legacyMeta={legacyMeta} setLegacyMeta={setLegacyMeta} onIntervalAdded={(h) => addDivider(String(h), null)} />}
        {appMode === 'REPS' && <Repetitions repState={repState} setRepState={setRepState} />}
        {appMode === 'REPERTOIRE' && (
            <>
                {view === 'PRACTICE' && <Practice currentPiece={currentPiece} pickPiece={pickPiece} stopSession={() => { setCurrentPiece(null); setSessionFilter(false); }} redListCount={pieces.filter(p => p.status === 'red' && p.type !== 'divider').length} />}
                {view === 'LIST' && (
                       <Repertoire 
                          repertoire={pieces} 
                          setRepertoire={setPieces} 
                          isRedListMode={isRedListMode} 
                          toggleRedList={() => setIsRedListMode(!isRedListMode)} 
                          onOpenAddPiece={handleStartAdd} 
                          onOpenAddDivider={() => setIsAddingDivider(true)}
                       />
                )}
                {view === 'LEADERBOARD' && <Leaderboard sortedPieces={sortedPieces} />}
                {view === 'HISTORY' && <History history={history} replayPieceFromHistory={replayPieceFromHistory} deleteHistoryEntry={deleteHistoryEntry} />}
                {view === 'SETTINGS' && <Settings syncStatus={syncStatus} isFirebaseEnabled={isFirebaseEnabled} syncId={syncId} setSyncId={setSyncId} handleLogout={handleLogout} isDark={isDark} setIsDark={setIsDark} />}
            </>
        )}
      </div>

      {/* ADD MODAL (Legacy Style) */}
      {isAdding && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50" style={{ height: 'var(--app-height)' }}>
              <div className="min-h-full flex items-center justify-center p-4">
                  <div onClick={(e) => e.stopPropagation()} className={`p-6 rounded-2xl w-full max-w-sm shadow-2xl animate-in zoom-in duration-200 relative ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
                      <h3 className={`text-sm font-bold mb-4 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Add New Piece</h3>
                      <div className="space-y-4 pb-32">
                          <div><label className={`text-xs font-bold mb-1 block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Title</label><input autoFocus value={newPieceTitle} onChange={(e) => setNewPieceTitle(e.target.value)} className={`w-full p-3 border rounded-xl text-lg outline-none focus:border-indigo-500 ${isDark ? 'border-slate-600 bg-slate-700 text-white' : 'border-slate-300'}`} /></div>
                          <div><label className={`text-xs font-bold mb-1 block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Date Started</label><input type="date" value={newPieceDate} onChange={(e) => setNewPieceDate(e.target.value)} className={`w-full p-3 border rounded-xl text-sm outline-none ${isDark ? 'border-slate-600 bg-slate-700 text-white' : 'border-slate-300'}`} /></div>
                          <div className="flex gap-2 pt-2"><button onClick={addNewPiece} className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-semibold">Save</button><button onClick={() => setIsAdding(false)} className={`flex-1 py-3 rounded-xl font-semibold ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>Cancel</button></div>
                      </div>
                  </div>
              </div>
          </div>
      )}
      {isAddingDivider && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50" style={{ height: 'var(--app-height)' }}>
              <div className="min-h-full flex items-center justify-center p-4">
                  <div onClick={(e) => e.stopPropagation()} className={`p-6 rounded-2xl w-full max-w-sm shadow-2xl animate-in zoom-in duration-200 relative ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
                      <h3 className={`text-sm font-bold mb-4 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Add Divider</h3>
                      <div className="space-y-4 pb-12">
                          <div><label className={`text-xs font-bold mb-1 block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Label</label><input autoFocus value={dividerText} onChange={(e) => setDividerText(e.target.value)} className={`w-full p-3 border rounded-xl text-lg outline-none focus:border-indigo-500 ${isDark ? 'border-slate-600 bg-slate-700 text-white' : 'border-slate-300'}`} /></div>
                          <div><label className={`text-xs font-bold mb-1 block ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Insert After</label><select value={dividerAfterId} onChange={e => setDividerAfterId(e.target.value)} className={`w-full p-3 border rounded-xl text-sm outline-none ${isDark ? 'border-slate-600 bg-slate-700 text-white' : 'border-slate-300'}`}><option value="">At the top</option>{pieces.filter(p => p.type !== 'divider').map((p, idx) => <option key={p.id} value={p.id}>{idx + 1}. {p.title}</option>)}</select></div>
                          <div className="flex gap-2 pt-2"><button onClick={() => addDivider(dividerText, dividerAfterId)} className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-semibold">Add</button><button onClick={() => setIsAddingDivider(false)} className={`flex-1 py-3 rounded-xl font-semibold ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>Cancel</button></div>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}

export default App;
