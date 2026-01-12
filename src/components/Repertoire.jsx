import React, { useState } from 'react';
import { Plus, X, Music, Minus, Circle } from 'lucide-react';

const Repertoire = ({ repertoire, setRepertoire, isRedListMode, toggleRedList }) => {
  const displayedPieces = isRedListMode 
    ? repertoire.filter(p => p.status === 'red' && p.type !== 'divider') 
    : repertoire;

  // --- MODAL STATE (New Feature) ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('piece'); 
  const [newPieceTitle, setNewPieceTitle] = useState("");
  const [newPieceComposer, setNewPieceComposer] = useState("");
  const [newPieceStatus, setNewPieceStatus] = useState("In Progress");
  const [dividerText, setDividerText] = useState("");
  const [insertPosition, setInsertPosition] = useState("end");
  const [insertAfterId, setInsertAfterId] = useState("");

  // --- ACTIONS ---
  const deletePiece = (id) => { if (confirm("Delete this?")) setRepertoire(repertoire.filter(p => p.id !== id)); };
  
  const cyclePieceStatus = (id) => {
     setRepertoire(repertoire.map(p => {
        if (p.id !== id) return p;
        const current = p.status || 'normal';
        let next = 'normal';
        if (current === 'normal') next = 'red';
        else if (current === 'red') next = 'green';
        else if (current === 'green') next = 'normal';
        return { ...p, status: next };
     }));
  };

  const handleAdd = () => {
    const newId = Date.now();
    let newItem;

    if (modalMode === 'piece') {
      if (!newPieceTitle) return;
      newItem = {
        id: newId,
        type: 'piece',
        title: newPieceTitle,
        composer: newPieceComposer, // Storing for future use
        status: newPieceStatus === 'Mastered' ? 'green' : 'normal',
        startDate: new Date().toISOString().split('T')[0],
        playCount: 0
      };
    } else {
      newItem = {
        id: newId,
        type: 'divider',
        text: dividerText.trim() === "" ? "-----------------" : `--- ${dividerText} ---`
      };
    }

    let updatedRepertoire = [...repertoire];
    if (insertPosition === 'end') {
      updatedRepertoire.push(newItem);
    } else {
      const index = updatedRepertoire.findIndex(p => p.id === Number(insertAfterId));
      if (index !== -1) updatedRepertoire.splice(index + 1, 0, newItem);
      else updatedRepertoire.push(newItem);
    }
    setRepertoire(updatedRepertoire);
    setIsModalOpen(false);
    setNewPieceTitle(""); setDividerText("");
  };

  const IconDot = ({ status }) => {
      let colorClass = "text-slate-300";
      if (status === 'red') colorClass = "text-red-500";
      if (status === 'green') colorClass = "text-green-500";
      return <Circle size={12} fill={status === 'red' || status === 'green' ? "currentColor" : "none"} className={colorClass} strokeWidth={3} />;
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 w-full pb-24">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-4 px-2">
        <div className="text-sm font-bold uppercase tracking-wider text-slate-400">My Repertoire</div>
        <div className="flex gap-2">
            <button onClick={toggleRedList} className={`flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full border transition-all ${isRedListMode ? 'bg-red-500 text-white border-red-500' : 'bg-transparent text-slate-400 border-slate-300'}`}>
              <IconDot status={isRedListMode ? 'red' : 'normal'} /> {isRedListMode ? 'Red List Active' : 'Show Red List'}
            </button>
            <button onClick={() => setIsModalOpen(true)} className="bg-indigo-600 text-white p-1 rounded-full"><Plus size={16}/></button>
        </div>
      </div>

      {/* LIST */}
      <div className="space-y-3 pb-8">
         {displayedPieces.map((piece, index) => {
             if (piece.type === 'divider') {
                 return (
                     <div key={piece.id} className="relative py-4 flex items-center justify-center gap-4 opacity-70">
                         <div className="h-px bg-slate-300 flex-1"></div>
                         <span className="font-bold text-slate-400 text-xs tracking-widest uppercase">{piece.text || piece.title}</span>
                         <div className="h-px bg-slate-300 flex-1"></div>
                         <button onClick={() => deletePiece(piece.id)} className="absolute right-0 text-slate-300 hover:text-red-500"><X size={14}/></button>
                     </div>
                 );
             }
             return (
                 <div key={piece.id} className="relative rounded-xl overflow-hidden bg-white border border-slate-100 shadow-sm flex items-center justify-between p-4">
                     <div className="flex-1 pr-4 pl-2">
                         <h3 className="font-medium text-slate-900">{piece.title}</h3>
                         <div className="text-[10px] text-slate-400 mt-1 font-mono">
                           Started: {piece.startDate} • Plays: {piece.playCount || 0}
                         </div>
                     </div>
                     <div className="flex items-center gap-3">
                        <button onClick={() => cyclePieceStatus(piece.id)} className="p-2">
                            <IconDot status={piece.status} />
                        </button>
                        <button onClick={() => deletePiece(piece.id)} className="text-slate-300 hover:text-red-500"><X size={16}/></button>
                     </div>
                 </div>
             );
         })}
         {displayedPieces.length === 0 && <div className="text-center text-slate-400 mt-10 p-6">No pieces found.</div>}
      </div>

      {/* NEW MODAL (From your request) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex border-b border-slate-100">
              <button onClick={() => setModalMode('piece')} className={`flex-1 p-4 font-medium text-sm flex items-center justify-center gap-2 ${modalMode === 'piece' ? 'bg-white text-indigo-600 border-b-2 border-indigo-600' : 'bg-slate-50 text-slate-500'}`}>
                <Music size={16} /> Add Piece
              </button>
              <button onClick={() => setModalMode('divider')} className={`flex-1 p-4 font-medium text-sm flex items-center justify-center gap-2 ${modalMode === 'divider' ? 'bg-white text-indigo-600 border-b-2 border-indigo-600' : 'bg-slate-50 text-slate-500'}`}>
                <Minus size={16} /> Add Divider
              </button>
            </div>
            <div className="p-6 space-y-4">
              {modalMode === 'piece' ? (
                <>
                  <input placeholder="Piece Title" value={newPieceTitle} onChange={(e) => setNewPieceTitle(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" autoFocus />
                  <input placeholder="Composer (Optional)" value={newPieceComposer} onChange={(e) => setNewPieceComposer(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" />
                </>
              ) : (
                <div className="text-center space-y-2">
                   <p className="text-sm text-slate-500">Leave empty for a solid line</p>
                   <input placeholder="Section Name" value={dividerText} onChange={(e) => setDividerText(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-center" autoFocus />
                </div>
              )}
              {/* Insert Logic */}
              <div className="pt-2 border-t border-slate-100">
                 <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">Position</label>
                 <div className="flex gap-2 mb-3">
                    <button onClick={() => setInsertPosition('end')} className={`flex-1 py-2 text-xs rounded-lg border ${insertPosition === 'end' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'border-slate-200 text-slate-600'}`}>End of List</button>
                    <button onClick={() => setInsertPosition('after')} className={`flex-1 py-2 text-xs rounded-lg border ${insertPosition === 'after' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'border-slate-200 text-slate-600'}`}>After...</button>
                 </div>
                 {insertPosition === 'after' && (
                   <select className="w-full p-2 text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none" value={insertAfterId} onChange={(e) => setInsertAfterId(e.target.value)}>
                     <option value="">Select a piece...</option>
                     {repertoire.filter(p=>p.type!=='divider').map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                   </select>
                 )}
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setIsModalOpen(false)} className="flex-1 py-3 text-slate-600 font-medium hover:bg-slate-50 rounded-xl">Cancel</button>
                <button onClick={handleAdd} className="flex-1 py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700">Add</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Repertoire;
