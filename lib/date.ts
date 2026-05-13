export function startOfDayUtc(input: Date | string = new Date()) {
  const date = new Date(input);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function addDaysUtc(input: Date | string, days: number) {
  const date = startOfDayUtc(input);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

export function isoDay(input: Date | string = new Date()) {
  return startOfDayUtc(input).toISOString().slice(0, 10);
}

export function getPastSevenDays(input: Date | string = new Date()) {
  return Array.from({ length: 7 }, (_, index) => addDaysUtc(input, index - 6));
}
