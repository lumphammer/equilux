/** The visitor's preferred locale, from Accept-Language, for formatting dates and times. */
export function requestLocale(request: Request): string {
  const header = request.headers.get('Accept-Language') ?? '';
  for (const part of header.split(',')) {
    const tag = part.split(';')[0].trim();
    if (!tag || tag === '*') continue;
    try {
      const [supported] = Intl.DateTimeFormat.supportedLocalesOf(tag);
      if (supported) return supported;
    } catch {
      // Malformed tag
    }
  }
  return 'en-GB';
}
