// Geometry shared by the charts: one column per day.

import { useEffect, useRef, useState } from 'preact/hooks';
import type { DayRow } from '../lib/daylight.ts';
import { formatDate } from '../lib/format.ts';

export const MARGIN = { left: 56, right: 14, top: 26, bottom: 28 };

export function useWidth<T extends HTMLElement>(fallback = 800) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

export interface Columns {
  n: number;
  width: number;
  plotWidth: number;
  col: number;
  left: (i: number) => number;
  centre: (i: number) => number;
  index: (x: number) => number;
}

export function columns(n: number, width: number): Columns {
  const plotWidth = Math.max(width - MARGIN.left - MARGIN.right, 50);
  const col = plotWidth / n;
  return {
    n,
    width,
    plotWidth,
    col,
    left: (i) => MARGIN.left + i * col,
    centre: (i) => MARGIN.left + (i + 0.5) * col,
    index: (x) => Math.min(n - 1, Math.max(0, Math.floor((x - MARGIN.left) / col))),
  };
}

export interface Tick {
  i: number;
  label: string;
}

/** Month starts for long ranges, every day or week or two for short ones. */
export function dateTicks(rows: DayRow[], c: Columns, locale: string): Tick[] {
  const ticks: Tick[] = [];
  if (rows.length > 75) {
    const starts = rows.flatMap((r, i) => (r.date.endsWith('-01') ? [i] : []));
    const every = Math.ceil((starts.length * 44) / c.plotWidth);
    starts.forEach((i, k) => {
      if (k % every) return;
      const date = rows[i].date;
      const showYear = date.slice(5, 7) === '01' || k === 0;
      ticks.push({
        i,
        label: formatDate(date, locale, showYear ? { month: 'short', year: 'numeric' } : { month: 'short' }),
      });
    });
    return ticks;
  }
  const step = [1, 2, 7, 14].find((s) => rows.length / s <= c.plotWidth / 64) ?? 28;
  for (let i = 0; i < rows.length; i += step) {
    ticks.push({ i, label: formatDate(rows[i].date, locale, { day: 'numeric', month: 'short' }) });
  }
  return ticks;
}

/**
 * Props that make a chart a slider over its days: focusable, arrow keys move
 * the crosshair, and screen readers hear the day under it.
 */
export function chartSlider(options: {
  label: string;
  rows: DayRow[];
  hover: number | null;
  setHover: (i: number | null) => void;
  today: number;
  describe: (row: DayRow) => string;
}) {
  const { label, rows, hover, setHover, today, describe } = options;
  const current = hover ?? (today >= 0 ? today : 0);
  return {
    role: 'slider',
    tabIndex: 0,
    'aria-label': label,
    'aria-valuemin': 0,
    'aria-valuemax': rows.length - 1,
    'aria-valuenow': current,
    'aria-valuetext': describe(rows[current]),
    onKeyDown: keyboardHover(rows.length, hover, setHover, today),
  } as const;
}

/** Arrow keys move the crosshair; Escape clears it. */
function keyboardHover(n: number, hover: number | null, setHover: (i: number | null) => void, today: number) {
  return (e: KeyboardEvent) => {
    const start = hover ?? (today >= 0 ? today : 0);
    const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, PageUp: -7, PageDown: 7 };
    if (e.key in moves) {
      e.preventDefault();
      setHover(Math.min(n - 1, Math.max(0, hover === null ? start : start + moves[e.key])));
    } else if (e.key === 'Home') setHover(0);
    else if (e.key === 'End') setHover(n - 1);
    else if (e.key === 'Escape') setHover(null);
  };
}

/** Tooltip placement beside the crosshair, flipping left near the right edge. Preact 11 wants units. */
export function tooltipStyle(x: number, width: number, top: number, room = 260) {
  return x > width - room
    ? { right: `${width - x + 14}px`, top: `${top}px` }
    : { left: `${x + 14}px`, top: `${top}px` };
}
