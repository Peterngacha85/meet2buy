const kesFormat = new Intl.NumberFormat('en-KE', { maximumFractionDigits: 0 });

/** 54999 → "KES 54,999" */
export const kes = (amount) => `KES ${kesFormat.format(amount ?? 0)}`;

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

/** "5 minutes ago", "yesterday" */
export function timeAgo(date) {
  const seconds = Math.round((new Date(date).getTime() - Date.now()) / 1000);
  const steps = [
    [60, 'second'],
    [60, 'minute'],
    [24, 'hour'],
    [7, 'day'],
    [4.35, 'week'],
    [12, 'month'],
    [Infinity, 'year'],
  ];
  let value = seconds;
  for (const [size, unit] of steps) {
    if (Math.abs(value) < size) return relative.format(Math.round(value), unit);
    value /= size;
  }
  return '';
}
