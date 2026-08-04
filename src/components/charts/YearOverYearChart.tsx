import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTheme } from '@mui/material/styles';
import type { ReportingYearPoint } from '@/types';
import { formatTonnes, formatIntensity } from '@/utils/format';

/**
 * CO₂e per reporting year (bars) with transport intensity (line) — the view that
 * separates volume growth from routing inefficiency: the total can rise with
 * tonnage while intensity falls.
 *
 * Years are the workbook's own Jul→Jun windows, so the axis is a label
 * ("FY23-24"), not a calendar number.
 */
export function YearOverYearChart({
  data,
  height = 260,
  onYearClick,
}: {
  data: ReportingYearPoint[];
  height?: number;
  onYearClick?: (reportingYear: string) => void;
}) {
  const theme = useTheme();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 12, right: 8, bottom: 0, left: -8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} vertical={false} />
        <XAxis dataKey="reportingYear" tick={{ fontSize: 12 }} stroke={theme.palette.text.secondary} />
        <YAxis
          yAxisId="left"
          tick={{ fontSize: 12 }}
          stroke={theme.palette.text.secondary}
          width={52}
          tickFormatter={(v: number) => formatTonnes(v)}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fontSize: 12 }}
          stroke={theme.palette.primary.main}
          width={48}
          tickFormatter={(v: number) => `${v}`}
        />
        <Tooltip
          formatter={(v: number, n) => (n === 'intensity' ? [formatIntensity(v), 'Intensity'] : [formatTonnes(v), 'CO₂e'])}
          labelFormatter={(l) => `${l}${onYearClick ? ' — click the bar for month-by-month' : ''}`}
          contentStyle={{ borderRadius: 10, fontSize: 12.5 }}
        />
        <Bar
          yAxisId="left"
          dataKey="co2eTonnes"
          fill={theme.palette.secondary.main}
          radius={[5, 5, 0, 0]}
          barSize={44}
          isAnimationActive={false}
          cursor={onYearClick ? 'pointer' : undefined}
          onClick={
            onYearClick
              ? (entry: { payload?: ReportingYearPoint }) => entry?.payload && onYearClick(entry.payload.reportingYear)
              : undefined
          }
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="intensity"
          stroke={theme.palette.primary.main}
          strokeWidth={2.5}
          dot={{ r: 3 }}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
