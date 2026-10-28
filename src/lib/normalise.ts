// Name normalisation for searching, unchanged since Sunlightr, the 2007
// Perl app this grew out of: "Saint-Étienne" and "saint etienne" both
// become "saintetienne".

const SPECIAL: Record<string, string> = {
  ß: 'ss',
  Æ: 'AE',
  æ: 'ae',
  Ĳ: 'IJ',
  ĳ: 'ij',
  Œ: 'Oe',
  œ: 'oe',
  Ð: 'D',
  Đ: 'D',
  ð: 'd',
  đ: 'd',
  Ħ: 'H',
  ħ: 'h',
  ı: 'i',
  ĸ: 'k',
  Ŀ: 'L',
  Ł: 'L',
  ŀ: 'l',
  ł: 'l',
  Ŋ: 'N',
  ŉ: 'n',
  ŋ: 'n',
  Ø: 'O',
  ø: 'o',
  ſ: 's',
  Þ: 'T',
  Ŧ: 'T',
  þ: 't',
  ŧ: 't',
};
const SPECIAL_RE = new RegExp(`[${Object.keys(SPECIAL).join('')}]`, 'g');

/** Lowercase, without accents, spaces or punctuation. */
export function normalise(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(SPECIAL_RE, (c) => SPECIAL[c])
    .replace(/[^A-Za-z0-9]/g, '')
    .toLowerCase();
}

/** Looser still: doubled letters made single, vowels removed ("Manchster"). */
export function normaliseLoose(name: string): string {
  return normalise(name)
    .replace(/(.)\1/g, '$1')
    .replace(/[aeiou]/g, '');
}
