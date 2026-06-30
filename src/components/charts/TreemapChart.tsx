import { ResponsiveContainer, Tooltip, Treemap } from 'recharts';
import { useTheme } from '@mui/material/styles';
import { Box, Typography } from '@mui/material';
import { CHART_PALETTE } from '@/app/config/chartColors';

export interface TreemapDatum {
  name: string;
  size: number;
  sub?: string;
}

/** Proportional treemap — shows CO₂e concentration across a dimension at a glance. */
export function TreemapChart({
  data,
  valueFormatter,
  height = 300,
  onSelect,
}: {
  data: TreemapDatum[];
  valueFormatter: (v: number) => string;
  height?: number;
  onSelect?: (name: string) => void;
}) {
  const theme = useTheme();
  const rows = data.map((d, i) => ({ ...d, fill: CHART_PALETTE[i % CHART_PALETTE.length] }));

  const Content = (props: { x: number; y: number; width: number; height: number; name?: string; size?: number; fill?: string }) => {
    const { x, y, width, height: h, name, size, fill } = props;
    if (width <= 0 || h <= 0) return null;
    const show = width > 56 && h > 28;
    return (
      <g style={{ cursor: onSelect ? 'pointer' : 'default' }} onClick={onSelect && name ? () => onSelect(name) : undefined}>
        <rect x={x} y={y} width={width} height={h} fill={fill} stroke={theme.palette.background.paper} strokeWidth={2} rx={3} />
        {show && (
          <>
            <text x={x + 7} y={y + 17} fontSize={11.5} fontWeight={700} fill="#fff">
              {(name ?? '').length > 18 ? `${(name ?? '').slice(0, 17)}…` : name}
            </text>
            <text x={x + 7} y={y + 32} fontSize={11} fill="rgba(255,255,255,0.85)">
              {valueFormatter(size ?? 0)}
            </text>
          </>
        )}
      </g>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <Treemap data={rows} dataKey="size" stroke="#fff" isAnimationActive={false} content={<Content x={0} y={0} width={0} height={0} />}>
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload as TreemapDatum;
            return (
              <Box sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 1.5, p: 1, boxShadow: 2 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, display: 'block' }}>{p.name}</Typography>
                <Typography variant="caption" color="text.secondary">{valueFormatter(p.size)}{p.sub ? ` · ${p.sub}` : ''}</Typography>
              </Box>
            );
          }}
        />
      </Treemap>
    </ResponsiveContainer>
  );
}
