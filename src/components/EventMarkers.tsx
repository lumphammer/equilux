import type { DayRow } from '../lib/daylight.ts';
import { formatDate } from '../lib/format.ts';
import { type Columns, MARGIN } from './chart.ts';

interface Props {
  rows: DayRow[];
  c: Columns;
  plotHeight: number;
  today: number;
  locale: string;
  onDark?: boolean;
}

/** Shared positions and labels keep the two plots aligned. Lines are never hidden for label collisions. */
export function EventMarkers({ rows, c, plotHeight, today, locale, onDark = false }: Props) {
  const lastLabel = [-Infinity, -Infinity];
  const events = rows.flatMap((row, i) => [
    ...(row.season
      ? [{ i, kind: 'season', label: row.season.includes('solstice') ? 'Solstice' : 'Equinox', title: row.season }]
      : []),
    ...(row.equilux ? [{ i, kind: 'equilux', label: 'Equilux', title: 'Equilux · daylight closest to 12 hours' }] : []),
  ]);
  return (
    <g class={onDark ? 'event-markers event-markers-on-dark' : 'event-markers'}>
      {events.map(({ i, kind, label, title }) => {
        const lane = kind === 'equilux' ? 1 : 0;
        const x = c.centre(i);
        // Clamp labels to the plot edges, using separate rows for equinox and equilux.
        const labelX = Math.max(MARGIN.left + 24, Math.min(MARGIN.left + c.plotWidth - 24, x));
        const showLabel =
          labelX - lastLabel[lane] >= 56 && !(lane === 1 && today >= 0 && Math.abs(labelX - c.centre(today)) < 48);
        if (showLabel) lastLabel[lane] = labelX;
        return (
          <g key={`${i}-${kind}`} class={`event-marker ${kind}`}>
            <title>
              {title} · {formatDate(rows[i].date, locale, { day: 'numeric', month: 'long', year: 'numeric' })}
            </title>
            <line x1={x} x2={x} y1={MARGIN.top} y2={MARGIN.top + plotHeight} />
            {showLabel && (
              <text class="marker" x={labelX} y={MARGIN.top - (lane === 0 ? 24 : 8)} text-anchor="middle">
                {label}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}
