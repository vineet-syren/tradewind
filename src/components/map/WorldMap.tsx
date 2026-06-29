import { useEffect, useMemo, useState } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import LayersClearRoundedIcon from '@mui/icons-material/LayersClearRounded';
import { MapContainer, TileLayer, Polyline, CircleMarker, Marker, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Lane, Leg } from '@/types';
import { MODE_COLORS } from '@/constants/app';
import { ModeLegend } from '@/components/shared/Chips';
import { useDataSource } from '@/hooks/useDataSource';
import { useAsync } from '@/hooks/useAsync';
import { formatDistance, formatLitres, formatTonnes } from '@/utils/format';
import { landCurve, midOf, oceanRoute, type LatLng } from './maritimeRoutes';

const MODE_EMOJI: Record<string, string> = { Ocean: '🚢', Air: '✈️', Rail: '🚆', Road: '🚚' };
const VEH_LABEL: Record<string, string> = { Ocean: 'vessels', Air: 'flights', Rail: 'wagons', Road: 'trucks' };
const WORLD_BOUNDS: [[number, number], [number, number]] = [[-74, -179], [83, 179]];
const NO_LEGS: Leg[] = [];

/** Elevated mode badge with an optional ×N vehicle-count chip (pseudo-3D). */
function badgeIcon(mode: string, big = false, count = 1) {
  const color = MODE_COLORS[mode] ?? '#666';
  const size = big ? 30 : 20;
  const countChip =
    count > 1
      ? `<span style="position:absolute;top:-7px;right:-9px;min-width:16px;height:16px;padding:0 3px;border-radius:8px;background:#0B1F2A;color:#fff;font-size:9.5px;font-weight:700;display:flex;align-items:center;justify-content:center;border:1.5px solid #fff;box-shadow:0 1px 2px rgba(0,0,0,.3)">×${count}</span>`
      : '';
  return L.divIcon({
    className: '',
    html: `<div class="tw-badge" style="position:relative;width:${size}px;height:${size}px;border-radius:50%;background:#fff;border:2px solid ${color};display:flex;align-items:center;justify-content:center;font-size:${big ? 15 : 11}px">${MODE_EMOJI[mode] ?? '•'}${countChip}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function pinIcon(kind: 'origin' | 'port' | 'dest') {
  const color = kind === 'origin' ? '#2E8B6F' : kind === 'dest' ? '#C0392B' : '#0C8B7B';
  return L.divIcon({
    className: 'tw-pin',
    html: `<svg width="26" height="35" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg">
      <path d="M15 0C6.7 0 0 6.7 0 15c0 10.5 15 25 15 25s15-14.5 15-25C30 6.7 23.3 0 15 0z" fill="${color}" stroke="#fff" stroke-width="2"/>
      <circle cx="15" cy="14.5" r="5.5" fill="#fff"/>
    </svg>`,
    iconSize: [26, 35],
    iconAnchor: [13, 35],
  });
}

function legStatus(leg: Leg, i: number, n: number): string {
  if (leg.mode === 'ocean') return 'In transit · sea';
  if (leg.mode === 'air') return 'In transit · air';
  if (i === n - 1) return 'Out for delivery';
  return `Inland haul · ${leg.modeLabel.toLowerCase()}`;
}

function FitBounds({ points }: { points: LatLng[] }) {
  const map = useMap();
  const key = points.map((p) => p.join(',')).join('|');
  useEffect(() => {
    if (!points.length) return;
    map.fitBounds(L.latLngBounds(points.map((p) => L.latLng(p[0], p[1]))), { padding: [42, 42], maxZoom: 6, animate: true });
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
  const [hoverId, setHoverId] = useState<string | null>(null);
  const { data: detail } = useAsync(
    () => (selectedLaneId ? ds.getLane(selectedLaneId) : Promise.resolve(null)),
    [selectedLaneId],
  );
  const isolated = Boolean(selectedLaneId && detail && detail.laneId === selectedLaneId);
  const legs = isolated ? detail!.scenarios.current.legs : NO_LEGS;

  // Group view: routed (curved) ocean paths + deduped endpoint markers.
  const group = useMemo(() => {
    const routes = lanes.map((l) => ({ lane: l, path: oceanRoute(l.destPort, l.coords.originPort, l.coords.destPort) }));
    const mk = new Map<string, { pt: LatLng; kind: 'origin' | 'dest'; label: string }>();
    const add = (lat: number, lon: number, kind: 'origin' | 'dest', label: string) => {
      const k = `${kind}:${lat.toFixed(2)},${lon.toFixed(2)}`;
      if (!mk.has(k)) mk.set(k, { pt: [lat, lon], kind, label });
    };
    for (const l of lanes) {
      add(l.coords.originPort.lat, l.coords.originPort.lon, 'origin', l.originPort);
      add(l.coords.destPort.lat, l.coords.destPort.lon, 'dest', l.destPort);
    }
    return { routes, markers: [...mk.values()], points: [...mk.values()].map((m) => m.pt) };
  }, [lanes]);

  // Isolated view: routed legs + waypoints from the route legs.
  const isoLegs = useMemo(
    () =>
      legs.map((leg, i) => ({
        leg,
        i,
        path: leg.mode === 'ocean' ? oceanRoute(leg.to, leg.fromCoord, leg.toCoord) : landCurve(leg.fromCoord, leg.toCoord, leg.mode === 'air' ? 0.28 : 0.14),
      })),
    [legs],
  );
  const waypoints = useMemo(() => {
    if (!legs.length) return [] as { name: string; pt: LatLng; kind: 'origin' | 'port' | 'dest' }[];
    const wp: { name: string; pt: LatLng; kind: 'origin' | 'port' | 'dest' }[] = [
      { name: legs[0].from, pt: [legs[0].fromCoord.lat, legs[0].fromCoord.lon], kind: 'origin' },
    ];
    legs.forEach((l, i) => wp.push({ name: l.to, pt: [l.toCoord.lat, l.toCoord.lon], kind: i === legs.length - 1 ? 'dest' : 'port' }));
    return wp;
  }, [legs]);

  const fitPoints = isolated ? isoLegs.flatMap((l) => l.path) : group.points;
  const totals = isolated
    ? {
        co2e: legs.reduce((s, l) => s + l.co2eTonnes, 0),
        km: legs.reduce((s, l) => s + l.distanceKm, 0),
        fuel: legs.reduce((s, l) => s + l.fuelLitres, 0),
        taken: legs.reduce((s, l) => s + l.transitDaysActual, 0),
        expected: legs.reduce((s, l) => s + l.transitDaysExpected, 0),
        cargo: legs[0]?.weightTonnes ?? 0,
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

          {/* ── GROUP VIEW — clean: thin routed lines + endpoint pins ──── */}
          {!isolated &&
            group.routes.map(({ lane, path }) => {
              const hot = hoverId === lane.laneId;
              return (
                <Polyline
                  key={lane.laneId}
                  positions={path}
                  className={hot ? 'tw-route-glow' : undefined}
                  pathOptions={{ color: MODE_COLORS.Ocean, weight: hot ? 3.5 : 1.4, opacity: hot ? 0.95 : 0.45, lineCap: 'round' }}
                  eventHandlers={{ click: () => onSelectLane?.(lane.laneId), mouseover: () => setHoverId(lane.laneId), mouseout: () => setHoverId(null) }}
                >
                  <Tooltip sticky className="tw-chip">
                    <strong>{lane.label}</strong>
                    <br />
                    {lane.shipmentCount} shipments · {formatTonnes(lane.totalCo2eTonnes)} CO₂e
                    <br />
                    Click to trace the end-to-end route
                  </Tooltip>
                </Polyline>
              );
            })}
          {!isolated &&
            group.markers.map((m, i) =>
              m.kind === 'dest' ? (
                <Marker key={`d-${i}`} position={m.pt} icon={pinIcon('dest')} interactive={false}>
                  <Tooltip direction="top" offset={[0, -32]}>{m.label}</Tooltip>
                </Marker>
              ) : (
                <CircleMarker key={`o-${i}`} center={m.pt} radius={4} pathOptions={{ color: '#fff', weight: 1.5, fillColor: theme.palette.primary.main, fillOpacity: 1 }}>
                  <Tooltip direction="top">{m.label} · origin port</Tooltip>
                </CircleMarker>
              ),
            )}

          {/* ── ISOLATED VIEW — one shipment, end to end ───────────────── */}
          {isolated && isoLegs.map(({ i, path }) => <Polyline key={`sh-${i}`} positions={path} pathOptions={{ color: '#0B1F2A', weight: 8, opacity: 0.16, lineCap: 'round' }} />)}
          {isolated &&
            isoLegs.map(({ leg, i, path }) => (
              <Polyline key={`mn-${i}`} positions={path} className="tw-route-glow" pathOptions={{ color: MODE_COLORS[leg.modeLabel] ?? '#666', weight: 5, opacity: 0.95, lineCap: 'round', dashArray: leg.mode === 'air' ? '2 8' : undefined }} />
            ))}
          {isolated && isoLegs.map(({ i, path }) => <Polyline key={`fl-${i}`} positions={path} className="tw-route-animated" pathOptions={{ color: '#fff', weight: 2, opacity: 0.85 }} />)}
          {isolated &&
            isoLegs.map(({ leg, i, path }) => (
              <Marker key={`bd-${i}`} position={midOf(path)} icon={badgeIcon(leg.modeLabel, true, leg.vehicleCount)} interactive={false}>
                <Tooltip permanent direction="top" offset={[0, -6]} className="tw-chip">
                  <strong>{legStatus(leg, i, legs.length)}</strong>
                  <br />
                  <span style={{ fontWeight: 400, color: '#5C6B72' }}>
                    {formatTonnes(leg.co2eTonnes)} · {formatDistance(leg.distanceKm)} · {formatLitres(leg.fuelLitres)} {leg.fuelType}
                  </span>
                  <br />
                  <span style={{ fontWeight: 400, color: '#5C6B72' }}>
                    {leg.vehicleCount > 1 ? `${leg.vehicleCount} ${VEH_LABEL[leg.modeLabel]} · ` : ''}
                    {leg.transitDaysActual}d taken · {leg.transitDaysExpected}d planned
                  </span>
                </Tooltip>
              </Marker>
            ))}
          {isolated &&
            waypoints.map((w, i) => (
              <Marker key={`wp-${i}`} position={w.pt} icon={pinIcon(w.kind)} interactive={false}>
                <Tooltip permanent direction="top" offset={[0, -31]} className="tw-place">
                  {w.name}
                  {w.kind === 'origin' ? ' · Origin' : w.kind === 'dest' ? ' · Destination' : ' · Port'}
                </Tooltip>
              </Marker>
            ))}
        </MapContainer>

        {isolated && detail && totals && (
          <Box sx={{ position: 'absolute', top: 12, right: 12, zIndex: 1000, p: 1.5, maxWidth: 264, borderRadius: 1.5, bgcolor: alpha(theme.palette.background.paper, 0.96), border: 1, borderColor: 'divider', boxShadow: 3 }}>
            <Typography variant="caption" color="primary.main" sx={{ fontWeight: 700, letterSpacing: '0.04em' }}>
              END-TO-END ROUTE
            </Typography>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.25 }}>
              {detail.origin} → {detail.destCity}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              {detail.modePath.join(' → ')} · cargo {formatTonnes(totals.cargo)}
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
              <Metric label="CO₂e" value={formatTonnes(totals.co2e)} />
              <Metric label="Distance" value={formatDistance(totals.km)} />
              <Metric label="Fuel" value={formatLitres(totals.fuel)} />
              <Metric label="Days (taken/plan)" value={`${Math.round(totals.taken)} / ${Math.round(totals.expected)}`} />
            </Box>
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
          {isolated ? 'Actual routed legs · CO₂e, distance, fuel, days & vehicles per leg' : 'Scroll to zoom · click a shipment lane to trace its full route'}
        </Typography>
      </Stack>
    </Box>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
        {value}
      </Typography>
    </Box>
  );
}
