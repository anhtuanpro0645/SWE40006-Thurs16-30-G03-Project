// Turns a User-Agent header into a browser name for the stats page.
// Order matters: Edge and Opera also contain "Chrome", and Chrome also
// contains "Safari", so the more specific names are checked first.
const RULES = [
  ['Edge', /Edg(?:A|iOS)?\//],
  ['Opera', /OPR\//],
  ['Chrome', /(?:Chrome|CriOS)\//],
  ['Firefox', /(?:Firefox|FxiOS)\//],
  ['Safari', /Safari\//],
  ['Postman', /PostmanRuntime\//],
  ['curl', /^curl\//],
];

export function parseBrowser(userAgent) {
  if (!userAgent) return 'Unknown';
  const match = RULES.find(([, pattern]) => pattern.test(userAgent));
  return match ? match[0] : 'Other';
}