import { By } from '@angular/platform-browser';
import { HistoricalDataTableComponent } from '../historical-data-table/historical-data-table.component';
import { MarketType } from '../../../core/enums/market-type';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { InstrumentWorkspaceComponent } from './instrument-workspace.component';
import { STOCKS, FOREX } from '../../../core/data/instruments';
import {
  ALPHA_VANTAGE_API_KEY,
  MARKET_REQUEST_INTERVAL_MS,
} from '../../../core/services/market-data.service';
import { NotificationService } from '../../../core/services/notification.service';
const payload = (stock: boolean, value: number) => ({
  [stock ? 'Time Series (Daily)' : 'Time Series FX (Daily)']: {
    '2026-10-21': { '4. close': String(value - 0.1) },
    '2026-10-22': { '4. close': String(value) },
  },
});
describe('Direct API workspace states', () => {
  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      imports: [InstrumentWorkspaceComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ALPHA_VANTAGE_API_KEY, useValue: 'unit-test-key' },
        { provide: MARKET_REQUEST_INTERVAL_MS, useValue: 0 },
      ],
    });
  });
  afterEach(() => TestBed.inject(HttpTestingController).verify({ ignoreCancelled: true }));
  async function render(marketType: MarketType) {
    const view = TestBed.createComponent(InstrumentWorkspaceComponent);
    view.componentRef.setInput('marketType', marketType);
    view.componentRef.setInput('instruments', marketType === MarketType.Stock ? STOCKS : FOREX);
    view.detectChanges();
    const element = view.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Loading daily market history');
    await new Promise((r) => setTimeout(r, 250));
    return { view, element, http: TestBed.inject(HttpTestingController) };
  }
  it('updates summary, chart, dates and table from direct stock responses', async () => {
    const { view, element, http } = await render(MarketType.Stock);
    http.expectOne((r) => r.params.get('symbol') === 'AAPL').flush(payload(true, 108.25));
    view.detectChanges();
    await view.whenStable();
    expect(element.textContent).toContain('Oct 22, 2026');
    expect(element.querySelector('[data-testid="summary-value"]')?.textContent).toContain(
      '$108.25',
    );
    const select = element.querySelector('select')!;
    select.value = 'TSLA';
    select.dispatchEvent(new Event('change'));
    view.detectChanges();
    expect(element.textContent).not.toContain('$108.25');
    await new Promise((r) => setTimeout(r, 250));
    http.expectOne((r) => r.params.get('symbol') === 'TSLA').flush(payload(true, 220.5));
    view.detectChanges();
    await view.whenStable();
    expect(element.querySelector('tbody tr td')?.textContent).toContain('$220.50');
    expect(element.querySelector('app-market-chart')?.textContent).toContain('TSLA');
    expect(TestBed.inject(NotificationService).toasts().length).toBe(0);
  });
  it('keeps rate limits inline and in one warning without opening a modal or substituting prices', async () => {
    const { view, element, http } = await render(MarketType.Forex);
    http
      .expectOne((r) => r.params.get('from_symbol') === 'EUR')
      .flush({
        Information:
          'Our standard API rate limit is 25 requests per day. Subscribe to premium plans.',
      });
    view.detectChanges();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain('request allowance');
    expect(
      TestBed.inject(NotificationService)
        .toasts()
        .map((t) => t.type),
    ).toEqual(['warning']);
    expect(element.querySelector('dialog')?.open).toBe(false);
    expect(element.querySelector('path.price-line')).toBeNull();
    element.querySelector<HTMLButtonElement>('button.primary-button')!.click();
    await new Promise((r) => setTimeout(r, 250));
    view.detectChanges();
    http.expectNone(() => true);
    expect(TestBed.inject(NotificationService).toasts().length).toBe(1);
  });
  it('shows an empty FX history with clear base and quote currencies', async () => {
    const { view, element, http } = await render(MarketType.Forex);
    http
      .expectOne((r) => r.params.get('from_symbol') === 'EUR')
      .flush({ 'Time Series FX (Daily)': {} });
    view.detectChanges();
    await view.whenStable();
    expect(element.textContent).toContain('No chart data available');
    expect(element.textContent).toContain('Base: EUR / Quote: USD');
    expect(TestBed.inject(NotificationService).toasts().length).toBe(0);
  });
  for (const marketType of [MarketType.Stock, MarketType.Forex]) {
    it(
      'paginates 100 loaded ' +
        marketType +
        ' records without HTTP and resets on instrument changes',
      async () => {
        const { view, element, http } = await render(marketType);
        const stock = marketType === MarketType.Stock;
        const series = Object.fromEntries(
          Array.from({ length: 100 }, (_, index) => [
            new Date(Date.UTC(2026, 0, index + 1)).toISOString().slice(0, 10),
            { '4. close': String(100 + index) },
          ]),
        );
        const response = { [stock ? 'Time Series (Daily)' : 'Time Series FX (Daily)']: series };
        http.expectOne(() => true).flush(response);
        view.detectChanges();
        await view.whenStable();
        const table = view.debugElement.query(By.directive(HistoricalDataTableComponent))
          .componentInstance as HistoricalDataTableComponent;
        expect(element.querySelectorAll('tbody tr').length).toBe(10);
        const next = Array.from(element.querySelectorAll('app-historical-data-table button')).find(
          (b) => b.textContent?.trim() === 'Next',
        ) as HTMLButtonElement;
        next.click();
        view.detectChanges();
        expect(table.currentPage).toBe(2);
        const size = element.querySelector<HTMLSelectElement>('app-historical-data-table select')!;
        size.value = '20';
        size.dispatchEvent(new Event('change'));
        view.detectChanges();
        expect(table.totalPages).toBe(5);
        expect(element.querySelectorAll('tbody tr').length).toBe(20);
        table.changePage(5);
        view.detectChanges();
        await new Promise((r) => setTimeout(r, 250));
        http.expectNone(() => true);
        expect(view.componentInstance.history.length).toBe(100);
        const instruments = stock ? STOCKS : FOREX;
        view.componentInstance.selectInstrument(instruments[1].symbol);
        view.detectChanges();
        expect(table.currentPage).toBe(1);
        await new Promise((r) => setTimeout(r, 250));
        http.expectOne(() => true).flush(response);
        view.detectChanges();
        await view.whenStable();
        table.changePage(3);
        view.detectChanges();
        view.componentInstance.selectInstrument(instruments[0].symbol);
        view.detectChanges();
        await new Promise((r) => setTimeout(r, 250));
        view.detectChanges();
        expect(table.currentPage).toBe(1);
        expect(table.totalRecords).toBe(100);
        http.expectNone(() => true);
      },
    );
  }
});
