import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import { useTheme } from '@mui/material/styles';
import type { Scenario } from '@/types';
import { APPROACH_COLORS, APPROACH_LABEL } from '@/constants/app';
import { formatTonnes } from '@/utils/format';

/** Side-by-side CO₂e per representative shipment across the four approaches. */
export function ScenarioCompareChart({
  scenarios,
  height = 240,
}: {
  scenarios: { current: Scenario; optimal: Scenario; balanced: Scenario; best: Scenario };
  height?: number;
}) {
  const theme = useTheme();
  // Cap the optimal (air) bar so it doesn't crush the others; show true value in label.
  const order: Scenario[] = [scenarios.current, scenarios.optimal, scenarios.balanced, scenarios.best];
  const nonAirMax = Math.max(scenarios.current.co2eTonnes, scenarios.balanced.co2eTonnes, scenarios.best.co2eTonnes);
  const cap = nonAirMax * 2.2;
  const rows = order.map((s) => ({
    kind: s.kind,
    label: APPROACH_LABEL[s.kind],
    value: s.co2eTonnes,
    display: Math.min(s.co2eTonnes, cap),
    capped: s.co2eTonnes > cap,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} margin={{ top: 20, right: 16, bottom: 4, left: -10 }}>
        <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke={theme.palette.text.secondary} />
        <YAxis tick={{ fontSize: 11 }} stroke={theme.palette.text.secondary} width={44} domain={[0, cap]} />
        <Tooltip
          formatter={(_v: number, _n, p) => [formatTonnes(p.payload.value) + (p.payload.capped ? ' (off-scale)' : ''), 'CO₂e / shipment']}
          contentStyle={{ borderRadius: 10, fontSize: 12 }}
        />
        <Bar dataKey="display" radius={[6, 6, 0, 0]}>
          {rows.map((r) => (
            <Cell key={r.kind} fill={APPROACH_COLORS[r.kind]} />
          ))}
          <LabelList
            dataKey="value"
            position="top"
            formatter={(v: number) => formatTonnes(v)}
            style={{ fontSize: 11, fontWeight: 700, fill: theme.palette.text.primary }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
