import { MarketType } from '../enums/market-type';
import { parseAlphaVantage, MarketDataError } from './alpha-vantage-parser';
import { normalizeStoredHistory } from './market-data-normalizer';
import { STOCKS, FOREX } from '../data/instruments';
describe('Direct Alpha Vantage response parser', () => {
  it('parses both daily shapes chronologically and derives the latest observation and percentage change', () => {
    for (const instrument of [STOCKS[0], FOREX[0]]) {
      const data = parseAlphaVantage(
        {
          [instrument.marketType === MarketType.Stock
            ? 'Time Series (Daily)'
            : 'Time Series FX (Daily)']: {
            '2026-10-23': { '4. close': '108.25' },
            '2026-10-21': { '4. close': '100' },
            '2026-10-22': { '4. close': '105' },
          },
        },
        instrument,
      );
      expect(data.symbol).toBe(instrument.symbol);
      expect(data.source).toBe('Alpha Vantage');
      expect(data.observations[0].value).toBe(100);
      expect(data.latestClose).toBe(108.25);
      expect(data.latestDate?.toISOString()).toBe('2026-10-23T00:00:00.000Z');
      expect(data.changePercent).toBeCloseTo(((108.25 - 105) / 105) * 100);
    }
  });
  it('rejects invalid dates and nonpositive or malformed closing values safely', () => {
    const data = parseAlphaVantage(
      {
        'Time Series (Daily)': {
          '2026-02-30': { '4. close': '1' },
          '2026-10-20': { '4. close': '0' },
          '2026-10-21': { '4. close': 'NaN' },
          '2026-10-22': { '4. close': '0x10' },
          '2026-10-23': { '4. close': '-3' },
          '2026-10-24': { '4. close': '108.125' },
        },
      },
      STOCKS[0],
    );
    expect(data.observations.length).toBe(1);
    expect(data.latestClose).toBe(108.125);
    expect(data.changePercent).toBeNull();
  });
  it('distinguishes empty history from missing or invalid responses', () => {
    expect(parseAlphaVantage({ 'Time Series (Daily)': {} }, STOCKS[0]).status).toBe('empty');
    for (const response of [null, [], {}, 'html'])
      expect(() => parseAlphaVantage(response, STOCKS[0])).toThrow(MarketDataError);
  });
  it('classifies rate notices despite premium upsells and explicit premium denials despite quota advertising', () => {
    for (const [notice, code] of [
      [
        'Our standard API rate limit is 25 requests per day. Subscribe to premium plans.',
        'RATE_LIMIT',
      ],
      ['This is a premium endpoint. Subscribe to remove daily rate limits.', 'ACCESS_DENIED'],
      ['The API key provided is invalid: fixture-private-value', 'INVALID_API_KEY'],
    ]) {
      try {
        parseAlphaVantage({ Information: notice }, STOCKS[0]);
        expect.unreachable();
      } catch (error) {
        expect(error).toBeInstanceOf(MarketDataError);
        expect((error as MarketDataError).code).toBe(code);
        expect((error as Error).message).not.toContain('fixture-private-value');
      }
    }
  });
  it('does not mislabel provider observations for another stock or currency pair', () => {
    expect(() =>
      parseAlphaVantage(
        { 'Meta Data': { '2. Symbol': 'MSFT' }, 'Time Series (Daily)': {} },
        STOCKS[0],
      ),
    ).toThrow();
    expect(() =>
      parseAlphaVantage(
        {
          'Meta Data': { '2. From Symbol': 'GBP', '3. To Symbol': 'USD' },
          'Time Series FX (Daily)': {},
        },
        FOREX[0],
      ),
    ).toThrow();
  });
  it('validates cached data source and symbol before restoring it', () => {
    expect(() =>
      normalizeStoredHistory(
        {
          symbol: 'MSFT',
          marketType: MarketType.Stock,
          source: 'Alpha Vantage',
          status: 'success',
          observations: [],
        },
        STOCKS[0],
      ),
    ).toThrow();
    expect(() =>
      normalizeStoredHistory(
        {
          symbol: 'AAPL',
          marketType: MarketType.Stock,
          source: 'Other',
          status: 'success',
          observations: [],
        },
        STOCKS[0],
      ),
    ).toThrow();
  });
});
