import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ForexComponent } from './forex.component';
import { InstrumentWorkspaceComponent } from '../../shared/components/instrument-workspace/instrument-workspace.component';
@NgModule({
  declarations: [ForexComponent],
  imports: [
    InstrumentWorkspaceComponent,
    RouterModule.forChild([{ path: '', component: ForexComponent, data: { title: 'Forex' } }]),
  ],
})
export class ForexModule {}
