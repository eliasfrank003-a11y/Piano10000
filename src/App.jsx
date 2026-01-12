import React, { useState, useEffect, useRef } from 'react';
import Tracker from './components/Tracker';
import Repertoire from './components/Repertoire';
import Repetitions from './components/Repetitions';
import Settings from './components/Settings';
import { Play, List, Clock, Settings as SettingsIcon, Music, Timer, RotateCw, StopCircle } from 'lucide-react';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import confetti from 'canvas-confetti';

// --- FIREBASE CONFIG (From v51) ---
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
  // --- STATE ---
  const [appMode, setAppMode] = useState('REPERTOIRE');
  const [view, setView] = useState('PRACTICE');
  const [isDark, setIsDark] = useState(() => localStorage.getItem('pianoTheme') === 'dark');

  // --- DATA STATE ---
  const [repertoire, setRepertoire] = useState(() => JSON.parse(localStorage.getItem("pianoRepertoire_v9") || "[]"));
  const [tenKData, setTenKData] = useState(() => JSON.parse(localStorage.getItem("piano10k_v1") || '{"hours":"","minutes":""}'));
  const [repState, setRepState] = useState({ count: 5, target: 5 });
  const [history, setHistory] = useState(() => JSON.parse(localStorage.getItem("pianoHistory_v1") || "[]"));

  const [currentPiece, setCurrentPiece] = useState(null);
  const [isRedListMode, setIsRedListMode] = useState(false);

  // --- SYNC STATE ---
  const [syncId, setSyncId] = useState(() => localStorage.getItem('pianoSyncId') || "");
  const [syncStatus, setSyncStatus] = useState("disconnected");
  const [isFirebaseEnabled, setIsFirebaseEnabled] = useState(false);
  const dbRef = useRef(null);
  const isCloudReady = useRef(false);

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
    } catch (e) {
      console.error("Firebase Init Failed", e);
    }
  }, []);

  // --- SYNC LOGIC (The "Magic" from v51) ---
  useEffect(() => {
    if (isFirebaseEnabled && syncId && dbRef.current) {
      setSyncStatus("syncing");
      isCloudReady.current = false;
      dbRef.current.collection('piano_users').doc(syncId).get().then(doc => {
        if (doc.exists) {
          const data = doc.data();
          if (data.pianoRepertoire_v9) setRepertoire(data.pianoRepertoire_v9);
          if (data.piano10k_v1) setTenKData(data.piano10k_v1);
          if (data.pianoHistory_v1) setHistory(data.pianoHistory_v1);
          setSyncStatus("synced");
        } else {
          setSyncStatus("synced"); // New user
        }
      }).catch(err => {
        console.error("Cloud Load Error", err);
        setSyncStatus("error");
      }).finally(() => {
        isCloudReady.current = true;
      });
    } else if (!syncId) {
      setSyncStatus("disconnected");
    }
  }, [syncId, isFirebaseEnabled]);

  // Generic Save Function
  const saveData = async (key, data) => {
    localStorage.setItem(key, JSON.stringify(data));
    if (isFirebaseEnabled && syncId && dbRef.current && isCloudReady.current) {
      setSyncStatus("syncing");
      try {
        await dbRef.current.collection('piano_users').doc(syncId).set({
          [key]: data,
          lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        setSyncStatus("synced");
      } catch (e) {
        setSyncStatus("error");
      }
    }
  };

  // --- PERSISTENCE HOOKS ---
  useEffect(() => { saveData('pianoRepertoire_v9', repertoire); }, [repertoire]);
  useEffect(() => { saveData('piano10k_v1', tenKData); }, [tenKData]);
  useEffect(() => { saveData('pianoHistory_v1', history); }, [history]);
  useEffect(() => { if (syncId) localStorage.setItem('pianoSyncId', syncId); }, [syncId]);

  // --- THEME ---
  useEffect(() => {
    if (isDark) { document.documentElement.classList.add('dark'); localStorage.setItem('pianoTheme', 'dark'); } 
    else { document.documentElement.classList.remove('dark'); localStorage.setItem('pianoTheme', 'light'); }
  }, [isDark]);

  // --- ACTIONS ---
  const pickPiece = (forceRed = false) => {
    const validPool = repertoire.filter(p => p.type !== 'divider');
    const pool = forceRed || isRedListMode
        ? validPool.filter(p => p.status === 'red')
        : validPool.filter(p => p.status !== 'green');

    if (pool.length === 0) return alert("No pieces available!");
    const winner = pool[Math.floor(Math.random() * pool.length)];
    setCurrentPiece(winner);
    
    // Auto-record play
    const now = Date.now();
    setRepertoire(prev => prev.map(p => p.id === winner.id ? { ...p, playCount: (p.playCount || 0) + 1, lastPlayed: now } : p));
    setHistory(prev => [{ historyId: now, pieceId: winner.id, title: winner.title, timestamp: now }, ...prev]);
  };

  const handleLogout = () => {
    if (confirm("Disconnect cloud sync?")) {
        setSyncId("");
        localStorage.removeItem('pianoSyncId');
        setSyncStatus("disconnected");
    }
  };

  return (
    <div className={`flex flex-col h-screen ${isDark ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-900'} font-sans overflow-hidden`}>
      
      {/* HEADER */}
      <div className={`p-4 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} border-b shadow-sm flex justify-between items-center shrink-0 z-10`}>
         <button onClick={() => {
             if (appMode === 'REPERTOIRE') setAppMode('10K');
             else if (appMode === '10K') setAppMode('REPS');
             else setAppMode('REPERTOIRE');
         }} className="flex items-center gap-2 font-bold text-lg">
             {appMode === 'REPERTOIRE' && <><Music /> Repertoire</>}
             {appMode === '10K' && <><Timer /> 10,000 Hours</>}
             {appMode === 'REPS' && <><RotateCw /> Repetitions</>}
         </button>
      </div>

      {/* CONTENT */}
      <div className="flex-1 overflow-hidden flex flex-col relative">
        {appMode === '10K' && <Tracker tenKData={tenKData} setTenKData={setTenKData} />}
        {appMode === 'REPS' && <Repetitions repState={repState} setRepState={setRepState} />}
        {appMode === 'REPERTOIRE' && (
            <>
                {view === 'PRACTICE' && (
                    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-8 animate-in fade-in duration-300">
                        {currentPiece ? (
                            <div className="w-full">
                                <div className="text-sm uppercase tracking-widest text-slate-400 mb-2">Please Play</div>
                                <div className="text-3xl font-serif font-medium leading-tight mb-8">{currentPiece.title}</div>
                                <div className="inline-block px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-xs text-slate-500">Total Plays: {currentPiece.playCount || 0}</div>
                            </div>
                        ) : <div className="text-slate-400 italic">Tap below to pick a piece</div>}

                        <div className="flex flex-col gap-4 w-full max-w-sm">
                            <button onClick={() => pickPiece(false)} className="bg-indigo-600 active:bg-indigo-700 text-white text-xl font-bold py-6 px-12 rounded-2xl shadow-xl transition-all transform active:scale-95 w-full">
                                {currentPiece ? "Next Piece" : "Start Session"}
                            </button>
                            {!currentPiece && (
                                <button onClick={() => pickPiece(true)} className="border-2 border-red-500 text-red-500 font-bold py-3 px-6 rounded-xl w-full">Red List Only</button>
                            )}
                            {currentPiece && (
                                <button onClick={() => setCurrentPiece(null)} className="flex items-center justify-center gap-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold py-4 rounded-xl active:scale-95">
                                    <StopCircle /> Stop Session
                                </button>
                            )}
                        </div>
                    </div>
                )}
                {view === 'LIST' && <Repertoire repertoire={repertoire} setRepertoire={setRepertoire} isRedListMode={isRedListMode} toggleRedList={() => setIsRedListMode(!isRedListMode)} />}
                {view === 'SETTINGS' && <Settings syncStatus={syncStatus} isFirebaseEnabled={isFirebaseEnabled} syncId={syncId} setSyncId={setSyncId} handleLogout={handleLogout} isDark={isDark} setIsDark={setIsDark} />}
            </>
        )}
      </div>

      {/* BOTTOM NAV */}
      {appMode === 'REPERTOIRE' && (
          <div className={`border-t p-2 flex justify-around items-center shrink-0 safe-area-pb ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <button onClick={() => setView('PRACTICE')} className={`p-2 rounded-full flex flex-col items-center ${view === 'PRACTICE' ? 'text-indigo-500' : 'text-slate-400'}`}><Play size={24} /><span className="text-[10px] font-bold">Practice</span></button>
              <button onClick={() => setView('LIST')} className={`p-2 rounded-full flex flex-col items-center ${view === 'LIST' ? 'text-indigo-500' : 'text-slate-400'}`}><List size={24} /><span className="text-[10px] font-bold">List</span></button>
              <button onClick={() => setView('SETTINGS')} className={`p-2 rounded-full flex flex-col items-center ${view === 'SETTINGS' ? 'text-indigo-500' : 'text-slate-400'}`}><SettingsIcon size={24} /><span className="text-[10px] font-bold">Settings</span></button>
          </div>
      )}
    </div>
  );
}

export default App;
