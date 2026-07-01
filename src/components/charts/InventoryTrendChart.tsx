import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTheme } from '@mui/material/styles';
import type { InventoryYearPoint } from '@/types';
import { SCOPE_COLORS } from '@/constants/app';
import { formatTonnes } from '@/utils/format';

const SERIES = [
  { key: 'scope1', label: 'Scope 1' },
  { key: 'scope2', label: 'Scope 2' },
  { key: 'scope3', label: 'Scope 3' },
] as const;

/** Stacked total emissions by scope per year, with the SBTi reduction path overlaid. */
export function InventoryTrendChart({ data, height = 300 }: { data: InventoryYearPoint[]; height?: number }) {
  const theme = useTheme();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 12, right: 8, bottom: 0, left: -6 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} vertical={false} />
        <XAxis dataKey="year" tick={{ fontSize: 11 }} stroke={theme.palette.text.secondary} />
        <YAxis tick={{ fontSize: 11 }} stroke={theme.palette.text.secondary} width={52} tickFormatter={(v: number) => formatTonnes(v, 0)} />
        <Tooltip
          formatter={(v: number, n) => [formatTonnes(v), n === 'targetTotal' ? 'SBTi target path' : (n as string)]}
          contentStyle={{ borderRadius: 10, fontSize: 12 }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {SERIES.map((s) => (
          <Bar key={s.key} dataKey={s.key} name={s.label} stackId="scopes" fill={SCOPE_COLORS[s.key]} isAnimationActive={false} maxBarSize={46} />
        ))}
        <Line
          type="monotone"
          dataKey="targetTotal"
          name="SBTi target path"
          stroke={theme.palette.text.primary}
          strokeWidth={2}
          strokeDasharray="5 4"
          dot={false}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
