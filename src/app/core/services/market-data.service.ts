import { environment } from '../../../environments/environment';
import { Injectable, InjectionToken, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import {
  Observable,
  catchError,
  defer,
  finalize,
  map,
  of,
  shareReplay,
  startWith,
  switchMap,
  tap,
  throwError,
  timer,
} from 'rxjs';
import { STOCKS, FOREX } from '../data/instruments';
import { MarketType } from '../enums/market-type';
import { Instrument, MarketHistory, MarketLoadState } from '../models/market-data';
import { MarketDataError, parseAlphaVantage } from './alpha-vantage-parser';
import { normalizeStoredHistory } from './market-data-normalizer';
export const ALPHA_VANTAGE_API_KEY = new InjectionToken<string>('Alpha Vantage browser key', {
  providedIn: 'root',
  factory: () => environment.apiKey,
});
export const MARKET_REQUEST_INTERVAL_MS = new InjectionToken<number>('market request interval', {
  providedIn: 'root',
  factory: () => 1200,
});
const CACHE_MS = 6 * 60 * 60 * 1000;
const STORAGE_PREFIX = 'marketdash:daily:v1:';
@Injectable({ providedIn: 'root' })
export class MarketDataService {
  private http = inject(HttpClient);
  private apiKey = inject(ALPHA_VANTAGE_API_KEY);
  private requestInterval = inject(MARKET_REQUEST_INTERVAL_MS);
  readonly stocks = STOCKS;
  readonly forex = FOREX;
  private cache = new Map<string, { expires: number; marketHistory: MarketHistory }>();
  private inFlight = new Map<string, Observable<MarketHistory>>();
  private failures = new Map<string, { expires: number; error: MarketDataError }>();
  private nextRequestAt = 0;
  private limitedUntil = 0;
  constructor() {
    try {
      const until = Number(sessionStorage.getItem(STORAGE_PREFIX + 'cooldown'));
      if (Number.isFinite(until) && until > Date.now()) this.limitedUntil = until;
    } catch {
      /* Storage may be disabled; in-memory caching still works. */
    }
  }
  getStockHistory(stockSymbol: string): Observable<MarketHistory> {
    const instrument = this.stocks.find((stock) => stock.symbol === stockSymbol);
    return this.getMarketHistory(instrument);
  }
  getForexHistory(fromCurrency: string, toCurrency: string): Observable<MarketHistory> {
    const instrument = this.forex.find(
      (currencyPair) =>
        currencyPair.baseCurrency === fromCurrency && currencyPair.quoteCurrency === toCurrency,
    );
    return this.getMarketHistory(instrument);
  }
  private getMarketHistory(instrument: Instrument | undefined): Observable<MarketHistory> {
    if (!instrument)
      return throwError(
        () => new MarketDataError('INVALID_RESPONSE', 'Choose a supported stock or currency pair.'),
      );
    const instrumentSymbol = instrument.symbol;
    return defer(() => {
      const cached = this.getCachedMarketHistory(instrument);
      if (cached) return of(cached);
      const failure = this.failures.get(instrumentSymbol);
      if (failure && failure.expires > Date.now()) return throwError(() => failure.error);
      if (this.limitedUntil > Date.now()) return throwError(() => this.createRateLimitError());
      const pending = this.inFlight.get(instrumentSymbol);
      if (pending) return pending;
      const stream = this.fetchHistory(instrument).pipe(
        tap((marketHistory) => this.saveMarketHistoryToCache(marketHistory)),
        catchError((error) => throwError(() => this.recordFailure(instrumentSymbol, error))),
        finalize(() => {
          if (this.inFlight.get(instrumentSymbol) === stream)
            this.inFlight.delete(instrumentSymbol);
        }),
        shareReplay({ bufferSize: 1, refCount: true }),
      );
      this.inFlight.set(instrumentSymbol, stream);
      return stream;
    });
  }
  watchMarketHistory(instruments: Observable<Instrument>): Observable<MarketLoadState> {
    return instruments.pipe(
      switchMap((instrument) =>
        timer(200).pipe(
          switchMap(() => {
            if (instrument.marketType === MarketType.Stock)
              return this.getStockHistory(instrument.symbol);
            return this.getForexHistory(instrument.baseCurrency!, instrument.quoteCurrency!);
          }),
          map((marketHistory): MarketLoadState => ({
            status: marketHistory.status,
            marketHistory,
          })),
          catchError((error) => {
            const marketError = this.normalizeApiError(error);
            let errorKind: MarketLoadState['errorKind'] = 'unavailable';
            if (marketError.code === 'RATE_LIMIT') errorKind = 'rate-limit';
            else if (marketError.code === 'NETWORK_ERROR') errorKind = 'network';
            return of<MarketLoadState>({
              status: 'error',
              message: marketError.message,
              errorKind,
            });
          }),
          startWith<MarketLoadState>({ status: 'loading' }),
        ),
      ),
    );
  }
  private fetchHistory(instrument: Instrument): Observable<MarketHistory> {
    if (!this.apiKey)
      return throwError(
        () =>
          new MarketDataError(
            'NOT_CONFIGURED',
            'The Alpha Vantage key is not configured. Set ALPHA_VANTAGE_API_KEY and rebuild the application.',
          ),
      );
    let params = new HttpParams()
      .set(
        'function',
        instrument.marketType === MarketType.Stock ? 'TIME_SERIES_DAILY' : 'FX_DAILY',
      )
      .set('outputsize', 'compact')
      .set('apikey', this.apiKey);
    if (instrument.marketType === MarketType.Stock)
      params = params.set('symbol', instrument.symbol);
    else
      params = params
        .set('from_symbol', instrument.baseCurrency!)
        .set('to_symbol', instrument.quoteCurrency!);
    const now = Date.now(),
      delay = Math.max(0, this.nextRequestAt - now);
    this.nextRequestAt = Math.max(now, this.nextRequestAt) + this.requestInterval;
    // Unsubscription cancels both queued timers and active HTTP requests.
    return timer(delay).pipe(
      switchMap(() =>
        this.limitedUntil > Date.now()
          ? throwError(() => this.createRateLimitError())
          : this.http.get<unknown>(environment.apiUrl, {
              params,
              headers: { Accept: 'application/json' },
            }),
      ),
      map((response) => parseAlphaVantage(response, instrument)),
    );
  }
  private getCachedMarketHistory(instrument: Instrument): MarketHistory | undefined {
    const cached = this.cache.get(instrument.symbol);
    if (cached && cached.expires > Date.now()) return cached.marketHistory;
    try {
      const stored: unknown = JSON.parse(
        sessionStorage.getItem(STORAGE_PREFIX + instrument.symbol) || 'null',
      );
      if (
        stored !== null &&
        typeof stored === 'object' &&
        'expires' in stored &&
        typeof stored.expires === 'number' &&
        'data' in stored &&
        Number.isFinite(stored.expires) &&
        stored.expires > Date.now() &&
        stored.expires <= Date.now() + CACHE_MS
      ) {
        const marketHistory = normalizeStoredHistory(stored.data, instrument);
        this.cache.set(instrument.symbol, { marketHistory, expires: stored.expires });
        return marketHistory;
      }
    } catch {
      /* Ignore invalid or unavailable session storage. */
    }
    return undefined;
  }
  private saveMarketHistoryToCache(marketHistory: MarketHistory): void {
    const expires = Date.now() + (marketHistory.status === 'empty' ? 5 * 60000 : CACHE_MS);
    this.cache.set(marketHistory.symbol, { marketHistory, expires });
    try {
      sessionStorage.setItem(
        STORAGE_PREFIX + marketHistory.symbol,
        JSON.stringify({
          expires,
          // Keep the persisted shape compatible with existing session caches.
          data: {
            symbol: marketHistory.symbol,
            marketType: marketHistory.marketType,
            source: marketHistory.source,
            status: marketHistory.status,
            observations: marketHistory.observations.map((point) => ({
              date: point.date.toISOString().slice(0, 10),
              value: point.value,
            })),
          },
        }),
      );
    } catch {
      /* Quota/privacy restrictions leave the in-memory cache available. */
    }
  }
  private recordFailure(symbol: string, error: unknown): MarketDataError {
    const marketError = this.normalizeApiError(error);
    if (marketError.code === 'RATE_LIMIT' && this.limitedUntil <= Date.now()) {
      this.limitedUntil =
        Date.now() + (marketError.limitScope === 'short-term' ? 60000 : 15 * 60000);
      try {
        sessionStorage.setItem(STORAGE_PREFIX + 'cooldown', String(this.limitedUntil));
      } catch {
        /* Optional storage. */
      }
    }
    if (marketError.code === 'ACCESS_DENIED' || marketError.code === 'INVALID_API_KEY')
      this.failures.set(symbol, { error: marketError, expires: Date.now() + 15 * 60000 });
    return marketError;
  }
  private createRateLimitError() {
    return new MarketDataError(
      'RATE_LIMIT',
      'Alpha Vantage has reached its request allowance. Cached instruments may still be available. Please wait before retrying; the daily allowance may take longer to reset.',
    );
  }
  private normalizeApiError(error: unknown): MarketDataError {
    if (error instanceof MarketDataError) return error;
    if (error instanceof HttpErrorResponse) {
      if (error.status === 429) return this.createRateLimitError();
      if (error.status === 0)
        return new MarketDataError(
          'NETWORK_ERROR',
          'Alpha Vantage could not be reached. Check your connection. Browser CORS restrictions can also block direct requests.',
        );
      if (error.status === 401)
        return new MarketDataError(
          'INVALID_API_KEY',
          'Alpha Vantage rejected the API key. Check the configured key and rebuild.',
        );
      if (error.status === 403)
        return new MarketDataError(
          'ACCESS_DENIED',
          'Alpha Vantage denied access to this daily series. No paid endpoint or replacement prices will be used.',
        );
      if (error.status === 200)
        return new MarketDataError(
          'INVALID_RESPONSE',
          'Alpha Vantage returned invalid JSON instead of daily history.',
        );
    }
    // HttpErrorResponse.message contains the request URL/key: never display it.
    return new MarketDataError(
      'UNAVAILABLE',
      'Daily market data is temporarily unavailable. Please try again later.',
    );
  }
}
