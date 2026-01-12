import React from 'react';
import { RefreshCw } from 'lucide-react';
import confetti from 'canvas-confetti';

const Repetitions = ({ repState, setRepState }) => {
  const { count, target } = repState;
  
  const updateCount = (newCount) => setRepState(prev => ({ ...prev, count: newCount }));
  const setTarget = (val) => setRepState(prev => ({ ...prev, target: val, count: val }));
  
  const triggerConfetti = () => {
    const duration = 3000, animationEnd = Date.now() + duration;
    const randomInOut = (min, max) => Math.random() * (max - min) + min;
    const frame = () => {
      if (animationEnd - Date.now() <= 0) return;
      confetti({ particleCount: 3, startVelocity: 0, ticks: 300, origin: { x: Math.random(), y: -0.1 }, gravity: randomInOut(0.5, 1.0), scalar: randomInOut(0.8, 1.2), drift: randomInOut(-0.4, 0.4), colors: ['#6366f1', '#a855f7', '#ec4899', '#3b82f6', '#14b8a6'] });
      requestAnimationFrame(frame);
    };
    frame();
  };

  const handleTap = () => { 
    if (count === 1) triggerConfetti();
    updateCount(count > 0 ? count - 1 : 0); 
  };
  const handleReset = () => updateCount(parseInt(target) || 5);
  const handleTargetChange = (e) => { const val = parseInt(e.target.value) || 0; setRepState(prev => ({ ...prev, target: val, count: val })); };

  return (
    <div className="flex-1 flex flex-col p-6 animate-in fade-in zoom-in duration-300 h-full scroller-fix" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex gap-2 mb-6">
        <button onClick={() => setTarget(5)} className="flex-1 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-white py-3 rounded-xl font-bold active:scale-95 transition-transform">5</button>
        <button onClick={() => setTarget(20)} className="flex-1 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-white py-3 rounded-xl font-bold active:scale-95 transition-transform">20</button>
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-4 rounded-xl border border-slate-200 dark:border-slate-700">
          <span className="text-xs font-bold text-slate-400">Custom:</span>
          <input type="number" value={target} onChange={handleTargetChange} className="w-12 bg-transparent text-right font-bold text-slate-900 dark:text-white outline-none py-3" />
        </div>
      </div>
      <button onClick={handleTap} className="flex-1 bg-gradient-to-br from-indigo-500 to-purple-600 active:scale-[0.98] transition-transform rounded-3xl shadow-xl flex flex-col items-center justify-center text-white mb-6 relative overflow-hidden group">
        <div className="absolute inset-0 bg-white/10 opacity-0 group-active:opacity-100 transition-opacity"></div>
        <div className="text-9xl font-bold tracking-tighter drop-shadow-md select-none">{count}</div>
        <div className="text-white/60 font-medium uppercase tracking-widest mt-2 text-sm">Tap to Reduce</div>
      </button>
      <button onClick={handleReset} className="p-4 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-500 dark:text-slate-400 font-bold flex items-center justify-center gap-2 active:bg-slate-200 dark:active:bg-slate-700 transition-colors shrink-0">
        <RefreshCw size={18}/> Reset Counter
      </button>
    </div>
  );
};

export default Repetitions;
