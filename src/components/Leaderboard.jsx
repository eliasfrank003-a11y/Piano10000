import React from 'react';

const Leaderboard = ({ repertoire }) => {
  // Filter out dividers and sort by play count
  const validPieces = repertoire
    .filter(p => p.type !== 'divider')
    .sort((a, b) => (b.playCount || 0) - (a.playCount || 0));

  return (
    <div className="flex-1 overflow-y-auto p-4 w-full pb-24">
      <div className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4 px-2">Most Played</div>
      <div className="space-y-3">
        {validPieces.map((piece, index) => (
          <div key={piece.id} className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-100 shadow-sm relative overflow-hidden">
            <div className="absolute -left-2 -bottom-4 text-6xl font-bold text-slate-50 pointer-events-none z-0">{index + 1}</div>
            <div className="flex-1 pr-4 z-10 pl-2">
              <h3 className="font-medium text-slate-900">{piece.title}</h3>
              <p className="text-xs text-slate-400 mt-1">Played {piece.playCount || 0} times</p>
            </div>
          </div>
        ))}
        {validPieces.length === 0 && <div className="text-center text-slate-400 mt-10 p-6">No pieces yet. Add one below!</div>}
      </div>
    </div>
  );
};

export default Leaderboard;
