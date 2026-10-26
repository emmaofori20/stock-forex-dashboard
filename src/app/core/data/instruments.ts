import { MarketType } from '../enums/market-type';
import { Instrument } from '../models/market-data';
export const STOCKS: readonly Instrument[] = [
  { name: 'Apple', symbol: 'AAPL', marketType: MarketType.Stock, category: 'US equity', mark: 'A' },
  {
    name: 'Microsoft',
    symbol: 'MSFT',
    marketType: MarketType.Stock,
    category: 'US equity',
    mark: 'M',
  },
  { name: 'Tesla', symbol: 'TSLA', marketType: MarketType.Stock, category: 'US equity', mark: 'T' },
];
export const FOREX: readonly Instrument[] = [
  {
    name: 'Euro / US Dollar',
    symbol: 'EUR/USD',
    marketType: MarketType.Forex,
    category: 'Currency pair',
    mark: 'EUR',
    baseCurrency: 'EUR',
    quoteCurrency: 'USD',
  },
  {
    name: 'British Pound / US Dollar',
    symbol: 'GBP/USD',
    marketType: MarketType.Forex,
    category: 'Currency pair',
    mark: 'GBP',
    baseCurrency: 'GBP',
    quoteCurrency: 'USD',
  },
  {
    name: 'US Dollar / Japanese Yen',
    symbol: 'USD/JPY',
    marketType: MarketType.Forex,
    category: 'Currency pair',
    mark: 'USD',
    baseCurrency: 'USD',
    quoteCurrency: 'JPY',
  },
];
