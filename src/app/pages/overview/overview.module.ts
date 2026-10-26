import { ModalComponent } from '../../shared/components/modal/modal.component';
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { OverviewComponent } from './overview.component';
import { PriceCardComponent } from '../../shared/components/price-card/price-card.component';
import { MarketChartComponent } from '../../shared/components/market-chart/market-chart.component';
import { IconComponent } from '../../shared/components/icon/icon.component';
@NgModule({
  declarations: [OverviewComponent],
  imports: [
    ModalComponent,
    PriceCardComponent,
    MarketChartComponent,
    IconComponent,
    RouterModule.forChild([
      { path: '', component: OverviewComponent, data: { title: 'Overview' } },
    ]),
  ],
})
export class OverviewModule {}
