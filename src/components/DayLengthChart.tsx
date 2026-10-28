import { type DayRow } from '../lib/daylight.ts';
import { formatDate, formatDelta, formatDuration } from '../lib/format.ts';
import { chartSlider, columns, dateTicks, MARGIN, tooltipStyle, useWidth } from './chart.ts';

const HEIGHT = 200;
const LONG_DATE = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' } as const;

interface Props {
  rows: DayRow[];
  today: number;
  hover: number | null;
  setHover: (i: number | null) => void;
  locale: string;
}

export function DayLengthChart({ rows, today, hover, setHover, locale }: Props) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const c = columns(rows.length, width);
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;

  const lengths = rows.map((r) => r.dayLength);
  const minI = lengths.indexOf(Math.min(...lengths));
  const maxI = lengths.indexOf(Math.max(...lengths));
  // Whole hours, at least two apart
  let lo = Math.floor(lengths[minI] / 60);
  let hi = Math.ceil(lengths[maxI] / 60);
  if (hi - lo < 2) {
    lo = Math.max(0, Math.min(lo, hi - 2));
    hi = Math.max(hi, lo + 2);
  }
  const step = [1, 2, 3, 4, 6].find((s) => (hi - lo) / s <= 5) ?? 6;
  const y = (minutes: number) => MARGIN.top + plotHeight * (1 - (minutes / 60 - lo) / (hi - lo));
  const ticks = dateTicks(rows, c, locale);
  const line = rows.map((r, i) => `${i ? 'L' : 'M'}${c.centre(i).toFixed(1)},${y(r.dayLength).toFixed(1)}`).join('');

  const extremes = [
    { i: maxI, label: 'Longest' },
    { i: minI, label: 'Shortest' },
  ].filter(({ i }) => i > 0 && i < rows.length - 1);

  const row = hover !== null ? rows[hover] : null;

  return (
    <figure class="chart">
      <figcaption>
        <h2>Day length</h2>
      </figcaption>
      <div class="plot" ref={ref}>
        <svg
          width={width}
          height={HEIGHT}
          {...chartSlider({
            label: 'Day length by date. Use the arrow keys to move between days.',
            rows,
            hover,
            setHover,
            today,
            describe: (r) => `${formatDate(r.date, locale, LONG_DATE)}: ${formatDuration(r.dayLength)} of daylight`,
          })}
          onPointerMove={(e) => setHover(c.index(e.offsetX))}
          onPointerLeave={() => setHover(null)}
          onBlur={() => setHover(null)}
        >
          {Array.from({ length: Math.floor((hi - lo) / step) + 1 }, (_, k) => lo + k * step).map((h) => (
            <g key={h}>
              <line class="grid" x1={MARGIN.left} x2={MARGIN.left + c.plotWidth} y1={y(h * 60)} y2={y(h * 60)} />
              <text class="tick" x={MARGIN.left - 8} y={y(h * 60)} dy="0.32em" text-anchor="end">
                {h}h
              </text>
            </g>
          ))}
          <line
            class="axis"
            x1={MARGIN.left}
            x2={MARGIN.left + c.plotWidth}
            y1={MARGIN.top + plotHeight}
            y2={MARGIN.top + plotHeight}
          />
          {ticks.map((t) => (
            <text key={t.i} class="tick" x={c.left(t.i)} y={HEIGHT - 8}>
              {t.label}
            </text>
          ))}
          {today >= 0 && (
            <g class="today-light">
              <line x1={c.centre(today)} x2={c.centre(today)} y1={MARGIN.top} y2={MARGIN.top + plotHeight} />
            </g>
          )}
          <path class="series-line" d={line} />
          {extremes.map(({ i, label }) => {
            const above = label === 'Longest';
            const anchor = c.centre(i) < MARGIN.left + 80 ? 'start' : c.centre(i) > width - 80 ? 'end' : 'middle';
            return (
              <g key={label}>
                <circle class="series-dot" cx={c.centre(i)} cy={y(lengths[i])} r={4} />
                <text class="direct-label" x={c.centre(i)} y={y(lengths[i]) + (above ? -10 : 18)} text-anchor={anchor}>
                  {label}: {formatDuration(lengths[i])},{' '}
                  {formatDate(rows[i].date, locale, { day: 'numeric', month: 'short' })}
                </text>
              </g>
            );
          })}
          {hover !== null && (
            <g>
              <line
                class="crosshair-light"
                x1={c.centre(hover)}
                x2={c.centre(hover)}
                y1={MARGIN.top}
                y2={MARGIN.top + plotHeight}
              />
              <circle class="series-dot" cx={c.centre(hover)} cy={y(lengths[hover])} r={4} />
            </g>
          )}
        </svg>
        {row && hover !== null && (
          <div class="tooltip" style={tooltipStyle(c.centre(hover), width, MARGIN.top, 220)}>
            <div class="tip-date">{formatDate(row.date, locale, LONG_DATE)}</div>
            <div class="tip-headline">
              <strong>{formatDuration(row.dayLength)}</strong>
              {hover > 0 && (
                <span class="muted"> {formatDelta(row.dayLength - rows[hover - 1].dayLength)} on the day before</span>
              )}
            </div>
          </div>
        )}
      </div>
    </figure>
  );
}
