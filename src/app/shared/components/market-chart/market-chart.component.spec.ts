import { MarketType } from '../../../core/enums/market-type';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { MarketChartComponent } from './market-chart.component';
import { MarketDataPoint } from '../../../core/models/market-data';

describe('MarketChartComponent D3 rendering', () => {
  let notifyResize: () => void;
  let disconnect: ReturnType<typeof vi.fn>;
  let chartWidth: number;
  const sample: readonly MarketDataPoint[] = [
    { date: new Date('2026-09-01T00:00:00Z'), value: 100 },
    { date: new Date('2026-09-02T00:00:00Z'), value: 110 },
    { date: new Date('2026-09-03T00:00:00Z'), value: 105 },
  ];
  beforeEach(async () => {
    chartWidth = 800;
    disconnect = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          notifyResize = callback;
        }
        observe() {}
        disconnect = disconnect;
      },
    );
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: chartWidth,
      bottom: 320,
      width: chartWidth,
      height: 320,
      toJSON: () => ({}),
    }));
    await TestBed.configureTestingModule({ imports: [MarketChartComponent] }).compileComponents();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  async function render(data: readonly MarketDataPoint[] = sample) {
    const fixture = TestBed.createComponent(MarketChartComponent);
    fixture.componentRef.setInput('data', data);
    fixture.componentRef.setInput('symbol', 'AAPL');
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }
  it('draws one genuine line and area with readable dates and price labels', async () => {
    const { element } = await render();
    expect(element.querySelectorAll('svg').length).toBe(1);
    expect(element.querySelector('path.price-line')?.getAttribute('d')).toMatch(/^M/);
    expect(element.querySelector('path.price-area')?.getAttribute('d')).toContain('Z');
    expect(element.querySelector('svg')?.textContent).toContain('Sep 01');
    expect(element.querySelector('svg')?.textContent).toContain('$');
    expect(element.querySelector('desc')?.textContent).toContain('Daily historical closing data');
  });
  it('selects the nearest point on pointer movement and hides the tooltip on leave', async () => {
    const { element } = await render();
    const overlay = element.querySelector('.chart-interaction')!;
    overlay.dispatchEvent(new MouseEvent('pointermove', { clientX: 424, clientY: 120 }));
    expect(element.querySelector('.chart-tooltip')?.textContent).toContain('Sep 2, 2026');
    expect(element.querySelector('.chart-tooltip')?.textContent).toContain('$110.00');
    expect(overlay.getAttribute('aria-valuenow')).toBe('1');
    expect(element.querySelector('.chart-focus')?.getAttribute('display')).toBeNull();
    expect(element.querySelector('.chart-focus circle')?.getAttribute('cx')).toBe('424');
    overlay.dispatchEvent(new Event('pointerleave'));
    expect(element.querySelector('.chart-focus')?.getAttribute('display')).toBe('none');
  });
  it('supports keyboard inspection, exact forex formatting and endpoints', async () => {
    const { fixture, element } = await render(
      sample.map((point) => ({ ...point, value: point.value / 100 })),
    );
    fixture.componentRef.setInput('marketType', MarketType.Forex);
    fixture.componentRef.setInput('symbol', 'EUR/USD');
    fixture.detectChanges();
    const overlay = element.querySelector('.chart-interaction')!;
    overlay.dispatchEvent(new FocusEvent('focus'));
    overlay.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(element.querySelector('.chart-tooltip')?.textContent).toContain('1.1000');
    overlay.dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }));
    expect(overlay.getAttribute('aria-valuenow')).toBe('2');
    overlay.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home' }));
    expect(overlay.getAttribute('aria-valuenow')).toBe('0');
    overlay.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(element.querySelector('.chart-focus')?.getAttribute('display')).toBe('none');
  });
  it('renders empty and invalid datasets without stale paths', async () => {
    const { fixture, element } = await render();
    fixture.componentRef.setInput('data', []);
    fixture.detectChanges();
    expect(element.textContent).toContain('No chart data available');
    expect(element.querySelector('path.price-line')).toBeNull();
    fixture.componentRef.setInput('data', [
      { date: new Date('bad'), value: 1 },
      { date: new Date(), value: NaN },
    ]);
    fixture.detectChanges();
    expect(element.textContent).toContain('No chart data available');
    expect(element.querySelector('path.price-line')).toBeNull();
  });
  it('normalizes unsorted and duplicate dates without mutating input', async () => {
    const input = [sample[2], sample[0], sample[1], { ...sample[1], value: 112 }];
    const { element } = await render(input);
    expect(input[0]).toBe(sample[2]);
    expect(element.textContent).toContain('3 daily observations');
    element
      .querySelector('.chart-interaction')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(element.querySelector('.chart-tooltip')?.textContent).toContain('$112.00');
  });
  it('handles a single observation and a flat series without invalid geometry', async () => {
    const { fixture, element } = await render([sample[0]]);
    expect(element.querySelector('path.price-line')?.getAttribute('d')).not.toMatch(/NaN|Infinity/);
    expect(element.querySelector('svg > circle')).toBeTruthy();
    fixture.componentRef.setInput(
      'data',
      sample.map((point) => ({ ...point, value: 0 })),
    );
    fixture.detectChanges();
    expect(element.querySelector('path.price-line')?.getAttribute('d')).not.toMatch(/NaN|Infinity/);
  });
  it('redraws for sidebar expansion and collapse without a window resize', async () => {
    const { element } = await render();
    for (const width of [976, 800, 976]) {
      chartWidth = width;
      notifyResize();
      expect(element.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 ' + width + ' 320');
      expect(element.querySelectorAll('path.price-line').length).toBe(1);
      expect(element.querySelector('path.price-line')?.getAttribute('d')).not.toMatch(
        /NaN|Infinity/,
      );
    }
  });
  it('redraws at mobile widths without duplicate elements and disconnects on destroy', async () => {
    const { fixture, element } = await render();
    chartWidth = 300;
    notifyResize();
    expect(element.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 300 320');
    for (let i = 0; i < 3; i++) {
      fixture.componentRef.setInput(
        'data',
        sample.map((point) => ({ ...point, value: point.value + i })),
      );
      fixture.detectChanges();
      notifyResize();
      expect(element.querySelectorAll('path.price-line').length).toBe(1);
      expect(element.querySelectorAll('.chart-interaction').length).toBe(1);
      expect(element.querySelectorAll('.chart-tooltip').length).toBe(1);
    }
    const oldOverlay = element.querySelector('.chart-interaction')!;
    fixture.destroy();
    expect(disconnect).toHaveBeenCalledOnce();
    expect(element.querySelector('svg')?.childElementCount).toBe(0);
    expect((oldOverlay as Element & { __on?: unknown }).__on).toBeUndefined();
  });
});

describe('Market chart precision', () => {
  it('preserves additional provider close precision during inspection', async () => {
    await TestBed.configureTestingModule({ imports: [MarketChartComponent] }).compileComponents();
    const view = TestBed.createComponent(MarketChartComponent);
    view.componentRef.setInput('symbol', 'AAPL');
    view.componentRef.setInput('data', [
      { date: new Date('2026-10-23T00:00:00Z'), value: 347.725 },
    ]);
    view.detectChanges();
    const element = view.nativeElement as HTMLElement;
    const overlay = element.querySelector('.chart-interaction')!;
    overlay.dispatchEvent(new FocusEvent('focus'));
    expect(element.querySelector('.chart-tooltip')?.textContent).toContain('$347.725');
    expect(overlay.getAttribute('aria-valuetext')).toContain('$347.725');
  });
});
