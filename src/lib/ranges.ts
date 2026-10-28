import { addDays, addMonths, type IsoDate } from './tz.ts';

export const PRESETS = {
  '30d': { label: '±30 days', range: (t: IsoDate) => [addDays(t, -30), addDays(t, 30)] },
  '3m': { label: '±3 months', range: (t: IsoDate) => [addMonths(t, -3), addMonths(t, 3)] },
  '6m': { label: '±6 months', range: (t: IsoDate) => [addMonths(t, -6), addMonths(t, 6)] },
  next12m: { label: 'Next 12 months', range: (t: IsoDate) => [t, addDays(addMonths(t, 12), -1)] },
  year: { label: 'This year', range: (t: IsoDate) => [`${t.slice(0, 4)}-01-01`, `${t.slice(0, 4)}-12-31`] },
} satisfies Record<string, { label: string; range: (today: IsoDate) => [IsoDate, IsoDate] | IsoDate[] }>;

export type PresetKey = keyof typeof PRESETS;
export type Range = { preset: PresetKey } | { from: IsoDate; to: IsoDate };
export const DEFAULT_RANGE = { preset: '6m' } as const satisfies Range;
export const MAX_DAYS = 3 * 366;

export function resolveRange(range: Range, today: IsoDate): [IsoDate, IsoDate] {
  if ('preset' in range) return PRESETS[range.preset].range(today) as [IsoDate, IsoDate];
  return [range.from, range.to];
}

export function rangeFromParams(params: URLSearchParams): Range {
  const preset = params.get('range');
  if (preset && preset in PRESETS) return { preset: preset as PresetKey };
  const from = params.get('from');
  const to = params.get('to');
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  if (from && to && iso.test(from) && iso.test(to) && from <= to) return { from, to };
  return DEFAULT_RANGE;
}

export function rangeToParams(range: Range): string {
  if ('preset' in range) return range.preset === DEFAULT_RANGE.preset ? '' : `?range=${range.preset}`;
  return `?from=${range.from}&to=${range.to}`;
}
