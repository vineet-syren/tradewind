import { Box } from '@mui/material';
import type { PersonaId } from '@/types';

/**
 * One distinct icon per persona, drawn inline.
 *
 * These are SVG rather than glyphs from the icon set because each needs to read
 * as its own object at 26px in the top bar: a globe, a container, a chart. Depth
 * comes from a lit top face, a darker side face and a soft base shadow — the
 * same three-tone treatment on all three, so they sit together as a set instead
 * of looking like three unrelated illustrations.
 *
 * Self-contained: no image files, no external requests, and they inherit the
 * persona colour so the accent stays consistent with the rest of the switcher.
 */

/* eslint-disable react-refresh/only-export-components -- the accent map belongs
   with the glyphs that derive their faces from it. */
export const PERSONA_COLOR: Record<string, string> = {
  cso: '#4f46e5',
  logistics: '#0ea5e9',
  analyst: '#10b981',
};

/** Light face, mid face, shadow — derived from one accent so all three match. */
function faces(color: string) {
  return { light: color, mid: shade(color, -0.18), dark: shade(color, -0.36) };
}

/** Mix a hex colour towards black (negative) or white (positive). */
function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const v = amount < 0 ? c * (1 + amount) : c + (255 - c) * amount;
    return Math.round(Math.max(0, Math.min(255, v)));
  });
  return `#${ch.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

function CsoGlyph({ color }: { color: string }) {
  const f = faces(color);
  const id = 'tw-cso';
  return (
    <svg viewBox="0 0 48 48" width="100%" height="100%" role="presentation">
      <defs>
        <radialGradient id={`${id}-globe`} cx="35%" cy="28%" r="78%">
          <stop offset="0%" stopColor={shade(f.light, 0.42)} />
          <stop offset="55%" stopColor={f.light} />
          <stop offset="100%" stopColor={f.dark} />
        </radialGradient>
        <linearGradient id={`${id}-leaf`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#a7f3d0" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
      </defs>
      <ellipse cx="24" cy="41" rx="13" ry="3" fill={f.dark} opacity="0.22" />
      <circle cx="24" cy="22" r="15" fill={`url(#${id}-globe)`} />
      {/* Meridians, so it reads as a globe and not a plain disc */}
      <g fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="1.1">
        <ellipse cx="24" cy="22" rx="6.4" ry="15" />
        <path d="M9.4 17.6h29.2M9.4 26.4h29.2" />
      </g>
      <circle cx="19" cy="16" r="4.4" fill="#fff" opacity="0.2" />
      {/* Leaf — the sustainability mark, sitting proud of the sphere */}
      <path d="M31 30c6-1 9-5 9.5-10-5.5-.5-10 2-11 7.2-.3 1.6-.1 2.4 1.5 2.8z" fill={`url(#${id}-leaf)`} />
      <path d="M40 20c-4.2 2.2-7 5.4-8.6 9.6" stroke="#065f46" strokeOpacity="0.5" strokeWidth="1.1" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function LogisticsGlyph({ color }: { color: string }) {
  const f = faces(color);
  const id = 'tw-log';
  return (
    <svg viewBox="0 0 48 48" width="100%" height="100%" role="presentation">
      <defs>
        <linearGradient id={`${id}-top`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={shade(f.light, 0.5)} />
          <stop offset="100%" stopColor={f.light} />
        </linearGradient>
      </defs>
      <ellipse cx="24" cy="41.5" rx="15" ry="3" fill={f.dark} opacity="0.22" />
      {/* An isometric shipping container: top face, then two sides */}
      <path d="M24 7l16 8-16 8-16-8z" fill={`url(#${id}-top)`} />
      <path d="M8 15v14l16 8V23z" fill={f.mid} />
      <path d="M40 15v14l-16 8V23z" fill={f.dark} />
      {/* Corrugation, the detail that makes it a container rather than a box */}
      <g stroke="#fff" strokeOpacity="0.3" strokeWidth="1">
        <path d="M12 19.5v13M16 21.5v13M20 23.5v13" />
      </g>
      <g stroke="#000" strokeOpacity="0.16" strokeWidth="1">
        <path d="M28 35.5v-13M32 33.5v-13M36 31.5v-13" />
      </g>
    </svg>
  );
}

function AnalystGlyph({ color }: { color: string }) {
  const f = faces(color);
  const id = 'tw-ana';
  return (
    <svg viewBox="0 0 48 48" width="100%" height="100%" role="presentation">
      <defs>
        <linearGradient id={`${id}-bar`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={shade(f.light, 0.35)} />
          <stop offset="100%" stopColor={f.mid} />
        </linearGradient>
      </defs>
      <ellipse cx="24" cy="41.5" rx="15" ry="3" fill={f.dark} opacity="0.22" />
      {/* Three bars in perspective — each has a lit top and a shaded right face */}
      {[
        { x: 8, h: 12 },
        { x: 18, h: 20 },
        { x: 28, h: 28 },
      ].map((b) => (
        <g key={b.x}>
          <path d={`M${b.x} ${38 - b.h}l5-2.5 5 2.5-5 2.5z`} fill={shade(f.light, 0.5)} />
          <path d={`M${b.x} ${38 - b.h}v${b.h}l5 2.5V${40.5 - b.h}z`} fill={`url(#${id}-bar)`} />
          <path d={`M${b.x + 10} ${38 - b.h}v${b.h}l-5 2.5V${40.5 - b.h}z`} fill={f.dark} />
        </g>
      ))}
      {/* Magnifier — the analyst is the one looking into the numbers */}
      <circle cx="34" cy="14" r="7" fill="#fff" fillOpacity="0.9" stroke={f.dark} strokeWidth="2.2" />
      <path d="M39 19l5 5" stroke={f.dark} strokeWidth="3" strokeLinecap="round" />
      <path d="M31 15l2.5 2.5L38 12" fill="none" stroke={f.mid} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const GLYPHS: Record<string, (p: { color: string }) => JSX.Element> = {
  cso: CsoGlyph,
  logistics: LogisticsGlyph,
  analyst: AnalystGlyph,
};

export function PersonaAvatar({ personaId, size = 30 }: { personaId: PersonaId | string; size?: number }) {
  const color = PERSONA_COLOR[personaId] ?? '#4f46e5';
  const Glyph = GLYPHS[personaId] ?? CsoGlyph;
  return (
    <Box
      sx={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: '50%',
        display: 'grid',
        placeItems: 'center',
        // A soft tinted well behind the glyph, so it reads as a solid object
        // sitting in the chrome rather than a flat sticker on it.
        background: `radial-gradient(circle at 32% 28%, ${shade(color, 0.9)}, ${shade(color, 0.72)})`,
        boxShadow: `inset 0 -1px 2px ${shade(color, 0.3)}55, 0 1px 2px rgba(15,23,42,.16)`,
        p: `${Math.round(size * 0.11)}px`,
      }}
    >
      <Glyph color={color} />
    </Box>
  );
}
