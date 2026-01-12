import React from 'react';
import { Timer } from 'lucide-react';

const Tracker = ({ totalHours, addSession }) => {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
      <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-slate-700">Progress Tracker</h2>
          <Timer className="text-indigo-300" size={20}/>
      </div>
      
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
  );
};

export default Tracker;
