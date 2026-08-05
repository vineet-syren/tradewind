import { Bar, CartesianGrid, Cell, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTheme } from '@mui/material/styles';
import { Box, Stack, Typography } from '@mui/material';
import type { ReportingYearPoint } from '@/types';
import { ORIGIN_COLOR } from '@/constants/app';
import { formatTonnes, formatIntensity } from '@/utils/format';

/**
 * CO₂e per reporting year (bars) with transport intensity (line) — the view that
 * separates volume growth from routing inefficiency: the total can rise with
 * tonnage while intensity falls.
 *
 * Years are the workbook's own Jul→Jun windows, so the axis is a label
 * ("FY23-24"), not a calendar number. Synthetic years are drawn in a different
 * colour and a year still being planned is hatched, so no bar is read as a
 * closed, recorded figure when it is not.
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
  const barFill = theme.palette.secondary.main;
  const anySynthetic = data.some((y) => y.dataOrigin === 'synthetic');
  const anyPartial = data.some((y) => y.plannedShipments > 0 || y.isPartial);
  const isPartial = (y: ReportingYearPoint) => y.plannedShipments > 0 || y.isPartial;

  const fillFor = (y: ReportingYearPoint) => (y.dataOrigin === 'synthetic' ? ORIGIN_COLOR.synthetic : barFill);

  return (
    <Box>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 12, right: 12, bottom: 0, left: -4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} vertical={false} />
          <XAxis dataKey="reportingYear" tick={{ fontSize: 12 }} stroke={theme.palette.text.secondary} />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 12 }}
            stroke={theme.palette.text.secondary}
            width={56}
            tickFormatter={(v: number) => formatTonnes(v)}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 12 }}
            stroke={theme.palette.primary.main}
            width={54}
            // The right axis is an intensity, not a bare number — label it as one
            // or the two axes read as the same unit at different scales.
            tickFormatter={(v: number) => `${Math.round(v)}`}
          />
          <Tooltip
            contentStyle={{ borderRadius: 10, fontSize: 12.5 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const y = payload[0].payload as ReportingYearPoint;
              return (
                <Box sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 1.5, p: 1.25, boxShadow: 2 }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, display: 'block' }}>
                    {y.reportingYear}
                    {y.dataOrigin === 'synthetic' ? ' · synthetic' : ''}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    CO₂e: {formatTonnes(y.co2eTonnes)} across {y.shipments} movements
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    Intensity: {formatIntensity(y.intensity)}
                  </Typography>
                  {isPartial(y) && (
                    <Typography variant="caption" color="warning.main" sx={{ display: 'block' }}>
                      Part year — {y.plannedShipments > 0
                        ? `${y.plannedShipments} shipment${y.plannedShipments === 1 ? '' : 's'} still to be planned`
                        : 'this reporting year has not reached its June year-end'}. Not comparable with a closed year.
                    </Typography>
                  )}
                  {onYearClick && (
                    <Typography variant="caption" color="primary.main" sx={{ display: 'block', mt: 0.5 }}>
                      Click the bar for month by month
                    </Typography>
                  )}
                </Box>
              );
            }}
          />
          <Bar
            yAxisId="left"
            dataKey="co2eTonnes"
            radius={[5, 5, 0, 0]}
            barSize={44}
            isAnimationActive={false}
            cursor={onYearClick ? 'pointer' : undefined}
            onClick={
              onYearClick
                ? (entry: { payload?: ReportingYearPoint }) => entry?.payload && onYearClick(entry.payload.reportingYear)
                : undefined
            }
          >
            {data.map((y) => (
              <Cell
                key={y.reportingYear}
                fill={fillFor(y)}
                fillOpacity={isPartial(y) ? 0.28 : y.dataOrigin === 'synthetic' ? 0.7 : 1}
                stroke={isPartial(y) ? fillFor(y) : undefined}
                strokeDasharray={isPartial(y) ? '4 3' : undefined}
                strokeWidth={isPartial(y) ? 1.5 : 0}
              />
            ))}
          </Bar>
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

      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
        <Legend swatch={barFill} label="CO₂e recorded in the workbook" />
        {anySynthetic && <Legend swatch={ORIGIN_COLOR.synthetic} label="CO₂e on synthetic years" />}
        {anyPartial && <Legend swatch={theme.palette.text.disabled} label="Dashed = part year, not comparable with a closed one" />}
        <Legend swatch={theme.palette.primary.main} label="Intensity, g CO₂e per tonne-km (right axis)" />
      </Stack>
    </Box>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <Stack direction="row" spacing={0.6} alignItems="center">
      <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: swatch }} />
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Stack>
  );
}
