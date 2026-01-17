import React, { useMemo } from 'react';

const MomentumChart = ({ externalHistory, stats, graphRange, setGraphRange }) => {
  const chartData = useMemo(() => {
    if (!stats || !externalHistory) return null;

    const points = [];
    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // 1. Calculate Start Date based on range
    let startDate = new Date(todayMidnight);
    if (graphRange === 7) {
        startDate.setDate(todayMidnight.getDate() - 6);
    } else if (graphRange === 30) {
        startDate.setDate(todayMidnight.getDate() - 29);
    }

    // 2. Prepare Data Map
    const dailyPlayMap = {};
    externalHistory.forEach(s => {
        const d = new Date(s.id);
        const key = d.toDateString();
        dailyPlayMap[key] = (dailyPlayMap[key] || 0) + s.duration;
    });

    // 3. Generate Points
    // We start at Cumulative Delta = 0 (assuming we start "on track")
    let currentCumulativeDelta = 0; 
    let iterator = new Date(startDate);
    let xIndex = 0;
    
    // Safety: Find first ever log date to avoid plotting huge drops for days before you even started using the app
    const firstLogTimestamp = externalHistory.length > 0 
        ? Math.min(...externalHistory.map(s => s.id)) 
        : Date.now();
    const firstLogDate = new Date(firstLogTimestamp);
    firstLogDate.setHours(0,0,0,0);

    const cumulativeTotals = {};
    let runningTotal = 0;
    const sortedDates = Object.keys(dailyPlayMap)
      .map(key => new Date(key))
      .sort((a, b) => a - b);

    sortedDates.forEach(date => {
      runningTotal += dailyPlayMap[date.toDateString()] || 0;
      cumulativeTotals[date.toDateString()] = runningTotal;
    });

    while (iterator <= todayMidnight) {
        // Logic: If the date is before you ever started logging, assume perfect average (flat line)
        // If it's after you started, but no data, it counts as 0 play (line goes down)
        const isPreHistory = iterator < firstLogDate;
        
        let dailyDelta = 0;
        if (!isPreHistory) {
            const played = dailyPlayMap[iterator.toDateString()] || 0;
            const daysSinceStart = Math.max(1, Math.floor((iterator - firstLogDate) / (1000 * 60 * 60 * 24)) + 1);
            const totalToDate = cumulativeTotals[iterator.toDateString()] ?? runningTotal;
            const dailyBaseline = totalToDate / daysSinceStart;
            dailyDelta = (played - dailyBaseline) * 3600; // Convert to seconds
        }

        currentCumulativeDelta += dailyDelta;

        points.push({
            x: xIndex,
            y: currentCumulativeDelta,
            date: iterator.toLocaleDateString('en-US', { weekday: 'short' }),
            fullDate: iterator.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            isProjected: isPreHistory
        });

        // Advance day
        iterator.setDate(iterator.getDate() + 1);
        xIndex++;
    }

    if (points.length < 2) return null; // Need at least 2 points for a line

    // 4. Scaling (GeoGebra Style)
    const yValues = points.map(p => p.y);
    const minY = Math.min(0, ...yValues);
    const maxY = Math.max(0, ...yValues);
    
    // Range Calculation with "Minimum Zoom" protection
    // We ensure the range is at least 20 seconds so tiny 1s changes don't look huge
    let range = maxY - minY;
    if (range < 20) range = 20; 
    
    const padding = range * 0.2; // 20% padding
    const effectiveMin = minY - padding;
    const effectiveMax = maxY + (range * 0.2); // Add padding to max too
    const effectiveRange = effectiveMax - effectiveMin;

    const width = 100;
    const height = 100;
    const maxX = points.length - 1;

    // Coordinate Transformers
    const getX = (idx) => (idx / maxX) * width;
    const getY = (val) => height - ((val - effectiveMin) / effectiveRange) * height;

    // 5. Build SVG Paths
    // Line Path
    const pathD = points.map((p, i) => 
        `${i===0 ? 'M' : 'L'} ${getX(p.x)} ${getY(p.y)}`
    ).join(" ");

    // Area Fill (gradient)
    const areaD = `${pathD} L ${width} ${getY(0)} L 0 ${getY(0)} Z`;

    const zeroY = getY(0);
    const isUp = points[points.length-1].y >= 0;
    const color = isUp ? '#22c55e' : '#ef4444'; // Green or Red

    const tickStep = 10;
    const tickMin = Math.floor(effectiveMin / tickStep) * tickStep;
    const tickMax = Math.ceil(effectiveMax / tickStep) * tickStep;
    const ticks = [];
    for (let t = tickMin; t <= tickMax; t += tickStep) {
      ticks.push(t);
    }

    return { points, pathD, areaD, zeroY, color, getX, getY, ticks };
  }, [externalHistory, stats, graphRange]);

  if (!chartData) return null;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm mb-6 border border-slate-100 dark:border-slate-700">
        <div className="flex justify-between items-center mb-6">
            <div className="text-sm font-bold uppercase tracking-wider text-slate-400">Momentum</div>
            <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
            <button onClick={() => setGraphRange(7)} className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${graphRange === 7 ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white' : 'text-slate-400'}`}>THIS WEEK</button>
            <button onClick={() => setGraphRange(30)} className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${graphRange === 30 ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white' : 'text-slate-400'}`}>30D</button>
            </div>
        </div>
        
        <div className="h-40 w-full relative">
            <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" className="overflow-visible">
                {/* Axes */}
                <line x1="0" y1="0" x2="0" y2="100" stroke="currentColor" strokeWidth="0.6" className="text-slate-300 dark:text-slate-600" />
                <line x1="0" y1="100" x2="100" y2="100" stroke="currentColor" strokeWidth="0.6" className="text-slate-300 dark:text-slate-600" />

                {/* Y-Axis Ticks */}
                {chartData.ticks.map((tick) => (
                    <g key={`tick-${tick}`}>
                        <line x1="0" y1={chartData.getY(tick)} x2="2" y2={chartData.getY(tick)} stroke="currentColor" strokeWidth="0.5" className="text-slate-300 dark:text-slate-600" />
                        <text x="3" y={chartData.getY(tick) + 1.5} fontSize="3" fill="currentColor" className="text-slate-400 font-mono">{tick}s</text>
                    </g>
                ))}

                {/* X-Axis Labels */}
                {chartData.points.map((point, i) => (
                    <text key={`label-${i}`} x={chartData.getX(point.x)} y="104" fontSize="3" textAnchor="middle" fill="currentColor" className="text-slate-400 font-mono">
                        {point.date}
                    </text>
                ))}
                {/* Zero Line (Baseline) */}
                <line x1="0" y1={chartData.zeroY} x2="100" y2={chartData.zeroY} stroke="currentColor" strokeWidth="0.5" strokeDasharray="3" className="text-slate-300 dark:text-slate-600" />
                
                {/* Baseline Label */}
                <text x="2" y={chartData.zeroY - 2} fontSize="4" fill="currentColor" className="text-slate-400 opacity-50 font-mono font-bold">DAILY AVG</text>

                {/* Gradient Area */}
                <path d={chartData.areaD} fill={chartData.color} fillOpacity="0.1" stroke="none" />

                {/* The Trend Line */}
                <path d={chartData.pathD} fill="none" stroke={chartData.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />

                {/* Physical Data Points */}
                {chartData.points.map((p, i) => (
                    <circle 
                        key={i} 
                        cx={chartData.getX(p.x)} 
                        cy={chartData.getY(p.y)} 
                        r="1.5" 
                        fill="white" 
                        stroke={chartData.color} 
                        strokeWidth="1" 
                        vectorEffect="non-scaling-stroke" // Keeps stroke crisp
                    />
                ))}
            </svg>
        </div>
    </div>
  );
};

export default MomentumChart;
