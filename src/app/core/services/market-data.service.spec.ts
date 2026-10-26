import { STOCKS } from '../data/instruments';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { vi } from 'vitest';
import {
  ALPHA_VANTAGE_API_KEY,
  MARKET_REQUEST_INTERVAL_MS,
  MarketDataService,
} from './market-data.service';
import { MarketHistory, MarketLoadState } from '../models/market-data';
const payload = (stock = true) => ({
  [stock ? 'Time Series (Daily)' : 'Time Series FX (Daily)']: {
    '2026-10-22': { '4. close': '108.25' },
    '2026-10-20': { '4. close': '100' },
    '2026-10-21': { '4. close': '105' },
  },
});
describe('Direct Alpha Vantage service', () => {
  let service: MarketDataService, http: HttpTestingController;
  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ALPHA_VANTAGE_API_KEY, useValue: 'unit-test-key' },
        { provide: MARKET_REQUEST_INTERVAL_MS, useValue: 0 },
      ],
    });
    service = TestBed.inject(MarketDataService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify({ ignoreCancelled: true });
    sessionStorage.clear();
    vi.useRealTimers();
  });
  function stock() {
    return http.expectOne((r) => r.params.get('symbol') === 'AAPL');
  }
  it('calls the real upstream URL directly with compact daily parameters and normalizes closes', () => {
    let data: MarketHistory | undefined;
    service.getStockHistory('AAPL').subscribe((value) => (data = value));
    vi.advanceTimersByTime(1);
    const req = stock();
    expect(req.request.url).toBe('https://www.alphavantage.co/query');
    expect(req.request.params.get('function')).toBe('TIME_SERIES_DAILY');
    expect(req.request.params.get('outputsize')).toBe('compact');
    expect(req.request.params.get('apikey')).toBe('unit-test-key');
    req.flush(payload());
    expect(data?.latestClose).toBe(108.25);
    expect(data?.latestDate?.toISOString()).toBe('2026-10-22T00:00:00.000Z');
    expect(data?.changePercent).toBeCloseTo(3.095238);
    expect(data?.observations[0].value).toBe(100);
  });
  it('uses FX_DAILY with correct base and quote', () => {
    service.getForexHistory('USD', 'JPY').subscribe();
    vi.advanceTimersByTime(1);
    const req = http.expectOne((r) => r.params.get('from_symbol') === 'USD');
    expect(req.request.params.get('to_symbol')).toBe('JPY');
    expect(req.request.params.get('function')).toBe('FX_DAILY');
    req.flush(payload(false));
  });
  it('shares in-flight work and cached values, including firstValueFrom subscribers', async () => {
    const a = firstValueFrom(service.getStockHistory('AAPL')),
      b = firstValueFrom(service.getStockHistory('AAPL'));
    vi.advanceTimersByTime(1);
    stock().flush(payload());
    expect(await a).toEqual(await b);
    expect((await firstValueFrom(service.getStockHistory('AAPL'))).latestClose).toBe(108.25);
    http.expectNone(() => true);
  });
  it('persists public observations across service instances without storing the key', () => {
    service.getStockHistory('AAPL').subscribe();
    vi.advanceTimersByTime(1);
    stock().flush(payload());
    expect(JSON.stringify(sessionStorage)).not.toContain('unit-test-key');
    const restored = TestBed.runInInjectionContext(() => new MarketDataService());
    let data: MarketHistory | undefined;
    restored.getStockHistory('AAPL').subscribe((value) => (data = value));
    expect(data?.latestClose).toBe(108.25);
    http.expectNone(() => true);
  });
  it('expires daily caches after six hours', () => {
    service.getStockHistory('AAPL').subscribe();
    vi.advanceTimersByTime(1);
    stock().flush(payload());
    vi.advanceTimersByTime(6 * 60 * 60 * 1000 + 1);
    service.getStockHistory('AAPL').subscribe();
    vi.advanceTimersByTime(1);
    stock().flush(payload());
  });
  it('restores legacy cached observations and recalculates summaries instead of trusting stored ones', () => {
    sessionStorage.setItem(
      'marketdash:daily:v1:AAPL',
      JSON.stringify({
        expires: Date.now() + 60000,
        data: {
          symbol: 'AAPL',
          marketType: 'stock',
          source: 'Alpha Vantage',
          status: 'success',
          name: 'Old name',
          latestClose: 999,
          latestDate: '2020-01-01',
          changePercent: -99,
          observations: [
            { date: '2026-10-22', value: 108.25 },
            { date: '2026-10-21', value: 105 },
          ],
        },
      }),
    );
    let data: MarketHistory | undefined;
    service.getStockHistory('AAPL').subscribe((value) => (data = value));
    expect(data?.latestClose).toBe(108.25);
    expect(data?.latestDate?.toISOString()).toBe('2026-10-22T00:00:00.000Z');
    expect(data?.changePercent).toBeCloseTo(3.095238);
    expect(data?.name).toBe(service.stocks[0].name);
    http.expectNone(() => true);
  });
  it('does not cache network failures and allows a successful manual retry', () => {
    const symbols = new BehaviorSubject(STOCKS[0]);
    const states: MarketLoadState[] = [];
    const sub = service.watchMarketHistory(symbols).subscribe((state) => states.push(state));
    vi.advanceTimersByTime(201);
    stock().error(new ProgressEvent('error'));
    expect(states.at(-1)?.errorKind).toBe('network');
    expect(sessionStorage.getItem('marketdash:daily:v1:AAPL')).toBeNull();
    symbols.next(STOCKS[0]);
    expect(states.at(-1)?.status).toBe('loading');
    vi.advanceTimersByTime(201);
    stock().flush(payload());
    expect(states.at(-1)?.marketHistory?.latestClose).toBe(108.25);
    sub.unsubscribe();
  });
  it('cancels obsolete selection requests and prevents rapid switching from creating earlier calls', () => {
    const symbols = new BehaviorSubject(STOCKS[0]);
    const states: MarketLoadState[] = [];
    const sub = service.watchMarketHistory(symbols).subscribe((s) => states.push(s));
    symbols.next(STOCKS[1]);
    symbols.next(STOCKS[2]);
    vi.advanceTimersByTime(201);
    const req = http.expectOne((r) => r.params.get('symbol') === 'TSLA');
    http.expectNone((r) => r.params.get('symbol') === 'AAPL');
    symbols.next(STOCKS[0]);
    expect(req.cancelled).toBe(true);
    vi.advanceTimersByTime(201);
    stock().flush(payload());
    expect(states.at(-1)?.marketHistory?.symbol).toBe('AAPL');
    sub.unsubscribe();
  });
  it('keeps shared HTTP work until its last subscriber leaves', () => {
    const a = service.getStockHistory('AAPL').subscribe(),
      b = service.getStockHistory('AAPL').subscribe();
    vi.advanceTimersByTime(1);
    const req = stock();
    a.unsubscribe();
    expect(req.cancelled).toBe(false);
    b.unsubscribe();
    expect(req.cancelled).toBe(true);
  });
  it('handles provider rate notices, pauses requests without retry loops and permits a later manual retry', () => {
    const symbols = new BehaviorSubject(STOCKS[0]);
    let state: MarketLoadState | undefined;
    const sub = service.watchMarketHistory(symbols).subscribe((s) => (state = s));
    vi.advanceTimersByTime(201);
    stock().flush({
      Information:
        'Our standard API rate limit is 25 requests per day. Subscribe to premium plans.',
    });
    expect(state?.errorKind).toBe('rate-limit');
    expect(state?.marketHistory).toBeUndefined();
    symbols.next(STOCKS[0]);
    vi.advanceTimersByTime(201);
    http.expectNone(() => true);
    vi.advanceTimersByTime(15 * 60000 + 1);
    symbols.next(STOCKS[0]);
    vi.advanceTimersByTime(201);
    stock().flush(payload());
    expect(state?.status).toBe('success');
    sub.unsubscribe();
  });
  it('shows safe network failures without including request URLs or credentials', () => {
    let state: MarketLoadState | undefined;
    service.watchMarketHistory(new BehaviorSubject(STOCKS[0])).subscribe((s) => (state = s));
    vi.advanceTimersByTime(201);
    stock().error(new ProgressEvent('error'));
    expect(state?.errorKind).toBe('network');
    expect(state?.message).toContain('CORS');
    expect(state?.message).not.toContain('unit-test-key');
    expect(state?.marketHistory).toBeUndefined();
  });
  it('caches denied access errors without paid or fabricated fallback', () => {
    const messages: string[] = [];
    service.getStockHistory('AAPL').subscribe({ error: (e) => messages.push(e.message) });
    vi.advanceTimersByTime(1);
    stock().flush({ Information: 'This is a premium endpoint.' });
    service.getStockHistory('AAPL').subscribe({ error: (e) => messages.push(e.message) });
    http.expectNone(() => true);
    expect(messages.length).toBe(2);
    expect(messages[0]).toContain('free-tier');
  });
  it('rejects unsupported instruments without making a request', () => {
    service.getStockHistory('IBM').subscribe({ error: () => {} });
    vi.advanceTimersByTime(1);
    http.expectNone(() => true);
  });
});
describe('Direct request pacing', () => {
  it('spaces different instruments by 1.2 seconds and allows canceling queued work', () => {
    vi.useFakeTimers();
    sessionStorage.clear();
    try {
      TestBed.configureTestingModule({
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          { provide: ALPHA_VANTAGE_API_KEY, useValue: 'unit-test-key' },
        ],
      });
      const service = TestBed.inject(MarketDataService),
        http = TestBed.inject(HttpTestingController);
      const a = service.getStockHistory('AAPL').subscribe(),
        b = service.getStockHistory('MSFT').subscribe();
      vi.advanceTimersByTime(0);
      http.expectOne((r) => r.params.get('symbol') === 'AAPL').flush(payload());
      http.expectNone((r) => r.params.get('symbol') === 'MSFT');
      vi.advanceTimersByTime(1199);
      http.expectNone((r) => r.params.get('symbol') === 'MSFT');
      b.unsubscribe();
      vi.advanceTimersByTime(1);
      http.expectNone((r) => r.params.get('symbol') === 'MSFT');
      a.unsubscribe();
      http.verify();
    } finally {
      sessionStorage.clear();
      vi.useRealTimers();
    }
  });
});

describe('Queued request cooldown', () => {
  it('does not extend a short-term cooldown when another queued request is suppressed', () => {
    vi.useFakeTimers();
    sessionStorage.clear();
    try {
      TestBed.configureTestingModule({
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          { provide: ALPHA_VANTAGE_API_KEY, useValue: 'unit-test-key' },
        ],
      });
      const service = TestBed.inject(MarketDataService),
        http = TestBed.inject(HttpTestingController);
      service.getStockHistory('AAPL').subscribe({ error: () => {} });
      service.getForexHistory('EUR', 'USD').subscribe({ error: () => {} });
      vi.advanceTimersByTime(0);
      http
        .expectOne((r) => r.params.get('symbol') === 'AAPL')
        .flush({ Note: 'One request per second is allowed.' });
      vi.advanceTimersByTime(1200);
      http.expectNone(() => true);
      vi.advanceTimersByTime(60000);
      service.getForexHistory('EUR', 'USD').subscribe({ error: () => {} });
      vi.advanceTimersByTime(1);
      http.expectOne((r) => r.params.get('from_symbol') === 'EUR').flush(payload(false));
      http.verify();
    } finally {
      sessionStorage.clear();
      vi.useRealTimers();
    }
  });
});
