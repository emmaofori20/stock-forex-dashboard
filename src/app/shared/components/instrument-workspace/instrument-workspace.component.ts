import { MarketType } from '../../../core/enums/market-type';
import { Component, Input, OnInit, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Subject, tap } from 'rxjs';
import { NotificationService } from '../../../core/services/notification.service';
import { notifyMarketFailure } from '../../utils/market-notifications';
import { ModalComponent } from '../modal/modal.component';
import { FormsModule } from '@angular/forms';
import {
  Instrument,
  MarketLoadState,
  formatMarketDate,
  formatMarketValue,
} from '../../../core/models/market-data';
import { MarketDataService } from '../../../core/services/market-data.service';
import { MarketChartComponent } from '../market-chart/market-chart.component';
@Component({
  selector: 'app-instrument-workspace',
  standalone: true,
  imports: [FormsModule, MarketChartComponent, ModalComponent],
  templateUrl: './instrument-workspace.component.html',
})
export class InstrumentWorkspaceComponent implements OnInit {
  @Input({ required: true }) instruments: readonly Instrument[] = [];
  @Input() marketType = MarketType.Stock;
  readonly MarketType = MarketType;
  protected readonly marketData = inject(MarketDataService);
  private notifications = inject(NotificationService);
  detailsOpen = false;
  get errorDetails(): string {
    return `${this.selectedSymbol} daily history\n\n${this.state().message ?? 'Daily history is unavailable.'}\n\nRetry requests daily closing observations again. No sample prices are substituted when a request fails.`;
  }
  private requests = new Subject<Instrument>();
  readonly state = toSignal(
    this.marketData
      .watchMarketHistory(this.requests)
      .pipe(tap((state) => notifyMarketFailure(this.notifications, state))),
    {
      initialValue: { status: 'loading' } as MarketLoadState,
    },
  );
  selectedSymbol = '';
  ngOnInit(): void {
    if (this.instruments[0]) this.selectInstrument(this.instruments[0].symbol);
  }
  selectInstrument(symbol: string): void {
    this.detailsOpen = false;
    this.selectedSymbol = symbol;
    const instrument = this.selected;
    if (instrument) this.requests.next(instrument);
  }
  retry(): void {
    const instrument = this.selected;
    if (instrument) this.requests.next(instrument);
  }
  get selected(): Instrument | undefined {
    return this.instruments.find((item) => item.symbol === this.selectedSymbol);
  }
  get marketHistory() {
    return this.state().marketHistory;
  }
  get history() {
    return this.marketHistory?.observations ?? [];
  }
  formatValue(value: number): string {
    return formatMarketValue(value, this.marketType, this.selectedSymbol);
  }
  formatDate = formatMarketDate;
  formatChange(value: number): string {
    return (value >= 0 ? '+' : '') + value.toFixed(2) + '%';
  }
}
