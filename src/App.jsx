import React, { useState, useEffect } from 'react';
import Repertoire from './components/Repertoire';

function App() {
  // Load data from localStorage
  const [repertoire, setRepertoire] = useState(() => {
    const saved = localStorage.getItem("pianoRepertoire");
    return saved ? JSON.parse(saved) : [];
  });

  const [totalHours, setTotalHours] = useState(() => {
    return parseFloat(localStorage.getItem("pianoTotalHours")) || 0;
  });

  useEffect(() => {
    localStorage.setItem("pianoRepertoire", JSON.stringify(repertoire));
  }, [repertoire]);

  useEffect(() => {
    localStorage.setItem("pianoTotalHours", totalHours.toString());
  }, [totalHours]);

  const addSession = (hours) => {
    setTotalHours(prev => prev + hours);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-20">
      <header className="bg-indigo-600 text-white p-6 shadow-md">
        <div className="max-w-md mx-auto">
          <h1 className="text-3xl font-bold">Piano 10,000</h1>
          <p className="text-indigo-200">Mastery Journey</p>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h2 className="text-xl font-bold mb-4 text-slate-700">Progress Tracker</h2>
          <div className="text-center py-6">
             <div className="text-5xl font-black text-indigo-600 mb-2">
               {totalHours.toFixed(1)}
             </div>
             <div className="text-sm text-slate-400 uppercase tracking-widest font-semibold">Hours Practice</div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-4">
            <button onClick={() => addSession(0.25)} className="p-3 bg-slate-50 hover:bg-indigo-50 text-indigo-600 rounded-xl font-semibold transition-colors">+15m</button>
            <button onClick={() => addSession(0.5)} className="p-3 bg-slate-50 hover:bg-indigo-50 text-indigo-600 rounded-xl font-semibold transition-colors">+30m</button>
            <button onClick={() => addSession(1)} className="p-3 bg-slate-50 hover:bg-indigo-50 text-indigo-600 rounded-xl font-semibold transition-colors">+1h</button>
          </div>
        </div>

        <Repertoire repertoire={repertoire} setRepertoire={setRepertoire} />
      </main>
    </div>
  );
}

export default App;
