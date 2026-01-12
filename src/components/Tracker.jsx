import React, { useState, useMemo } from 'react';
import { Plus, Info, ChevronDown, Trash, Edit2 } from 'lucide-react';

// --- HELPER FUNCTIONS ---
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

  return {
    daysPassed,
    avgDisplay: formatDecimalToHMS(avgHoursPerDay),
    percentage,
    finishDate: finishDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    totalPlayed,
    next1k: (Math.floor(totalPlayed / 1000) + 1) * 1000,
    daysTo1k: Math.ceil(((Math.floor(totalPlayed / 1000) + 1) * 1000 - totalPlayed) / avgHoursPerDay),
    nextMilestone: (Math.floor(totalPlayed / 100) + 1) * 100,
    daysToMilestone: Math.ceil(((Math.floor(totalPlayed / 100) + 1) * 100 - totalPlayed) / avgHoursPerDay),
  };
}

const Tracker = ({ tenKData, setTenKData }) => {
  const stats = calculate10kStats(tenKData.hours, tenKData.minutes);
  const [expandedId, setExpandedId] = useState(null);

  const toggleExpand = (id) => setExpandedId(expandedId === id ? null : id);

  return (
    <div className="flex-1 flex flex-col p-6 overflow-y-auto w-full pb-24">
      {/* INPUT CARD */}
      <div className="bg-white rounded-2xl p-6 shadow-sm mb-6 border border-slate-100 relative">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">Current Progress</h2>
        </div>

        <div className="flex gap-4 items-center">
          <div className="flex-1">
            <label className="text-xs text-slate-500 mb-1 block">Hours</label>
            <input
              type="number"
              value={tenKData.hours}
              onChange={(e) => setTenKData({ ...tenKData, hours: e.target.value })}
              placeholder="0"
              className="w-full text-3xl font-bold bg-transparent border-b-2 border-slate-200 focus:border-indigo-500 outline-none text-slate-900 p-1"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-slate-500 mb-1 block">Minutes</label>
            <input
              type="number"
              value={tenKData.minutes}
              onChange={(e) => setTenKData({ ...tenKData, minutes: e.target.value })}
              placeholder="0"
              className="w-full text-3xl font-bold bg-transparent border-b-2 border-slate-200 focus:border-indigo-500 outline-none text-slate-900 p-1"
            />
          </div>
        </div>
      </div>

      {stats ? (
        <>
          {/* PROGRESS BAR */}
          <div className="mb-4">
            <div className="flex justify-between text-xs font-bold text-slate-500 mb-2">
              <span>MASTERY</span>
              <span>{stats.percentage}%</span>
            </div>
            <div className="h-6 w-full bg-slate-200 rounded-full overflow-hidden shadow-inner relative">
              <div className="h-full bg-green-500 transition-all duration-1000 ease-out relative" style={{ width: `${stats.percentage}%` }}>
                <div className="absolute inset-0 bg-white/20"></div>
              </div>
            </div>
            <div className="flex justify-between mt-2 text-xs text-slate-400 font-mono items-center">
              <span>Avg: {stats.avgDisplay}/day</span>
              <span>Day {stats.daysPassed}</span>
            </div>
          </div>

          {/* TIMELINE */}
          <div className="relative mt-6 pb-12">
            <div className="absolute left-8 top-[3.5rem] bottom-8 w-0.5 bg-slate-200 -translate-x-1/2 z-0"></div>

            {/* Finish Date */}
            <div className="relative z-10 mb-8 pl-16">
              <div className="absolute left-8 top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-slate-300 ring-4 ring-slate-50"></div>
              <div className="border border-dashed border-slate-300 rounded-xl p-3 flex justify-between items-center bg-slate-50">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Estimated Finish</div>
                  <div className="text-lg font-bold text-slate-700">{stats.finishDate}</div>
                </div>
              </div>
            </div>

            {/* Next 1k */}
             <div className="relative z-10 mb-8 pl-16">
              <div className="absolute left-8 top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-purple-400 ring-4 ring-purple-400/20"></div>
              <div className="bg-gradient-to-r from-purple-50 to-white border border-purple-200 rounded-xl p-4 shadow-sm flex justify-between items-center">
                 <div>
                    <div className="text-purple-600 text-xs font-bold uppercase tracking-wider mb-1">Next 1k</div>
                    <div className="text-xl font-bold text-slate-900">{stats.next1k} Hours</div>
                 </div>
                 <div className="text-2xl font-bold text-purple-500">{stats.daysTo1k} <span className="text-xs text-slate-400">days</span></div>
              </div>
            </div>

            {/* Legacy Milestones */}
            {LEGACY_MILESTONES.map((milestone, idx) => {
               const isExpanded = expandedId === idx;
               return (
                 <div key={idx} onClick={() => toggleExpand(idx)} className="relative z-10 mb-8 pl-16 cursor-pointer">
                   <div className="absolute left-8 top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-slate-300"></div>
                   <div className="flex-1">
                     <div className="flex justify-between items-baseline">
                       <span className="text-lg font-bold text-slate-700">{milestone.hours} Hours</span>
                       <span className="text-xs text-slate-400">{milestone.avg}/day</span>
                     </div>
                     <div className="text-xs text-slate-400 mt-0.5">{calculateDaysAgo(milestone.date)} days ago</div>
                   </div>
                 </div>
               );
            })}
          </div>
        </>
      ) : (
        <div className="text-center text-slate-400 mt-10 p-6 bg-slate-100 rounded-2xl">Enter your total hours above to generate your timeline.</div>
      )}
    </div>
  );
};

export default Tracker;
