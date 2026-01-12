import React, { useState } from 'react';
import { Plus, X, Music, Minus } from 'lucide-react';

const Repertoire = ({ repertoire, setRepertoire }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('piece'); // 'piece' or 'divider'
  
  // Form States
  const [newPieceTitle, setNewPieceTitle] = useState("");
  const [newPieceComposer, setNewPieceComposer] = useState("");
  const [newPieceStatus, setNewPieceStatus] = useState("In Progress");
  const [dividerText, setDividerText] = useState("");
  
  // Insertion Logic
  const [insertPosition, setInsertPosition] = useState("end"); // 'end' or 'after'
  const [insertAfterId, setInsertAfterId] = useState("");

  const handleAdd = () => {
    const newId = Date.now();
    let newItem;

    if (modalMode === 'piece') {
      if (!newPieceTitle) return;
      newItem = {
        id: newId,
        type: 'piece',
        title: newPieceTitle,
        composer: newPieceComposer,
        status: newPieceStatus,
        repetitions: 0,
        mastered: false
      };
    } else {
      // Divider Logic
      newItem = {
        id: newId,
        type: 'divider',
        title: dividerText.trim() === "" ? "-----------------" : `--- ${dividerText} ---`
      };
    }

    let updatedRepertoire = [...repertoire];

    if (insertPosition === 'end') {
      updatedRepertoire.push(newItem);
    } else {
      const index = updatedRepertoire.findIndex(p => p.id === Number(insertAfterId));
      if (index !== -1) {
        updatedRepertoire.splice(index + 1, 0, newItem);
      } else {
        updatedRepertoire.push(newItem);
      }
    }

    setRepertoire(updatedRepertoire);
    resetForm();
    setIsModalOpen(false);
  };

  const resetForm = () => {
    setNewPieceTitle("");
    setNewPieceComposer("");
    setDividerText("");
    setInsertPosition("end");
    setInsertAfterId("");
  };

  const deleteItem = (id) => {
    setRepertoire(repertoire.filter(item => item.id !== id));
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-8">
      {/* Header with Plus Button */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800">My Repertoire</h2>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="p-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition-colors shadow-sm"
          title="Add Piece or Divider"
        >
          <Plus size={20} />
        </button>
      </div>

      {/* List */}
      <div className="space-y-3">
        {repertoire.map((item, index) => (
          <div key={item.id} className="group flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl transition-all border border-transparent hover:border-slate-100">
            
            {item.type === 'divider' ? (
              // DIVIDER VIEW
              <div className="w-full flex items-center justify-center text-slate-400 font-mono text-sm">
                {item.title}
              </div>
            ) : (
              // PIECE VIEW
              <div className="flex items-center gap-4 overflow-hidden">
                <div className="w-8 h-8 flex items-center justify-center bg-indigo-50 text-indigo-600 rounded-full text-sm font-semibold flex-shrink-0">
                  {index + 1}
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-slate-800 truncate">{item.title}</h3>
                  <p className="text-sm text-slate-500 truncate">{item.composer}</p>
                </div>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  item.status === 'Mastered' ? 'bg-emerald-100 text-emerald-700' :
                  item.status === 'In Progress' ? 'bg-amber-100 text-amber-700' :
                  'bg-slate-100 text-slate-600'
                }`}>
                  {item.status}
                </span>
              </div>
            )}

            <button 
              onClick={() => deleteItem(item.id)}
              className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-red-500 transition-all"
            >
              <X size={18} />
            </button>
          </div>
        ))}
      </div>

      {/* MODAL OVERLAY */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            
            {/* Modal Header */}
            <div className="flex border-b border-slate-100">
              <button 
                onClick={() => setModalMode('piece')}
                className={`flex-1 p-4 font-medium text-sm flex items-center justify-center gap-2 ${modalMode === 'piece' ? 'bg-white text-indigo-600 border-b-2 border-indigo-600' : 'bg-slate-50 text-slate-500'}`}
              >
                <Music size={16} /> Add Piece
              </button>
              <button 
                onClick={() => setModalMode('divider')}
                className={`flex-1 p-4 font-medium text-sm flex items-center justify-center gap-2 ${modalMode === 'divider' ? 'bg-white text-indigo-600 border-b-2 border-indigo-600' : 'bg-slate-50 text-slate-500'}`}
              >
                <Minus size={16} /> Add Divider
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              
              {/* INPUTS */}
              {modalMode === 'piece' ? (
                <>
                  <input
                    placeholder="Piece Title"
                    value={newPieceTitle}
                    onChange={(e) => setNewPieceTitle(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    autoFocus
                  />
                  <input
                    placeholder="Composer"
                    value={newPieceComposer}
                    onChange={(e) => setNewPieceComposer(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  <select
                    value={newPieceStatus}
                    onChange={(e) => setNewPieceStatus(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                  >
                    <option>In Progress</option>
                    <option>Mastered</option>
                    <option>Wishlist</option>
                  </select>
                </>
              ) : (
                <div className="text-center space-y-2">
                   <p className="text-sm text-slate-500">Leave empty for a solid line</p>
                   <input
                    placeholder="Section Name (Optional)"
                    value={dividerText}
                    onChange={(e) => setDividerText(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-center"
                    autoFocus
                  />
                </div>
              )}

              {/* INSERT POSITION LOGIC */}
              <div className="pt-2 border-t border-slate-100">
                 <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">Position</label>
                 <div className="flex gap-2 mb-3">
                    <button 
                      onClick={() => setInsertPosition('end')}
                      className={`flex-1 py-2 text-xs rounded-lg border ${insertPosition === 'end' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'border-slate-200 text-slate-600'}`}
                    >
                      End of List
                    </button>
                    <button 
                      onClick={() => setInsertPosition('after')}
                      className={`flex-1 py-2 text-xs rounded-lg border ${insertPosition === 'after' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'border-slate-200 text-slate-600'}`}
                    >
                      After Piece...
                    </button>
                 </div>
                 
                 {insertPosition === 'after' && (
                   <select 
                    className="w-full p-2 text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none"
                    value={insertAfterId}
                    onChange={(e) => setInsertAfterId(e.target.value)}
                   >
                     <option value="">Select a piece...</option>
                     {repertoire.map(p => (
                       <option key={p.id} value={p.id}>
                         {/* FIX: Shows only title, no double numbers */}
                         {p.title}
                       </option>
                     ))}
                   </select>
                 )}
              </div>

              {/* ACTION BUTTONS */}
              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 text-slate-600 font-medium hover:bg-slate-50 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleAdd}
                  disabled={modalMode === 'piece' && !newPieceTitle}
                  className="flex-1 py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-indigo-200"
                >
                  Add {modalMode === 'piece' ? 'Piece' : 'Divider'}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default Repertoire;
