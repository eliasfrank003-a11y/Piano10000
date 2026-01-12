import React, { useState, useRef } from 'react';
import { Trash } from 'lucide-react';

// --- EXACT ICON FROM LEGACY ---
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

// --- HELPERS FROM LEGACY ---
function weeksSince(dateString) {
    if (!dateString) return null;
    const d = new Date(dateString);
    const now = new Date();
    const diffMs = now - d;
    const diffWeeks = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 7));
    if (diffWeeks < 0) return "Future";
    return `${diffWeeks} weeks`;
}

function formatDisplayDate(dateString) {
    if (!dateString) return "";
    return new Date(dateString)
      .toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
      .replace(/\//g, '.');
}

const Repertoire = ({ repertoire, setRepertoire, isRedListMode, toggleRedList }) => {
  // Sort pieces exactly like Legacy (Newest ID first)
  const sortedPieces = [...repertoire].sort((a, b) => b.id - a.id);
  
  const displayedPieces = isRedListMode 
    ? sortedPieces.filter(p => p.status === 'red' && p.type !== 'divider') 
    : sortedPieces;

  const [swipedId, setSwipedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ title: '', date: '' });
  const touchStartX = useRef(null);

  // --- ACTIONS ---
  const deletePiece = (id) => { 
      if (confirm("Delete this?")) setRepertoire(repertoire.filter(p => p.id !== id)); 
  };
  
  const editPiece = (id, updated) => {
      setRepertoire(repertoire.map(p => p.id === id ? { ...p, ...updated } : p));
  };

  const cyclePieceStatus = (id) => {
     setRepertoire(repertoire.map(p => {
        if (p.id !== id) return p;
        const current = p.status || (p.isRed ? 'red' : 'normal');
        let next = 'normal';
        if (current === 'normal') next = 'red';
        else if (current === 'red') next = 'green';
        else if (current === 'green') next = 'normal';
        return { ...p, status: next, isRed: next === 'red' };
     }));
  };

  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e, id) => {
    if (!touchStartX.current) return;
    const endX = e.changedTouches[0].clientX;
    const diff = touchStartX.current - endX;
    if (diff > 50) setSwipedId(id);
    else if (diff < -50) { if (swipedId === id) setSwipedId(null); }
    touchStartX.current = null;
  };

  const startEdit = (piece) => {
    setEditingId(piece.id);
    setEditForm({ title: piece.title, date: piece.startDate || '' });
  };
  
  const saveEdit = () => {
    if (editForm.title && editingId) {
      editPiece(editingId, { title: editForm.title, startDate: editForm.date });
      setEditingId(null);
      setSwipedId(null);
    }
  };
  
  const clearDate = () => setEditForm({ ...editForm, date: '' });

  return (
    <div className="flex-1 overflow-y-auto p-4 animate-in slide-in-from-right duration-300 w-full no-scrollbar scroller-fix" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      
      {/* Header */}
      <div className="flex items-center justify-between mb-4 px-2">
        <div className="text-sm font-bold uppercase tracking-wider text-slate-400">My Repertoire</div>
        <button onClick={toggleRedList} className={`flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full border transition-all ${isRedListMode ? 'bg-red-500 text-white border-red-500' : 'bg-transparent text-slate-400 border-slate-300 dark:border-slate-600'}`}>
          <IconDot status={isRedListMode ? 'red' : 'normal'} /> {isRedListMode ? 'Red List Active' : 'Show Red List'}
        </button>
      </div>

      {/* Edit Modal Overlay */}
      {editingId && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50" style={{ height: 'var(--app-height, 100vh)' }}>
           <div className="min-h-full flex items-center justify-center p-4">
              <div onClick={(e) => e.stopPropagation()} className="bg-white dark:bg-slate-800 p-6 rounded-2xl w-full max-w-sm shadow-2xl animate-in zoom-in duration-200 relative">
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">Edit Piece</h3>
                <div className="space-y-3">
                  <input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} className="w-full p-3 border border-slate-200 dark:border-slate-600 rounded-xl text-lg outline-none dark:bg-slate-700 dark:text-white" />
                  <div className="flex gap-2">
                    <input type="date" value={editForm.date} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} className="w-full p-3 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-xl text-sm outline-none dark:text-white" />
                    <button onClick={clearDate} className="bg-slate-100 dark:bg-slate-700 text-slate-500 p-3 rounded-xl"><Trash size={16}/></button>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button onClick={saveEdit} className="flex-1 bg-indigo-600 text-white py-3 rounded-xl text-sm font-bold">Save</button>
                    <button onClick={() => setEditingId(null)} className="flex-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 py-3 rounded-xl text-sm font-bold">Cancel</button>
                  </div>
                </div>
              </div>
           </div>
        </div>
      )}

      {/* List Items */}
      <div className="space-y-3 pb-8">
        {[...displayedPieces].map((piece) => {
          const isSwiped = swipedId === piece.id;
          
          // --- DIVIDER RENDERING (Exact match to old version) ---
          if (piece.type === 'divider') {
              return (
                  <div key={piece.id} className="relative overflow-hidden isolate">
                     {/* Background Delete Button */}
                     <div className={`absolute inset-0 z-0 flex justify-end transition-all duration-200 ${isSwiped ? 'opacity-100' : 'opacity-0 invisible'}`}>
                       <button onClick={() => deletePiece(piece.id)} className="bg-red-500 text-white font-bold w-24 flex items-center justify-center rounded-r-xl my-2">Delete</button>
                     </div>
                     
                     {/* Foreground Content */}
                     <div 
                        className="relative z-10 swipe-item bg-slate-50 dark:bg-slate-900" 
                        onTouchStart={handleTouchStart} 
                        onTouchEnd={(e) => handleTouchEnd(e, piece.id)} 
                        style={{ 
                            backfaceVisibility: 'hidden', 
                            willChange: 'transform', 
                            transform: isSwiped ? 'translate3d(-6rem,0,0)' : 'translate3d(0,0,0)' 
                        }}
                     >
                        <div className="flex items-center justify-center gap-4 py-4 opacity-70">
                            <div className="h-px bg-slate-300 dark:bg-slate-600 flex-1"></div>
                            <span className="font-bold text-slate-400 dark:text-slate-500 text-xs tracking-widest uppercase">{piece.text || piece.hours}</span>
                            <div className="h-px bg-slate-300 dark:bg-slate-600 flex-1"></div>
                        </div>
                     </div>
                  </div>
              )
          }

          // --- PIECE RENDERING ---
          const weeksAgo = weeksSince(piece.startDate);
          return (
            <div key={piece.id} className="relative rounded-xl overflow-hidden isolate bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 transform-gpu" style={{ backgroundClip: 'padding-box' }}>
              {/* Background Buttons */}
              <div className={`absolute inset-0 z-0 flex justify-end bg-white dark:bg-slate-800 transition-all duration-200 ${isSwiped ? 'opacity-100' : 'opacity-0 invisible'}`}>
                <button onClick={() => startEdit(piece)} className="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold w-20 flex items-center justify-center">Edit</button>
                <button onClick={() => deletePiece(piece.id)} className="bg-red-500 text-white font-bold w-24 flex items-center justify-center">Delete</button>
              </div>

              {/* Foreground Content */}
              <div className="absolute inset-0 z-10 bg-white dark:bg-slate-800 shadow-sm p-4 flex items-center justify-between swipe-item" onTouchStart={handleTouchStart} onTouchEnd={(e) => handleTouchEnd(e, piece.id)} style={{ backfaceVisibility: 'hidden', willChange: 'transform', transform: isSwiped ? 'translate3d(-11rem,0,0)' : 'translate3d(0,0,0)' }}>
                <div className="flex-1 pr-4 pl-2">
                  <h3 className="font-medium text-slate-900 dark:text-white">{piece.title}</h3>
                  {weeksAgo && (
                    <div className="text-[10px] text-slate-400 mt-1 font-mono">
                      Started: {formatDisplayDate(piece.startDate)} • {weeksAgo}
                    </div>
                  )}
                </div>
                <button onClick={(e) => { e.stopPropagation(); cyclePieceStatus(piece.id); }} className="p-2 active:scale-90 transition-transform">
                  <IconDot status={piece.status || (piece.isRed ? 'red' : 'normal')} />
                </button>
              </div>
              
              {/* Spacer to give height to absolute element */}
              <div className="h-[72px]"></div>
            </div>
          );
        })}
        {displayedPieces.length === 0 && <div className="text-center text-slate-400 mt-10 p-6">No pieces found.</div>}
      </div>
    </div>
  );
};

export default Repertoire;
