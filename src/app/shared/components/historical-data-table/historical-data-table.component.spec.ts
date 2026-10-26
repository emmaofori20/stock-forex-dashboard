import { TestBed } from '@angular/core/testing';
import { HistoricalDataTableComponent } from './historical-data-table.component';
import { MarketType } from '../../../core/enums/market-type';

const observations = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    date: new Date(Date.UTC(2026, 0, index + 1)),
    value: index + 1,
  }));

describe('Historical data pagination', () => {
  function render(count = 100) {
    const view = TestBed.createComponent(HistoricalDataTableComponent);
    const data = observations(count);
    view.componentRef.setInput('observations', data);
    view.componentRef.setInput('marketType', MarketType.Stock);
    view.componentRef.setInput('symbol', 'AAPL');
    view.detectChanges();
    return {
      view,
      table: view.componentInstance,
      element: view.nativeElement as HTMLElement,
      data,
    };
  }
  it('shows ten newest records without mutating the source and navigates with buttons', () => {
    const { view, table, element, data } = render();
    expect(table.totalPages).toBe(10);
    expect(element.querySelectorAll('tbody tr').length).toBe(10);
    expect(table.visibleRecords.map((p) => p.value)).toEqual([
      100, 99, 98, 97, 96, 95, 94, 93, 92, 91,
    ]);
    expect(data[0].value).toBe(1);
    expect(element.textContent).toContain('Showing 1–10 of 100 records');
    const button = (label: string) =>
      Array.from(element.querySelectorAll('button')).find((b) => b.textContent?.trim() === label)!;
    expect(button('Previous').disabled).toBe(true);
    button('Next').click();
    view.detectChanges();
    expect(table.currentPage).toBe(2);
    expect(element.textContent).toContain('Showing 11–20 of 100 records');
    element.querySelector<HTMLButtonElement>('[aria-label="Page 4"]')!.click();
    view.detectChanges();
    expect(table.currentPage).toBe(4);
    while (table.currentPage < 10) {
      button('Next').click();
      view.detectChanges();
    }
    view.detectChanges();
    expect(button('Next').disabled).toBe(true);
    expect(element.textContent).toContain('Showing 91–100 of 100 records');
    expect(element.querySelector('[aria-current="page"]')?.textContent?.trim()).toBe('10');
  });
  it('renders a partial last page and clamps out-of-range navigation', () => {
    const { view, table, element } = render(23);
    element.querySelector<HTMLButtonElement>('[aria-label="Page 3"]')!.click();
    view.detectChanges();
    expect(table.currentPage).toBe(3);
    expect(element.querySelectorAll('tbody tr').length).toBe(3);
    expect(element.textContent).toContain('Showing 21–23 of 23 records');
    table.changePage(-1);
    expect(table.currentPage).toBe(1);
  });
  it('updates total pages and resets the page using the page-size selector', () => {
    const { view, table, element } = render();
    for (const size of [20, 50, 10]) {
      table.changePage(2);
      const select = element.querySelector('select')!;
      select.value = String(size);
      select.dispatchEvent(new Event('change'));
      view.detectChanges();
      expect(table.currentPage).toBe(1);
      expect(table.totalPages).toBe(100 / size);
      expect(element.querySelectorAll('tbody tr').length).toBe(size);
    }
  });
  it('resets for a new instrument and for a smaller replacement dataset', () => {
    const { view, table } = render();
    table.changePage(7);
    view.componentRef.setInput('symbol', 'MSFT');
    view.detectChanges();
    expect(table.currentPage).toBe(1);
    table.changePage(9);
    view.componentRef.setInput('observations', observations(3));
    view.detectChanges();
    expect(table.currentPage).toBe(1);
    expect(table.visibleRecords.length).toBe(3);
  });
  it('handles empty observations with zero record range and disabled controls', () => {
    const { element, table } = render(0);
    expect(table.visibleRecords).toEqual([]);
    expect(element.textContent).toContain('Showing 0–0 of 0 records');
    expect(element.textContent).toContain('No valid daily closing observations');
    expect(Array.from(element.querySelectorAll('button')).every((b) => b.disabled)).toBe(true);
    expect(element.querySelector('footer')?.textContent).toContain(
      'Source: Alpha Vantage · Daily historical closing prices',
    );
  });
  it('preserves stock, forex and explicit precision formatting', () => {
    const { view, table } = render();
    expect(table.formatValue(1.234567)).toBe('$1.23');
    view.componentRef.setInput('marketType', MarketType.Forex);
    view.componentRef.setInput('symbol', 'EUR/USD');
    view.detectChanges();
    expect(table.formatValue(1.234567)).toBe('1.2346');
    view.componentRef.setInput('symbol', 'USD/JPY');
    view.detectChanges();
    expect(table.formatValue(151.234567)).toBe('151.235');
    view.componentRef.setInput('precisionMode', 'exact');
    view.detectChanges();
    expect(table.formatValue(151.234567)).toBe('151.234567');
  });
});
