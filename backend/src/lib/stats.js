// Small helpers that turn grouped database rows into the "top N" lists
// shown on the stats page. Kept free of Express and the database so they
// can be unit tested on their own.

export const TOP_N = 5;

// The site a click came from: "canvas.swin.edu.au", or "Direct" when the
// browser sent no Referer header (typed in, bookmark, app, ...).
export function referrerName(referrer) {
  if (!referrer) return 'Direct';
  try {
    return new URL(referrer).hostname || 'Other';
  } catch {
    return 'Other';
  }
}

// rows: [{ key, clicks }] where several keys can map to the same name,
// e.g. two different Chrome versions are both "Chrome".
// Returns [{ name, clicks }] sorted by clicks (ties by name), at most `limit`.
export function topCounts(rows, toName, limit = TOP_N) {
  const totals = new Map();
  for (const { key, clicks } of rows) {
    const name = toName(key);
    totals.set(name, (totals.get(name) ?? 0) + clicks);
  }
  return [...totals]
    .map(([name, clicks]) => ({ name, clicks }))
    .sort((a, b) => b.clicks - a.clicks || a.name.localeCompare(b.name))
    .slice(0, limit);
}