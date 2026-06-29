import { useEffect, useMemo } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { MapContainer, TileLayer, Polyline, CircleMarker, Marker, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { GeoCoord, Lane, ModeLabel } from '@/types';
import { MODE_COLORS } from '@/constants/app';
import { ModeLegend } from '@/components/shared/Chips';
import { formatTonnes } from '@/utils/format';

const MODE_EMOJI: Record<string, string> = { Ocean: '🚢', Air: '✈️', Rail: '🚆', Road: '🚚' };

type Pt = [number, number];
const toPt = (c: GeoCoord): Pt => [c.lat, c.lon];
const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

interface Seg {
  laneId: string;
  mode: ModeLabel;
  from: Pt;
  to: Pt;
  dashed?: boolean;
}

function modeIcon(mode: string, active: boolean) {
  const color = MODE_COLORS[mode] ?? '#666';
  const size = active ? 26 : 21;
  return L.divIcon({
    className: 'tw-mode-icon',
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:#fff;border:1.5px solid ${color};display:flex;align-items:center;justify-content:center;font-size:${active ? 13 : 11}px;box-shadow:0 1px 3px rgba(0,0,0,.25)">${MODE_EMOJI[mode] ?? '•'}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

/** Fit the map to all plotted points whenever the lane set changes. */
function FitBounds({ points }: { points: Pt[] }) {
  const map = useMap();
  const key = points.map((p) => p.join(',')).join('|');
  useEffect(() => {
    if (!points.length) return;
    const bounds = L.latLngBounds(points.map((p) => L.latLng(p[0], p[1])));
    map.fitBounds(bounds, { padding: [28, 28], maxZoom: 6 });
    // re-measure after layout settles (drawer / responsive containers)
    setTimeout(() => map.invalidateSize(), 200);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key]);
  return null;
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
  const maxReduction = Math.max(...lanes.map((l) => l.realizableReductionTonnes), 0.001);

  // Build per-lane leg segments (inland → ocean → delivery, + air exceptions).
  const { segments, oceanIcons, markers, allPoints } = useMemo(() => {
    const segs: Seg[] = [];
    const oIcons: { laneId: string; mode: ModeLabel; at: Pt }[] = [];
    const mk = new Map<string, { pt: Pt; kind: 'origin' | 'port' | 'dest'; label: string }>();
    const pts: Pt[] = [];
    const addMk = (c: GeoCoord, kind: 'origin' | 'port' | 'dest', label: string) => {
      const pt = toPt(c);
      pts.push(pt);
      const k = `${kind}:${pt[0].toFixed(2)},${pt[1].toFixed(2)}`;
      if (!mk.has(k)) mk.set(k, { pt, kind, label });
    };
    for (const l of lanes) {
      const c = l.coords;
      const inland = (l.modePath[0] as ModeLabel) ?? 'Road';
      const delivery = (l.modePath[2] as ModeLabel) ?? 'Road';
      segs.push({ laneId: l.laneId, mode: inland, from: toPt(c.origin), to: toPt(c.originPort) });
      segs.push({ laneId: l.laneId, mode: 'Ocean', from: toPt(c.originPort), to: toPt(c.destPort) });
      segs.push({ laneId: l.laneId, mode: delivery, from: toPt(c.destPort), to: toPt(c.destCity) });
      if (l.hasAirExceptions) segs.push({ laneId: l.laneId, mode: 'Air', from: toPt(c.origin), to: toPt(c.destPort), dashed: true });
      oIcons.push({ laneId: l.laneId, mode: 'Ocean', at: mid(toPt(c.originPort), toPt(c.destPort)) });
      addMk(c.origin, 'origin', l.origin);
      addMk(c.originPort, 'port', l.originPort);
      addMk(c.destPort, 'dest', l.destPort);
      addMk(c.destCity, 'dest', l.destCity);
    }
    return { segments: segs, oceanIcons: oIcons, markers: [...mk.values()], allPoints: pts };
  }, [lanes]);

  const laneById = useMemo(() => new Map(lanes.map((l) => [l.laneId, l])), [lanes]);
  const selected = selectedLaneId ? laneById.get(selectedLaneId) : undefined;

  // Icons along the selected lane's individual legs (truck / train / ship / plane).
  const selectedLegIcons = useMemo(() => {
    if (!selected) return [];
    return segments
      .filter((s) => s.laneId === selected.laneId)
      .map((s, i) => ({ key: i, mode: s.mode, at: mid(s.from, s.to) }));
  }, [segments, selected]);

  const tileUrl = dark
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

  return (
    <Box>
      <Box
        sx={{
          height,
          width: '100%',
          borderRadius: 1.5,
          overflow: 'hidden',
          border: 1,
          borderColor: 'divider',
          '& .leaflet-container': { height: '100%', width: '100%', background: dark ? '#0A1A22' : '#E3EEEC', fontFamily: 'inherit' },
        }}
      >
        <MapContainer center={[25, 60]} zoom={3} scrollWheelZoom worldCopyJump style={{ height: '100%', width: '100%' }}>
          <TileLayer
            url={tileUrl}
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          />
          <FitBounds points={allPoints} />

          {segments.map((s, i) => {
            const isActive = s.laneId === selectedLaneId;
            const dim = Boolean(selectedLaneId) && !isActive;
            const lane = laneById.get(s.laneId);
            const baseW = s.mode === 'Ocean' ? 1 + (lane ? (lane.realizableReductionTonnes / maxReduction) * 3 : 1) : 2;
            return (
              <Polyline
                key={i}
                positions={[s.from, s.to]}
                pathOptions={{
                  color: MODE_COLORS[s.mode],
                  weight: isActive ? baseW + 1.5 : baseW,
                  opacity: dim ? 0.4 : isActive ? 0.95 : 0.72,
                  dashArray: s.dashed ? '6 7' : undefined,
                  lineCap: 'round',
                }}
                eventHandlers={{ click: () => onSelectLane?.(s.laneId) }}
              >
                {lane && (
                  <Tooltip sticky>
                    <strong>{lane.label}</strong>
                    <br />
                    {formatTonnes(lane.totalCo2eTonnes)} CO₂e · {formatTonnes(lane.realizableReductionTonnes)}/yr realizable
                  </Tooltip>
                )}
              </Polyline>
            );
          })}

          {markers.map((m, i) => (
            <CircleMarker
              key={i}
              center={m.pt}
              radius={m.kind === 'origin' ? 4 : 5}
              pathOptions={{
                color: '#fff',
                weight: 1.5,
                fillColor: m.kind === 'origin' ? MODE_COLORS.Road : m.kind === 'port' ? theme.palette.primary.main : theme.palette.secondary.main,
                fillOpacity: 1,
              }}
            >
              <Tooltip direction="top">{m.label}</Tooltip>
            </CircleMarker>
          ))}

          {/* Ship icon on every ocean leg (larger for the selected lane) */}
          {oceanIcons.map((o, i) => (
            <Marker key={`o-${i}`} position={o.at} icon={modeIcon('Ocean', o.laneId === selectedLaneId)} interactive={false} />
          ))}

          {/* Selected lane: icon per leg (train / truck / ship / plane) */}
          {selectedLegIcons.map((s) => (
            <Marker key={`leg-${s.key}`} position={s.at} icon={modeIcon(s.mode, true)} interactive={false} />
          ))}
        </MapContainer>
      </Box>

      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" useFlexGap gap={1} sx={{ mt: 1.5 }}>
        <ModeLegend />
        <Typography variant="caption" color="text.secondary">
          Scroll to zoom · click a lane to inspect its road, rail and ocean legs
        </Typography>
      </Stack>
    </Box>
  );
}
