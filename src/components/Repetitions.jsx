import React from 'react';
import { RefreshCw } from 'lucide-react';

const Repetitions = ({ repState, setRepState }) => {
  const { count, target } = repState;
  
  const updateCount = (newCount) => setRepState(prev => ({ ...prev, count: newCount }));
  const setTarget = (val) => setRepState(prev => ({ ...prev, target: val, count: val }));
  
  const handleTap = () => { updateCount(count > 0 ? count - 1 : 0); };
  const handleReset = () => updateCount(parseInt(target) || 5);
  const handleTargetChange = (e) => { const val = parseInt(e.target.value) || 0; setRepState(prev => ({ ...prev, target: val, count: val })); };

  return (
    <div className="flex-1 flex flex-col p-6 h-full pb-24">
      <div className="flex gap-2 mb-6">
        <button onClick={() => setTarget(5)} className="flex-1 bg-slate-200 text-slate-700 py-3 rounded-xl font-bold active:scale-95 transition-transform">5</button>
        <button onClick={() => setTarget(20)} className="flex-1 bg-slate-200 text-slate-700 py-3 rounded-xl font-bold active:scale-95 transition-transform">20</button>
        <div className="flex items-center gap-2 bg-slate-100 px-4 rounded-xl border border-slate-200">
          <span className="text-xs font-bold text-slate-400">Custom:</span>
          <input type="number" value={target} onChange={handleTargetChange} className="w-12 bg-transparent text-right font-bold text-slate-900 outline-none py-3" />
        </div>
      </div>
      
      <button onClick={handleTap} className="flex-1 bg-gradient-to-br from-indigo-500 to-purple-600 active:scale-[0.98] transition-transform rounded-3xl shadow-xl flex flex-col items-center justify-center text-white mb-6 relative overflow-hidden group">
        <div className="absolute inset-0 bg-white/10 opacity-0 group-active:opacity-100 transition-opacity"></div>
        <div className="text-9xl font-bold tracking-tighter drop-shadow-md select-none">{count}</div>
        <div className="text-white/60 font-medium uppercase tracking-widest mt-2 text-sm">Tap to Reduce</div>
      </button>
      
      <button onClick={handleReset} className="p-4 bg-slate-100 rounded-xl text-slate-500 font-bold flex items-center justify-center gap-2 active:bg-slate-200 transition-colors shrink-0">
        <RefreshCw size={18} /> Reset Counter
      </button>
    </div>
  );
};

export default Repetitions;
