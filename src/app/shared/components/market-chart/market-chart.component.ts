import { MarketType } from '../../../core/enums/market-type';
import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  ViewChild,
  inject,
} from '@angular/core';
import {
  area,
  axisBottom,
  axisLeft,
  bisector,
  extent,
  line,
  pointer,
  scaleLinear,
  scaleTime,
  select,
  utcFormat,
} from 'd3';
import {
  MarketDataPoint,
  formatMarketDate,
  formatMarketValue,
} from '../../../core/models/market-data';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-market-chart',
  standalone: true,
  imports: [IconComponent],
  templateUrl: './market-chart.component.html',
})
export class MarketChartComponent implements OnChanges, AfterViewInit, OnDestroy {
  @Input() data: readonly MarketDataPoint[] = [];
  @Input() title = 'Market performance';
  @Input() symbol = '';
  @Input() marketType = MarketType.Stock;
  @Input() subtitle = 'Alpha Vantage / Daily closing observations, not live streaming prices.';
  @ViewChild('container', { static: true }) private container!: ElementRef<HTMLDivElement>;
  @ViewChild('svg', { static: true }) private svg!: ElementRef<SVGSVGElement>;
  protected points: readonly MarketDataPoint[] = [];
  private zone = inject(NgZone);
  private observer?: ResizeObserver;
  private ready = false;
  private width = 0;

