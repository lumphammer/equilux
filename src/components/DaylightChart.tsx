import { useMemo } from 'preact/hooks';
import { type DayRow, intervals } from '../lib/daylight.ts';
import { formatClock, formatDate, formatDelta, formatDuration } from '../lib/format.ts';
import type { Level } from '../lib/sun.ts';
import { chartSlider, type Columns, columns, dateTicks, MARGIN, tooltipStyle, useWidth } from './chart.ts';
import { EventMarkers } from './EventMarkers.tsx';
import { CrossingTimes, spanText } from './DayDetails.tsx';

const HEIGHT = 380;
const PLOT_HEIGHT = HEIGHT - MARGIN.top - MARGIN.bottom;
const LONG_DATE = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' } as const;
// Midnight at the bottom, so the sun rises up the chart
const y = (minutes: number) => MARGIN.top + PLOT_HEIGHT * (1 - minutes / 1440);
// Painted in this order over the night background: each covers the next
// darkest
const BANDS: { level: Level; label: string }[] = [
  { level: 'astronomical', label: 'Astronomical twilight' },
  { level: 'nautical', label: 'Nautical twilight' },
  { level: 'civil', label: 'Civil twilight' },
  { level: 'day', label: 'Daylight' },
];

interface Props {
  rows: DayRow[];
  today: number;
  hover: number | null;
  setHover: (i: number | null) => void;
  timeZone: string;
  locale: string;
}

export function DaylightChart({ rows, today, hover, setHover, timeZone, locale }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const c = useMemo(() => columns(rows.length, width), [rows.length, width]);
  const plotHeight = PLOT_HEIGHT;

  const bands = useMemo(() => BANDS.map((b) => ({ ...b, shapes: bandShapes(rows, b.level, c) })), [rows, c]);
  const sunLine = useMemo(() => sunLines(rows, c), [rows, c]);
  const ticks = dateTicks(rows, c, locale);
  const changes = rows.flatMap((r, i) => (r.clockChange ? [{ i, change: r.clockChange }] : []));

  const row = hover !== null ? rows[hover] : null;

  return (
    <figure class="chart">
      <figcaption>
        <h2>Sunrise, sunset and twilight</h2>
        <ul class="legend">
          {BANDS.toReversed().map((b) => (
            <li key={b.level}>
              <span class={`swatch band-${b.level}`} />
              {b.label}
            </li>
          ))}
          <li>
            <span class="swatch band-night" />
            Night
          </li>
          <li>
            <span class="line-key equilux-key" />
            Equilux
          </li>
          <li>
            <span class="line-key sun" />
            Sunrise and sunset
          </li>
        </ul>
      </figcaption>
      <div class="plot" ref={ref}>
        <svg
          width={width}
          height={HEIGHT}
          {...chartSlider({
            label: 'Sunrise, sunset and twilight by date. Use the arrow keys to move between days.',
            rows,
            hover,
            setHover,
            today,
            describe: (r) =>
              `${formatDate(r.date, locale, LONG_DATE)}: sunrise to sunset ${spanText(r.crossings.day, timeZone, locale)}, ${formatDuration(r.dayLength)} of daylight${r.season ? `, ${r.season}` : ''}${r.equilux ? ', Equilux' : ''}`,
          })}
          onPointerMove={(e) => setHover(c.index(e.offsetX))}
          onPointerLeave={() => setHover(null)}
          onBlur={() => setHover(null)}
        >
          <rect class="band-night" x={MARGIN.left} y={MARGIN.top} width={c.plotWidth} height={plotHeight} />
          {bands.map((b) => (
            <g key={b.level} class={`band-${b.level}`} shape-rendering="crispEdges">
              {b.shapes.rects.map(([x, y0, w, h], k) => (
                <rect key={k} x={x} y={y0} width={w} height={h} />
              ))}
              <path d={b.shapes.path} shape-rendering="geometricPrecision" />
            </g>
          ))}
          {[3, 6, 9, 12, 15, 18, 21].map((h) => (
            <line
              key={h}
              class="grid-on-dark"
              x1={MARGIN.left}
              x2={MARGIN.left + c.plotWidth}
              y1={y(h * 60)}
              y2={y(h * 60)}
            />
          ))}
          <path class="sun-line" d={sunLine} />
          {changes.map(({ i }) => (
            <line
              key={i}
              class="clock-change"
              x1={c.left(i)}
              x2={c.left(i)}
              y1={MARGIN.top}
              y2={MARGIN.top + plotHeight}
            />
          ))}
          {today >= 0 && (
            <g class="today">
              <line x1={c.centre(today)} x2={c.centre(today)} y1={MARGIN.top} y2={MARGIN.top + plotHeight} />
              <text x={c.centre(today)} y={MARGIN.top - 8} text-anchor="middle">
                Today
              </text>
            </g>
          )}
          <EventMarkers rows={rows} c={c} plotHeight={plotHeight} today={today} locale={locale} onDark />
          {[0, 3, 6, 9, 12, 15, 18, 21, 24].map((h) => (
            <text key={h} class="tick" x={MARGIN.left - 8} y={y(h * 60)} dy="0.32em" text-anchor="end">
              {formatClock(h * 60, locale)}
            </text>
          ))}
          {ticks.map((t) => (
            <text key={t.i} class="tick" x={c.left(t.i)} y={HEIGHT - 8} text-anchor="start">
              {t.label}
            </text>
          ))}
          {hover !== null && (
            <line
              class="crosshair"
              x1={c.centre(hover)}
              x2={c.centre(hover)}
              y1={MARGIN.top}
              y2={MARGIN.top + plotHeight}
            />
          )}
        </svg>
        {row && hover !== null && (
          <div class="tooltip" style={tooltipStyle(c.centre(hover), width, MARGIN.top)}>
            <div class="tip-date">{formatDate(row.date, locale, LONG_DATE)}</div>
            <div class="tip-headline">
              <strong>{formatDuration(row.dayLength)}</strong> daylight
              {hover > 0 && <span class="muted"> {formatDelta(row.dayLength - rows[hover - 1].dayLength)}</span>}
            </div>
            <CrossingTimes row={row} timeZone={timeZone} locale={locale} />
            {row.equilux && <div class="tip-note">Equilux · daylight closest to 12 hours</div>}
            {row.season && <div class="tip-note">{row.season}</div>}
            {row.clockChange !== 0 && (
              <div class="tip-note">
                Clocks went {row.clockChange > 0 ? 'forward' : 'back'}{' '}
                {formatDuration(Math.abs(row.clockChange)).replace(/^0h /, '').replace(/ 00m$/, '')}
              </div>
            )}
          </div>
        )}
      </div>
    </figure>
  );
}

