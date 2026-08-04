import { useEffect, useMemo, useState } from 'react';
import { Box, IconButton, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { MapContainer, TileLayer, Polyline, CircleMarker, Marker, Tooltip } from 'react-leaflet';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Lane, Leg, RouteOption } from '@/types';
import { MODE_COLORS, OPTION_COLORS } from '@/constants/app';
import { ModeLegend } from '@/components/shared/Chips';
import { formatDistance, formatTonnes } from '@/utils/format';
import { landCurve, midOf, oceanRoute, type LatLng } from './maritimeRoutes';

const MODE_EMOJI: Record<string, string> = { Ocean: '🚢', Air: '✈️', Rail: '🚆', Road: '🚚' };
const WORLD_BOUNDS: [[number, number], [number, number]] = [[-74, -179], [83, 179]];

/** Large mode glyph used to mark the midpoint of each leg. */
function badgeIcon(mode: string) {
  const box = 36;
  return L.divIcon({
    className: '',
    html: `<div style="width:${box}px;height:${box}px;display:flex;align-items:center;justify-content:center;font-size:26px;line-height:1;filter:drop-shadow(0 2px 3px rgba(11,31,42,.55))">${MODE_EMOJI[mode] ?? '•'}</div>`,
    iconSize: [box, box],
    iconAnchor: [box / 2, box / 2],
  });
}

