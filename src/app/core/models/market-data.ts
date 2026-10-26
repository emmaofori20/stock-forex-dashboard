import { MarketType } from '../enums/market-type';

export interface MarketDataPoint {
  readonly date: Date;
  readonly value: number;
}

export function formatMarketValue(
  value: number,
  marketType: MarketType,
  symbol: string,
  precisionMode: 'standard' | 'exact' = 'standard',
): string {
  let precision = 2;
  if (marketType === MarketType.Forex) precision = symbol.endsWith('/JPY') ? 3 : 4;
  return new Intl.NumberFormat('en-US', {
    ...(marketType === MarketType.Stock ? { style: 'currency', currency: 'USD' } : {}),
    minimumFractionDigits: precision,
    maximumFractionDigits: precisionMode === 'exact' ? 8 : precision,
  }).format(value);
}
export function formatMarketDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export interface Instrument {
  readonly name: string;
  readonly symbol: string;
  readonly marketType: MarketType;
  readonly category: string;
  readonly mark: string;
  readonly baseCurrency?: string;
  readonly quoteCurrency?: string;
}
export interface MarketHistory {
  readonly symbol: string;
  readonly name: string;
  readonly marketType: MarketType;
  readonly observations: readonly MarketDataPoint[];
  readonly latestClose: number | null;
  readonly latestDate: Date | null;
  readonly changePercent: number | null;
  readonly source: 'Alpha Vantage';
  readonly status: 'success' | 'empty';
}
export interface MarketLoadState {
  readonly status: 'loading' | 'success' | 'empty' | 'error';
  readonly marketHistory?: MarketHistory;
  readonly message?: string;
  readonly errorKind?: 'rate-limit' | 'network' | 'unavailable';
}
