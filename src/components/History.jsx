import React from 'react';
import { Plus, Trash } from 'lucide-react';

const History = ({ history, replayPieceFromHistory, deleteHistoryEntry }) => {
  const formatTime = (ts) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex-1 overflow-y-auto p-4 w-full pb-24">
      <div className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4 px-2">Recent Activity</div>
      {history.length === 0 && <div className="text-center text-slate-400 mt-10 italic">No history yet. Start playing!</div>}
      <div className="space-y-3">
        {history.map((entry) => (
          <div key={entry.historyId} className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
            <div className="flex flex-col">
              <span className="text-xs text-slate-400 font-mono">{formatTime(entry.timestamp)}</span>
              <span className="font-medium text-slate-900 text-sm line-clamp-1">{entry.title}</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => replayPieceFromHistory(entry.pieceId)} className="p-2 text-indigo-400 bg-indigo-50 rounded-lg"><Plus size={16}/></button>
              <button onClick={() => deleteHistoryEntry(entry.historyId, entry.pieceId)} className="p-2 text-slate-300 hover:text-red-500 rounded-lg"><Trash size={16}/></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default History;
