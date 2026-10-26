import { MarketType } from '../../core/enums/market-type';
import { Component, inject } from '@angular/core';
import { MarketDataService } from '../../core/services/market-data.service';
@Component({
  selector: 'app-forex',
  standalone: false,
  template: `<app-instrument-workspace
    [marketType]="MarketType.Forex"
    [instruments]="marketData.forex"
  />`,
})
export class ForexComponent {
  readonly MarketType = MarketType;
  readonly marketData = inject(MarketDataService);
}
