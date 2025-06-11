export function getClickhouseDateNow() {
  return formatClickhouseDate(new Date());
}

export function formatClickhouseDate(date: Date) {
  return date.toISOString().replace('T', ' ').replace('Z', '');
}
