import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { StocksComponent } from './stocks.component';
import { InstrumentWorkspaceComponent } from '../../shared/components/instrument-workspace/instrument-workspace.component';
@NgModule({
  declarations: [StocksComponent],
  imports: [
    InstrumentWorkspaceComponent,
    RouterModule.forChild([{ path: '', component: StocksComponent, data: { title: 'Stocks' } }]),
  ],
})
export class StocksModule {}