function pinIcon(kind: 'origin' | 'port' | 'dest') {
  const color = kind === 'dest' ? '#ef4444' : '#10b981';
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

function FitBounds({ points }: { points: LatLng[] }) {
  const map = useMap();
  const key = points.map((p) => p.join(',')).join('|');
  useEffect(() => {
    if (!points.length) return;
    const bounds = L.latLngBounds(points.map((p) => L.latLng(p[0], p[1])));
    // Size first, then fit. Fitting against a container that has not been laid
    // out yet computes the zoom for a near-zero viewport, which lands the map
    // deep inside the bounds instead of around them.
    const fit = () => {
      map.invalidateSize();
      map.fitBounds(bounds, { padding: [42, 42], maxZoom: 6, animate: false });
    };
    fit();
    // Re-fit once the pane has settled (fonts, sticky columns, split-pane drag).
    const t = setTimeout(fit, 240);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key]);
  return null;
}

/** Route geometry: sea legs follow a maritime corridor, land legs run straight. */
const pathOf = (leg: Leg): LatLng[] =>
  leg.mode === 'ocean'
    ? oceanRoute(leg.to, leg.fromCoord, leg.toCoord)
    : landCurve(leg.fromCoord, leg.toCoord, leg.mode === 'air' ? 0.28 : 0.05);

/**
 * The network map, in one of two states.
 *
 * With `options` it compares the routes for a single shipment — each option
 * traced in its own colour, the selected one highlighted. Without them it shows
 * the lane network, one line per corridor.
 */
export function WorldMap({
  lanes = [],
  options,
  selectedOptionId,
  onSelectOption,
  onSelectLane,
  selectedLaneId,
  height = 420,
}: {
  lanes?: Lane[];
  /** Route options for one shipment. When set, the map switches to compare mode. */
  options?: RouteOption[];
  /** `RouteOption.id` — two options can share a `kind`, so ids drive selection. */
  selectedOptionId?: string;
  onSelectOption?: (id: string) => void;
  onSelectLane?: (laneId: string) => void;
  selectedLaneId?: string | null;
  height?: number;
}) {
  const theme = useTheme();
  const dark = theme.palette.mode === 'dark';
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);

  const compare = Boolean(options?.length);

  // ── Compare mode: every option's legs, pre-routed ──────────────────────
  const traced = useMemo(
    () => (options ?? []).map((o) => ({ option: o, paths: o.legs.map(pathOf) })),
    [options],
  );
  const active = useMemo(
    () => traced.find((t) => t.option.id === selectedOptionId) ?? traced[0],
    [traced, selectedOptionId],
  );

  // Endpoints for the active option — origin and final destination stay labelled.
  const waypoints = useMemo(() => {
    const legs = active?.option.legs ?? [];
    if (!legs.length) return [] as { name: string; pt: LatLng; kind: 'origin' | 'port' | 'dest' }[];
    const wp: { name: string; pt: LatLng; kind: 'origin' | 'port' | 'dest' }[] = [
      { name: legs[0].from, pt: [legs[0].fromCoord.lat, legs[0].fromCoord.lon], kind: 'origin' },
    ];
    legs.forEach((l, i) =>
      wp.push({ name: l.to, pt: [l.toCoord.lat, l.toCoord.lon], kind: i === legs.length - 1 ? 'dest' : 'port' }),
    );
    return wp;
  }, [active]);

  // ── Network mode: one routed line per lane ─────────────────────────────
  const network = useMemo(() => {
    const routes = lanes
      .filter((l) => l.coords.gateway && l.coords.destPort)
      .map((l) => ({ lane: l, path: oceanRoute(l.destPort, l.coords.gateway, l.coords.destPort) }));
    const mk = new Map<string, { pt: LatLng; kind: 'origin' | 'dest'; label: string }>();
    const add = (lat: number, lon: number, kind: 'origin' | 'dest', label: string) => {
      const k = `${kind}:${lat.toFixed(2)},${lon.toFixed(2)}`;
      if (!mk.has(k)) mk.set(k, { pt: [lat, lon], kind, label });
    };
    for (const l of lanes) {
      add(l.coords.gateway.lat, l.coords.gateway.lon, 'origin', l.primaryGateway);
      add(l.coords.destPort.lat, l.coords.destPort.lon, 'dest', l.destPort);
    }
    return { routes, markers: [...mk.values()], points: [...mk.values()].map((m) => m.pt) };
  }, [lanes]);

  const fitPoints = compare ? traced.flatMap((t) => t.paths.flat()) : network.points;

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
          '& .leaflet-container': {
            height: '100%',
            width: '100%',
            background: dark ? '#0A1A22' : '#dfeae7',
            fontFamily: 'inherit',
          },
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
          <TileLayer url={tileUrl} noWrap attribution="&copy; OpenStreetMap &copy; CARTO" />
          <FitBounds points={fitPoints} />

          {/* ── NETWORK VIEW ──────────────────────────────────────────── */}
          {!compare &&
            network.routes.map(({ lane, path }) => {
              const hot = hoverId === lane.laneId || selectedLaneId === lane.laneId;
              return (
                <Polyline
                  key={lane.laneId}
                  positions={path}
                  className={hot ? 'tw-route-glow' : undefined}
                  pathOptions={{
                    color: lane.hasAirFreight ? MODE_COLORS.Air : MODE_COLORS.Ocean,
                    weight: hot ? 4 : 1.6,
                    opacity: hot ? 0.95 : 0.5,
                    lineCap: 'round',
                  }}
                  eventHandlers={{
                    click: () => onSelectLane?.(lane.laneId),
                    mouseover: () => setHoverId(lane.laneId),
                    mouseout: () => setHoverId(null),
                  }}
                >
                  <Tooltip sticky className="tw-chip">
                    <strong>{lane.label}</strong>
                    <br />
                    {lane.shipmentCount} shipments · {formatTonnes(lane.totalCo2eTonnes)} CO₂e
                    {lane.avoidableTonnes > 0.001 && (
                      <>
                        <br />
                        {formatTonnes(lane.avoidableTonnes)} avoidable on a proven route
                      </>
                    )}
                  </Tooltip>
                </Polyline>
              );
            })}
          {!compare &&
            network.markers.map((m, i) =>
              m.kind === 'dest' ? (
                <Marker key={`d-${i}`} position={m.pt} icon={pinIcon('dest')} interactive={false}>
                  <Tooltip direction="top" offset={[0, -32]}>
                    {m.label}
                  </Tooltip>
                </Marker>
              ) : (
                <CircleMarker
                  key={`o-${i}`}
                  center={m.pt}
                  radius={4}
                  pathOptions={{ color: '#fff', weight: 1.5, fillColor: theme.palette.primary.main, fillOpacity: 1 }}
                >
                  <Tooltip direction="top">{m.label} · gateway port</Tooltip>
                </CircleMarker>
              ),
            )}

          {/* ── COMPARE VIEW — non-selected options sit behind ─────────── */}
          {compare &&
            traced
              .filter((t) => t !== active)
              .flatMap((t) =>
                t.paths.map((path, i) => (
                  <Polyline
                    key={`alt-${t.option.id}-${i}`}
                    positions={path}
                    pathOptions={{
                      color: OPTION_COLORS[t.option.kind] ?? '#666',
                      weight: 3,
                      opacity: 0.5,
                      lineCap: 'round',
                      dashArray: t.option.modePath.includes('Air') ? '2 8' : undefined,
                    }}
                    eventHandlers={onSelectOption ? { click: () => onSelectOption(t.option.id) } : undefined}
                  >
                    <Tooltip sticky className="tw-chip">
                      <strong>{t.option.label}</strong> · {t.option.modePath.join(' → ')}
                      <br />
                      {formatTonnes(t.option.co2eTonnes)} CO₂e · {formatDistance(t.option.distanceKm)}
                      <br />
                      Click to trace this option
                    </Tooltip>
                  </Polyline>
                )),
              )}

          {/* ── COMPARE VIEW — the selected option, drawn on top ───────── */}
          {compare &&
            active?.paths.map((path, i) => (
              <Polyline
                key={`sel-halo-${i}`}
                positions={path}
                pathOptions={{ color: '#0B1F2A', weight: 9, opacity: 0.16, lineCap: 'round' }}
              />
            ))}
          {compare &&
            active?.option.legs.map((leg, i) => (
              <Polyline
                key={`sel-${i}`}
                positions={active.paths[i]}
                className="tw-route-glow"
                pathOptions={{
                  color: MODE_COLORS[leg.modeLabel] ?? '#666',
                  weight: 5.5,
                  opacity: 0.96,
                  lineCap: 'round',
                  dashArray: leg.mode === 'air' ? '2 8' : undefined,
                }}
              />
            ))}
          {compare &&
            active?.paths.map((path, i) => (
              <Polyline
                key={`flow-${i}`}
                positions={path}
                className="tw-route-animated"
                pathOptions={{ color: '#fff', weight: 2, opacity: 0.85 }}
              />
            ))}
          {compare &&
            active?.option.legs.map((leg, i) => (
              <Marker key={`bd-${i}`} position={midOf(active.paths[i])} icon={badgeIcon(leg.modeLabel)}>
                <Tooltip direction="top" offset={[0, -12]} className="tw-chip">
                  <div style={{ fontWeight: 700, fontSize: 12 }}>
                    {leg.from} → {leg.to}
                  </div>
                  <div style={{ fontWeight: 800, fontSize: 17, lineHeight: 1.15, color: MODE_COLORS[leg.modeLabel] }}>
                    {formatTonnes(leg.co2eTonnes)} CO₂e
                  </div>
                  <div style={{ fontSize: 11.5, color: '#5C6B72', marginTop: 2 }}>
                    {formatDistance(leg.distanceKm)} · {leg.emissionFactor} {leg.efUnit}
                  </div>
                  <div style={{ fontSize: 11, color: '#5C6B72' }}>{leg.sourceRef}</div>
                </Tooltip>
              </Marker>
            ))}
          {compare &&
            waypoints.map((w, i) => (
              <Marker key={`wp-${i}`} position={w.pt} icon={pinIcon(w.kind)} interactive={w.kind === 'port'}>
                <Tooltip permanent={w.kind !== 'port'} direction="top" offset={[0, -31]} className="tw-place">
                  {w.name}
                  {w.kind === 'origin' ? ' · Factory' : w.kind === 'dest' ? ' · Destination' : ' · Port'}
                </Tooltip>
              </Marker>
            ))}
        </MapContainer>

        {/* Option picker, overlaid so comparing never needs a scroll */}
        {compare && options && options.length > 1 && panelOpen && (
          <Box
            sx={{
              position: 'absolute',
              top: 12,
              right: 12,
              zIndex: 1000,
              p: 1.25,
              width: 262,
              maxWidth: '86%',
              borderRadius: 1.5,
              bgcolor: alpha(theme.palette.background.paper, 0.97),
              border: 1,
              borderColor: 'divider',
              boxShadow: 3,
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
              <Typography variant="caption" color="primary.main" sx={{ fontWeight: 700, letterSpacing: '0.04em' }}>
                ROUTES ON THE MAP
              </Typography>
              <IconButton size="small" onClick={() => setPanelOpen(false)} sx={{ mt: -0.5, mr: -0.5 }} aria-label="Hide route list">
                <CloseRoundedIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Stack>
            <Stack spacing={0.5} sx={{ mt: 0.5 }}>
              {options.map((o) => {
                const isActive = o.id === active?.option.id;
                const color = OPTION_COLORS[o.kind] ?? '#666';
                return (
                  <Box
                    key={o.id}
                    onClick={() => onSelectOption?.(o.id)}
                    sx={{
                      p: 0.75,
                      borderRadius: 1.5,
                      border: 1,
                      borderColor: isActive ? color : 'divider',
                      bgcolor: isActive ? alpha(color, 0.08) : 'transparent',
                      cursor: onSelectOption ? 'pointer' : 'default',
                    }}
                  >
                    <Stack direction="row" spacing={0.75} alignItems="center">
                      <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />
                      <Typography variant="caption" sx={{ fontWeight: 700 }}>
                        {o.label}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary', ml: 'auto', fontVariantNumeric: 'tabular-nums' }}>
                        {formatTonnes(o.co2eTonnes)}
                      </Typography>
                    </Stack>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', pl: 2.1, fontSize: 11.5 }}>
                      {o.modePath.join(' → ')}
                      {o.gateway ? ` · via ${o.gateway}` : ''}
                    </Typography>
                  </Box>
                );
              })}
            </Stack>
          </Box>
        )}
      </Box>

      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" useFlexGap gap={1} sx={{ mt: 1.5 }}>
        <ModeLegend />
        <Typography variant="caption" color="text.secondary">
          {compare
            ? 'Every option is a route the workbook has recorded · hover a leg for its distance, factor and source cell'
            : 'Scroll to zoom · click a lane to open it'}
        </Typography>
      </Stack>
    </Box>
  );
}
