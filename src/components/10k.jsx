import React, { useState, useMemo } from 'react';
import { Plus, Info, Edit2, Trash, Crown, Star } from 'lucide-react';

// --- CONSTANTS & HELPERS (Exact copy from v51) ---
const START_DATE = new Date("2024-02-01");

const LEGACY_MILESTONES = [
  { hours: 900, date: new Date("2025-11-08"), avg: "1h 24m", type: 'legacy' },
  { hours: 800, date: new Date("2025-08-18"), avg: "1h 25m", type: 'legacy' },
  { hours: 700, date: new Date("2025-06-30"), avg: "1h 22m", type: 'legacy' },
  { hours: 600, date: new Date("2025-04-30"), avg: "1h 20m", type: 'legacy' },
  { hours: 500, date: new Date("2024-12-31"), avg: "1h 29m", type: 'legacy' },
  { hours: 400, date: new Date("2024-11-13"), avg: "1h 24m", type: 'legacy' },
];

function formatDecimalToHMS(decimalHours) {
  const totalSeconds = Math.round(decimalHours * 3600);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}h ${m}m ${s}s`;
}

function calculateDaysAgo(date) {
  const now = new Date();
  const diffTime = Math.abs(now - date);
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

function formatAvgTime(str) {
  if (!str) return "";
  if (str.includes('h') && str.includes('m')) return str;
  let match = str.match(/^(\d+):(\d+):(\d+)$/);
  if (match) return `${parseInt(match[1])}h ${parseInt(match[2])}m ${parseInt(match[3])}s`;
  match = str.match(/^(\d+):(\d+)$/);
  if (match) return `${parseInt(match[1])}h ${parseInt(match[2])}m`;
  if (/^\d{5,6}$/.test(str)) {
     const s = parseInt(str.slice(-2), 10);
     const m = parseInt(str.slice(-4, -2), 10);
     const h = parseInt(str.slice(0, -4), 10);
     return `${h}h ${m}m ${s}s`;
  }
  if (/^\d{3,4}$/.test(str)) {
     const m = parseInt(str.slice(-2), 10);
     const h = parseInt(str.slice(0, -2), 10);
     return `${h}h ${m}m`;
  }
  return str;
}

function formatYearsMonthsSincePlain(dateObj) {
  const now = new Date();
  let years = now.getFullYear() - dateObj.getFullYear();
  let months = now.getMonth() - dateObj.getMonth();
  if (now.getDate() < dateObj.getDate()) months -= 1;
  if (months < 0) { years -= 1; months += 12; }
  if (years < 0) years = 0;
  if (months < 0) months = 0;
  return { years, months, text: `${years} year ${months} month` };
}

function calculate10kStats(totalHours, totalMinutes) {
  const now = new Date();
  const timeDiff = now - START_DATE;
  const daysPassed = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
  const totalPlayed = parseFloat(totalHours || 0) + (parseFloat(totalMinutes || 0) / 60);
  if (daysPassed <= 0 || totalPlayed === 0) return null;

  const avgHoursPerDay = totalPlayed / daysPassed;
  const percentage = Math.min(100, (totalPlayed / 10000) * 100).toFixed(2);

  const remainingHours = 10000 - totalPlayed;
  const daysRemaining = remainingHours / avgHoursPerDay;
  const finishDate = new Date();
  finishDate.setDate(now.getDate() + daysRemaining);

  const years = Math.floor(daysRemaining / 365);
  const months = Math.floor((daysRemaining % 365) / 30);
  const yearsFormatted = String(years).padStart(2, '0') + 'y';
  const monthsFormatted = String(months).padStart(2, '0') + 'm';

  const nextMilestone = (Math.floor(totalPlayed / 100) + 1) * 100;
  const hoursToMilestone = nextMilestone - totalPlayed;
  const daysToMilestone = Math.ceil(hoursToMilestone / avgHoursPerDay);
  const nextMilestoneDate = new Date();
  nextMilestoneDate.setDate(now.getDate() + daysToMilestone);
  const nextMilestoneDateStr = nextMilestoneDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const next1k = (Math.floor(totalPlayed / 1000) + 1) * 1000;
  const hoursTo1k = next1k - totalPlayed;
  const daysTo1k = Math.ceil(hoursTo1k / avgHoursPerDay);
  const next1kDate = new Date();
  next1kDate.setDate(now.getDate() + daysTo1k);
  const next1kDateStr = next1kDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const totalDays = daysPassed + daysRemaining;
  const totalJourneyYears = Math.floor(totalDays / 365);
  const totalJourneyMonths = Math.floor((totalDays % 365) / 30);
  const totalJourneyFormatted = `${totalJourneyYears}y ${totalJourneyMonths}m`;
  const remainingFormatted = `${yearsFormatted} ${monthsFormatted}`;

  return {
    daysPassed,
    avgDisplay: formatDecimalToHMS(avgHoursPerDay),
    percentage,
    finishDate: finishDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    yearsFormatted,
    monthsFormatted,
    nextMilestone,
    daysToMilestone,
    nextMilestoneDateStr,
    totalPlayed,
    next1k,
    daysTo1k,
    next1kDateStr,
    totalJourneyFormatted,
    remainingFormatted
  };
}

const Tracker = ({
  tenKData,
  setTenKData,
  customMilestones = [],
  addCustomMilestone,
  deleteCustomMilestone,
  editCustomMilestone,
  intervalMilestones = [],
  setIntervalMilestones,
  legacyMeta = {},
  setLegacyMeta,
  onIntervalAdded
}) => {
  const stats = calculate10kStats(tenKData.hours, tenKData.minutes);

  const [expandedId, setExpandedId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState('CHOOSE');
  const [modalType, setModalType] = useState(null);
  const [editingMilestone, setEditingMilestone] = useState(null);
  const [isForecastOpen, setIsForecastOpen] = useState(false);
  const [formState, setFormState] = useState({
    date: new Date().toISOString().split('T')[0],
    hours: '',
    avg: '',
    title: '',
    description: ''
  });

  const journeyAge = useMemo(() => formatYearsMonthsSincePlain(START_DATE), []);

  const nextIntervalHours = useMemo(() => {
    const hoursSet = new Set([
      ...LEGACY_MILESTONES.map(m => Number(m.hours)),
      ...intervalMilestones.map(m => Number(m.hours)),
    ]);
    let h = 1000;
    while (hoursSet.has(h)) h += 100;
    return h;
  }, [intervalMilestones]);

  const allMilestones = useMemo(() => {
    const legacy = LEGACY_MILESTONES.map(m => ({
      ...m,
      id: `legacy-${m.hours}`,
      type: 'legacy',
      title: `${m.hours} Hours`,
      description: legacyMeta[`legacy-${m.hours}`] || ""
    }));

    const interval = intervalMilestones.map(m => ({
      ...m,
      id: `interval-${m.id}`,
      type: 'interval',
      title: `${m.hours} Hours`,
      date: new Date(m.date),
      description: m.description || "",
      avg: formatAvgTime(m.avg)
    }));

    const custom = customMilestones.map(m => ({
      ...m,
      id: `custom-${m.id}`,
      type: 'custom',
      date: new Date(m.date),
      title: m.title,
      description: m.description || ""
    }));

    return [...legacy, ...interval, ...custom].sort((a, b) => Number(b.hours) - Number(a.hours));
  }, [customMilestones, intervalMilestones, legacyMeta]);

  const toggleExpand = (id) => setExpandedId(expandedId === id ? null : id);

  const openAdd = () => {
    setIsModalOpen(true);
    setModalStep('CHOOSE');
    setModalType(null);
    setEditingMilestone(null);
  };

  const openEdit = (milestone) => {
    setEditingMilestone(milestone);
    setIsModalOpen(true);
    setModalStep('FORM');
    setModalType('EDIT_DESC');
    setFormState({
      date: milestone.date ? new Date(milestone.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      hours: milestone.hours ? String(milestone.hours) : '',
      avg: milestone.avg || '',
      title: milestone.title || '',
      description: milestone.description || ''
    });
  };

  const saveEditDescription = () => {
    if (!editingMilestone) return;
    const desc = formState.description || "";

    if (editingMilestone.type === 'legacy') {
      setLegacyMeta(prev => ({ ...prev, [editingMilestone.id]: desc }));
    }
    if (editingMilestone.type === 'interval') {
      const rawId = String(editingMilestone.id).replace('interval-', '');
      setIntervalMilestones(prev => prev.map(m => String(m.id) === rawId ? { ...m, description: desc } : m));
    }
    if (editingMilestone.type === 'custom') {
      const rawId = String(editingMilestone.id).replace('custom-', '');
      editCustomMilestone(Number(rawId), { description: desc });
    }

    setIsModalOpen(false);
    setEditingMilestone(null);
  };

  const deleteEditingMilestone = () => {
    if (!editingMilestone) return;
    if (editingMilestone.type === 'interval') {
      const rawId = String(editingMilestone.id).replace('interval-', '');
      if (confirm("Delete this milestone?")) {
        setIntervalMilestones(prev => prev.filter(m => String(m.id) !== rawId));
        setIsModalOpen(false);
        setEditingMilestone(null);
      }
      return;
    }
    if (editingMilestone.type === 'custom') {
      const rawId = String(editingMilestone.id).replace('custom-', '');
      if (confirm("Delete this milestone?")) {
        deleteCustomMilestone(Number(rawId));
        setIsModalOpen(false);
        setEditingMilestone(null);
      }
      return;
    }
    if (editingMilestone.type === 'legacy') {
       if (confirm("Remove entry metadata?")) {
         setLegacyMeta(prev => { const n={...prev}; delete n[editingMilestone.id]; return n; });
         setIsModalOpen(false);
         setEditingMilestone(null);
       }
    }
  };

  const saveNewMilestone = () => {
    if (modalType === 'INTERVAL') {
      if (!formState.date || !formState.avg || !formState.hours) return;
      const h = Number(formState.hours);
      setIntervalMilestones(prev => ([
        ...prev,
        { id: Date.now(), date: formState.date, hours: h, avg: formState.avg, description: formState.description || "" }
      ]));
      if (onIntervalAdded) onIntervalAdded(String(h));
      setIsModalOpen(false);
      return;
    }

    if (modalType === 'CUSTOM') {
      if (!formState.date || !formState.hours || !formState.title) return;
      addCustomMilestone({
        id: Date.now(),
        date: formState.date,
        hours: Number(formState.hours),
        title: formState.title,
        description: formState.description || "",
        dateCreated: Date.now()
      });
      setIsModalOpen(false);
    }
  };

  const inputClass = "w-full p-3 border border-slate-200 dark:border-slate-600 rounded-xl text-sm outline-none dark:bg-slate-700 dark:text-white";

  const getForecastData = () => {
    if (!stats) return null;
    const calculateEffort = (secondsToAdd) => {
      const totalSeconds = secondsToAdd * stats.daysPassed;
      if (totalSeconds < 60) return `${Math.round(totalSeconds)}s`;
      const mins = Math.floor(totalSeconds / 60);
      const secs = Math.round(totalSeconds % 60);
      if (mins < 60) return `${mins}m ${secs}s`;
      const hrs = Math.floor(mins / 60);
      const remMins = mins % 60;
      return `${hrs}h ${remMins}m`;
    };
    const currentTotalHours = stats.totalPlayed;
    const currentDays = stats.daysPassed;
    const currentAvgHours = currentTotalHours / currentDays;
    const nextAvgHours = currentTotalHours / (currentDays + 1);
    const diffHours = currentAvgHours - nextAvgHours;
    const diffSeconds = diffHours * 3600;

    return {
      effort: [1, 3, 5, 10, 20].map(s => ({ seconds: s, cost: calculateEffort(s) })),
      drop: diffSeconds.toFixed(2)
    };
  };

  const forecastData = useMemo(() => isForecastOpen ? getForecastData() : null, [isForecastOpen, stats]);

  return (
    <div className="flex-1 flex flex-col p-6 overflow-y-auto w-full animate-in fade-in zoom-in duration-300 scroller-fix pb-24">
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm mb-6 border border-slate-100 dark:border-slate-700 z-20 relative">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">Current Progress</h2>
          {/* EDITED: Simplified Plus button */}
          <button onClick={openAdd} className="text-indigo-500 flex items-center justify-center bg-indigo-50 dark:bg-slate-800 p-2 rounded-full hover:bg-indigo-100 dark:hover:bg-slate-700 transition-colors">
            <Plus size={18} />
          </button>
        </div>

        <div className="flex gap-4 items-center">
          <div className="flex-1">
            <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Hours</label>
            <input
              type="number"
              value={tenKData.hours}
              onChange={(e) => setTenKData({ ...tenKData, hours: e.target.value })}
              placeholder="0"
              className="w-full text-3xl font-bold bg-transparent border-b-2 border-slate-200 dark:border-slate-600 focus:border-indigo-500 outline-none text-slate-900 dark:text-white p-1"
            />
          </div>

          <div className="flex-1">
            <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Minutes</label>
            <input
              type="number"
              value={tenKData.minutes}
              onChange={(e) => setTenKData({ ...tenKData, minutes: e.target.value })}
              placeholder="0"
              className="w-full text-3xl font-bold bg-transparent border-b-2 border-slate-200 dark:border-slate-600 focus:border-indigo-500 outline-none text-slate-900 dark:text-white p-1"
            />
          </div>
        </div>
      </div>

      {isForecastOpen && forecastData && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50" style={{ height: 'var(--app-height)' }}>
           <div className="min-h-full flex items-center justify-center p-4">
             <div onClick={(e) => e.stopPropagation()} className="bg-white dark:bg-slate-800 p-6 rounded-2xl w-full max-w-sm shadow-2xl animate-in zoom-in duration-200 relative">
               <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                 <Info size={16}/> Stats Forecast
               </h3>
               <div className="space-y-4">
                 <div>
                   <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">To Increase Average</div>
                   <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl overflow-hidden">
                     {forecastData.effort.map((item, i) => (
                       <div key={item.seconds} className={`flex justify-between items-center p-3 ${i !== 0 ? 'border-t border-slate-100 dark:border-slate-700' : ''}`}>
                         <span className="text-sm font-medium text-slate-600 dark:text-slate-300">+{item.seconds} sec</span>
                         <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">Play +{item.cost}</span>
                       </div>
                     ))}
                   </div>
                 </div>
                 <div>
                   <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">If You Skip Today</div>
                   <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-xl p-3 flex justify-between items-center">
                     <span className="text-sm font-medium text-red-600 dark:text-red-400">Average Drops By</span>
                     <span className="text-sm font-bold text-red-600 dark:text-red-400">{forecastData.drop} sec</span>
                   </div>
                 </div>
                 <button onClick={() => setIsForecastOpen(false)} className="w-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 py-3 rounded-xl text-sm font-bold">Close</button>
               </div>
             </div>
           </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50" style={{ height: 'var(--app-height)' }}>
           <div className="min-h-full flex items-center justify-center p-4">
             <div onClick={(e) => e.stopPropagation()} className="bg-white dark:bg-slate-800 p-6 rounded-2xl w-full max-w-sm shadow-2xl animate-in zoom-in duration-200 relative">
               {modalStep === 'CHOOSE' && (
                 <>
                   <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">Add Milestone</h3>
                   <div className="space-y-2">
                     <button onClick={() => { setModalType('INTERVAL'); setModalStep('FORM'); setFormState({ date: new Date().toISOString().split('T')[0], hours: String(nextIntervalHours), avg: '', title: '', description: '' }); }} className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-left">
                       <div className="text-sm font-bold text-slate-900 dark:text-white">100h Milestone</div>
                     </button>
                     <button onClick={() => { setModalType('CUSTOM'); setModalStep('FORM'); setFormState({ date: new Date().toISOString().split('T')[0], hours: '', avg: '', title: '', description: '' }); }} className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-left">
                       <div className="text-sm font-bold text-slate-900 dark:text-white">Custom Milestone</div>
                     </button>
                   </div>
                   <button onClick={() => setIsModalOpen(false)} className="w-full mt-4 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 py-3 rounded-xl text-sm font-bold">Cancel</button>
                 </>
               )}
               {modalStep === 'FORM' && modalType !== 'EDIT_DESC' && (
                 <>
                   <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">{modalType === 'INTERVAL' ? '100h Milestone' : 'Custom Milestone'}</h3>
                   <div className="space-y-3">
                     <div>
                       <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">Date</label>
                       <input type="date" value={formState.date} onChange={e => setFormState({ ...formState, date: e.target.value })} className={inputClass} style={{ width: '100%', minWidth: 0 }} />
                     </div>
                     {modalType === 'INTERVAL' && (
                       <>
                         <div>
                           <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">Hours</label>
                           <input type="number" value={formState.hours} onChange={e => setFormState({ ...formState, hours: e.target.value })} className={inputClass} inputMode="numeric" />
                         </div>
                         <div>
                           <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">Avg play time/day</label>
                           <input type="text" inputMode="numeric" placeholder="01:24:00" value={formState.avg} onChange={e => setFormState({ ...formState, avg: e.target.value })} className={inputClass} />
                         </div>
                       </>
                     )}
                     {modalType === 'CUSTOM' && (
                       <>
                         <div><label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">At hours</label><input type="number" placeholder="1050" value={formState.hours} onChange={e => setFormState({ ...formState, hours: e.target.value })} className={inputClass} /></div>
                         <div><label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">Name</label><input type="text" placeholder="New Piano" value={formState.title} onChange={e => setFormState({ ...formState, title: e.target.value })} className={inputClass} /></div>
                       </>
                     )}
                     <div><label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">Description</label><textarea value={formState.description} onChange={e => setFormState({ ...formState, description: e.target.value })} className={`${inputClass} h-24`} /></div>
                     <div className="flex gap-2 pt-1">
                       <button onClick={saveNewMilestone} className="flex-1 bg-indigo-600 text-white py-3 rounded-xl text-sm font-bold">Save</button>
                       <button onClick={() => { setModalStep('CHOOSE'); setModalType(null); setEditingMilestone(null); }} className="flex-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 py-3 rounded-xl text-sm font-bold">Back</button>
                     </div>
                   </div>
                 </>
               )}
               {modalStep === 'FORM' && modalType === 'EDIT_DESC' && editingMilestone && (
                 <>
                   <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Edit Description</h3>
                   <div className="text-xs text-slate-400 mb-4">{editingMilestone.title || `${editingMilestone.hours} Hours`}</div>
                   <div className="space-y-3">
                     <textarea value={formState.description} onChange={e => setFormState({ ...formState, description: e.target.value })} className={`${inputClass} h-28`} placeholder="Description..." />
                     <div className="flex gap-2">
                       <button onClick={saveEditDescription} className="flex-1 bg-indigo-600 text-white py-3 rounded-xl text-sm font-bold">Save</button>
                       <button onClick={deleteEditingMilestone} className="px-4 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 py-3 rounded-xl text-sm font-bold" title="Delete"><Trash size={16}/></button>
                       <button onClick={() => { setIsModalOpen(false); setEditingMilestone(null); }} className="flex-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 py-3 rounded-xl text-sm font-bold">Cancel</button>
                     </div>
                   </div>
                 </>
               )}
             </div>
           </div>
        </div>
      )}

      {stats ? (
        <>
          <div className="mb-4">
            <div className="flex justify-between text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">
              <span>MASTERY</span>
              <span>{stats.percentage}%</span>
            </div>
            <div className="h-6 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden shadow-inner relative">
              <div className="h-full bg-green-500 transition-all duration-1000 ease-out relative" style={{ width: `${stats.percentage}%` }}>
                <div className="absolute inset-0 bg-white/20"></div>
              </div>
            </div>
            <div className="flex justify-between mt-2 text-xs text-slate-400 font-mono items-center">
              <div className="flex items-center gap-2">
                <span>Avg: {stats.avgDisplay}/day</span>
                <button onClick={() => setIsForecastOpen(true)} className="text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300"><Info size={16}/></button>
              </div>
              <span>Day {stats.daysPassed}</span>
            </div>
          </div>

          <div className="relative mt-6 pb-12">
            {/* EDITED: Changed top-[3.5rem] to top-8 so the line goes UP BEHIND the first point */}
            <div className="absolute left-8 top-8 bottom-8 w-0.5 bg-slate-200 dark:bg-slate-700 -translate-x-1/2 z-0"></div>

            <div className="relative z-10 mb-8 pl-16">
              <div className="absolute left-8 top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-slate-300 dark:bg-slate-600 ring-4 ring-slate-50 dark:ring-slate-900"></div>
              <div className="border border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-3 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Estimated Finish</div>
                  <div className="text-lg font-bold text-slate-700 dark:text-slate-300">{stats.finishDate}</div>
                </div>
                <div className="text-right flex flex-col items-end justify-center gap-0.5">
                    <div className="text-xs font-bold text-slate-500 dark:text-slate-400">REMAINING {stats.remainingFormatted}</div>
                    <div className="text-xs font-bold text-slate-500 dark:text-slate-400">TOTAL {stats.totalJourneyFormatted}</div>
                </div>
              </div>
            </div>

            <div className="relative z-10 mb-8 pl-16">
              <div className="absolute left-8 top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-purple-400 ring-4 ring-purple-400/20 shadow-lg shadow-purple-400/50"></div>
              <div className="bg-gradient-to-r from-purple-50 to-white dark:from-slate-800 dark:to-slate-800 border border-purple-200 dark:border-purple-900/30 rounded-xl p-4 shadow-sm">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-purple-600 dark:text-purple-400 text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1"><Crown size={12}/> Next 1k</div>
                    <div className="text-xl font-bold text-slate-900 dark:text-white">{stats.next1k} Hours</div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-purple-500">{stats.daysTo1k}</div>
                    <div className="text-[10px] text-slate-400 uppercase font-bold">{stats.next1kDateStr}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative z-10 mb-8 pl-16">
              <div className="absolute left-8 top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-yellow-400 ring-4 ring-yellow-400/20 shadow-lg shadow-yellow-400/50"></div>
              <div className="bg-gradient-to-r from-yellow-50 to-white dark:from-slate-800 dark:to-slate-800 border border-yellow-200 dark:border-yellow-900/30 rounded-xl p-4 shadow-sm">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-yellow-600 dark:text-yellow-400 text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1"><Star size={12}/> Next Goal</div>
                    <div className="text-xl font-bold text-slate-900 dark:text-white">{stats.nextMilestone} Hours</div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-yellow-500">{stats.daysToMilestone}</div>
                    <div className="text-[10px] text-slate-400 uppercase font-bold">{stats.nextMilestoneDateStr}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative z-10 mb-8 pl-16">
              <div className="absolute left-8 top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-green-500 ring-4 ring-green-500/20"></div>
              <div className="bg-white dark:bg-slate-800 border border-green-200 dark:border-green-900/50 rounded-xl p-4 shadow-sm">
                <div className="flex justify-between items-center mb-1">
                  <div className="text-green-600 dark:text-green-400 text-xs font-bold uppercase tracking-wider">Current</div>
                  <div className="text-xs text-slate-400">Today</div>
                </div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white">{Math.floor(stats.totalPlayed)} <span className="text-sm font-normal text-slate-500">Hours</span></div>
              </div>
            </div>

            {allMilestones.map((milestone, idx) => {
              const isExpanded = expandedId === milestone.id;
              return (
                <div key={milestone.id || idx} onClick={() => toggleExpand(milestone.id)} className="relative z-10 mb-8 pl-16 cursor-pointer">
                  <div className="absolute left-8 top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600"></div>
                  <div className="flex-1">
                    <div className="flex justify-between items-baseline">
                      <span className={`font-bold text-slate-700 dark:text-slate-300 ${milestone.type === 'custom' ? 'text-sm' : 'text-lg'}`}>{milestone.title}</span>
                      {milestone.type === 'custom' ? <span className="text-xs text-slate-400">{milestone.hours} h</span> : <span className="text-xs text-slate-400">{milestone.avg}/day</span>}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">{milestone.date ? `${calculateDaysAgo(milestone.date)} days ago` : ''}</div>
                    {isExpanded && (
                      <div className="mt-3 text-sm text-slate-600 dark:text-slate-300 border-t border-slate-200 dark:border-slate-700 pt-2 flex justify-between items-start animate-in fade-in">
                        <div className="flex-1 mr-2 whitespace-pre-wrap">{milestone.description || <span className="text-slate-400 italic">No description...</span>}</div>
                        <button onClick={(e) => { e.stopPropagation(); openEdit(milestone); }} className="text-slate-400 hover:text-indigo-500 p-1"><Edit2 size={16}/></button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            <div className="relative z-10 pl-16">
              <div className="absolute left-8 top-1/2 -translate-x-1/2 w-4 h-full bg-slate-50 dark:bg-slate-900 z-0"></div>
              <div className="absolute left-8 top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-slate-900 dark:bg-white border-2 border-slate-50 dark:border-slate-900 z-10"></div>
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">Journey Started</div>
                  <div className="text-xs text-slate-400">Feb 1, 2024</div>
                </div>
                <div className="text-xs text-slate-400">{journeyAge.text}</div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="text-center text-slate-400 mt-10 p-6 bg-slate-100 dark:bg-slate-800/50 rounded-2xl">Enter your total hours above to generate your timeline.</div>
      )}
    </div>
  );
};

export default Tracker;
