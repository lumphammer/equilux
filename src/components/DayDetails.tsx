import type { DayRow, LocalCrossing } from '../lib/daylight.ts';
import { formatTime } from '../lib/format.ts';

export function crossingText(c: LocalCrossing, timeZone: string, locale: string, which: 'rise' | 'set') {
  if (c === 'up') return 'All day';
  if (c === 'down') return 'None';
  return formatTime(c[which], timeZone, locale);
}

export function spanText(c: LocalCrossing, timeZone: string, locale: string) {
  if (c === 'up') return 'All day';
  if (c === 'down') return 'None';
  return `${formatTime(c.rise, timeZone, locale)} – ${formatTime(c.set, timeZone, locale)}`;
}

/** Every crossing on a day, for tooltips: band-coloured line keys, times leading. */
export function CrossingTimes({ row, timeZone, locale }: { row: DayRow; timeZone: string; locale: string }) {
  const t = (c: LocalCrossing) => spanText(c, timeZone, locale);
  const items: [string, string, string][] = [
    ['sun', 'Sunrise – sunset', t(row.crossings.day)],
    ['noon', 'Solar noon', formatTime(row.noon, timeZone, locale)],
    ['band-civil', 'Civil twilight', t(row.crossings.civil)],
    ['band-nautical', 'Nautical', t(row.crossings.nautical)],
    ['band-astronomical', 'Astronomical', t(row.crossings.astronomical)],
  ];
  return (
    <dl class="tip-rows">
      {items.map(([key, label, value]) => (
        <div key={label}>
          <dt>
            <span class={`line-key ${key}`} />
            {label}
          </dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
