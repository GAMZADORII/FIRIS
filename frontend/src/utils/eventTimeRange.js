// Event timestamps without an offset are supplied in KST by the API.
export function matchesEventTimeRange(value, start, end, startTime, endTime) {
  if (!start && !end && !startTime && !endTime) return true;
  if (!value) return false;
  const minute = value.replace(' ', 'T').slice(0, 16);
  const time = minute.slice(11, 16);
  if (start && minute < `${start}T${startTime || '00:00'}`) return false;
  if (end && minute > `${end}T${endTime || '23:59'}`) return false;
  if (!start && startTime && time < startTime) return false;
  if (!end && endTime && time > endTime) return false;
  return true;
}
