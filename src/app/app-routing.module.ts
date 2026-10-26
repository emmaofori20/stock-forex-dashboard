import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DashboardLayoutComponent } from './layout/dashboard-layout/dashboard-layout.component';
const routes: Routes = [
  {
    path: '',
    component: DashboardLayoutComponent,
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadChildren: () =>
          import('./pages/overview/overview.module').then((m) => m.OverviewModule),
      },
      {
        path: 'stocks',
        loadChildren: () => import('./pages/stocks/stocks.module').then((m) => m.StocksModule),
      },
      {
        path: 'forex',
        loadChildren: () => import('./pages/forex/forex.module').then((m) => m.ForexModule),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
@NgModule({
  imports: [RouterModule.forRoot(routes, { scrollPositionRestoration: 'enabled' })],
  exports: [RouterModule],
})
export class AppRoutingModule {}
