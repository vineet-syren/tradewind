import { useEffect, useMemo } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import LayersClearRoundedIcon from '@mui/icons-material/LayersClearRounded';
import { MapContainer, TileLayer, Polyline, CircleMarker, Marker, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { GeoCoord, Lane, Leg } from '@/types';
import { MODE_COLORS } from '@/constants/app';
import { ModeLegend } from '@/components/shared/Chips';
import { useDataSource } from '@/hooks/useDataSource';
import { useAsync } from '@/hooks/useAsync';
import { formatDistance, formatLitres, formatTonnes } from '@/utils/format';

const MODE_EMOJI: Record<string, string> = { Ocean: '🚢', Air: '✈️', Rail: '🚆', Road: '🚚' };
const WORLD_BOUNDS: [[number, number], [number, number]] = [[-74, -179], [83, 179]];
const NO_LEGS: Leg[] = [];

type Pt = [number, number];
const toPt = (c: GeoCoord): Pt => [c.lat, c.lon];
const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

/** Elevated circular mode badge (pseudo-3D). */
function badgeIcon(mode: string, big = false) {
  const color = MODE_COLORS[mode] ?? '#666';
  const size = big ? 30 : 22;
  return L.divIcon({
    className: '',
    html: `<div class="tw-badge" style="width:${size}px;height:${size}px;border-radius:50%;background:#fff;border:2px solid ${color};display:flex;align-items:center;justify-content:center;font-size:${big ? 15 : 12}px">${MODE_EMOJI[mode] ?? '•'}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

/** Google-Maps-style teardrop location pin (pseudo-3D). */
function pinIcon(kind: 'origin' | 'port' | 'dest') {
  const color = kind === 'origin' ? '#2E8B6F' : kind === 'dest' ? '#C0392B' : '#0C8B7B';
  return L.divIcon({
    className: 'tw-pin',
    html: `<svg width="28" height="38" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg">
      <path d="M15 0C6.7 0 0 6.7 0 15c0 10.5 15 25 15 25s15-14.5 15-25C30 6.7 23.3 0 15 0z" fill="${color}" stroke="#fff" stroke-width="2"/>
      <circle cx="15" cy="14.5" r="5.5" fill="#fff"/>
    </svg>`,
    iconSize: [28, 38],
    iconAnchor: [14, 38],
  });
}

function legStatus(leg: Leg, i: number, n: number): string {
  if (leg.mode === 'ocean') return 'In transit · sea';
  if (leg.mode === 'air') return 'In transit · air';
  if (i === n - 1) return 'Out for delivery';
  return `Inland haul · ${leg.modeLabel.toLowerCase()}`;
}

function FitBounds({ points }: { points: Pt[] }) {
  const map = useMap();
  const key = points.map((p) => p.join(',')).join('|');
  useEffect(() => {
    if (!points.length) return;
    map.fitBounds(L.latLngBounds(points.map((p) => L.latLng(p[0], p[1]))), { padding: [40, 40], maxZoom: 6, animate: true });
    setTimeout(() => map.invalidateSize(), 220);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key]);
  return null;
}

export function WorldMap({
  lanes,
  selectedLaneId,
  onSelectLane,
  onClear,
  height = 460,
}: {
  lanes: Lane[];
  selectedLaneId?: string | null;
  onSelectLane?: (id: string) => void;
  onClear?: () => void;
  height?: number;
}) {
  const theme = useTheme();
  const dark = theme.palette.mode === 'dark';
  const ds = useDataSource();
  const { data: detail } = useAsync(
    () => (selectedLaneId ? ds.getLane(selectedLaneId) : Promise.resolve(null)),
    [selectedLaneId],
  );
  const isolated = Boolean(selectedLaneId && detail && detail.laneId === selectedLaneId);
  const legs = isolated ? detail!.scenarios.current.legs : NO_LEGS;

  const maxReduction = Math.max(...lanes.map((l) => l.realizableReductionTonnes), 0.001);

  // Group-view geometry (all lanes) + deduped location markers.
  const group = useMemo(() => {
    const arcs = lanes.map((l) => ({ lane: l, from: toPt(l.coords.originPort), to: toPt(l.coords.destPort) }));
    const mk = new Map<string, { pt: Pt; kind: 'origin' | 'port' | 'dest'; label: string }>();
    const pts: Pt[] = [];
    const add = (c: GeoCoord, kind: 'origin' | 'port' | 'dest', label: string) => {
      const pt = toPt(c);
      pts.push(pt);
      const k = `${kind}:${pt[0].toFixed(2)},${pt[1].toFixed(2)}`;
      if (!mk.has(k)) mk.set(k, { pt, kind, label });
    };
    for (const l of lanes) {
      add(l.coords.originPort, 'origin', l.originPort);
      add(l.coords.destPort, 'dest', l.destPort);
    }
    return { arcs, markers: [...mk.values()], points: pts };
  }, [lanes]);

  // Isolated-view waypoints (origin → ports → destination) from the route legs.
  const waypoints = useMemo(() => {
    if (!legs.length) return [];
    const wp: { name: string; pt: Pt; kind: 'origin' | 'port' | 'dest' }[] = [
      { name: legs[0].from, pt: toPt(legs[0].fromCoord), kind: 'origin' },
    ];
    legs.forEach((l, i) => wp.push({ name: l.to, pt: toPt(l.toCoord), kind: i === legs.length - 1 ? 'dest' : 'port' }));
    return wp;
  }, [legs]);

  const fitPoints = isolated ? waypoints.map((w) => w.pt) : group.points;
  const totals = isolated
    ? {
        co2e: legs.reduce((s, l) => s + l.co2eTonnes, 0),
        km: legs.reduce((s, l) => s + l.distanceKm, 0),
        fuel: legs.reduce((s, l) => s + l.fuelLitres, 0),
      }
    : null;

  const tileUrl = dark
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

  return (
    <Box>
      <Box
        sx={{
          position: 'relative',
          height,
          width: '100%',
          borderRadius: 1.5,
          overflow: 'hidden',
          border: 1,
          borderColor: 'divider',
          '& .leaflet-container': { height: '100%', width: '100%', background: dark ? '#0A1A22' : '#dfeae7', fontFamily: 'inherit' },
        }}
      >
        <MapContainer
          center={[22, 45]}
          zoom={3}
          minZoom={2}
          maxBounds={WORLD_BOUNDS}
          maxBoundsViscosity={1}
          zoomSnap={0.25}
          zoomDelta={0.5}
          wheelPxPerZoomLevel={140}
          worldCopyJump={false}
          scrollWheelZoom
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer url={tileUrl} noWrap attribution='&copy; OpenStreetMap &copy; CARTO' />
          <FitBounds points={fitPoints} />

          {/* ── GROUP VIEW: all shipment lanes ─────────────────────────── */}
          {!isolated &&
            group.arcs.map(({ lane, from, to }, i) => (
              <Polyline
                key={i}
                positions={[from, to]}
                className="tw-route-glow"
                pathOptions={{ color: MODE_COLORS.Ocean, weight: 1.5 + (lane.realizableReductionTonnes / maxReduction) * 3, opacity: 0.7, lineCap: 'round' }}
                eventHandlers={{ click: () => onSelectLane?.(lane.laneId) }}
              >
                <Tooltip sticky className="tw-chip">
                  <strong>{lane.label}</strong>
                  <br />
                  {lane.shipmentCount} shipments · {formatTonnes(lane.totalCo2eTonnes)} CO₂e
                  <br />
                  Click to view end-to-end route
                </Tooltip>
              </Polyline>
            ))}
          {!isolated &&
            group.arcs.map(({ from, to }, i) => (
              <Marker key={`s-${i}`} position={mid(from, to)} icon={badgeIcon('Ocean')} interactive={false} />
            ))}
          {!isolated &&
            group.markers.map((m, i) => (
              <CircleMarker
                key={`m-${i}`}
                center={m.pt}
                radius={4}
                pathOptions={{ color: '#fff', weight: 1.5, fillColor: m.kind === 'dest' ? theme.palette.secondary.main : theme.palette.primary.main, fillOpacity: 1 }}
              >
                <Tooltip direction="top">{m.label}</Tooltip>
              </CircleMarker>
            ))}

          {/* ── ISOLATED VIEW: one shipment's end-to-end route ─────────── */}
          {isolated &&
            legs.map((leg, i) => (
              <Polyline key={`shadow-${i}`} positions={[toPt(leg.fromCoord), toPt(leg.toCoord)]} pathOptions={{ color: '#0B1F2A', weight: 8, opacity: 0.18, lineCap: 'round' }} />
            ))}
          {isolated &&
            legs.map((leg, i) => {
              const from = toPt(leg.fromCoord);
              const to = toPt(leg.toCoord);
              const color = MODE_COLORS[leg.modeLabel] ?? '#666';
              return (
                <Polyline
                  key={`main-${i}`}
                  positions={[from, to]}
                  className="tw-route-glow"
                  pathOptions={{ color, weight: 5, opacity: 0.95, lineCap: 'round', dashArray: leg.mode === 'air' ? '2 8' : undefined }}
                />
              );
            })}
          {isolated &&
            legs.map((leg, i) => (
              <Polyline key={`flow-${i}`} positions={[toPt(leg.fromCoord), toPt(leg.toCoord)]} className="tw-route-animated" pathOptions={{ color: '#fff', weight: 2, opacity: 0.85 }} />
            ))}
          {isolated &&
            legs.map((leg, i) => (
              <Marker key={`badge-${i}`} position={mid(toPt(leg.fromCoord), toPt(leg.toCoord))} icon={badgeIcon(leg.modeLabel, true)} interactive={false}>
                <Tooltip permanent direction="top" offset={[0, -6]} className="tw-chip">
                  <strong>{legStatus(leg, i, legs.length)}</strong>
                  <br />
                  <span style={{ fontWeight: 400, color: '#5C6B72' }}>
                    {formatTonnes(leg.co2eTonnes)} · {formatDistance(leg.distanceKm)} · {formatLitres(leg.fuelLitres)}
                  </span>
                </Tooltip>
              </Marker>
            ))}
          {isolated &&
            waypoints.map((w, i) => (
              <Marker key={`wp-${i}`} position={w.pt} icon={pinIcon(w.kind)} interactive={false}>
                <Tooltip permanent direction="top" offset={[0, -34]} className="tw-place">
                  {w.name}
                  {w.kind === 'origin' ? ' · Origin' : w.kind === 'dest' ? ' · Destination' : ' · Port'}
                </Tooltip>
              </Marker>
            ))}
        </MapContainer>

        {/* Selected-route summary card */}
        {isolated && detail && totals && (
          <Box
            sx={{
              position: 'absolute',
              top: 12,
              right: 12,
              zIndex: 1000,
              p: 1.5,
              maxWidth: 250,
              borderRadius: 1.5,
              bgcolor: alpha(theme.palette.background.paper, 0.96),
              border: 1,
              borderColor: 'divider',
              boxShadow: 3,
            }}
          >
            <Typography variant="caption" color="primary.main" sx={{ fontWeight: 700, letterSpacing: '0.04em' }}>
              END-TO-END ROUTE
            </Typography>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.25 }}>
              {detail.origin} → {detail.destCity}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              {detail.modePath.join(' → ')}
            </Typography>
            <Stack direction="row" spacing={1.5}>
              <Metric label="CO₂e" value={formatTonnes(totals.co2e)} />
              <Metric label="Distance" value={formatDistance(totals.km)} />
              <Metric label="Fuel" value={formatLitres(totals.fuel)} />
            </Stack>
            {onClear && (
              <Button size="small" fullWidth variant="outlined" startIcon={<LayersClearRoundedIcon />} onClick={onClear} sx={{ mt: 1.5 }}>
                Show all routes
              </Button>
            )}
          </Box>
        )}
      </Box>

      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" useFlexGap gap={1} sx={{ mt: 1.5 }}>
        <ModeLegend />
        <Typography variant="caption" color="text.secondary">
          {isolated ? 'End-to-end route · CO₂e, distance & fuel per leg' : 'Scroll to zoom · click a shipment lane to trace its full route'}
        </Typography>
      </Stack>
    </Box>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
        {value}
      </Typography>
    </Box>
  );
}
