import React, { useState, useEffect } from 'react';
import Repertoire from './components/Repertoire';
import Repetitions from './components/Repetitions';
import Tracker from './components/Tracker';

function App() {
  // --- STATE MANAGEMENT (The "Memory") ---
  
  // 1. Repertoire Data
  const [repertoire, setRepertoire] = useState(() => {
    const saved = localStorage.getItem("pianoRepertoire");
    return saved ? JSON.parse(saved) : [];
  });

  // 2. 10k Hours Data
  const [totalHours, setTotalHours] = useState(() => {
    return parseFloat(localStorage.getItem("pianoTotalHours")) || 0;
  });

  // --- DATA PERSISTENCE (Saving to Browser) ---
  useEffect(() => {
    localStorage.setItem("pianoRepertoire", JSON.stringify(repertoire));
  }, [repertoire]);

  useEffect(() => {
    localStorage.setItem("pianoTotalHours", totalHours.toString());
  }, [totalHours]);

  // --- ACTIONS ---
  const addSession = (hours) => {
    setTotalHours(prev => prev + hours);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-20">
      
      {/* HEADER */}
      <header className="bg-indigo-600 text-white p-6 shadow-md mb-6">
        <div className="max-w-md mx-auto">
          <h1 className="text-3xl font-bold">Piano 10,000</h1>
          <p className="text-indigo-200">Mastery Journey</p>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="max-w-md mx-auto p-4 space-y-6">
        
        {/* Component 1: The Tracker */}
        <Tracker 
          totalHours={totalHours} 
          addSession={addSession} 
        />

        {/* Component 2: The Repertoire List */}
        <Repertoire 
          repertoire={repertoire} 
          setRepertoire={setRepertoire} 
        />

        {/* Component 3: Spaced Repetition */}
        <Repetitions />

      </main>
    </div>
  );
}

export default App;
