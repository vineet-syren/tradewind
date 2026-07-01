import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTheme } from '@mui/material/styles';
import type { InventoryYearPoint, ScopeId } from '@/types';
import { SCOPE_COLORS, SCOPE_SHORT } from '@/constants/app';
import { formatTonnes } from '@/utils/format';

/** Single-scope emissions trend over the reporting years. */
export function ScopeTrendArea({ data, scope, height = 260 }: { data: InventoryYearPoint[]; scope: ScopeId; height?: number }) {
  const theme = useTheme();
  const color = SCOPE_COLORS[scope];
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 12, right: 8, bottom: 0, left: -6 }}>
        <defs>
          <linearGradient id={`grad-${scope}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.5} />
            <stop offset="100%" stopColor={color} stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} vertical={false} />
        <XAxis dataKey="year" tick={{ fontSize: 11 }} stroke={theme.palette.text.secondary} />
        <YAxis tick={{ fontSize: 11 }} stroke={theme.palette.text.secondary} width={52} tickFormatter={(v: number) => formatTonnes(v, 0)} />
        <Tooltip formatter={(v: number) => [formatTonnes(v), SCOPE_SHORT[scope]]} contentStyle={{ borderRadius: 10, fontSize: 12 }} />
        <Area type="monotone" dataKey={scope} stroke={color} strokeWidth={2.5} fill={`url(#grad-${scope})`} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
