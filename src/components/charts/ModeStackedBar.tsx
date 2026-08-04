import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTheme } from '@mui/material/styles';
import { MODE_COLORS } from '@/constants/app';
import { formatTonnes } from '@/utils/format';

const MODES = ['Ocean', 'Rail', 'Road', 'Air'] as const;

/** Horizontal stacked bars of CO₂e by mode per category (e.g. customer × mode). */
export function ModeStackedBar({
  rows,
  height = 300,
  layout = 'vertical',
}: {
  rows: Array<{ name: string } & Partial<Record<(typeof MODES)[number], number>>>;
  height?: number;
  layout?: 'vertical' | 'horizontal';
}) {
  const theme = useTheme();
  const vertical = layout === 'vertical';
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} layout={layout} margin={{ top: 8, right: 16, bottom: 4, left: vertical ? 8 : -8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} horizontal={!vertical} vertical={vertical} />
        {vertical ? (
          <>
            <XAxis type="number" tick={{ fontSize: 11 }} stroke={theme.palette.text.secondary} tickFormatter={(v) => formatTonnes(v)} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} stroke={theme.palette.text.secondary} width={150} />
          </>
        ) : (
          <>
            <XAxis type="category" dataKey="name" tick={{ fontSize: 11 }} stroke={theme.palette.text.secondary} />
            <YAxis type="number" tick={{ fontSize: 11 }} stroke={theme.palette.text.secondary} width={48} tickFormatter={(v) => formatTonnes(v)} />
          </>
        )}
        <Tooltip formatter={(v: number, n) => [formatTonnes(v), n as string]} contentStyle={{ borderRadius: 10, fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {MODES.map((m, i) => (
          <Bar key={m} dataKey={m} stackId="a" fill={MODE_COLORS[m]} radius={i === MODES.length - 1 ? [0, 4, 4, 0] : undefined} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
