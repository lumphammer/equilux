import type { DayRow } from '../lib/daylight.ts';
import { formatDate, formatDelta, formatDuration } from '../lib/format.ts';
import { crossingText } from './DayDetails.tsx';

interface Props {
  rows: DayRow[];
  today: number;
  timeZone: string;
  locale: string;
  fileName: string;
}

export function DayTable({ rows, today, timeZone, locale, fileName }: Props) {
  const t = (c: DayRow['crossings']['day'], which: 'rise' | 'set') => crossingText(c, timeZone, locale, which);
  return (
    <details class="table-view">
      <summary>Table of times ({rows.length} days)</summary>
      <p>
        <button type="button" class="button" onClick={() => downloadCsv(rows, timeZone, fileName)}>Download CSV</button>
      </p>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">First light</th>
              <th scope="col">Sunrise</th>
              <th scope="col">Solar noon</th>
              <th scope="col">Sunset</th>
              <th scope="col">Last light</th>
              <th scope="col">Daylight</th>
              <th scope="col">Change</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.date} class={[i === today && 'is-today', r.clockChange && 'is-clock-change'].filter(Boolean).join(' ')}>
                <th scope="row">
                  {formatDate(r.date, locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                  {r.season && <span class="row-note">{r.season}</span>}
                  {r.clockChange !== 0 && <span class="row-note">Clocks {r.clockChange > 0 ? 'forward' : 'back'}</span>}
                </th>
                <td>{t(r.crossings.civil, 'rise')}</td>
                <td>{t(r.crossings.day, 'rise')}</td>
                <td>{crossingText({ rise: r.noon, set: r.noon, riseMin: 0, setMin: 0 }, timeZone, locale, 'rise')}</td>
                <td>{t(r.crossings.day, 'set')}</td>
                <td>{t(r.crossings.civil, 'set')}</td>
                <td>{formatDuration(r.dayLength)}</td>
                <td>{i > 0 ? formatDelta(r.dayLength - rows[i - 1].dayLength) : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function downloadCsv(rows: DayRow[], timeZone: string, fileName: string) {
  // ISO local times, so spreadsheets can parse them whatever the reader's locale
  const local = (ms: number) =>
    new Intl.DateTimeFormat('sv-SE', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(ms);
  const cell = (c: DayRow['crossings']['day'], which: 'rise' | 'set') =>
    typeof c === 'string' ? (c === 'up' ? 'all day' : 'none') : local(c[which]);
  const lines = [
    ['date', 'astronomical_dawn', 'nautical_dawn', 'civil_dawn', 'sunrise', 'solar_noon', 'sunset', 'civil_dusk',
      'nautical_dusk', 'astronomical_dusk', 'daylight_minutes', 'utc_offset_minutes'].join(','),
    ...rows.map((r) =>
      [
        r.date,
        cell(r.crossings.astronomical, 'rise'), cell(r.crossings.nautical, 'rise'), cell(r.crossings.civil, 'rise'),
        cell(r.crossings.day, 'rise'), local(r.noon), cell(r.crossings.day, 'set'),
        cell(r.crossings.civil, 'set'), cell(r.crossings.nautical, 'set'), cell(r.crossings.astronomical, 'set'),
        r.dayLength.toFixed(1), r.offset,
      ].join(','),
    ),
  ];
  const url = URL.createObjectURL(new Blob([lines.join('\n') + '\n'], { type: 'text/csv' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: `${fileName}.csv` });
  a.click();
  URL.revokeObjectURL(url);
}
