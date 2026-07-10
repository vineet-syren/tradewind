import { useEffect, useMemo, useState } from 'react';
import { Box, Button, IconButton, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import LayersClearRoundedIcon from '@mui/icons-material/LayersClearRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import RouteRoundedIcon from '@mui/icons-material/RouteRounded';
import { MapContainer, TileLayer, Polyline, CircleMarker, Marker, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Lane, Leg } from '@/types';
import { MODE_COLORS, APPROACH_COLORS } from '@/constants/app';
import { ModeLegend } from '@/components/shared/Chips';
import { useDataSource } from '@/hooks/useDataSource';
import { useAsync } from '@/hooks/useAsync';
import { formatDistance, formatLitres, formatTonnes } from '@/utils/format';
import { landCurve, midOf, oceanRoute, type LatLng } from './maritimeRoutes';

const MODE_EMOJI: Record<string, string> = { Ocean: '🚢', Air: '✈️', Rail: '🚆', Road: '🚚' };
const VEH_LABEL: Record<string, string> = { Ocean: 'vessels', Air: 'flights', Rail: 'wagons', Road: 'trucks' };
const WORLD_BOUNDS: [[number, number], [number, number]] = [[-74, -179], [83, 179]];
const NO_LEGS: Leg[] = [];

/** Large mode glyph (no circle) with a vehicle-count badge when more than one. */
function badgeIcon(mode: string, big = false, count = 1) {
  const color = MODE_COLORS[mode] ?? '#666';
  const glyph = big ? 30 : 22;
  const box = glyph + 14;
  const countChip =
    count > 1
      ? `<span style="position:absolute;top:0;right:-2px;min-width:18px;height:18px;padding:0 3px;border-radius:9px;background:${color};color:#fff;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.45)">${count}</span>`
      : '';
  return L.divIcon({
    className: '',
    html: `<div style="position:relative;width:${box}px;height:${box}px;display:flex;align-items:center;justify-content:center;font-size:${glyph}px;line-height:1;filter:drop-shadow(0 2px 3px rgba(11,31,42,.55))">${MODE_EMOJI[mode] ?? '•'}${countChip}</div>`,
    iconSize: [box, box],
    iconAnchor: [box / 2, box / 2],
  });
}

function pinIcon(kind: 'origin' | 'port' | 'dest') {
  const color = kind === 'origin' ? '#10b981' : kind === 'dest' ? '#ef4444' : '#10b981';
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

type ScenarioKindKey = 'current' | 'best' | 'balanced' | 'optimal';
const ALL_KINDS: ScenarioKindKey[] = ['current', 'best', 'balanced', 'optimal'];

export function WorldMap({
  lanes,
  selectedLaneId,
  onSelectLane,
  onClear,
  height = 460,
  scenarioKind = 'current',
  showAllRoutes = false,
  onSelectKind,
}: {
  lanes: Lane[];
  selectedLaneId?: string | null;
  onSelectLane?: (id: string) => void;
  onClear?: () => void;
  height?: number;
  /** Which route option to trace for the isolated lane (drives live redraw). */
  scenarioKind?: ScenarioKindKey;
  /** Draw all four route options at once (to-be-planned shipments) so they can be compared on the map. */
  showAllRoutes?: boolean;
  /** Clicking a route (or a compare row) highlights that option. */
  onSelectKind?: (k: ScenarioKindKey) => void;
}) {
  const theme = useTheme();
  const dark = theme.palette.mode === 'dark';
  const ds = useDataSource();
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(true);
  const { data: detail } = useAsync(
    () => (selectedLaneId ? ds.getLane(selectedLaneId) : Promise.resolve(null)),
    [selectedLaneId],
  );
  const isolated = Boolean(selectedLaneId && detail && detail.laneId === selectedLaneId);
  const legs = isolated ? detail!.scenarios[scenarioKind].legs : NO_LEGS;

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
        // Road/rail run straight between land points (bow 0) so they never bow
        // out over water; air keeps a curved arc.
        path: leg.mode === 'ocean' ? oceanRoute(leg.to, leg.fromCoord, leg.toCoord) : landCurve(leg.fromCoord, leg.toCoord, leg.mode === 'air' ? 0.28 : 0),
      })),
    [legs],
  );

  // Compare view: every route option traced at once, colored by approach.
  const allRoutes = useMemo(() => {
    if (!isolated || !showAllRoutes || !detail) return [];
    return ALL_KINDS.map((kind) => {
      const sc = detail.scenarios[kind];
      const paths = sc.legs.map((leg) =>
        leg.mode === 'ocean' ? oceanRoute(leg.to, leg.fromCoord, leg.toCoord) : landCurve(leg.fromCoord, leg.toCoord, leg.mode === 'air' ? 0.28 : 0.06),
      );
      return {
        kind,
        scenario: sc,
        paths,
        distanceKm: sc.legs.reduce((s, l) => s + l.distanceKm, 0),
        fuelLitres: sc.legs.reduce((s, l) => s + l.fuelLitres, 0),
      };
    });
  }, [isolated, showAllRoutes, detail]);
  const waypoints = useMemo(() => {
    if (!legs.length) return [] as { name: string; pt: LatLng; kind: 'origin' | 'port' | 'dest' }[];
    const wp: { name: string; pt: LatLng; kind: 'origin' | 'port' | 'dest' }[] = [
      { name: legs[0].from, pt: [legs[0].fromCoord.lat, legs[0].fromCoord.lon], kind: 'origin' },
    ];
    legs.forEach((l, i) => wp.push({ name: l.to, pt: [l.toCoord.lat, l.toCoord.lon], kind: i === legs.length - 1 ? 'dest' : 'port' }));
    return wp;
  }, [legs]);

  // Plain-language description of how an option's route differs from current:
  // a different origin port and/or a different mode chain.
  const routeChange = (r: { kind: ScenarioKindKey; scenario: { legs: Leg[]; modePath: string[] } }): string | null => {
    if (!detail || r.kind === 'current') return null;
    const cur = detail.scenarios.current;
    const parts: string[] = [];
    const curPort = cur.legs[0]?.to;
    const newPort = r.scenario.legs[0]?.to;
    if (curPort && newPort && curPort !== newPort) parts.push(`via ${newPort} instead of ${curPort}`);
    if (r.scenario.modePath.join('|') !== cur.modePath.join('|')) parts.push(r.scenario.modePath.join(' → '));
    return parts.length ? `Route change: ${parts.join(' · ')}` : null;
  };

  const fitPoints = isolated
    ? showAllRoutes && allRoutes.length
      ? allRoutes.flatMap((r) => r.paths.flat())
      : isoLegs.flatMap((l) => l.path)
    : group.points;
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

          {/* ── COMPARE VIEW — all four route options traced at once ───── */}
          {isolated &&
            showAllRoutes &&
            allRoutes.map((r) =>
              r.paths.map((path, i) => {
                const active = r.kind === scenarioKind;
                return (
                  <Polyline
                    key={`cmp-${r.kind}-${i}`}
                    positions={path}
                    className={active ? 'tw-route-glow' : undefined}
                    pathOptions={{
                      color: APPROACH_COLORS[r.scenario.kind] ?? '#666',
                      weight: active ? 5.5 : 3,
                      opacity: active ? 0.95 : 0.55,
                      lineCap: 'round',
                      dashArray: r.scenario.modePath.includes('Air') ? '2 8' : undefined,
                    }}
                    eventHandlers={onSelectKind ? { click: () => onSelectKind(r.kind) } : undefined}
                  >
                    <Tooltip sticky className="tw-chip">
                      <strong>{r.scenario.label}</strong> · {r.scenario.modePath.join(' → ')}
                      <br />
                      {formatTonnes(r.scenario.co2eTonnes)} CO₂e · {formatDistance(r.distanceKm)} · {formatLitres(r.fuelLitres)}
                      <br />
                      ~{Math.round(r.scenario.transitDays)} days · click to highlight this option
                    </Tooltip>
                  </Polyline>
                );
              }),
            )}

          {/* ── ISOLATED VIEW — one shipment, end to end ───────────────── */}
          {isolated && !showAllRoutes && isoLegs.map(({ i, path }) => <Polyline key={`sh-${i}`} positions={path} pathOptions={{ color: '#0B1F2A', weight: 8, opacity: 0.16, lineCap: 'round' }} />)}
          {isolated &&
            !showAllRoutes &&
            isoLegs.map(({ leg, i, path }) => (
              <Polyline key={`mn-${i}`} positions={path} className="tw-route-glow" pathOptions={{ color: MODE_COLORS[leg.modeLabel] ?? '#666', weight: 5, opacity: 0.95, lineCap: 'round', dashArray: leg.mode === 'air' ? '2 8' : undefined }} />
            ))}
          {isolated && !showAllRoutes && isoLegs.map(({ i, path }) => <Polyline key={`fl-${i}`} positions={path} className="tw-route-animated" pathOptions={{ color: '#fff', weight: 2, opacity: 0.85 }} />)}
          {/* Mode badges with ×N vehicle count; leg metrics on hover. In compare
              mode they follow the HIGHLIGHTED option so vehicles stay visible. */}
          {isolated &&
            isoLegs.map(({ leg, i, path }) => (
              <Marker key={`bd-${i}`} position={midOf(path)} icon={badgeIcon(leg.modeLabel, true, leg.vehicleCount)}>
                <Tooltip direction="top" offset={[0, -10]} className="tw-chip">
                  <div style={{ fontWeight: 700, fontSize: 12 }}>{legStatus(leg, i, legs.length)}</div>
                  <div style={{ fontWeight: 800, fontSize: 17, lineHeight: 1.15, color: MODE_COLORS[leg.modeLabel] ?? '#0B1F2A' }}>
                    {formatTonnes(leg.co2eTonnes)} CO₂e
                  </div>
                  <div style={{ fontSize: 11.5, color: '#5C6B72', marginTop: 2 }}>
                    {formatDistance(leg.distanceKm)} · {formatLitres(leg.fuelLitres)} {leg.fuelType}
                  </div>
                  <div style={{ fontSize: 11.5, color: '#5C6B72' }}>
                    {leg.vehicleCount > 1 ? `${leg.vehicleCount} ${VEH_LABEL[leg.modeLabel]} · ` : ''}
                    {leg.transitDaysActual}d taken · {leg.transitDaysExpected}d planned
                  </div>
                </Tooltip>
              </Marker>
            ))}
          {/* Origin & destination names stay pinned; intermediate ports show on hover.
              In compare mode only the endpoints render — ports differ per option. */}
          {isolated &&
            waypoints
              .filter((w) => !showAllRoutes || w.kind !== 'port')
              .map((w, i) => (
                <Marker key={`wp-${i}`} position={w.pt} icon={pinIcon(w.kind)} interactive={w.kind === 'port'}>
                  <Tooltip permanent={w.kind !== 'port'} direction="top" offset={[0, -31]} className="tw-place">
                    {w.name}
                    {w.kind === 'origin' ? ' · Origin' : w.kind === 'dest' ? ' · Destination' : ' · Port'}
                  </Tooltip>
                </Marker>
              ))}
        </MapContainer>

        {/* Collapsible end-to-end summary (so it never blocks the route) */}
        {isolated && detail && totals && !summaryOpen && (
          <Button
            size="small"
            variant="contained"
            startIcon={<RouteRoundedIcon />}
            onClick={() => setSummaryOpen(true)}
            sx={{ position: 'absolute', top: 12, right: 12, zIndex: 1000, boxShadow: 3 }}
          >
            Route summary
          </Button>
        )}
        {/* Compare panel — the four options side by side; click a row to highlight its trace */}
        {isolated && detail && showAllRoutes && summaryOpen && (
          <Box sx={{ position: 'absolute', top: 12, right: 12, zIndex: 1000, p: 1.5, width: 296, maxWidth: '86%', borderRadius: 1.5, bgcolor: alpha(theme.palette.background.paper, 0.97), border: 1, borderColor: 'divider', boxShadow: 3 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
              <Typography variant="caption" color="primary.main" sx={{ fontWeight: 700, letterSpacing: '0.04em' }}>
                ROUTE OPTIONS · THIS SHIPMENT
              </Typography>
              <IconButton size="small" onClick={() => setSummaryOpen(false)} sx={{ mt: -0.5, mr: -0.5 }} aria-label="Collapse summary">
                <CloseRoundedIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Stack>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.25, mb: 0.75 }}>
              {detail.origin} → {detail.destCity}
            </Typography>
            <Stack spacing={0.5}>
              {allRoutes.map((r) => {
                const active = r.kind === scenarioKind;
                return (
                  <Box
                    key={r.kind}
                    onClick={() => onSelectKind?.(r.kind)}
                    sx={{
                      p: 0.75,
                      borderRadius: 1.5,
                      border: 1,
                      borderColor: active ? APPROACH_COLORS[r.scenario.kind] : 'divider',
                      bgcolor: active ? alpha(APPROACH_COLORS[r.scenario.kind] ?? '#666', 0.07) : 'transparent',
                      cursor: onSelectKind ? 'pointer' : 'default',
                    }}
                  >
                    <Stack direction="row" spacing={0.75} alignItems="center">
                      <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: APPROACH_COLORS[r.scenario.kind], flexShrink: 0 }} />
                      <Typography variant="caption" sx={{ fontWeight: 700 }}>{r.scenario.label}</Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary', ml: 'auto', fontVariantNumeric: 'tabular-nums' }}>
                        {formatTonnes(r.scenario.co2eTonnes)}
                      </Typography>
                    </Stack>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', pl: 2.1, fontSize: 11.5 }}>
                      ${Math.round(r.scenario.freightUsd / 100) / 10}K · ~{Math.round(r.scenario.transitDays)}d · {formatDistance(r.distanceKm)} · {formatLitres(r.fuelLitres)}
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', pl: 2.1, fontSize: 11, color: routeChange(r) ? 'primary.main' : 'text.disabled', fontWeight: routeChange(r) ? 600 : 400 }}>
                      {routeChange(r) ?? 'same path as booked'}
                    </Typography>
                  </Box>
                );
              })}
            </Stack>
            {onClear && (
              <Button size="small" fullWidth variant="outlined" startIcon={<LayersClearRoundedIcon />} onClick={onClear} sx={{ mt: 1 }}>
                Show all routes
              </Button>
            )}
          </Box>
        )}

        {isolated && detail && totals && !showAllRoutes && summaryOpen && (
          <Box sx={{ position: 'absolute', top: 12, right: 12, zIndex: 1000, p: 1.5, maxWidth: 264, borderRadius: 1.5, bgcolor: alpha(theme.palette.background.paper, 0.96), border: 1, borderColor: 'divider', boxShadow: 3 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
              <Typography variant="caption" color="primary.main" sx={{ fontWeight: 700, letterSpacing: '0.04em' }}>
                END-TO-END ROUTE
              </Typography>
              <IconButton size="small" onClick={() => setSummaryOpen(false)} sx={{ mt: -0.5, mr: -0.5 }} aria-label="Collapse summary">
                <CloseRoundedIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Stack>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.25 }}>
              {detail.origin} → {detail.destCity}
            </Typography>
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.25, mb: 1 }} flexWrap="wrap" useFlexGap>
              <Box component="span" sx={{ px: 0.75, py: 0.1, borderRadius: 1, fontSize: 11, fontWeight: 700, color: '#fff', bgcolor: APPROACH_COLORS[detail.scenarios[scenarioKind].kind] ?? '#5C6B72' }}>
                {detail.scenarios[scenarioKind].label}
              </Box>
              <Typography variant="caption" color="text.secondary">
                {detail.scenarios[scenarioKind].modePath.join(' → ')} · cargo {formatTonnes(totals.cargo)}
              </Typography>
            </Stack>
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
          {isolated
            ? showAllRoutes
              ? 'All four route options traced · hover a line for its CO₂e, cost, distance and days · click to highlight'
              : 'Actual routed legs · CO₂e, distance, fuel, days & vehicles per leg'
            : 'Scroll to zoom · click a shipment lane to trace its full route'}
        </Typography>
      </Stack>
    </Box>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
        {value}
      </Typography>
    </Box>
  );
}
