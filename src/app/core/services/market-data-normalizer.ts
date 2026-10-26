import { Instrument, MarketDataPoint, MarketHistory } from '../models/market-data';
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
export function createMarketHistory(
  instrument: Instrument,
  observations: readonly MarketDataPoint[],
): MarketHistory {
  const sortedObservations = [...observations].sort((a, b) => +a.date - +b.date);
  const latestObservation = sortedObservations[sortedObservations.length - 1],
    previousObservation = sortedObservations[sortedObservations.length - 2];
  const percentageChange =
    previousObservation?.value > 0 && latestObservation
      ? ((latestObservation.value - previousObservation.value) / previousObservation.value) * 100
      : null;
  return {
    symbol: instrument.symbol,
    name: instrument.name,
    marketType: instrument.marketType,
    observations: sortedObservations,
    latestClose: latestObservation?.value ?? null,
    latestDate: latestObservation?.date ?? null,
    changePercent:
      typeof percentageChange === 'number' && Number.isFinite(percentageChange)
        ? percentageChange
        : null,
    source: 'Alpha Vantage',
    status: sortedObservations.length ? 'success' : 'empty',
  };
}
export function normalizeStoredHistory(
  storedHistory: unknown,
  instrument: Instrument,
): MarketHistory {
  if (!isRecord(storedHistory)) throw new Error('Stored daily observations are invalid.');
  if (
    storedHistory['symbol'] !== instrument.symbol ||
    storedHistory['marketType'] !== instrument.marketType ||
    storedHistory['source'] !== 'Alpha Vantage' ||
    !['success', 'empty'].includes(String(storedHistory['status'])) ||
    !Array.isArray(storedHistory['observations'])
  )
    throw new Error('Stored daily observations do not match this instrument.');
  const unique = new Map<string, MarketDataPoint>();
  for (const row of storedHistory['observations']) {
    if (
      !isRecord(row) ||
      typeof row['date'] !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(row['date'])
    )
      continue;
    const date = new Date(row['date'] + 'T00:00:00Z');
    const rawValue = row['value'];
    if (
      (typeof rawValue !== 'number' && typeof rawValue !== 'string') ||
      String(rawValue).trim() === ''
    )
      continue;
    const value = Number(rawValue);
    if (
      Number.isFinite(+date) &&
      date.toISOString().slice(0, 10) === row['date'] &&
      Number.isFinite(value) &&
      value > 0
    )
      unique.set(row['date'], { date, value });
  }
  return createMarketHistory(instrument, [...unique.values()]);
}
