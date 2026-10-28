import type { DayRow, LocalCrossing } from '../lib/daylight.ts';
import { compass, formatDate, formatDelta, formatDuration, formatTime } from '../lib/format.ts';
import type { Place } from '../lib/place.ts';
import { seasons } from '../lib/sun.ts';
import { addDays, daysBetween, type IsoDate, localDate, offsetMinutes, utcNoon } from '../lib/tz.ts';
import { crossingText } from './DayDetails.tsx';

interface Props {
  place: Place;
  today: IsoDate;
  /** Yesterday, today and tomorrow */
  days: [DayRow, DayRow, DayRow];
  locale: string;
}

export function Today({ place, today, days: [yesterday, day, tomorrow], locale }: Props) {
  const tz = place.timeZone;
  const time = (ms: number) => formatTime(ms, tz, locale);
  const sun = day.crossings.day;
  const golden = day.crossings.golden;
  const change = day.dayLength - yesterday.dayLength;
  const trend = tomorrow.dayLength - day.dayLength;

  const polarName = sun === 'up' ? 'Midnight sun' : 'Polar night';
  const polar = sun === 'up' ? 'The sun doesn’t set today' : sun === 'down' ? 'The sun doesn’t rise today' : null;

  return (
    <section class="today-panel" aria-labelledby="today-heading">
      <h2 id="today-heading">
        Today, {formatDate(today, locale, { weekday: 'long', day: 'numeric', month: 'long' })}
      </h2>
      {polar && <p class="polar-note">{polar}.</p>}
      <div class="tiles">
        <Tile label="Sunrise" value={polar ? '—' : crossingText(sun, tz, locale, 'rise')}
          note={day.riseAzimuth !== null ? `${compass(day.riseAzimuth)}, ${Math.round(day.riseAzimuth)}°` : polarName} />
        <Tile label="Sunset" value={polar ? '—' : crossingText(sun, tz, locale, 'set')}
          note={day.riseAzimuth !== null ? `${compass(360 - day.riseAzimuth)}, ${Math.round(360 - day.riseAzimuth)}°` : polarName} />
        <Tile label="Daylight" value={formatDuration(day.dayLength)}
          note={change || trend ? `${formatDelta(change)} on yesterday` : 'No change'} />
        <Tile label="Solar noon" value={time(day.noon)}
          note={day.noonAltitude > 0 ? `Sun ${Math.round(day.noonAltitude)}° up` : 'Sun below the horizon'} />
        <Tile label="First light" value={crossingText(day.crossings.civil, tz, locale, 'rise')} note="Civil dawn" />
        <Tile label="Last light" value={crossingText(day.crossings.civil, tz, locale, 'set')} note="Civil dusk" />
        <Tile label="Golden hour" {...goldenHour(golden, sun, time)} />
      </div>
      <ul class="facts">
        {trend !== 0 && sun !== 'up' && sun !== 'down' && (
          <li>Days are getting {trend > 0 ? 'longer' : 'shorter'}, by {formatDelta(trend).slice(1)} tomorrow.</li>
        )}
        <NextSeason today={today} timeZone={tz} locale={locale} />
        <NextClockChange today={today} timeZone={tz} locale={locale} />
      </ul>
    </section>
  );
}

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div class="tile">
      <div class="tile-label">{label}</div>
      <div class="tile-value">{value}</div>
      {note && <div class="tile-note">{note}</div>}
    </div>
  );
}

function goldenHour(golden: LocalCrossing, sun: LocalCrossing, time: (ms: number) => string) {
  if (typeof sun === 'string' || golden === 'up') return { value: '—', note: 'Not today' };
  if (golden === 'down') return { value: 'All day', note: 'The sun stays low' };
  return { value: time(golden.set), note: 'Until sunset' };
}

function NextSeason({ today, timeZone, locale }: { today: IsoDate; timeZone: string; locale: string }) {
  const year = Number(today.slice(0, 4));
  const next = [...seasons(year), ...seasons(year + 1)]
    .map((s) => ({ ...s, date: localDate(s.at, timeZone) }))
    .find((s) => s.date >= today);
  if (!next) return null;
  const days = daysBetween(today, next.date);
  return (
    <li>
      The {next.event} is {days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`}, at{' '}
      {formatTime(next.at, timeZone, locale)} on {formatDate(next.date, locale, { day: 'numeric', month: 'long' })}.
    </li>
  );
}

function NextClockChange({ today, timeZone, locale }: { today: IsoDate; timeZone: string; locale: string }) {
  let previous = offsetMinutes(utcNoon(today), timeZone);
  for (let i = 1; i <= 366; i++) {
    const date = addDays(today, i);
    const offset = offsetMinutes(utcNoon(date), timeZone);
    if (offset !== previous) {
      const diff = offset - previous;
      const amount = Math.abs(diff) === 60 ? 'an hour' : formatDuration(Math.abs(diff));
      return (
        <li>
          The clocks go {diff > 0 ? 'forward' : 'back'} {amount} {i === 1 ? 'tonight' : `in ${i} days`}, on{' '}
          {formatDate(date, locale, { weekday: 'long', day: 'numeric', month: 'long' })}.
        </li>
      );
    }
    previous = offset;
  }
  return <li>The clocks don’t change here.</li>;
}
