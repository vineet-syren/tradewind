import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import { useTheme } from '@mui/material/styles';
import type { RouteOption } from '@/types';
import { OPTION_COLORS } from '@/constants/app';
import { formatTonnes } from '@/utils/format';

/**
 * CO₂e side by side across a shipment's route options, "as booked today" first.
 *
 * An air option can be two orders of magnitude above the rest, so the axis is
 * capped at twice the tallest non-outlier bar and any bar beyond it is labelled
 * with its true value and marked off-scale — otherwise every other bar
 * flattens to nothing.
 */
export function OptionCompareChart({
  options,
  height = 240,
  selectedOptionId,
  onSelectOption,
}: {
  options: RouteOption[];
  height?: number;
  selectedOptionId?: string;
  onSelectOption?: (id: string) => void;
}) {
  const theme = useTheme();
  if (!options.length) return null;

  const sorted = [...options].sort((a, b) => (a.isCurrent ? -1 : b.isCurrent ? 1 : a.co2eTonnes - b.co2eTonnes));
  const inScale = sorted.filter((o) => !o.modePath.includes('Air')).map((o) => o.co2eTonnes);
  const cap = inScale.length ? Math.max(...inScale) * 2 : Math.max(...sorted.map((o) => o.co2eTonnes));

  const rows = sorted.map((o) => ({
    id: o.id,
    label: o.label,
    kind: o.kind,
    value: o.co2eTonnes,
    display: Math.min(o.co2eTonnes, cap),
    capped: o.co2eTonnes > cap,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} margin={{ top: 24, right: 16, bottom: 4, left: -4 }}>
        <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke={theme.palette.text.secondary} interval={0} />
        <YAxis
          tick={{ fontSize: 11 }}
          stroke={theme.palette.text.secondary}
          width={58}
          domain={[0, cap]}
          tickFormatter={(v: number) => formatTonnes(v)}
        />
        <Tooltip
          formatter={(_v: number, _n, item) => {
            const row = item?.payload as (typeof rows)[number] | undefined;
            return [formatTonnes(row?.value ?? 0), 'CO₂e'];
          }}
          contentStyle={{ borderRadius: 10, fontSize: 12 }}
        />
        <Bar
          dataKey="display"
          radius={[5, 5, 0, 0]}
          barSize={54}
          isAnimationActive={false}
          cursor={onSelectOption ? 'pointer' : undefined}
          onClick={onSelectOption ? (e: { payload?: (typeof rows)[number] }) => e?.payload && onSelectOption(e.payload.id) : undefined}
        >
          {rows.map((r) => (
            <Cell
              key={r.id}
              fill={OPTION_COLORS[r.kind] ?? theme.palette.text.secondary}
              opacity={selectedOptionId && r.id !== selectedOptionId ? 0.45 : 1}
            />
          ))}
          <LabelList
            dataKey="display"
            position="top"
            style={{ fontSize: 11, fontWeight: 700, fill: theme.palette.text.primary }}
            formatter={(_: number, _i?: number) => ''}
          />
          <LabelList
            position="top"
            content={(props: { x?: number | string; y?: number | string; width?: number | string; index?: number }) => {
              const row = rows[props.index ?? 0];
              if (!row) return null;
              const x = Number(props.x ?? 0) + Number(props.width ?? 0) / 2;
              const y = Number(props.y ?? 0) - 7;
              return (
                <text x={x} y={y} textAnchor="middle" style={{ fontSize: 11, fontWeight: 700, fill: theme.palette.text.primary }}>
                  {formatTonnes(row.value)}
                  {row.capped ? ' ↑' : ''}
                </text>
              );
            }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
