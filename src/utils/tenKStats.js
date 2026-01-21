const DAY_MS = 1000 * 60 * 60 * 24;

export const START_DATE = new Date("2024-02-01");
export const BASE_LOG_DATE = new Date("2026-01-17");
export const BASE_HOURS_LOGGED = 1015 + (46 / 60);

export function formatDecimalToHMS(decimalHours) {
  const totalSeconds = Math.round(decimalHours * 3600);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.round(totalSeconds % 60);

  if (h === 0) {
    if (m === 0) return `${s}s`;
    return `${m}m ${s}s`;
  }
  return `${h}h ${m}m ${s}s`;
}

export function calculateTenKStats(externalHistory = [], now = new Date()) {
  const newEvents = externalHistory.filter((session) => new Date(session.id) > BASE_LOG_DATE);
  const newHours = newEvents.reduce((acc, session) => acc + session.duration, 0);
  const totalPlayedHours = BASE_HOURS_LOGGED + newHours;

  const timeDiff = now - START_DATE;
  const daysPassed = Math.floor(timeDiff / DAY_MS);

  if (daysPassed <= 0 || totalPlayedHours === 0) return null;

  const avgHoursPerDay = totalPlayedHours / daysPassed;

  return {
    totalPlayedHours,
    totalPlayedSeconds: Math.round(totalPlayedHours * 3600),
    avgHoursPerDay,
    avgSeconds: Math.round(avgHoursPerDay * 3600),
    avgDisplay: formatDecimalToHMS(avgHoursPerDay),
    daysPassed
  };
}
