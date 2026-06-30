import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTheme } from '@mui/material/styles';
import type { YearPoint } from '@/types';
import { formatTonnes } from '@/utils/format';

/**
 * Year-over-year emissions (bars) with CO₂ per-tonne intensity (line) — the
 * deck's "separate business growth from logistics inefficiency" view: total can
 * rise with volume while intensity (efficiency) falls.
 */
export function YearOverYearChart({ data, height = 260 }: { data: YearPoint[]; height?: number }) {
  const theme = useTheme();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 12, right: 8, bottom: 0, left: -8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} vertical={false} />
        <XAxis dataKey="year" tick={{ fontSize: 11 }} stroke={theme.palette.text.secondary} />
        <YAxis yAxisId="l" tick={{ fontSize: 11 }} stroke={theme.palette.text.secondary} width={46} tickFormatter={(v: number) => formatTonnes(v)} />
        <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11 }} stroke={theme.palette.primary.main} width={42} tickFormatter={(v: number) => v.toFixed(2)} />
        <Tooltip
          formatter={(v: number, n) => (n === 'intensity' ? [`${v.toFixed(3)} t/t`, 'CO₂ per tonne'] : [formatTonnes(v), 'CO₂e'])}
          contentStyle={{ borderRadius: 10, fontSize: 12 }}
        />
        <Bar yAxisId="l" dataKey="co2eTonnes" fill={theme.palette.secondary.main} radius={[5, 5, 0, 0]} barSize={34} />
        <Line yAxisId="r" type="monotone" dataKey="intensity" stroke={theme.palette.primary.main} strokeWidth={2.5} dot={{ r: 3 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
