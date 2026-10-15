// Backend LocalDateTime values are Korean local time. Round only for display.
export function formatDateTime(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?$/.exec(value || '');
  if (!match) return '—';
  const [, year, month, day, hour, minute, second, fraction = ''] = match;
  const milliseconds = Number(fraction.slice(0, 3).padEnd(3, '0'));
  const time = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second), milliseconds);
  return new Date(Math.round(time / 1000) * 1000).toISOString().slice(0, 19).replace('T', ' ');
}

export const formatClock = value => formatDateTime(value).slice(11) || '—';
export const formatShortDateTime = value => {
  const formatted = formatDateTime(value);
  return formatted === '—' ? formatted : formatted.slice(5).replace('-', '.');
};