  ngOnChanges(): void {
    // Normalize a copy; never sort or modify the parent data. Last value wins for duplicate dates.
    const unique = new Map<number, MarketDataPoint>();
    for (const point of this.data ?? []) {
      if (
        point.date instanceof Date &&
        Number.isFinite(+point.date) &&
        Number.isFinite(point.value)
      )
        unique.set(+point.date, point);
    }
    this.points = [...unique.values()].sort((a, b) => +a.date - +b.date);
    if (this.ready) this.updateChart();
  }
  ngAfterViewInit(): void {
    this.ready = true;
    this.zone.runOutsideAngular(() => {
      if (typeof ResizeObserver !== 'undefined') {
        this.observer = new ResizeObserver(() => {
          const width = this.container.nativeElement.getBoundingClientRect().width;
          if (width !== this.width) this.updateChart();
        });
        this.observer.observe(this.container.nativeElement);
      }
      this.updateChart();
    });
  }
  ngOnDestroy(): void {
    this.observer?.disconnect();
    select(this.svg.nativeElement).selectAll('*').on('.chart', null).remove();
  }
  private updateChart(): void {
    const svg = select(this.svg.nativeElement);
    // Remove old handlers before rebuilding so updates cannot accumulate charts or listeners.
    svg.selectAll('*').on('.chart', null).remove();
    if (!this.points.length) return;
    const data = this.points;
    const measured = this.container.nativeElement.getBoundingClientRect().width;
    this.width = measured;
    const width = measured || 640;
    const height = 320;
    const margin = {
      top: 22,
      right: 20,
      bottom: 42,
      left: this.marketType === MarketType.Stock ? 68 : 76,
    };
    const bottom = height - margin.bottom;
    const plotWidth = Math.max(1, width - margin.left - margin.right);
    const [first, last] = extent(data, (point) => point.date) as [Date, Date];
    const [low, high] = extent(data, (point) => point.value) as [number, number];
    const day = 86400000;
    const x = scaleTime()
      .domain(+first === +last ? [new Date(+first - day), new Date(+last + day)] : [first, last])
      .range([margin.left, width - margin.right]);
    const padding = (high - low) * 0.15 || Math.abs(low) * 0.01 || 1;
    const y = scaleLinear()
      .domain([low - padding, high + padding])
      .nice(5)
      .range([bottom, margin.top]);
    const formatValue = (value: number) => formatMarketValue(value, this.marketType, this.symbol);
    const formatInspectionValue = (value: number) =>
      formatMarketValue(value, this.marketType, this.symbol, 'exact');
    svg.attr('viewBox', `0 0 ${width} ${height}`).attr('height', height);
    svg.append('title').text(`${this.title}: ${this.symbol}`);
    svg
      .append('desc')
      .text(
        `Daily historical closing data. ${data.length} observations from ${formatMarketDate(first)} to ${formatMarketDate(last)}. Hover or focus the chart and use arrow keys to inspect values. The vertical axis is scaled to the data range.`,
      );
    const grid = svg
      .append('g')
      .attr('aria-hidden', 'true')
      .attr('transform', `translate(${margin.left},0)`)
      .call(
        axisLeft(y)
          .ticks(5)
          .tickSize(-plotWidth)
          .tickFormat(() => ''),
      );
    grid.select('.domain').remove();
    grid.selectAll('line').attr('stroke', 'var(--color-border)').attr('stroke-dasharray', '3 4');
    svg
      .append('path')
      .datum(data)
      .attr('class', 'price-area')
      .attr('aria-hidden', 'true')
      .attr('fill', 'var(--color-primary-light)')
      .attr('fill-opacity', 0.7)
      .attr(
        'd',
        area<MarketDataPoint>()
          .x((point) => x(point.date))
          .y0(bottom)
          .y1((point) => y(point.value)),
      );
    svg
      .append('path')
      .datum(data)
      .attr('class', 'price-line')
      .attr('aria-hidden', 'true')
      .attr('fill', 'none')
      .attr('stroke', 'var(--color-primary)')
      .attr('stroke-width', 2.5)
      .attr('stroke-linejoin', 'round')
      .attr('stroke-linecap', 'round')
      .attr(
        'd',
        line<MarketDataPoint>()
          .x((point) => x(point.date))
          .y((point) => y(point.value)),
      );
    // Explicit observed dates avoid duplicate labels and keep tiny containers readable.
    const tickCount = Math.max(2, Math.floor(plotWidth / 100));
    const dateTicks = data
      .filter((_, index) => index % Math.ceil(data.length / tickCount) === 0)
      .map((point) => point.date);
    const xAxis = svg
      .append('g')
      .attr('aria-hidden', 'true')
      .attr('transform', `translate(0,${bottom})`)
      .call(
        axisBottom(x)
          .tickValues(dateTicks)
          .tickFormat((date) => utcFormat('%b %d')(new Date(+date)))
          .tickSize(0)
          .tickPadding(14),
      );
    const yAxis = svg
      .append('g')
      .attr('aria-hidden', 'true')
      .attr('transform', `translate(${margin.left},0)`)
      .call(
        axisLeft(y)
          .ticks(5)
          .tickFormat((value) => formatValue(+value))
          .tickSize(0)
          .tickPadding(10),
      );
    for (const axis of [xAxis, yAxis]) {
      axis.select('.domain').remove();
      axis
        .selectAll('text')
        .attr('fill', 'var(--color-body)')
        .attr('font-size', 11)
        .attr('font-family', 'var(--font-sans)');
    }
    if (data.length === 1)
      svg
        .append('circle')
        .attr('cx', x(first))
        .attr('cy', y(data[0].value))
        .attr('r', 4)
        .attr('fill', 'var(--color-primary)');
    const focus = svg
      .append('g')
      .attr('class', 'chart-focus')
      .attr('display', 'none')
      .attr('pointer-events', 'none')
      .attr('aria-hidden', 'true');
    const guide = focus
      .append('line')
      .attr('y1', margin.top)
      .attr('y2', bottom)
      .attr('stroke', 'var(--color-muted)')
      .attr('stroke-dasharray', '4 4');
    const dot = focus
      .append('circle')
      .attr('r', 5)
      .attr('fill', 'var(--color-primary)')
      .attr('stroke', 'var(--color-surface)')
      .attr('stroke-width', 2);
    const tooltip = focus.append('g').attr('class', 'chart-tooltip');
    const tooltipWidth = Math.min(188, width - 16);
    tooltip
      .append('rect')
      .attr('width', tooltipWidth)
      .attr('height', 64)
      .attr('rx', 8)
      .attr('fill', 'var(--color-sidebar)');
    const dateLabel = tooltip
      .append('text')
      .attr('x', 12)
      .attr('y', 23)
      .attr('fill', 'var(--color-sidebar-muted)')
      .attr('font-size', 11);
    const valueLabel = tooltip
      .append('text')
      .attr('x', 12)
      .attr('y', 46)
      .attr('fill', 'var(--color-surface)')
      .attr('font-size', 14)
      .attr('font-weight', 600);
    let activeIndex = 0;
    const overlay = svg
      .append('rect')
      .attr('class', 'chart-interaction')
      .attr('x', margin.left)
      .attr('y', margin.top)
      .attr('width', plotWidth)
      .attr('height', bottom - margin.top)
      .attr('fill', 'transparent')
      .attr('tabindex', 0)
      .attr('role', 'slider')
      .attr('aria-label', `${this.symbol} daily observations. Use arrow keys to inspect.`)
      .attr('aria-valuemin', 0)
      .attr('aria-valuemax', data.length - 1)
      .attr('aria-valuenow', 0)
      .attr(
        'aria-valuetext',
        `${formatMarketDate(data[0].date)}: ${formatInspectionValue(data[0].value)}`,
      )
      .style('touch-action', 'pan-y');
    const showTooltip = (index: number) => {
      activeIndex = index;
      const point = data[index],
        px = x(point.date),
        py = y(point.value);
      focus.attr('display', null);
      guide.attr('x1', px).attr('x2', px);
      dot.attr('cx', px).attr('cy', py);
      const tx = Math.max(8, Math.min(width - tooltipWidth - 8, px + 12));
      const ty = py > 100 ? py - 78 : py + 16;
      tooltip.attr('transform', `translate(${tx},${Math.min(bottom - 68, ty)})`);
      dateLabel.text(formatMarketDate(point.date));
      valueLabel.text(formatInspectionValue(point.value));
      overlay
        .attr('aria-valuenow', index)
        .attr(
          'aria-valuetext',
          `${formatMarketDate(point.date)}: ${formatInspectionValue(point.value)}`,
        );
    };
    const hideTooltip = () => focus.attr('display', 'none');
    const findNearestIndex = bisector<MarketDataPoint, number>((point) => +point.date).center;
    overlay
      .on('pointermove.chart pointerdown.chart', (event: PointerEvent) => {
        const [px] = pointer(event, this.svg.nativeElement);
        showTooltip(findNearestIndex(data, +x.invert(px)));
      })
      .on('pointerleave.chart', () => {
        if (document.activeElement !== overlay.node()) hideTooltip();
      })
      .on('focus.chart', () => showTooltip(activeIndex))
      .on('blur.chart', hideTooltip)
      .on('keydown.chart', (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          hideTooltip();
          return;
        }
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        let nextIndex = activeIndex;
        if (event.key === 'Home') nextIndex = 0;
        else if (event.key === 'End') nextIndex = data.length - 1;
        else nextIndex += event.key === 'ArrowRight' ? 1 : -1;
        showTooltip(Math.max(0, Math.min(data.length - 1, nextIndex)));
      });
  }
}
