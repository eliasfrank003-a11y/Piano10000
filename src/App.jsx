import React, { useState, useEffect, useMemo } from 'react';
import Tracker from './components/Tracker';
import Repertoire from './components/Repertoire';
import Repetitions from './components/Repetitions';
import { Play, List, Crown, Clock, Settings, Music, Timer, RotateCw, StopCircle } from 'lucide-react';

function App() {
  // --- STATE ---
  const [appMode, setAppMode] = useState('REPERTOIRE'); // 'REPERTOIRE', '10K', 'REPS'
  const [view, setView] = useState('PRACTICE'); // 'PRACTICE', 'LIST', etc.

  // 1. Repertoire Data
  const [repertoire, setRepertoire] = useState(() => {
    const saved = localStorage.getItem("pianoRepertoire_v9");
    return saved ? JSON.parse(saved) : [];
  });
  // 2. 10k Data
  const [tenKData, setTenKData] = useState(() => {
    const saved = localStorage.getItem("piano10k_v1");
    return saved ? JSON.parse(saved) : { hours: "", minutes: "" };
  });
  // 3. Reps Data
  const [repState, setRepState] = useState({ count: 5, target: 5 });

  // 4. Session State
  const [currentPiece, setCurrentPiece] = useState(null);
  const [isRedListMode, setIsRedListMode] = useState(false);

  // --- PERSISTENCE ---
  useEffect(() => { localStorage.setItem("pianoRepertoire_v9", JSON.stringify(repertoire)); }, [repertoire]);
  useEffect(() => { localStorage.setItem("piano10k_v1", JSON.stringify(tenKData)); }, [tenKData]);

  // --- LOGIC ---
  const pickPiece = (forceRed = false) => {
    const validPool = repertoire.filter(p => p.type !== 'divider');
    const pool = forceRed || isRedListMode
        ? validPool.filter(p => p.status === 'red')
        : validPool.filter(p => p.status !== 'green'); // Don't pick mastered

    if (pool.length === 0) return alert("No pieces available to pick!");

    const winner = pool[Math.floor(Math.random() * pool.length)];
    setCurrentPiece(winner);
    // Auto-record play (Legacy behavior)
    setRepertoire(prev => prev.map(p => p.id === winner.id ? { ...p, playCount: (p.playCount || 0) + 1, lastPlayed: Date.now() } : p));
  };

  const stopSession = () => setCurrentPiece(null);

  // --- RENDER ---
  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      
      {/* TOP HEADER (Mode Switcher) */}
      <div className="p-4 bg-white border-b border-slate-200 shadow-sm flex justify-between items-center shrink-0 z-10">
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

      {/* MAIN CONTENT */}
      <div className="flex-1 overflow-hidden flex flex-col relative">
        
        {/* 10K MODE */}
        {appMode === '10K' && <Tracker tenKData={tenKData} setTenKData={setTenKData} />}

        {/* REPS MODE */}
        {appMode === 'REPS' && <Repetitions repState={repState} setRepState={setRepState} />}

        {/* REPERTOIRE MODE (Has Sub-Views) */}
        {appMode === 'REPERTOIRE' && (
            <>
                {view === 'PRACTICE' && (
                    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-8 animate-in fade-in duration-300">
                        {currentPiece ? (
                            <div className="w-full">
                                <div className="text-sm uppercase tracking-widest text-slate-400 mb-2">Please Play</div>
                                <div className="text-3xl font-serif font-medium text-slate-900 leading-tight mb-8">{currentPiece.title}</div>
                                <div className="inline-block px-3 py-1 bg-slate-100 rounded-full text-xs text-slate-500">Total Plays: {currentPiece.playCount || 0}</div>
                            </div>
                        ) : <div className="text-slate-400 italic">Tap below to pick a piece</div>}

                        <div className="flex flex-col gap-4 w-full max-w-sm">
                            <button onClick={() => pickPiece(false)} className="bg-indigo-600 active:bg-indigo-700 text-white text-xl font-bold py-6 px-12 rounded-2xl shadow-xl transition-all transform active:scale-95 w-full">
                                {currentPiece ? "Next Piece" : "Start Session"}
                            </button>
                            {!currentPiece && (
                                <button onClick={() => pickPiece(true)} className="border-2 border-red-500 text-red-500 font-bold py-3 px-6 rounded-xl w-full">
                                    Red List Only
                                </button>
                            )}
                            {currentPiece && (
                                <button onClick={stopSession} className="flex items-center justify-center gap-2 bg-slate-200 text-slate-700 font-bold py-4 rounded-xl active:scale-95">
                                    <StopCircle /> Stop Session
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {view === 'LIST' && (
                    <Repertoire 
                        repertoire={repertoire} 
                        setRepertoire={setRepertoire} 
                        isRedListMode={isRedListMode}
                        toggleRedList={() => setIsRedListMode(!isRedListMode)}
                    />
                )}
            </>
        )}
      </div>

      {/* BOTTOM NAVIGATION (Only for Repertoire Mode) */}
      {appMode === 'REPERTOIRE' && (
          <div className="bg-white border-t border-slate-200 p-2 flex justify-around items-center shrink-0 safe-area-pb">
              <button onClick={() => setView('PRACTICE')} className={`p-2 rounded-full flex flex-col items-center ${view === 'PRACTICE' ? 'text-indigo-600' : 'text-slate-400'}`}>
                  <Play size={24} />
                  <span className="text-[10px] font-bold">Practice</span>
              </button>
              <button onClick={() => setView('LIST')} className={`p-2 rounded-full flex flex-col items-center ${view === 'LIST' ? 'text-indigo-600' : 'text-slate-400'}`}>
                  <List size={24} />
                  <span className="text-[10px] font-bold">List</span>
              </button>
              {/* Placeholders for History/Leaderboard to keep layout stable */}
              <button className="p-2 rounded-full flex flex-col items-center text-slate-300">
                  <Clock size={24} />
                  <span className="text-[10px] font-bold">History</span>
              </button>
          </div>
      )}
    </div>
  );
}

export default App;
