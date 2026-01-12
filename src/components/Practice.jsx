import React from 'react';

// --- EXACT ICONS FROM LEGACY ---
const IconDot = ({ status }) => {
    let colorClass = "text-slate-300 dark:text-slate-600";
    let fill = "none";

    if (status === 'red') {
        colorClass = "text-red-500";
        fill = "currentColor";
    } else if (status === 'green') {
        colorClass = "text-green-500";
        fill = "currentColor";
    }

    return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className={colorClass}>
            <circle cx="12" cy="12" r="9"></circle>
        </svg>
    );
};

const IconStop = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
    </svg>
);

const Practice = ({ currentPiece, pickPiece, stopSession, redListCount }) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-8 animate-in fade-in duration-300 w-full overflow-hidden scroller-fix">
      {currentPiece ? (
        <div className="w-full">
          <div className="text-sm uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">Please Play</div>
          <div className="text-3xl font-serif font-medium text-slate-900 dark:text-white leading-tight mb-8">{currentPiece.title}</div>
          <div className="inline-block px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-xs text-slate-500 dark:text-slate-400">Total Plays: {currentPiece.playCount}</div>
        </div>
      ) : (
        <div className="text-slate-400 dark:text-slate-500 italic">Tap below to pick a piece</div>
      )}

      <div className="flex flex-col gap-4 w-full max-w-sm">
        <button onClick={() => pickPiece()} className="bg-indigo-600 active:bg-indigo-700 dark:bg-indigo-500 dark:active:bg-indigo-600 text-white text-xl font-bold py-6 px-12 rounded-2xl shadow-xl shadow-indigo-200 dark:shadow-none transition-all transform active:scale-95 w-full">
          {currentPiece ? "Next Piece" : "Start Session"}
        </button>

        {!currentPiece && (
          <button onClick={() => pickPiece(true)} className="border-2 border-red-500 text-red-500 active:bg-red-50 dark:active:bg-red-900/20 text-sm font-bold py-3 px-6 rounded-xl transition-all transform active:scale-95 w-full flex items-center justify-center gap-2">
            <IconDot status='red' /> Red List ({redListCount})
          </button>
        )}

        {currentPiece && (
          <button onClick={stopSession} className="flex items-center justify-center gap-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold py-4 rounded-xl active:scale-95 transition-all">
            <IconStop /> Stop Session
          </button>
        )}
      </div>
    </div>
  );
};

export default Practice;
