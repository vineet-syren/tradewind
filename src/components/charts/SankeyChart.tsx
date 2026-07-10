import { useState } from 'react';
import { ResponsiveContainer, Sankey, Tooltip } from 'recharts';
import { Box, Chip, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import type { FlowRow } from '@/types';
import { MODE_COLORS } from '@/constants/app';
import { formatTonnes } from '@/utils/format';

const MODES_SET = new Set(['Ocean', 'Rail', 'Road', 'Air']);

interface SelectedFlow {
  kind: 'flow' | 'node';
  from: string;
  to: string;
  value: number;
}

const ORIGIN_COLOR = '#64748b';
const TARGET_COLOR = '#6366f1';

function nodeColor(name: string, isSource: boolean): string {
  return MODE_COLORS[name] ?? (isSource ? ORIGIN_COLOR : TARGET_COLOR);
}

interface SankeyNodePayload {
  name: string;
  value?: number;
  x: number;
  y: number;
  width: number;
  height: number;
  index: number;
  payload: { name: string; isSource: boolean };
}

function NodeShape(props: unknown) {
  const { x, y, width, height, payload } = props as SankeyNodePayload;
  const fill = nodeColor(payload.name, payload.isSource);
  const labelLeft = x > 400; // right-column nodes label to the left
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill} rx={2} />
      <text
        x={labelLeft ? x - 6 : x + width + 6}
        y={y + height / 2}
        textAnchor={labelLeft ? 'end' : 'start'}
        dominantBaseline="middle"
        style={{ fontSize: 12.5, fontWeight: 600, fill: 'currentColor' }}
      >
        {payload.name}
      </text>
    </g>
  );
}

/** Two-stage CO₂e flow (origin → mode → destination market) as a sankey diagram. */
export function SankeyChart({
  flows,
  height = 360,
  valueFormatter = formatTonnes,
}: {
  flows: FlowRow[];
  height?: number;
  valueFormatter?: (v: number) => string;
}) {
  const theme = useTheme();
  const [selected, setSelected] = useState<SelectedFlow | null>(null);

  const clean = flows.filter((f) => f.value > 0 && f.from !== f.to);
  const targets = new Set(clean.map((f) => f.to));
  const sources = new Set(clean.map((f) => f.from));
  // Stage order: pure sources (origins) → intermediates (modes) → pure sinks (regions).
  const names: string[] = [];
  for (const f of clean) {
    if (!targets.has(f.from) && !names.includes(f.from)) names.push(f.from);
  }
  for (const f of clean) {
    if (targets.has(f.from) && !names.includes(f.from)) names.push(f.from);
  }
  for (const f of clean) {
    if (!sources.has(f.to) && !names.includes(f.to)) names.push(f.to);
  }
  const index = new Map(names.map((n, i) => [n, i]));
  const data = {
    nodes: names.map((name) => ({ name, isSource: !targets.has(name) })),
    links: clean
      .filter((f) => index.has(f.from) && index.has(f.to))
      .map((f) => ({ source: index.get(f.from)!, target: index.get(f.to)!, value: f.value })),
  };

  if (!data.links.length) return null;

  const grandTotal = data.links.reduce((s, l) => s + l.value, 0);

  return (
    <Box sx={{ color: theme.palette.text.primary }}>
      <ResponsiveContainer width="100%" height={height}>
        <Sankey
          data={data}
          nodeWidth={10}
          nodePadding={22}
          margin={{ top: 8, right: 110, bottom: 8, left: 8 }}
          node={NodeShape}
          link={{ stroke: theme.palette.mode === 'dark' ? 'rgba(129,140,248,0.62)' : 'rgba(79,70,229,0.5)' }}
          onClick={(item: unknown) => {
            const p = (item as { payload?: { source?: { name?: string }; target?: { name?: string }; value?: number; name?: string } })?.payload;
            if (!p) return;
            if (p.source?.name && p.target?.name) {
              setSelected({ kind: 'flow', from: p.source.name, to: p.target.name, value: p.value ?? 0 });
            } else if (p.name) {
              const through = clean.filter((f) => f.from === p.name || f.to === p.name).reduce((s, f) => s + f.value, 0) / 2 || p.value || 0;
              setSelected({ kind: 'node', from: p.name, to: '', value: p.value ?? through });
            }
          }}
        >
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as {
                name?: string;
                value?: number;
                source?: { name: string };
                target?: { name: string };
                payload?: { name?: string };
              };
              const label = p.source && p.target ? `${p.source.name} → ${p.target.name}` : p.name ?? p.payload?.name ?? '';
              return (
                <Box sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 1.5, p: 1, boxShadow: 2 }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, display: 'block' }}>{label}</Typography>
                  <Typography variant="caption" color="text.secondary">{valueFormatter(Number(payload[0].value ?? 0))}</Typography>
                </Box>
              );
            }}
          />
        </Sankey>
      </ResponsiveContainer>

      {/* Click details — which flow, how much, and its share of everything shown */}
      {selected ? (
        <Box sx={{ mt: 1, p: 1.25, borderRadius: 2, border: 1, borderColor: 'primary.main', bgcolor: (t) => alpha(t.palette.primary.main, 0.06) }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {selected.kind === 'flow' ? `${selected.from} → ${selected.to}` : selected.from}
            </Typography>
            <Chip size="small" color="primary" label={valueFormatter(selected.value)} />
            {grandTotal > 0 && (
              <Typography variant="caption" color="text.secondary">
                {((selected.value / grandTotal) * 100).toFixed(1)}% of the CO₂e shown
                {selected.kind === 'flow'
                  ? ` · every tonne on this band travels ${MODES_SET.has(selected.to) ? `by ${selected.to.toLowerCase()}` : `to ${selected.to}`}`
                  : ' · total passing through this point'}
              </Typography>
            )}
            <Chip size="small" variant="outlined" label="clear" onClick={() => setSelected(null)} sx={{ ml: 'auto', cursor: 'pointer' }} />
          </Stack>
        </Box>
      ) : (
        <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.secondary' }}>
          Click any band or bar for its details — origin city → transport mode → destination region.
        </Typography>
      )}
    </Box>
  );
}
