import { MarketType } from '../enums/market-type';
import { Instrument, MarketHistory } from '../models/market-data';
import { createMarketHistory } from './market-data-normalizer';
export type MarketErrorCode =
  | 'RATE_LIMIT'
  | 'INVALID_API_KEY'
  | 'ACCESS_DENIED'
  | 'INVALID_RESPONSE'
  | 'PROVIDER_ERROR'
  | 'NOT_CONFIGURED'
  | 'NETWORK_ERROR'
  | 'UNAVAILABLE';
export class MarketDataError extends Error {
  constructor(
    readonly code: MarketErrorCode,
    message: string,
    readonly limitScope: 'short-term' | 'daily' | 'unspecified' = 'unspecified',
  ) {
    super(message);
  }
}
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
export function parseAlphaVantage(response: unknown, instrument: Instrument): MarketHistory {
  if (!isRecord(response))
    throw new MarketDataError(
      'INVALID_RESPONSE',
      'Alpha Vantage returned an invalid response. Please try again later.',
    );
  const notice = String(
    response['Note'] ?? response['Information'] ?? response['Error Message'] ?? '',
  );
  if (
    /invalid.{0,30}(api.?key|apikey)|(api.?key|apikey).{0,30}(invalid|not valid)|missing.{0,20}(api.?key|apikey)/i.test(
      notice,
    )
  )
    throw new MarketDataError(
      'INVALID_API_KEY',
      'Alpha Vantage rejected the API key. Check the configured key and rebuild the application.',
    );
  if (
    /premium[- ]only|premium endpoint|endpoint.{0,40}(requires|available.{0,20}premium)/i.test(
      notice,
    )
  )
    throw new MarketDataError(
      'ACCESS_DENIED',
      'Alpha Vantage denied access to this daily series. MarketDash uses free-tier endpoints only; no paid endpoint is requested.',
    );
  if (
    response['Note'] ||
    /rate.?limit|frequency|requests per|call volume|limit.*reach/i.test(notice)
  ) {
    let limitScope: MarketDataError['limitScope'] = 'unspecified';
    if (/per second|per minute|minute.*limit|second.*limit/i.test(notice))
      limitScope = 'short-term';
    else if (/per day|daily/i.test(notice)) limitScope = 'daily';
    throw new MarketDataError(
      'RATE_LIMIT',
      'Alpha Vantage has reached its request allowance. Cached instruments may still be available. Please wait before retrying; the daily allowance may take longer to reset.',
      limitScope,
    );
  }
  if (/premium|subscription|entitlement/i.test(notice))
    throw new MarketDataError(
      'ACCESS_DENIED',
      'Alpha Vantage denied access to this daily series. No paid endpoint or replacement prices will be used.',
    );
  if (response['Information'] || response['Error Message'])
    throw new MarketDataError(
      'PROVIDER_ERROR',
      'Alpha Vantage could not provide this instrument. Check the configured key and endpoint access.',
    );
  const metadata = response['Meta Data'];
  if (isRecord(metadata)) {
    let instrumentMismatch: boolean;
    if (instrument.marketType === MarketType.Stock) {
      const responseSymbol = metadata['2. Symbol'];
      instrumentMismatch = Boolean(responseSymbol) && responseSymbol !== instrument.symbol;
    } else {
      const responseFromCurrency = metadata['2. From Symbol'];
      const responseToCurrency = metadata['3. To Symbol'];
      instrumentMismatch =
        (Boolean(responseFromCurrency) && responseFromCurrency !== instrument.baseCurrency) ||
        (Boolean(responseToCurrency) && responseToCurrency !== instrument.quoteCurrency);
    }
    if (instrumentMismatch)
      throw new MarketDataError(
        'INVALID_RESPONSE',
        'Alpha Vantage returned a different instrument. No replacement prices are shown.',
      );
  }
  const series =
    response[
      instrument.marketType === MarketType.Stock ? 'Time Series (Daily)' : 'Time Series FX (Daily)'
    ];
  if (!isRecord(series))
    throw new MarketDataError(
      'INVALID_RESPONSE',
      'Daily observations are missing from the Alpha Vantage response. Please try again later.',
    );
  const points = Object.entries(series).flatMap(([day, row]) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !isRecord(row)) return [];
    const date = new Date(day + 'T00:00:00Z'),
      rawClose = row['4. close'];
    if (
      !Number.isFinite(+date) ||
      date.toISOString().slice(0, 10) !== day ||
      (typeof rawClose !== 'number' && typeof rawClose !== 'string') ||
      !/^\d+(?:\.\d+)?$/.test(String(rawClose).trim())
    )
      return [];
    const value = Number(rawClose);
    return Number.isFinite(value) && value > 0 ? [{ date, value }] : [];
  });
  return createMarketHistory(instrument, points);
}
