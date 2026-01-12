import React from 'react';
import { Plus, Trash } from 'lucide-react';

const History = ({ history, replayPieceFromHistory, deleteHistoryEntry, formatTime }) => {
  // If formatTime isn't passed from App.jsx for some reason, we use this fallback to prevent crashing
  const safeFormatTime = formatTime || ((ts) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

  return (
    <div className="flex-1 overflow-y-auto p-4 animate-in slide-in-from-right duration-300 w-full no-scrollbar scroller-fix" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4 px-2">Recent Activity</div>
      
      {history.length === 0 && (
        <div className="text-center text-slate-400 mt-10 italic">No history yet. Start playing!</div>
      )}

      <div className="space-y-3 pb-24">
        {history.map((entry) => (
          <div key={entry.historyId} className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
            <div className="flex flex-col">
              <span className="text-xs text-slate-400 font-mono">{safeFormatTime(entry.timestamp)}</span>
              <span className="font-medium text-slate-900 dark:text-white text-sm line-clamp-1">{entry.title}</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => replayPieceFromHistory(entry.pieceId)} className="p-2 text-indigo-400 active:text-indigo-600 dark:text-indigo-400 dark:active:text-indigo-200 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg">
                <Plus size={20} />
              </button>
              <button onClick={() => deleteHistoryEntry(entry.historyId, entry.pieceId)} className="p-2 text-slate-300 active:text-slate-500 rounded-lg">
                <Trash size={20} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default History;
