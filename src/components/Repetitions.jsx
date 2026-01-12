import React, { useState } from 'react';
import { RefreshCw, Check, X } from 'lucide-react';

const Repetitions = () => {
  // Sample data - You can edit this later
  const [items, setItems] = useState([
    { id: 1, title: "C Major Scale", interval: "Daily", nextDue: "Today" },
    { id: 2, title: "Hanon Ex. 1", interval: "Every 2 days", nextDue: "Tomorrow" },
  ]);

  const [newItem, setNewItem] = useState("");

  const handleAdd = () => {
    if (!newItem) return;
    setItems([...items, { 
      id: Date.now(), 
      title: newItem, 
      interval: "Daily", 
      nextDue: "Today" 
    }]);
    setNewItem("");
  };

  const deleteItem = (id) => {
    setItems(items.filter(i => i.id !== id));
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-slate-700">Spaced Repetition</h2>
        <RefreshCw size={20} className="text-indigo-400" />
      </div>

      <div className="flex gap-2 mb-4">
        <input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder="Add new exercise..."
          className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button 
          onClick={handleAdd}
          className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors"
        >
          Add
        </button>
      </div>

      <div className="space-y-3">
        {items.map(item => (
          <div key={item.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
            <div>
              <h3 className="font-semibold text-slate-800">{item.title}</h3>
              <p className="text-xs text-slate-500">Interval: {item.interval}</p>
            </div>
            <div className="flex items-center gap-2">
               <span className="text-xs font-bold text-indigo-500 bg-indigo-50 px-2 py-1 rounded-md">
                 {item.nextDue}
               </span>
               <button onClick={() => deleteItem(item.id)} className="p-2 text-slate-400 hover:text-red-500">
                 <X size={16} />
               </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Repetitions;