type Rect = [number, number, number, number];

/**
 * A level's band as a smooth path where it can be (runs of ordinary days),
 * and per-day rectangles where it can't (polar days, twilight wrapping past
 * midnight). Runs break where the clocks change, leaving an honest step.
 */
function bandShapes(rows: DayRow[], level: Level, c: Columns) {
  const rects: Rect[] = [];
  let path = '';
  let run: number[] = [];

  const flush = () => {
    if (!run.length) return;
    const top: string[] = [];
    const bottom: string[] = [];
    run.forEach((i, k) => {
      const cr = rows[i].crossings[level] as { riseMin: number; setMin: number };
      const xs = [k === 0 ? c.left(i) : null, c.centre(i), k === run.length - 1 ? c.left(i) + c.col : null];
      for (const x of xs) {
        if (x === null) continue;
        top.push(`${x.toFixed(1)},${y(cr.setMin).toFixed(1)}`);
        bottom.unshift(`${x.toFixed(1)},${y(cr.riseMin).toFixed(1)}`);
      }
    });
    path += `M${top.join('L')}L${bottom.join('L')}Z`;
    run = [];
  };

  rows.forEach((row, i) => {
    const cr = row.crossings[level];
    const smooth = typeof cr === 'object' && cr.riseMin >= 0 && cr.setMin <= 1440;
    if (!smooth || row.clockChange) flush();
    if (smooth) run.push(i);
    else {
      for (const [a, b] of intervals(cr)) rects.push([c.left(i), y(b), c.col + 0.5, y(a) - y(b)]);
    }
  });
  flush();
  return { rects, path };
}

function sunLines(rows: DayRow[], c: Columns): string {
  const parts: string[] = [];
  for (const edge of ['riseMin', 'setMin'] as const) {
    let pen = false;
    rows.forEach((row, i) => {
      const cr = row.crossings.day;
      const v = typeof cr === 'object' ? cr[edge] : null;
      if (v === null || v < 0 || v > 1440 || row.clockChange) pen = false;
      if (v === null || v < 0 || v > 1440) return;
      parts.push(`${pen ? 'L' : 'M'}${c.centre(i).toFixed(1)},${y(v).toFixed(1)}`);
      pen = true;
    });
  }
  return parts.join('');
}
