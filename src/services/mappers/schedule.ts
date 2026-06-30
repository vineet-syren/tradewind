/**
 * Forward-planning aggregation. Given the planned (future-dated) shipments in a
 * window, bucket them by week and surface the headline planning numbers. The UI
 * never does this maths itself.
 */
import type { ScheduleSummary, ScheduleWeek, Shipment } from '@/types';

/** Monday of the ISO week containing the given YYYY-MM-DD date. */
function weekStartISO(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const mondayOffset = (d.getUTCDay() + 6) % 7; // 0 = Monday
  d.setUTCDate(d.getUTCDate() - mondayOffset);
  return d.toISOString().slice(0, 10);
}

function weekLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', timeZone: 'UTC' });
}

const MODE_KEY: Record<string, keyof Pick<ScheduleWeek, 'Ocean' | 'Rail' | 'Road' | 'Air'>> = {
  Ocean: 'Ocean',
  Rail: 'Rail',
  Road: 'Road',
  Air: 'Air',
};

export function buildSchedule(planned: Shipment[], window: { from: string; to: string }): ScheduleSummary {
  const sorted = [...planned].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const weeks = new Map<string, ScheduleWeek>();
  for (const s of sorted) {
    const ws = weekStartISO(s.date);
    let w = weeks.get(ws);
    if (!w) {
      w = { weekStart: ws, label: weekLabel(ws), Ocean: 0, Rail: 0, Road: 0, Air: 0, count: 0 };
      weeks.set(ws, w);
    }
    const key = MODE_KEY[s.primaryMode] ?? 'Ocean';
    w[key] = Math.round((w[key] + s.co2eTonnes) * 1000) / 1000;
    w.count += 1;
  }

  return {
    window,
    plannedCount: sorted.length,
    projectedCo2eTonnes: Math.round(sorted.reduce((acc, s) => acc + s.co2eTonnes, 0) * 10) / 10,
    avoidableTonnes: Math.round(sorted.reduce((acc, s) => acc + (s.avoidableTonnes ?? 0), 0) * 10) / 10,
    airExposedCount: sorted.filter((s) => s.airException).length,
    byWeek: [...weeks.values()].sort((a, b) => (a.weekStart < b.weekStart ? -1 : 1)),
    shipments: sorted,
  };
}
