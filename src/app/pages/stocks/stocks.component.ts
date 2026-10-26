import { MarketType } from '../../core/enums/market-type';
import { Component, inject } from '@angular/core';
import { MarketDataService } from '../../core/services/market-data.service';
@Component({
  selector: 'app-stocks',
  standalone: false,
  template: `<app-instrument-workspace
    [marketType]="MarketType.Stock"
    [instruments]="marketData.stocks"
  />`,
})
export class StocksComponent {
  readonly MarketType = MarketType;
  readonly marketData = inject(MarketDataService);
}
