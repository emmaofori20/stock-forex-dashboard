import { MarketType } from '../../core/enums/market-type';
import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { BehaviorSubject, tap } from 'rxjs';
import { NotificationService } from '../../core/services/notification.service';
import { notifyMarketFailure } from '../../shared/utils/market-notifications';
import { MarketLoadState } from '../../core/models/market-data';
import { RouterLink } from '@angular/router';
import { MarketDataService } from '../../core/services/market-data.service';
import { PriceCardComponent } from '../../shared/components/price-card/price-card.component';
import { MarketChartComponent } from '../../shared/components/market-chart/market-chart.component';
import { IconComponent } from '../../shared/components/icon/icon.component';
@Component({
  selector: 'app-overview',
  standalone: false,
  templateUrl: './overview.component.html',
})
export class OverviewComponent {
  readonly MarketType = MarketType;
  protected readonly marketData = inject(MarketDataService);
  private notifications = inject(NotificationService);
  detailsOpen = false;
  get errorDetails(): string {
    return `AAPL daily history\n\n${this.cards[0].state().message ?? 'Daily history is unavailable.'}\n\nRetry requests daily closing observations again. No sample prices are substituted when a request fails.`;
  }
  readonly instruments = [...this.marketData.stocks.slice(0, 2), this.marketData.forex[0]];
  readonly cards = this.instruments.map((instrument) => {
    const requests = new BehaviorSubject(instrument);
    return {
      instrument,
      requests,
      state: toSignal(
        this.marketData
          .watchMarketHistory(requests)
          .pipe(tap((state) => notifyMarketFailure(this.notifications, state))),
        {
          initialValue: { status: 'loading' } as MarketLoadState,
        },
      ),
    };
  });
  readonly markets = [
    {
      path: '/stocks',
      icon: 'stocks',
      title: 'Explore equities',
      description: 'A closer look at the companies you follow.',
    },
    {
      path: '/forex',
      icon: 'forex',
      title: 'Follow global currencies',
      description: "Put the world's currency pairs in perspective.",
    },
  ];
}
