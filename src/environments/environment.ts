import { localEnvironment } from './environment.local';
// The key is necessarily public in browser bundles and Alpha Vantage requests.
// Its configured value lives in the generated Git-ignored file, never this file.
export const environment = {
  apiUrl: 'https://www.alphavantage.co/query',
  apiKey: localEnvironment.apiKey,
};
