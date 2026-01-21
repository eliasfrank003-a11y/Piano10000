import React, { useState } from 'react';
import { Cloud, LogOut, Moon, Sun } from 'lucide-react';

const Settings = ({ syncStatus, isFirebaseEnabled, syncId, setSyncId, handleLogout, isDark, setIsDark }) => {
  const [localInput, setLocalInput] = useState("");
  const handleConnect = () => { if (localInput.trim()) setSyncId(localInput.trim()); };
  const handleKeyDown = (e) => { if (e.key === 'Enter') handleConnect(); };

  return (
    <div className="flex-1 overflow-y-auto p-4 w-full pb-24 scroller-fix">
      <div className="text-sm font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-4 px-2">Settings</div>

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-bold text-slate-900 dark:text-white">Cloud Sync</div>
          {syncStatus === 'synced' && <div className="text-xs text-green-500 font-bold flex gap-2 items-center">Connected</div>}
          {syncStatus === 'syncing' && <div className="text-xs text-indigo-500 font-bold animate-pulse">Syncing...</div>}
          {syncStatus === 'error' && <div className="text-xs text-red-500 font-bold">Offline</div>}
          {syncStatus === 'disconnected' && <div className="text-xs text-slate-400 font-bold">Disconnected</div>}
        </div>

        {!isFirebaseEnabled ? (
          <div className="text-center">
            <div className="text-slate-300 mb-2 flex justify-center"><Cloud size={32}/></div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Cloud sync is not configured.</p>
          </div>
        ) : (
          <div>
            {syncId ? (
              <div className="flex flex-col gap-3">
                <div className="p-3 bg-slate-100 dark:bg-slate-900 rounded-lg flex justify-between items-center">
                  <div className="text-xs font-mono text-slate-500">ID: ••••••••{syncId.slice(-3)}</div>
                  <button onClick={handleLogout} className="text-xs font-bold text-red-500 flex items-center gap-1"><LogOut size={14}/> Disconnect</button>
                </div>
              </div>
            ) : (
              <>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 block">Secret Passphrase</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={localInput}
                    onChange={(e) => setLocalInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="e.g. MyPiano2025"
                    className="flex-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:text-white"
                  />
                  <button onClick={handleConnect} className="bg-indigo-600 text-white px-4 rounded-lg text-sm font-bold">Connect</button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 mb-6 flex justify-between items-center">
        <div className="text-sm font-bold text-slate-900 dark:text-white">Dark Mode</div>
        <button onClick={() => setIsDark(!isDark)} className={`w-12 h-7 rounded-full p-1 transition-colors duration-300 flex items-center ${isDark ? 'bg-indigo-600 justify-end' : 'bg-slate-200 justify-start'}`}>
          <div className="w-5 h-5 rounded-full bg-white shadow-sm flex items-center justify-center text-slate-800">
            {isDark ? <Moon size={12} /> : <Sun size={12} />}
          </div>
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 mb-6">
        <div className="text-sm font-bold text-slate-900 dark:text-white">Version History</div>
        <ul className="mt-2 space-y-2 text-xs text-slate-500 dark:text-slate-400">
          <li>
            <span className="font-bold text-slate-600 dark:text-slate-300">v64</span> • Standalone PWA tweaks, unified Portfolio metrics, and chart axis updates.
          </li>
        </ul>
      </div>

      <div className="px-2 text-center text-xs text-slate-400">
         Piano v64 (Modular)<br />Build: Latest
      </div>
    </div>
  );
};

export default Settings;
