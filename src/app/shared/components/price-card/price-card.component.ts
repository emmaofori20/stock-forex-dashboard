import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  Instrument,
  MarketLoadState,
  formatMarketDate,
  formatMarketValue,
} from '../../../core/models/market-data';
import { IconComponent } from '../icon/icon.component';
@Component({
  selector: 'app-price-card',
  standalone: true,
  imports: [RouterLink, IconComponent],
  templateUrl: './price-card.component.html',
})
export class PriceCardComponent {
  @Input({ required: true }) instrument!: Instrument;
  @Input({ required: true }) state!: MarketLoadState;
  @Input() link = '/stocks';
  @Output() retry = new EventEmitter<void>();
  formatDate = formatMarketDate;
  formatValue(value: number): string {
    return formatMarketValue(value, this.instrument.marketType, this.instrument.symbol);
  }
}
