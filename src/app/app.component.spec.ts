import { environment } from '../environments/environment';
import {
  ALPHA_VANTAGE_API_KEY,
  MARKET_REQUEST_INTERVAL_MS,
} from './core/services/market-data.service';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { Router } from '@angular/router';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { App } from './app.component';
import { AppModule } from './app.module';

// Test-only HTTP responses; never imported by the application or bundled for users.
const values: Record<string, number> = {
  AAPL: 101,
  MSFT: 202,
  TSLA: 303,
  'EUR/USD': 1.101,
  'GBP/USD': 1.202,
  'USD/JPY': 151.303,
};
describe('MarketDash API-only navigation', () => {
  beforeEach(async () => {
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [AppModule],
      providers: [
        provideHttpClientTesting(),
        { provide: ALPHA_VANTAGE_API_KEY, useValue: 'unit-test-key' },
        { provide: MARKET_REQUEST_INTERVAL_MS, useValue: 0 },
      ],
    }).compileComponents();
  });
  afterEach(() => TestBed.inject(HttpTestingController).verify({ ignoreCancelled: true }));
  async function settle(fixture: ComponentFixture<App>) {
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 250));
    for (const request of TestBed.inject(HttpTestingController).match(
      (request) => request.url === environment.apiUrl,
    )) {
      const params = request.request.params;
      const symbol =
        params.get('symbol') || params.get('from_symbol') + '/' + params.get('to_symbol');
      const value = values[symbol];
      request.flush({
        [params.get('function') === 'TIME_SERIES_DAILY'
          ? 'Time Series (Daily)'
          : 'Time Series FX (Daily)']: {
          '2026-10-22': { '4. close': String(value * 0.99) },
          '2026-10-23': { '4. close': String(value) },
        },
      });
    }
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }
  async function render(url: string) {
    const fixture = TestBed.createComponent(App),
      router = TestBed.inject(Router);
    await router.navigateByUrl(url);
    await settle(fixture);
    return { fixture, router, element: fixture.nativeElement as HTMLElement };
  }
  it('renders overview cards and chart using HTTP responses with no demonstration mode', async () => {
    const { element } = await render('/');
    expect(element.querySelector('h1')?.textContent).toContain('Market Overview');
    expect(element.querySelectorAll('app-toast-container').length).toBe(1);
    expect(element.querySelectorAll('app-price-card').length).toBe(3);
    expect(element.textContent).toContain('Alpha Vantage');
    expect(element.textContent).not.toContain('Sample data');
    expect(element.querySelector('path.price-line')).toBeTruthy();
  });
  for (const path of ['/stocks', '/forex']) {
    it('supports direct navigation, route titles and active links for ' + path, async () => {
      const { element } = await render(path);
      const title = path === '/stocks' ? 'Stocks' : 'Forex';
      expect(element.querySelector('h1')?.textContent).toBe(title);
      expect(element.querySelector('app-navbar')?.textContent).toContain(title);
      expect(element.querySelector('a[aria-current="page"]')?.textContent).toContain(title);
      expect(element.querySelectorAll('tbody tr').length).toBe(2);
    });
    it('keeps all selected instruments synchronized with API responses on ' + path, async () => {
      const { fixture, element } = await render(path);
      const select = element.querySelector('select')!;
      for (const option of Array.from(select.options)) {
        select.value = option.value;
        select.dispatchEvent(new Event('change'));
        await settle(fixture);
        const summary = element.querySelector('[data-testid="summary-value"]')?.textContent?.trim();
        expect(summary).toBe(element.querySelector('tbody tr td')?.textContent?.trim());
        expect(element.querySelector('app-market-chart')?.textContent).toContain(option.value);
        expect(element.querySelectorAll('path.price-line').length).toBe(1);
        expect(element.querySelectorAll('tbody tr').length).toBe(2);
      }
    });
  }
  it('redirects unknown paths to overview', async () => {
    const { router, element } = await render('/unknown');
    expect(router.url).toBe('/');
    expect(element.querySelector('h1')?.textContent).toContain('Market Overview');
  });
  it('opens and closes mobile navigation and restores focus', async () => {
    const { fixture, element } = await render('/');
    const toggle = element.querySelector<HTMLButtonElement>(
      'button[aria-label="Open navigation"]',
    )!;
    toggle.focus();
    toggle.click();
    fixture.detectChanges();
    expect(element.querySelector('[role="dialog"]')).toBeTruthy();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(element.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(toggle);
  });
  it('closes mobile navigation after selecting a route', async () => {
    const { fixture, element } = await render('/');
    element.querySelector<HTMLButtonElement>('button[aria-label="Open navigation"]')!.click();
    fixture.detectChanges();
    element.querySelector<HTMLAnchorElement>('[role="dialog"] a[href="/stocks"]')!.click();
    await settle(fixture);
    expect(element.querySelector('[role="dialog"]')).toBeNull();
    expect(element.querySelector('h1')?.textContent).toBe('Stocks');
  });
});
