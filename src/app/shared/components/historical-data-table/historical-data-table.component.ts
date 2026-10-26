import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { MarketType } from '../../../core/enums/market-type';
import { MarketDataPoint, formatMarketDate, formatMarketValue } from '../../../core/models/market-data';

@Component({
  selector: 'app-historical-data-table',
  standalone: true,
  templateUrl: './historical-data-table.component.html',
})
export class HistoricalDataTableComponent implements OnChanges {
  @Input({ required: true }) observations: readonly MarketDataPoint[] = [];
  @Input({ required: true }) marketType = MarketType.Stock;
  @Input({ required: true }) symbol = '';
  @Input() precisionMode: 'standard' | 'exact' = 'standard';
  @Input() emptyMessage = 'No valid daily closing observations are available.';
  readonly MarketType = MarketType;
  readonly pageSizes = [10, 20, 50];
  currentPage = 1;
  pageSize = 10;
  private records: readonly MarketDataPoint[] = [];
  readonly formatDate = formatMarketDate;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['observations'] || changes['symbol']) {
      // Sort a copy so chart observations retain their original chronological order.
      this.records = [...this.observations].sort((a, b) => b.date.getTime() - a.date.getTime());
      this.currentPage = 1;
    }
  }
  get totalRecords(): number { return this.records.length; }
  get totalPages(): number { return Math.max(1, Math.ceil(this.totalRecords / this.pageSize)); }
  get visibleRecords(): readonly MarketDataPoint[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.records.slice(start, start + this.pageSize);
  }
  get firstRecord(): number { return this.totalRecords ? (this.currentPage - 1) * this.pageSize + 1 : 0; }
  get lastRecord(): number { return Math.min(this.currentPage * this.pageSize, this.totalRecords); }
  get pages(): number[] {
    const start = Math.max(1, Math.min(this.currentPage - 2, this.totalPages - 4));
    return Array.from({ length: Math.min(5, this.totalPages) }, (_, index) => start + index);
  }
  changePage(page: number): void {
    this.currentPage = Math.max(1, Math.min(page, this.totalPages));
  }
  changePageSize(size: number): void {
    if (!this.pageSizes.includes(size)) return;
    this.pageSize = size;
    this.currentPage = 1;
  }
  formatValue(value: number): string {
    return formatMarketValue(value, this.marketType, this.symbol, this.precisionMode);
  }
}
