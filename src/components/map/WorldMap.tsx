import { useMemo, useState } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import type { Lane } from '@/types';
import { MODE_COLORS } from '@/constants/app';
import { ModeIcon } from '@/components/layout/iconRegistry';
import { ModeLegend } from '@/components/shared/Chips';
import { formatTonnes } from '@/utils/format';
import {
  CONTINENTS,
  PROJ,
  PROJ_HEIGHT,
  arcMidpoint,
  arcPath,
  polygonToPath,
  project,
} from './worldGeo';

interface MarkerPoint {
  key: string;
  x: number;
  y: number;
  kind: 'origin' | 'port' | 'dest';
  label: string;
}

export function WorldMap({
  lanes,
  selectedLaneId,
  onSelectLane,
  height = 460,
}: {
  lanes: Lane[];
  selectedLaneId?: string | null;
  onSelectLane?: (id: string) => void;
  height?: number;
}) {
  const theme = useTheme();
  const dark = theme.palette.mode === 'dark';
  const [hoverId, setHoverId] = useState<string | null>(null);

  const land = dark ? '#15323F' : '#DCE8E3';
  const landStroke = dark ? 'rgba(255,255,255,0.08)' : '#C6D6D0';
  const grid = dark ? 'rgba(255,255,255,0.05)' : 'rgba(11,31,42,0.05)';

  const continentPaths = useMemo(() => CONTINENTS.map(polygonToPath), []);
  const graticule = useMemo(() => {
    const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
    for (let lon = -150; lon <= 150; lon += 30) {
      const a = project(lon, PROJ.latTop);
      const b = project(lon, PROJ.latBot);
      lines.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
    }
    for (let lat = 60; lat >= -40; lat -= 20) {
      const a = project(-180, lat);
      const b = project(180, lat);
      lines.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
    }
    return lines;
  }, []);

  const maxReduction = Math.max(...lanes.map((l) => l.realizableReductionTonnes), 0.001);

  const arcs = useMemo(
    () =>
      lanes.map((l) => {
        const a = project(l.coords.originPort.lon, l.coords.originPort.lat);
        const b = project(l.coords.destPort.lon, l.coords.destPort.lat);
        const air = l.hasAirExceptions;
        return {
          id: l.laneId,
          d: arcPath(a, b),
          mid: arcMidpoint(a, b),
          mode: air ? 'Air' : 'Ocean',
          width: 1 + (l.realizableReductionTonnes / maxReduction) * 3.2,
          label: l.label,
          co2e: l.totalCo2eTonnes,
          reduction: l.realizableReductionTonnes,
        };
      }),
    [lanes, maxReduction],
  );

  const markers = useMemo(() => {
    const m = new Map<string, MarkerPoint>();
    const add = (lat: number, lon: number, kind: MarkerPoint['kind'], label: string) => {
      const p = project(lon, lat);
      const key = `${kind}:${p.x.toFixed(0)},${p.y.toFixed(0)}`;
      if (!m.has(key)) m.set(key, { key, x: p.x, y: p.y, kind, label });
    };
    for (const l of lanes) {
      add(l.coords.origin.lat, l.coords.origin.lon, 'origin', l.origin);
      add(l.coords.originPort.lat, l.coords.originPort.lon, 'port', l.originPort);
      add(l.coords.destPort.lat, l.coords.destPort.lon, 'dest', l.destPort);
    }
    return [...m.values()];
  }, [lanes]);

  const selected = lanes.find((l) => l.laneId === selectedLaneId);
  const active = hoverId ?? selectedLaneId;
  const activeLane = lanes.find((l) => l.laneId === active);

  // Selected lane full multi-leg path (inland → ocean → delivery) with icons.
  const selectedLegs = useMemo(() => {
    if (!selected) return [];
    const c = selected.coords;
    const path = selected.modePath;
    const legDefs = [
      { from: project(c.origin.lon, c.origin.lat), to: project(c.originPort.lon, c.originPort.lat), mode: path[0] ?? 'Road' },
      { from: project(c.originPort.lon, c.originPort.lat), to: project(c.destPort.lon, c.destPort.lat), mode: path[1] ?? 'Ocean' },
      { from: project(c.destPort.lon, c.destPort.lat), to: project(c.destCity.lon, c.destCity.lat), mode: path[2] ?? 'Road' },
    ];
    return legDefs.map((leg, i) => ({ ...leg, key: i, d: arcPath(leg.from, leg.to, 0.12), mid: arcMidpoint(leg.from, leg.to, 0.12) }));
  }, [selected]);

  const pct = (v: number, total: number) => `${(v / total) * 100}%`;

  return (
    <Box>
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          maxWidth: (PROJ.width / PROJ_HEIGHT) * height,
          mx: 'auto',
          aspectRatio: `${PROJ.width} / ${PROJ_HEIGHT}`,
          borderRadius: 3,
          overflow: 'hidden',
          background: dark
            ? 'radial-gradient(120% 120% at 50% 0%, #0C2230 0%, #081720 100%)'
            : 'radial-gradient(120% 120% at 50% 0%, #EDF5F4 0%, #E3EEEC 100%)',
          border: 1,
          borderColor: 'divider',
        }}
      >
        <svg
          viewBox={`0 0 ${PROJ.width} ${PROJ_HEIGHT}`}
          width="100%"
          height="100%"
          style={{ position: 'absolute', inset: 0 }}
        >
          {graticule.map((g, i) => (
            <line key={i} x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} stroke={grid} strokeWidth={0.6} />
          ))}
          {continentPaths.map((d, i) => (
            <path key={i} d={d} fill={land} stroke={landStroke} strokeWidth={0.6} />
          ))}

          {/* Base ocean arcs for every lane */}
          {arcs.map((arc) => {
            const isActive = arc.id === active;
            const dim = active && !isActive;
            const color = MODE_COLORS[arc.mode];
            return (
              <path
                key={arc.id}
                d={arc.d}
                fill="none"
                stroke={color}
                strokeWidth={isActive ? arc.width + 1.4 : arc.width}
                strokeLinecap="round"
                opacity={dim ? 0.15 : isActive ? 0.95 : 0.55}
                strokeDasharray={arc.mode === 'Air' ? '5 5' : undefined}
                style={{ cursor: onSelectLane ? 'pointer' : 'default', transition: 'opacity .2s' }}
                onMouseEnter={() => setHoverId(arc.id)}
                onMouseLeave={() => setHoverId(null)}
                onClick={() => onSelectLane?.(arc.id)}
              />
            );
          })}

          {/* Selected lane: full multi-leg path */}
          {selectedLegs.map((leg) => (
            <path
              key={leg.key}
              d={leg.d}
              fill="none"
              stroke={MODE_COLORS[leg.mode] ?? '#888'}
              strokeWidth={2.6}
              strokeLinecap="round"
              className={leg.mode === 'Air' ? 'tw-route-animated' : undefined}
              opacity={0.95}
            />
          ))}

          {/* Markers */}
          {markers.map((mk) => {
            const isActiveMarker =
              activeLane &&
              (mk.label === activeLane.origin || mk.label === activeLane.originPort || mk.label === activeLane.destPort);
            const r = mk.kind === 'origin' ? 2.6 : 3.2;
            const fill = mk.kind === 'origin' ? MODE_COLORS.Road : mk.kind === 'port' ? theme.palette.primary.main : theme.palette.secondary.main;
            return (
              <g key={mk.key}>
                <circle
                  cx={mk.x}
                  cy={mk.y}
                  r={isActiveMarker ? r + 1.6 : r}
                  fill={fill}
                  stroke={dark ? '#0B1F2A' : '#fff'}
                  strokeWidth={1}
                  opacity={0.95}
                />
                {isActiveMarker && (
                  <text x={mk.x + 5} y={mk.y - 4} fontSize={9} fontWeight={700} fill={theme.palette.text.primary}>
                    {mk.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* HTML overlay: mode-icon glyphs on each arc midpoint */}
        {arcs.map((arc) => {
          const isActive = arc.id === active;
          if (active && !isActive) return null;
          return (
            <Box
              key={arc.id}
              onMouseEnter={() => setHoverId(arc.id)}
              onMouseLeave={() => setHoverId(null)}
              onClick={() => onSelectLane?.(arc.id)}
              sx={{
                position: 'absolute',
                left: pct(arc.mid.x, PROJ.width),
                top: pct(arc.mid.y, PROJ_HEIGHT),
                transform: 'translate(-50%, -50%)',
                width: isActive ? 26 : 20,
                height: isActive ? 26 : 20,
                borderRadius: '50%',
                bgcolor: 'background.paper',
                border: `1.5px solid ${MODE_COLORS[arc.mode]}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 1,
                cursor: onSelectLane ? 'pointer' : 'default',
                zIndex: isActive ? 3 : 1,
              }}
            >
              <ModeIcon mode={arc.mode} sx={{ fontSize: isActive ? 16 : 12, color: MODE_COLORS[arc.mode] }} />
            </Box>
          );
        })}

        {/* Selected-lane leg icons (truck / train / ship) */}
        {selectedLegs.map((leg) => (
          <Box
            key={`icon-${leg.key}`}
            sx={{
              position: 'absolute',
              left: pct(leg.mid.x, PROJ.width),
              top: pct(leg.mid.y, PROJ_HEIGHT),
              transform: 'translate(-50%, -50%)',
              width: 22,
              height: 22,
              borderRadius: '50%',
              bgcolor: 'background.paper',
              border: `1.5px solid ${MODE_COLORS[leg.mode] ?? '#888'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 1,
              zIndex: 4,
            }}
          >
            <ModeIcon mode={leg.mode} sx={{ fontSize: 13, color: MODE_COLORS[leg.mode] ?? '#888' }} />
          </Box>
        ))}

        {/* Hover/active info badge */}
        {activeLane && (
          <Box
            sx={{
              position: 'absolute',
              left: 12,
              bottom: 12,
              maxWidth: 300,
              p: 1.25,
              borderRadius: 2,
              bgcolor: alpha(theme.palette.background.paper, 0.95),
              border: 1,
              borderColor: 'divider',
              boxShadow: 2,
            }}
          >
            <Typography variant="caption" sx={{ fontWeight: 700, display: 'block' }}>
              {activeLane.label}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatTonnes(activeLane.totalCo2eTonnes)} CO₂e · {formatTonnes(activeLane.realizableReductionTonnes)}/yr realizable · {activeLane.shipmentCount} shipments
            </Typography>
          </Box>
        )}
      </Box>

      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" useFlexGap gap={1} sx={{ mt: 1.5 }}>
        <ModeLegend />
        <Typography variant="caption" color="text.secondary">
          Arc width ∝ realizable reduction · click a lane to inspect its legs
        </Typography>
      </Stack>
    </Box>
  );
}
